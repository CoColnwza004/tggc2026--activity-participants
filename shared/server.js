// Server-side logic shared by both Workers (participant + staff). Storage: Cloudflare D1 (binding DB).
// The schema is created on first use, and a random master key is generated and kept in D1,
// so the only setup is binding the database and setting the two PINs.
import { BOOTH_IDS, REQUIRED } from "./event.js";
import { b64u, hmac, codeFor, windowAt } from "./otp.js";

// one row per ticket handed in at the prize counter (PRIMARY KEY = one ticket per passport)
const REDEEMS = [
  `CREATE TABLE IF NOT EXISTS redeems (pid TEXT PRIMARY KEY, at INTEGER NOT NULL, staff TEXT)`,
  `CREATE INDEX IF NOT EXISTS redeems_at ON redeems (at)`,
];
// running totals, so booth screens and the dashboard read a handful of rows instead of counting every stamp
const COUNTS = [
  `CREATE TABLE IF NOT EXISTS counts (k TEXT PRIMARY KEY, n INTEGER NOT NULL) WITHOUT ROWID`,
  `CREATE TABLE IF NOT EXISTS completed (pid TEXT PRIMARY KEY, at INTEGER NOT NULL) WITHOUT ROWID`,
];
// booth details edited on the admin site (override shared/event.js at runtime) + booth logos
const BOOTH_CFG = [
  `CREATE TABLE IF NOT EXISTS booth_cfg (id TEXT PRIMARY KEY, th TEXT, en TEXT, place TEXT, icon TEXT, descr TEXT, logo TEXT, updated INTEGER NOT NULL, staff TEXT)`,
  `CREATE TABLE IF NOT EXISTS booth_logo (id TEXT PRIMARY KEY, v TEXT NOT NULL, mime TEXT NOT NULL, data TEXT NOT NULL)`,
];
// bump when the derived tables change; also rebuilt when the booth list or REQUIRED changes
const SCHEMA_V = `5|${REQUIRED}|${BOOTH_IDS.join(",")}`;
export const BUCKET = 15 * 60e3; // stamps-over-time counters: 15-minute buckets (key "t:<ms / BUCKET>")
const IN_BOOTHS = BOOTH_IDS.map(() => "?").join(",");
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)`,
  `CREATE TABLE IF NOT EXISTS passports (id TEXT PRIMARY KEY, name TEXT NOT NULL, school TEXT, role TEXT, phone TEXT, nkey TEXT UNIQUE, created INTEGER NOT NULL, n INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS stamps (pid TEXT NOT NULL, booth TEXT NOT NULL, at INTEGER NOT NULL, via TEXT, PRIMARY KEY (pid, booth)) WITHOUT ROWID`,
  `CREATE INDEX IF NOT EXISTS stamps_booth ON stamps (booth, at)`,
  ...REDEEMS,
  ...COUNTS,
  ...BOOTH_CFG,
  `CREATE TABLE IF NOT EXISTS attempts (k TEXT PRIMARY KEY, n INTEGER NOT NULL, until INTEGER NOT NULL)`,
];

// ---------- http helpers ----------
export const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });
export const fail = (status, code, msg) => json({ ok: false, error: code, message: msg }, status);
export async function body(req) {
  try { return await req.json(); } catch { return {}; }
}
export const clientIp = (req) => req.headers.get("cf-connecting-ip") || "local";

// ---------- bootstrap ----------
let MASTER = null;

async function setup(env) {
  const db = env.DB;
  const stmts = SCHEMA.map((s) => db.prepare(s));
  stmts.push(db.prepare("INSERT OR IGNORE INTO meta (k, v) VALUES ('master', ?)").bind(b64u.enc(crypto.getRandomValues(new Uint8Array(32)))));
  await db.batch(stmts);
}

/**
 * Adds tables missing from older databases and rebuilds the running totals from the real data.
 * Runs once per schema version (checked with one tiny read per Worker instance), in one transaction.
 */
async function migrate(env) {
  const db = env.DB;
  // passports.n (stamps per passport, for the dashboard's distribution) was added later
  let hasN = true;
  try { await db.prepare("SELECT n FROM passports LIMIT 0").all(); } catch { hasN = false; }
  await db.batch([
    ...[...REDEEMS, ...COUNTS, ...BOOTH_CFG].map((q) => db.prepare(q)),
    ...(hasN ? [] : [db.prepare("ALTER TABLE passports ADD COLUMN n INTEGER NOT NULL DEFAULT 0")]),
    ...rebuildTotals(db),
    db.prepare("INSERT INTO meta (k, v) VALUES ('schema', ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v").bind(SCHEMA_V),
  ]);
}

/** statements that recompute every running total from the real rows (put them in the same batch as the change) */
export function rebuildTotals(db) {
  return [
    db.prepare(`UPDATE passports SET n = (SELECT COUNT(*) FROM stamps s WHERE s.pid = passports.id AND s.booth IN (${IN_BOOTHS}))`).bind(...BOOTH_IDS),
    db.prepare("DELETE FROM counts"),
    db.prepare("DELETE FROM completed"),
    db.prepare("INSERT INTO counts (k, n) SELECT 'b:' || booth, COUNT(*) FROM stamps GROUP BY booth"),
    db.prepare(`INSERT INTO counts (k, n) SELECT 't:' || CAST(at / ${BUCKET} AS INTEGER), COUNT(*) FROM stamps GROUP BY CAST(at / ${BUCKET} AS INTEGER)`),
    db.prepare("INSERT INTO counts (k, n) SELECT 'p', COUNT(*) FROM passports"),
    db.prepare("INSERT INTO counts (k, n) SELECT 'r:' || COALESCE(role, ''), COUNT(*) FROM passports GROUP BY role"),
    db.prepare(`INSERT INTO completed (pid, at) SELECT pid, MAX(at) FROM stamps WHERE booth IN (${IN_BOOTHS}) GROUP BY pid HAVING COUNT(*) >= ?`).bind(...BOOTH_IDS, REQUIRED),
    db.prepare("INSERT INTO counts (k, n) SELECT 'done', COUNT(*) FROM completed"),
    db.prepare("INSERT INTO counts (k, n) SELECT 'rd', COUNT(*) FROM redeems"),
  ];
}

export async function master(env) {
  if (MASTER) return MASTER;
  let m = {};
  try {
    const { results } = await env.DB.prepare("SELECT k, v FROM meta WHERE k IN ('master', 'schema')").all();
    m = Object.fromEntries(results.map((r) => [r.k, r.v]));
  } catch { /* no tables yet */ }
  if (!m.master) {
    await setup(env);
    m.master = (await env.DB.prepare("SELECT v FROM meta WHERE k = 'master'").first()).v;
  }
  if (m.schema !== SCHEMA_V) await migrate(env);
  MASTER = b64u.dec(m.master);
  return MASTER;
}

// ---------- running totals ----------
/**
 * Counter bump that only applies when the statement just before it (in the same batch = same transaction)
 * changed a row, so a record and its total can never drift apart, even if a request dies halfway.
 */
export const bumpIfChanged = (env, k, d = 1) =>
  env.DB.prepare("INSERT INTO counts (k, n) SELECT ?1, ?2 WHERE changes() > 0 ON CONFLICT (k) DO UPDATE SET n = n + ?2").bind(k, d);
/** run `stmt`; if it changed a row, bump each key in the same transaction → was a row changed? */
export async function writeCounted(env, stmt, keys, d = 1) {
  const res = await env.DB.batch([stmt, ...keys.map((k) => bumpIfChanged(env, k, d))]);
  return res[0].meta.changes > 0;
}
export async function readCounts(env, keys) {
  const q = keys ? `SELECT k, n FROM counts WHERE k IN (${keys.map(() => "?").join(",")})` : "SELECT k, n FROM counts";
  const { results } = await env.DB.prepare(q).bind(...(keys || [])).all();
  return Object.fromEntries(results.map((r) => [r.k, r.n]));
}

// ---------- secrets & tokens ----------
const sig = async (env, msg, len = 22) => b64u.enc(await hmac(await master(env), msg)).slice(0, len);

const SECRETS = new Map();
export async function boothSecret(env, booth) {
  let v = SECRETS.get(booth);
  if (!v) { v = b64u.enc(await hmac(await master(env), "booth:" + booth)); SECRETS.set(booth, v); }
  return v;
}
export const passToken = (env, id) => sig(env, "pass:" + id);

/** header x-pass: "<id>.<token>" → passport id or null */
export async function passFromReq(env, req) {
  const h = req.headers.get("x-pass") || "";
  const [id, tok] = h.split(".");
  if (!id || !tok || !/^G[0-9A-Z]{6}$/.test(id)) return null;
  return (await passToken(env, id)) === tok ? id : null;
}

export async function staffToken(env, role, name, hours = 18) {
  const exp = Date.now() + hours * 3600e3;
  const pin = role === "admin" ? env.ADMIN_PIN : env.STAFF_PIN;
  const n = encodeURIComponent(String(name).slice(0, 40)).replace(/\./g, "%2E"); // cut before encoding: a cut inside a %XX escape breaks decoding
  return `${role}.${exp}.${n}.${await sig(env, `staff:${role}:${exp}:${n}:${pin}`)}`;
}
/** Authorization: Bearer <token> → {role, name} or null */
export async function staffFromReq(env, req) {
  const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const [role, exp, n, s] = t.split(".");
  if (!s || (role !== "staff" && role !== "admin") || +exp < Date.now()) return null;
  const pin = role === "admin" ? env.ADMIN_PIN : env.STAFF_PIN;
  if (!pin) return null;
  if ((await sig(env, `staff:${role}:${exp}:${n}:${pin}`)) !== s) return null;
  let nm = "เจ้าหน้าที่";
  try { nm = decodeURIComponent(n); } catch { /* keep default */ }
  return { role, name: nm };
}

// ---------- rate limiting (fixed window, stored in D1) ----------
export async function isLimited(env, key, max) {
  const r = await env.DB.prepare("SELECT n FROM attempts WHERE k = ? AND until > ?").bind(key, Date.now()).first();
  return !!r && r.n >= max;
}
export async function bump(env, key, windowSec) {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO attempts (k, n, until) VALUES (?1, 1, ?2)
     ON CONFLICT (k) DO UPDATE SET n = CASE WHEN until < ?3 THEN 1 ELSE n + 1 END,
                                   until = CASE WHEN until < ?3 THEN ?2 ELSE until END`
  ).bind(key, now + windowSec * 1000, now).run();
}

