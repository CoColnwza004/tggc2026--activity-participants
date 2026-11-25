// Server-side logic shared by both Workers (participant + staff). Storage: Cloudflare D1 (binding DB).
// The schema is created on first use, and a random master key is generated and kept in D1,
// so the only setup is binding the database and setting the two PINs.
import { EVENT, BOOTH_IDS } from "./event.js";
import { b64u, hmac, codeFor, windowAt } from "./otp.js";

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)`,
  `CREATE TABLE IF NOT EXISTS passports (id TEXT PRIMARY KEY, name TEXT NOT NULL, school TEXT, role TEXT, phone TEXT, nkey TEXT UNIQUE, created INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS stamps (pid TEXT NOT NULL, booth TEXT NOT NULL, at INTEGER NOT NULL, via TEXT, PRIMARY KEY (pid, booth)) WITHOUT ROWID`,
  `CREATE INDEX IF NOT EXISTS stamps_booth ON stamps (booth, at)`,
  `CREATE TABLE IF NOT EXISTS prizes (id TEXT PRIMARY KEY, name TEXT NOT NULL, art TEXT, total INTEGER NOT NULL, remaining INTEGER NOT NULL, sort INTEGER DEFAULT 0, active INTEGER DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS draws (pid TEXT PRIMARY KEY, prize TEXT, at INTEGER NOT NULL, claimed INTEGER, claimed_by TEXT)`,
  `CREATE INDEX IF NOT EXISTS draws_at ON draws (at)`,
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
let SETTINGS = null, SETTINGS_AT = 0;

async function setup(env) {
  const db = env.DB;
  const stmts = SCHEMA.map((s) => db.prepare(s));
  stmts.push(db.prepare("INSERT OR IGNORE INTO meta (k, v) VALUES ('master', ?)").bind(b64u.enc(crypto.getRandomValues(new Uint8Array(32)))));
  stmts.push(db.prepare("INSERT OR IGNORE INTO meta (k, v) VALUES ('winRate', ?)").bind(String(EVENT.winRate)));
  stmts.push(db.prepare("INSERT OR IGNORE INTO meta (k, v) VALUES ('expected', '0')"));
  EVENT.prizes.forEach((p, i) =>
    stmts.push(db.prepare("INSERT OR IGNORE INTO prizes (id, name, art, total, remaining, sort) VALUES (?, ?, ?, ?, ?, ?)").bind(p.id, p.name, p.art || "gift", p.qty, p.qty, i)));
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
  MASTER = b64u.dec(row.v);
  return MASTER;
}

export async function settings(env, fresh = false) {
  if (!fresh && SETTINGS && Date.now() - SETTINGS_AT < 15000) return SETTINGS;
  await master(env);
  const { results } = await env.DB.prepare("SELECT k, v FROM meta WHERE k IN ('winRate', 'expected')").all();
  const m = Object.fromEntries(results.map((r) => [r.k, r.v]));
  SETTINGS = { winRate: Math.min(1, Math.max(0, parseFloat(m.winRate ?? EVENT.winRate))), expected: Math.max(0, parseInt(m.expected || "0", 10)) };
  SETTINGS_AT = Date.now();
  return SETTINGS;
}
export const resetSettingsCache = () => { SETTINGS = null; };

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
  const n = encodeURIComponent(name).slice(0, 80);
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
  return { role, name: decodeURIComponent(n) };
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
    env.DB.prepare("SELECT d.prize, d.at, d.claimed, d.claimed_by, z.name AS prize_name, z.art FROM draws d LEFT JOIN prizes z ON z.id = d.prize WHERE d.pid = ?").bind(pid),
  ]);
  const passport = p.results[0];
  if (!passport) return null;
  const stamps = {};
  for (const s of st.results) stamps[s.booth] = s.at;
  const d = dr.results[0];
  return {
    passport,
    stamps,
    draw: d ? { win: !!d.prize, prize: d.prize ? { id: d.prize, name: d.prize_name, art: d.art } : null, at: d.at, claimed: d.claimed || null, claimedBy: d.claimed_by || null } : null,
  };
}

export async function addStamp(env, pid, booth, at, via) {
  const r = await env.DB.prepare("INSERT OR IGNORE INTO stamps (pid, booth, at, via) VALUES (?, ?, ?, ?)").bind(pid, booth, at, via).run();
  return r.meta.changes > 0;
}

export async function hasAllStamps(env, pid) {
  const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM stamps WHERE pid = ? AND booth IN (${BOOTH_IDS.map(() => "?").join(",")})`).bind(pid, ...BOOTH_IDS).first();
  return r.n >= BOOTH_IDS.length;
}

// ---------- the draw ----------
function rand() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}

/**
 * One draw per passport, decided here (never in the browser).
 * 1. claim the draw row (PRIMARY KEY stops a second draw, even from two phones at once)
 * 2. roll against the win rate (or, when "expected participants" is set, remaining stock ÷ people still to come)
 * 3. pick a prize weighted by remaining stock; the decrement only succeeds while stock > 0
 */
export async function runDraw(env, pid) {
  const now = Date.now();
  const ins = await env.DB.prepare("INSERT OR IGNORE INTO draws (pid, prize, at) VALUES (?, NULL, ?)").bind(pid, now).run();
  if (!ins.meta.changes) {
    // a draw for this passport is already running/finished (double tap, two phones): give it a moment to settle
    await new Promise((r) => setTimeout(r, 700));
    return { already: true };
  }

  const s = await settings(env);
  for (let attempt = 0; attempt < 3; attempt++) {
    const { results: prizes } = await env.DB.prepare("SELECT id, name, art, remaining FROM prizes WHERE active = 1 AND remaining > 0").all();
    const stock = prizes.reduce((a, p) => a + p.remaining, 0);
    if (!stock) break;
    let p = s.winRate;
    if (s.expected > 0) {
      const done = (await env.DB.prepare("SELECT COUNT(*) AS n FROM draws").first()).n - 1;
      p = Math.min(1, stock / Math.max(1, s.expected - done));
    }
    if (attempt === 0 && rand() >= p) break; // not a winner this time
    let x = rand() * stock, pick = prizes[0];
    for (const z of prizes) { if ((x -= z.remaining) < 0) { pick = z; break; } }
    const dec = await env.DB.prepare("UPDATE prizes SET remaining = remaining - 1 WHERE id = ? AND remaining > 0").bind(pick.id).run();
    if (dec.meta.changes) {
      await env.DB.prepare("UPDATE draws SET prize = ? WHERE pid = ?").bind(pick.id, pid).run();
      return { win: true, prize: { id: pick.id, name: pick.name, art: pick.art }, at: now };
    }
    // someone took the last one of that prize a moment ago → try again with fresh stock
  }
  return { win: false, prize: null, at: now };
}
