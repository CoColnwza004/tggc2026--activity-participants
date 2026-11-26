// Staff site Worker (separate site, same D1 database as the participant site).
// PINs come from Worker secrets: STAFF_PIN (booth/prize staff) and ADMIN_PIN (dashboard + everything).
import { EVENT, BOOTH_IDS, REQUIRED } from "../shared/event.js";
import {
  json, fail, body, clientIp, master, boothSecret, staffToken, staffFromReq,
  isLimited, bump, passportState, addStamp, clean, redeemTicket, noteProgress, stampCount, boothConfig, logoResponse,
} from "../shared/server.js";
import { adminApi } from "../shared/admin.js";

const STATIONS = [...BOOTH_IDS, EVENT.prizePoint.id];

function same(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function login(env, req) {
  const b = await body(req);
  const ipKey = "pin:" + clientIp(req);
  if (await isLimited(env, ipKey, 12)) return fail(429, "locked", "ใส่ PIN ผิดหลายครั้ง รอ 15 นาทีแล้วลองใหม่");
  const pin = String(b.pin || "").trim();
  const name = clean(b.name, 40) || "เจ้าหน้าที่";
  let role = null;
  if (env.ADMIN_PIN && same(pin, String(env.ADMIN_PIN))) role = "admin";
  else if (env.STAFF_PIN && same(pin, String(env.STAFF_PIN))) role = "staff";
  if (!role) {
    await bump(env, ipKey, 900);
    return fail(401, "pin", env.STAFF_PIN ? "PIN ไม่ถูกต้อง" : "ยังไม่ได้ตั้ง STAFF_PIN ในระบบ");
  }
  const secrets = {};
  for (const id of STATIONS) secrets[id] = await boothSecret(env, id);
  return json({ ok: true, role, name, token: await staffToken(env, role, name), secrets, now: Date.now() });
}

async function stationStats(env, id) {
  const [c, last] = await env.DB.batch([
    env.DB.prepare("SELECT n FROM counts WHERE k = ?").bind(id === EVENT.prizePoint.id ? "rd" : "b:" + id),
    id === EVENT.prizePoint.id
      ? env.DB.prepare(`SELECT r.pid, r.at, r.staff, p.name, p.school FROM redeems r JOIN passports p ON p.id = r.pid
                         ORDER BY r.at DESC LIMIT 40`)
      : env.DB.prepare(`SELECT s.pid, s.at, s.via, p.name, p.school FROM stamps s JOIN passports p ON p.id = s.pid
                         WHERE s.booth = ? ORDER BY s.at DESC LIMIT 8`).bind(id),
  ]);
  return { count: c.results[0]?.n || 0, recent: last.results };
}

async function api(env, req, url) {
  const route = req.method + " " + url.pathname;
  if (route === "POST /api/login") return login(env, req);
  if (route === "GET /api/ping") return json({ ok: true, now: Date.now() });
  if (route === "GET /api/booths") return json({ ok: true, ...(await boothConfig(env)), now: Date.now() });
  let lm;
  if (req.method === "GET" && (lm = url.pathname.match(/^\/api\/logo\/(b\d+)$/)) && BOOTH_IDS.includes(lm[1])) return logoResponse(env, lm[1]);

  const who = await staffFromReq(env, req);
  if (!who) return fail(401, "auth", "กรุณาเข้าสู่ระบบใหม่");

  let m;
  if (req.method === "GET" && (m = url.pathname.match(/^\/api\/station\/([a-z0-9_-]+)$/))) {
    if (!STATIONS.includes(m[1])) return fail(404, "nf", "ไม่พบจุดนี้");
    return json({ ok: true, ...(await stationStats(env, m[1])), now: Date.now() });
  }
  if (req.method === "GET" && (m = url.pathname.match(/^\/api\/passport\/(G[0-9A-Z]{6})$/))) {
    const s = await passportState(env, m[1]);
    return s ? json({ ok: true, ...s, now: Date.now() }) : fail(404, "nf", "ไม่พบสมุดรหัสนี้");
  }
  if (route === "POST /api/stamp") {
    // staff stamps a participant's passport by scanning its QR (fallback when the participant's camera fails)
    const b = await body(req);
    if (!BOOTH_IDS.includes(b.booth) || !/^G[0-9A-Z]{6}$/.test(b.pid || "")) return fail(400, "bad", "ข้อมูลไม่ถูกต้อง");
    const s0 = await passportState(env, b.pid);
    if (!s0) return fail(404, "nf", "ไม่พบสมุดรหัสนี้");
    const fresh = await addStamp(env, b.pid, b.booth, Date.now(), "staff:" + who.name);
    const s1 = await passportState(env, b.pid);
    if (fresh) await noteProgress(env, b.pid, s1.stamps);
    return json({ ok: true, fresh, ...s1, now: Date.now() });
  }
  if (route === "POST /api/redeem") {
    // prize counter: staff scanned the participant's ticket → record it once; the participant then fills in a raffle slip
    const b = await body(req);
    if (!/^G[0-9A-Z]{6}$/.test(b.pid || "")) return fail(400, "bad", "รหัสตั๋วไม่ถูกต้อง");
    const s0 = await passportState(env, b.pid);
    if (!s0) return fail(404, "nf", "ไม่พบตั๋ว/สมุดรหัสนี้");
    if (s0.redeem) return json({ ok: true, fresh: false, ...s0, now: Date.now() });
    if (stampCount(s0.stamps) < REQUIRED) return fail(400, "incomplete", "ยังสะสมตราไม่ครบ ยังไม่มีสิทธิ์");
    const fresh = await redeemTicket(env, b.pid, who.name);
    return json({ ok: true, fresh, ...(await passportState(env, b.pid)), now: Date.now() });
  }

  const ar = await adminApi(env, req, url, who); // admin role: still used by the lookup screen (undo a ticket)
  if (ar) return ar;
  return fail(404, "nf", "not found");
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    if (!env.DB) return fail(503, "nodb", "ยังไม่ได้เชื่อมฐานข้อมูล D1");
    try {
      await master(env); // creates tables on first use; cached per isolate afterwards
      return await api(env, req, url);
    } catch (e) {
      console.error(e);
      return fail(500, "err", "ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้ง");
    }
  },
};
