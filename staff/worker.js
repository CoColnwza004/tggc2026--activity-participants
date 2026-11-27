// Staff site Worker (separate site, same D1 database as the participant site).
// PINs come from Worker secrets: STAFF_PIN (booth/prize staff) and ADMIN_PIN (dashboard + everything).
import { EVENT, BOOTH_IDS, REQUIRED } from "../shared/event.js";
import {
  json, fail, body, clientIp, master, boothSecret, staffToken, staffFromReq,
  isLimited, bump, passportState, stampAndState, redeemAndState, clean, boothConfig, logoResponse,
} from "../shared/server.js";
import { adminApi } from "../shared/admin.js";
import { currentAnn, postAnn, clearAnn, annStats, pushPage, PAGE } from "../shared/announce.js";

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
    // stamp + totals + fresh passport: one transaction, one round trip
    const r = await stampAndState(env, b.pid, b.booth, Date.now(), "staff:" + who.name);
    if (!r.state) return fail(404, "nf", "ไม่พบสมุดรหัสนี้");
    return json({ ok: true, fresh: r.fresh, ...r.state, now: Date.now() });
  }
  if (route === "POST /api/redeem") {
    // prize counter: staff scanned the participant's ticket → record it once; the participant then fills in a raffle slip
    const b = await body(req);
    if (!/^G[0-9A-Z]{6}$/.test(b.pid || "")) return fail(400, "bad", "รหัสตั๋วไม่ถูกต้อง");
    // record once (only if complete) + fresh passport: one round trip
    const r = await redeemAndState(env, b.pid, who.name);
    if (!r.state) return fail(404, "nf", "ไม่พบตั๋ว/สมุดรหัสนี้");
    if (!r.fresh && !r.state.redeem) return fail(400, "incomplete", "ยังสะสมตราไม่ครบ ยังไม่มีสิทธิ์");
    return json({ ok: true, fresh: r.fresh, ...r.state, now: Date.now() });
  }

  // prize counter: announce the raffle (start time / place) + notify the phones that allowed it
  if (route === "GET /api/announce") return json({ ok: true, ann: await currentAnn(env, true), ...(await annStats(env)), page: PAGE });
  if (route === "POST /api/announce") {
    const r = await postAnn(env, await body(req), who);
    return r.error ? fail(400, "bad", r.error) : json({ ok: true, ...r, page: PAGE });
  }
  if (route === "POST /api/announce/push") {
    const b = await body(req);
    const id = +b.id, page = +b.page;
    if (!(id > 0) || !(page >= 0) || page > 200) return fail(400, "bad", "ข้อมูลไม่ถูกต้อง");
    return json({ ok: true, ...(await pushPage(env, id, page)) });
  }
  if (route === "POST /api/announce/clear") { await clearAnn(env); return json({ ok: true }); }

  const ar = await adminApi(env, req, url, who); // admin role: still used by the lookup screen (undo a ticket)
  if (ar) return ar;
  return fail(404, "nf", "not found");
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    if (!env.DB) return fail(503, "nodb", "ยังไม่ได้เชื่อมฐานข้อมูล D1");
    const t0 = Date.now();
    try {
      await master(env); // creates tables on first use; cached per isolate afterwards
      const res = await api(env, req, url);
      res.headers.set("server-timing", `app;dur=${Date.now() - t0}`);
      return res;
    } catch (e) {
      console.error(e);
      return fail(500, "err", "ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้ง");
    }
  },
};
