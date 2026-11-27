// Prize-counter announcements ("the raffle starts now, at …") + Web Push to the phones of people who
// collected every stamp and allowed notifications.
//
// Push messages carry NO payload: the phone's service worker fetches /api/announce when one arrives and shows
// that. So no payload encryption is needed, only a VAPID signature (ES256, WebCrypto). The VAPID key pair is
// generated on first use and kept in D1 (meta 'vapid'), so there is nothing to set up.
import { EVENT, REQUIRED } from "./event.js";
import { b64u } from "./otp.js";
// (no import from server.js: it imports this file)
const clean = (s, n = 120) => String(s || "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);

export const ANN_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS announce (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL,
     place TEXT, time TEXT, msg TEXT, staff TEXT, active INTEGER NOT NULL DEFAULT 1)`,
  // rowid order = sign-up order: new rows go to the end, so paging by OFFSET stays stable while a send is running
  `CREATE TABLE IF NOT EXISTS push_subs (pid TEXT NOT NULL UNIQUE, endpoint TEXT NOT NULL, p256dh TEXT, auth TEXT, at INTEGER NOT NULL,
     last INTEGER NOT NULL DEFAULT 0, gone INTEGER NOT NULL DEFAULT 0)`,
];

export const KINDS = {
  soon: "เตรียมตัว! ใกล้เริ่มจับรางวัล",
  start: "เริ่มจับรางวัลแล้ว!",
  winners: "ประกาศรายชื่อผู้โชคดี",
  custom: "",
};

// ---------- the current announcement (cached a few seconds per Worker instance) ----------
let ANN = null, ANN_AT = 0;
const row = (r) => (r ? { id: r.id, at: r.at, kind: r.kind, title: r.title, place: r.place || "", time: r.time || "", msg: r.msg || "", by: r.staff || "" } : null);
export async function currentAnn(env, fresh = false) {
  if (!fresh && Date.now() - ANN_AT < 8000) return ANN;
  const r = await env.DB.prepare("SELECT * FROM announce WHERE active = 1 ORDER BY id DESC LIMIT 1").first();
  ANN = row(r); ANN_AT = Date.now();
  return ANN;
}
export const annText = (a) => [a.time ? `เวลา ${a.time} น.` : "", a.place ? `ที่ ${a.place}` : "", a.msg].filter(Boolean).join(" · ");

export async function postAnn(env, b, who) {
  const kind = Object.hasOwn(KINDS, b.kind) ? b.kind : "custom";
  const title = clean(b.title, 80) || KINDS[kind];
  const place = clean(b.place, 120), time = clean(b.time, 20), msg = clean(b.msg, 200);
  if (!title) return { error: "กรุณาใส่หัวข้อประกาศ" };
  if ((kind === "start" || kind === "soon") && !place) return { error: "กรุณาระบุสถานที่จับรางวัล" };
  const db = env.DB;
  const [, ins, n] = await db.batch([
    db.prepare("UPDATE announce SET active = 0 WHERE active = 1"),
    db.prepare("INSERT INTO announce (at, kind, title, place, time, msg, staff) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *").bind(Date.now(), kind, title, place, time, msg, who.name),
    db.prepare("SELECT COUNT(*) AS rows, COALESCE(SUM(gone = 0), 0) AS subs FROM push_subs"),
  ]);
  ANN = row(ins.results[0]); ANN_AT = Date.now();
  return { ann: ANN, ...n.results[0] };
}
export async function clearAnn(env) {
  await env.DB.prepare("UPDATE announce SET active = 0 WHERE active = 1").run();
  ANN = null; ANN_AT = Date.now();
}
export async function annStats(env) {
  return env.DB.prepare("SELECT COUNT(*) AS rows, COALESCE(SUM(gone = 0), 0) AS subs FROM push_subs").first();
}

// ---------- subscriptions (participant side) ----------
export async function subscribe(env, pid, b) {
  const ep = String(b.endpoint || "");
  const local = env.PUSH_TEST === "1" && /^http:\/\/127\.0\.0\.1:\d+\//.test(ep); // local tests only (wrangler dev --var PUSH_TEST:1)
  if (!local && !/^https:\/\/[^\s]{10,800}$/.test(ep)) return { error: "ข้อมูลการแจ้งเตือนไม่ถูกต้อง" };
  const keys = b.keys || {};
  const db = env.DB;
  const r = await db.batch([
    db.prepare(`INSERT INTO push_subs (pid, endpoint, p256dh, auth, at) SELECT ?1, ?2, ?3, ?4, ?5 WHERE (SELECT n FROM passports WHERE id = ?1) >= ?6
                ON CONFLICT (pid) DO UPDATE SET endpoint = excluded.endpoint, p256dh = excluded.p256dh, auth = excluded.auth, at = excluded.at, gone = 0`)
      .bind(pid, ep, clean(keys.p256dh, 200), clean(keys.auth, 60), Date.now(), REQUIRED),
  ]);
  if (!r[0].meta.changes) return { error: "เปิดการแจ้งเตือนได้เมื่อสะสมตราครบแล้ว" };
  return { ok: true };
}
export const unsubscribe = (env, pid) => env.DB.prepare("DELETE FROM push_subs WHERE pid = ?").bind(pid).run();

// ---------- VAPID ----------
let VAPID = null;
async function vapid(env) {
  if (VAPID) return VAPID;
  let v = await env.DB.prepare("SELECT v FROM meta WHERE k = 'vapid'").first();
  if (!v) {
    const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
    const pub = b64u.enc(new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey)));
    await env.DB.prepare("INSERT OR IGNORE INTO meta (k, v) VALUES ('vapid', ?)").bind(JSON.stringify({ jwk, pub })).run();
    v = await env.DB.prepare("SELECT v FROM meta WHERE k = 'vapid'").first(); // another instance may have won the race
  }
  const { jwk, pub } = JSON.parse(v.v);
  VAPID = { pub, key: await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]), jwts: new Map() };
  return VAPID;
}
export const vapidPublic = async (env) => (await vapid(env)).pub;

const enc = new TextEncoder();
const j64 = (o) => b64u.enc(enc.encode(JSON.stringify(o)));
async function authFor(env, endpoint) {
  const v = await vapid(env);
  const aud = new URL(endpoint).origin;
  const hit = v.jwts.get(aud);
  if (hit && hit.until > Date.now()) return hit.h;
  const exp = Math.floor(Date.now() / 1000) + 3600; // Apple accepts at most 1 hour
  const data = `${j64({ typ: "JWT", alg: "ES256" })}.${j64({ aud, exp, sub: EVENT.participantUrl })}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, v.key, enc.encode(data)));
  const h = `vapid t=${data}.${b64u.enc(sig)}, k=${v.pub}`;
  v.jwts.set(aud, { h, until: Date.now() + 30 * 60e3 });
  return h;
}

