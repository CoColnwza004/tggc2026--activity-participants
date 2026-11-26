// Admin site Worker (separate site, same D1 database): booth details + logos, dashboard, ticket list, CSV, reset.
// Login with the ADMIN_PIN Worker secret only (staff PINs do not open this site).
import { BOOTH_IDS } from "../shared/event.js";
import { json, fail, body, clientIp, master, staffToken, staffFromReq, isLimited, bump, clean, boothConfig, logoResponse } from "../shared/server.js";
import { adminApi } from "../shared/admin.js";

function same(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function login(env, req) {
  const b = await body(req);
  const ipKey = "admin-pin:" + clientIp(req);
  if (await isLimited(env, ipKey, 8)) return fail(429, "locked", "ใส่ PIN ผิดหลายครั้ง รอ 15 นาทีแล้วลองใหม่");
  if (!env.ADMIN_PIN) return fail(503, "nopin", "ยังไม่ได้ตั้ง ADMIN_PIN ในระบบ");
  if (!same(String(b.pin || "").trim(), String(env.ADMIN_PIN))) {
    await bump(env, ipKey, 900);
    return fail(401, "pin", "PIN ไม่ถูกต้อง");
  }
  const name = clean(b.name, 40) || "แอดมิน";
  return json({ ok: true, role: "admin", name, token: await staffToken(env, "admin", name, 12), now: Date.now() });
}

async function api(env, req, url) {
  const route = req.method + " " + url.pathname;
  if (route === "POST /api/login") return login(env, req);
  let m;
  if (req.method === "GET" && (m = url.pathname.match(/^\/api\/logo\/(b\d+)$/)) && BOOTH_IDS.includes(m[1])) return logoResponse(env, m[1]);
  const who = await staffFromReq(env, req);
  if (!who || who.role !== "admin") return fail(401, "auth", "กรุณาเข้าสู่ระบบใหม่");
  if (route === "GET /api/booths") return json({ ok: true, ...(await boothConfig(env, true)), now: Date.now() });
  return (await adminApi(env, req, url, who)) || fail(404, "nf", "not found");
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    if (!env.DB) return fail(503, "nodb", "ยังไม่ได้เชื่อมฐานข้อมูล D1");
    try {
      await master(env);
      return await api(env, req, url);
    } catch (e) {
      console.error(e);
      return fail(500, "err", "ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้ง");
    }
  },
};