/** count a failed attempt and return the count in this window (one round trip) */
export async function bumpCount(env, key, windowSec) {
  const now = Date.now();
  const r = await env.DB.prepare(
    `INSERT INTO attempts (k, n, until) VALUES (?1, 1, ?2)
     ON CONFLICT (k) DO UPDATE SET n = CASE WHEN until < ?3 THEN 1 ELSE n + 1 END,
                                   until = CASE WHEN until < ?3 THEN ?2 ELSE until END
     RETURNING n`
  ).bind(key, now + windowSec * 1000, now).first();
  return r ? r.n : 1;
}

// ---------- booth code verification ----------
const LATE_WINDOWS = 20; // QR scanned while offline is accepted up to ~10 min later

/**
 * p = parsed payload {booth, win|null, code}; clientAt = when the participant scanned (server clock, ms)
 * QR codes carry their own window (from the booth device's server-synced clock).
 * Typed codes have no window: check the windows around the scan time.
 */
export async function verifyCode(env, p, clientAt) {
  const now = Date.now();
  const nowWin = windowAt(now);
  const secret = await boothSecret(env, p.booth);
  if (p.win != null) {
    if (p.win > nowWin + 2 || p.win < nowWin - LATE_WINDOWS) return false;
    return (await codeFor(secret, p.booth, p.win)) === p.code;
  }
  const at = Math.min(now, Math.max(now - LATE_WINDOWS * 30e3, clientAt || now));
  const base = windowAt(at);
  for (const w of [base, base - 1, base + 1, base - 2, base + 2]) {
    if ((await codeFor(secret, p.booth, w)) === p.code) return true;
  }
  return false;
}

