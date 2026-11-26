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
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)`,
  `CREATE TABLE IF NOT EXISTS passports (id TEXT PRIMARY KEY, name TEXT NOT NULL, school TEXT, role TEXT, phone TEXT, nkey TEXT UNIQUE, created INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS stamps (pid TEXT NOT NULL, booth TEXT NOT NULL, at INTEGER NOT NULL, via TEXT, PRIMARY KEY (pid, booth)) WITHOUT ROWID`,
  `CREATE INDEX IF NOT EXISTS stamps_booth ON stamps (booth, at)`,
  ...REDEEMS,
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

export async function master(env) {
  if (MASTER) return MASTER;
  let row = null;
  try { row = await env.DB.prepare("SELECT v FROM meta WHERE k = 'master'").first(); } catch { /* no tables yet */ }
  if (!row) {
    await setup(env);
    row = await env.DB.prepare("SELECT v FROM meta WHERE k = 'master'").first();
  }
  // databases created before the ticket-redeem flow have no redeems table yet
  await env.DB.batch(REDEEMS.map((q) => env.DB.prepare(q)));
  MASTER = b64u.dec(row.v);
  return MASTER;
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

export async function addStamp(env, pid, booth, at, via) {
  const r = await env.DB.prepare("INSERT OR IGNORE INTO stamps (pid, booth, at, via) VALUES (?, ?, ?, ?)").bind(pid, booth, at, via).run();
  return r.meta.changes > 0;
}

export async function hasAllStamps(env, pid) {
  const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM stamps WHERE pid = ? AND booth IN (${BOOTH_IDS.map(() => "?").join(",")})`).bind(pid, ...BOOTH_IDS).first();
  return r.n >= REQUIRED;
}

// ---------- prize counter ----------
/** staff scanned a complete ticket: record it once (a second scan of the same ticket changes nothing) */
export async function redeemTicket(env, pid, by) {
  const r = await env.DB.prepare("INSERT OR IGNORE INTO redeems (pid, at, staff) VALUES (?, ?, ?)").bind(pid, Date.now(), by).run();
  return r.meta.changes > 0;
}
