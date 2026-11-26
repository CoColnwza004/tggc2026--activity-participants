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
// bump when the derived tables change; also rebuilt when the booth list or REQUIRED changes
const SCHEMA_V = `4|${REQUIRED}|${BOOTH_IDS.join(",")}`;
const IN_BOOTHS = BOOTH_IDS.map(() => "?").join(",");
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)`,
  `CREATE TABLE IF NOT EXISTS passports (id TEXT PRIMARY KEY, name TEXT NOT NULL, school TEXT, role TEXT, phone TEXT, nkey TEXT UNIQUE, created INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS stamps (pid TEXT NOT NULL, booth TEXT NOT NULL, at INTEGER NOT NULL, via TEXT, PRIMARY KEY (pid, booth)) WITHOUT ROWID`,
  `CREATE INDEX IF NOT EXISTS stamps_booth ON stamps (booth, at)`,
  ...REDEEMS,
  ...COUNTS,
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
  await db.batch([
    ...[...REDEEMS, ...COUNTS].map((q) => db.prepare(q)),
    db.prepare("DELETE FROM counts"),
    db.prepare("DELETE FROM completed"),
    db.prepare("INSERT INTO counts (k, n) SELECT 'b:' || booth, COUNT(*) FROM stamps GROUP BY booth"),
    db.prepare("INSERT INTO counts (k, n) SELECT 'p', COUNT(*) FROM passports"),
    db.prepare("INSERT INTO counts (k, n) SELECT 'r:' || COALESCE(role, ''), COUNT(*) FROM passports GROUP BY role"),
    db.prepare(`INSERT INTO completed (pid, at) SELECT pid, MAX(at) FROM stamps WHERE booth IN (${IN_BOOTHS}) GROUP BY pid HAVING COUNT(*) >= ?`).bind(...BOOTH_IDS, REQUIRED),
    db.prepare("INSERT INTO counts (k, n) SELECT 'done', COUNT(*) FROM completed"),
    db.prepare("INSERT INTO counts (k, n) SELECT 'rd', COUNT(*) FROM redeems"),
    db.prepare("INSERT INTO meta (k, v) VALUES ('schema', ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v").bind(SCHEMA_V),
  ]);
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

export const boothSecret = async (env, booth) => b64u.enc(await hmac(await master(env), "booth:" + booth));
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

export async function passportState(env, pid) {
  const [p, st, dr] = await env.DB.batch([
    env.DB.prepare("SELECT id, name, school, role, created FROM passports WHERE id = ?").bind(pid),
    env.DB.prepare("SELECT booth, at, via FROM stamps WHERE pid = ?").bind(pid),
    env.DB.prepare("SELECT at, staff FROM redeems WHERE pid = ?").bind(pid),
  ]);
  const passport = p.results[0];
  if (!passport) return null;
  const stamps = {};
  for (const s of st.results) stamps[s.booth] = s.at;
  const d = dr.results[0];
  return { passport, stamps, redeem: d ? { at: d.at, by: d.staff || null } : null };
}

export const addStamp = (env, pid, booth, at, via) =>
  writeCounted(env, env.DB.prepare("INSERT OR IGNORE INTO stamps (pid, booth, at, via) VALUES (?, ?, ?, ?)").bind(pid, booth, at, via), ["b:" + booth]);

export const stampCount = (stamps) => BOOTH_IDS.filter((b) => stamps[b]).length;

/** after a new stamp: the first time a passport reaches REQUIRED, count it as completed (once, even under races) */
export async function noteProgress(env, pid, stamps) {
  if (stampCount(stamps) < REQUIRED) return;
  await writeCounted(env, env.DB.prepare("INSERT OR IGNORE INTO completed (pid, at) VALUES (?, ?)").bind(pid, Date.now()), ["done"]);
}

// ---------- prize counter ----------
/** staff scanned a complete ticket: record it once (a second scan of the same ticket changes nothing) */
export async function redeemTicket(env, pid, by) {
  return writeCounted(env, env.DB.prepare("INSERT OR IGNORE INTO redeems (pid, at, staff) VALUES (?, ?, ?)").bind(pid, Date.now(), by), ["rd"]);
}
export const unredeemTicket = (env, pid) => writeCounted(env, env.DB.prepare("DELETE FROM redeems WHERE pid = ?").bind(pid), ["rd"], -1);
/** the participant's phone waits on this while at the prize counter: one indexed row instead of the whole passport */
export async function redeemState(env, pid) {
  const d = await env.DB.prepare("SELECT at, staff FROM redeems WHERE pid = ?").bind(pid).first();
  return d ? { at: d.at, by: d.staff || null } : null;
}