// ---------- passport ----------
const ALPHA = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function newId() {
  const r = crypto.getRandomValues(new Uint8Array(6));
  let s = "G";
  for (const x of r) s += ALPHA[x & 31];
  return s;
}
export const normName = (s) => String(s || "").normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
export const clean = (s, n = 120) => String(s || "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);

// the three reads that make up a passport's state; appended to write batches so a write + its result is one round trip
const stateQueries = (db, pid) => [
  db.prepare("SELECT id, name, school, role, created FROM passports WHERE id = ?").bind(pid),
  db.prepare("SELECT booth, at, via FROM stamps WHERE pid = ?").bind(pid),
  db.prepare("SELECT at, staff FROM redeems WHERE pid = ?").bind(pid),
];
function toState([p, st, dr]) {
  const passport = p.results[0];
  if (!passport) return null;
  const stamps = {};
  for (const s of st.results) stamps[s.booth] = s.at;
  const d = dr.results[0];
  return { passport, stamps, redeem: d ? { at: d.at, by: d.staff || null } : null };
}
export async function passportState(env, pid) {
  return toState(await env.DB.batch(stateQueries(env.DB, pid)));
}

/**
 * Record a stamp and return the passport, in ONE transaction / ONE round trip:
 * stamp (only if the passport exists and, with limitKey, the code-attempt limit is not hit) → booth total →
 * 15-min total → the passport's own count → "completed" the first time it reaches REQUIRED → fresh state.
 * Every total only moves if the step before it changed a row, so nothing can drift even if a request dies.
 */
export async function stampAndState(env, pid, booth, at, via, { limitKey = null, limitMax = 15 } = {}) {
  const db = env.DB, now = Date.now();
  const guard = limitKey ? " AND NOT EXISTS (SELECT 1 FROM attempts WHERE k = ?5 AND until > ?6 AND n >= ?7)" : "";
  const ins = db.prepare(`INSERT OR IGNORE INTO stamps (pid, booth, at, via) SELECT ?1, ?2, ?3, ?4
                           WHERE EXISTS (SELECT 1 FROM passports WHERE id = ?1)${guard}`);
  const res = await db.batch([
    db.prepare("SELECT n FROM attempts WHERE k = ? AND until > ?").bind(limitKey || "", now),
    limitKey ? ins.bind(pid, booth, at, via, limitKey, now, limitMax) : ins.bind(pid, booth, at, via),
    bumpIfChanged(env, "b:" + booth),
    bumpIfChanged(env, "t:" + Math.floor(at / BUCKET)),
    db.prepare("UPDATE passports SET n = n + 1 WHERE id = ? AND changes() > 0").bind(pid),
    db.prepare("INSERT OR IGNORE INTO completed (pid, at) SELECT ?1, ?2 WHERE changes() > 0 AND (SELECT n FROM passports WHERE id = ?1) >= ?3").bind(pid, now, REQUIRED),
    bumpIfChanged(env, "done"),
    ...stateQueries(db, pid),
  ]);
  const limited = !!limitKey && (res[0].results[0]?.n || 0) >= limitMax;
  return { fresh: res[1].meta.changes > 0, limited, state: toState(res.slice(7)) };
}

/** prize counter: record the ticket once, only if the passport is complete; returns the passport — one round trip */
export async function redeemAndState(env, pid, by) {
  const db = env.DB;
  const res = await db.batch([
    db.prepare("INSERT OR IGNORE INTO redeems (pid, at, staff) SELECT ?1, ?2, ?3 WHERE (SELECT n FROM passports WHERE id = ?1) >= ?4").bind(pid, Date.now(), by, REQUIRED),
    bumpIfChanged(env, "rd"),
    ...stateQueries(db, pid),
  ]);
  return { fresh: res[0].meta.changes > 0, state: toState(res.slice(2)) };
}

export const stampCount = (stamps) => BOOTH_IDS.filter((b) => stamps[b]).length;

// ---------- prize counter ----------
export const unredeemTicket = (env, pid) => writeCounted(env, env.DB.prepare("DELETE FROM redeems WHERE pid = ?").bind(pid), ["rd"], -1);
/** the participant's phone waits on this while at the prize counter: one indexed row instead of the whole passport */
export async function redeemState(env, pid) {
  const d = await env.DB.prepare("SELECT at, staff FROM redeems WHERE pid = ?").bind(pid).first();
  return d ? { at: d.at, by: d.staff || null } : null;
}

// ---------- booth details (edited on the admin site) ----------
let BCFG = null, BCFG_AT = 0;
/** { v, booths: { b1: { th, en, place, icon, desc, logo } } } — only the fields an admin changed; cached 20 s per instance */
export async function boothConfig(env, fresh = false) {
  if (!fresh && BCFG && Date.now() - BCFG_AT < 20000) return BCFG;
  await master(env);
  const { results } = await env.DB.prepare("SELECT id, th, en, place, icon, descr, logo, updated FROM booth_cfg").all();
  const booths = {};
  let v = 0;
  for (const r of results) {
    const o = {};
    for (const [k, col] of [["th", "th"], ["en", "en"], ["place", "place"], ["icon", "icon"], ["desc", "descr"], ["logo", "logo"]]) if (r[col] != null && r[col] !== "") o[k] = r[col];
    booths[r.id] = o;
    v = Math.max(v, r.updated);
  }
  BCFG = { v, booths };
  BCFG_AT = Date.now();
  return BCFG;
}
export const dropBoothCache = () => { BCFG = null; };

/** GET /api/logo/<booth>?v=… — the URL changes with every upload, so the image can be cached for a year */
export async function logoResponse(env, id) {
  await master(env);
  const r = await env.DB.prepare("SELECT v, mime, data FROM booth_logo WHERE id = ?").bind(id).first();
  if (!r) return new Response("not found", { status: 404, headers: { "cache-control": "no-store" } });
  const bin = atob(r.data), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Response(u, { headers: { "content-type": r.mime, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
}