/**
 * Send announcement `id` to one page of subscribers (rowid order). The staff screen calls this page by page
 * (a few in parallel), so no single request makes too many outgoing calls. Rows already sent this id are skipped,
 * so a retried page never notifies anyone twice.
 */
export const PAGE = 100;
export async function pushPage(env, id, page) {
  const db = env.DB;
  const { results } = await db.prepare("SELECT rowid AS r, endpoint, last, gone FROM push_subs ORDER BY rowid LIMIT ? OFFSET ?").bind(PAGE, page * PAGE).all();
  const todo = results.filter((s) => !s.gone && s.last < id);
  const sent = [], gone = [];
  let failed = 0;
  // Workers keep at most 6 outgoing connections open at a time; more just queue, so a plain Promise.all is fine
  await Promise.all(todo.map(async (s) => {
    try {
      const r = await fetch(s.endpoint, {
        method: "POST",
        headers: { authorization: await authFor(env, s.endpoint), ttl: "3600", urgency: "high", topic: "tggc-raffle" },
        body: new Uint8Array(0), // an explicit empty body → "Content-Length: 0" (some push services refuse a POST without it)
      });
      if (r.status === 404 || r.status === 410) gone.push(s.r);
      else if (r.ok) sent.push(s.r);
      else failed++;
    } catch { failed++; }
  }));
  const stmts = [];
  for (let i = 0; i < sent.length; i += 90) { const c = sent.slice(i, i + 90); stmts.push(db.prepare(`UPDATE push_subs SET last = ? WHERE rowid IN (${c.map(() => "?").join(",")})`).bind(id, ...c)); }
  for (let i = 0; i < gone.length; i += 90) { const c = gone.slice(i, i + 90); stmts.push(db.prepare(`UPDATE push_subs SET gone = 1 WHERE rowid IN (${c.map(() => "?").join(",")})`).bind(...c)); }
  if (stmts.length) await db.batch(stmts);
  return { rows: results.length, sent: sent.length, skipped: results.length - todo.length, gone: gone.length, failed };
}
