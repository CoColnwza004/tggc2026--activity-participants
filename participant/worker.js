// Participant site Worker: static files come straight from Cloudflare's asset store
// (they never reach this code); only /api/* runs here.
import { EVENT, BOOTH_IDS } from "../shared/event.js";
import { parsePayload } from "../shared/otp.js";
import {
  json, fail, body, clientIp, master, passToken, passFromReq, verifyCode, isLimited, bump,
  newId, normName, clean, passportState, addStamp, bumpIfChanged, noteProgress, redeemState,
} from "../shared/server.js";

const ROLES = new Set(["student", "teacher", "guest"]);

// server clock estimate of when the participant scanned (they may have been offline)
function scanTime(b) {
  const now = Date.now();
  const at = +b.at, sent = +b.sent;
  if (!at || !sent || at > sent) return now;
  return Math.max(0, now - (sent - at));
}

async function join(env, req) {
  const b = await body(req);
  if (b.website) return fail(400, "bad", "ข้อมูลไม่ถูกต้อง");
  const name = clean(b.name, 80);
  const school = clean(b.school, 120);
  const role = ROLES.has(b.role) ? b.role : "student";
  const phone = String(b.phone || "").replace(/\D/g, "");
  if (name.length < 2) return fail(400, "name", "กรุณากรอกชื่อ-นามสกุล");
  if (!/^0\d{8,9}$/.test(phone)) return fail(400, "phone", "กรุณากรอกเบอร์โทร 9–10 หลัก ขึ้นต้นด้วย 0");

  const ipKey = "join:" + clientIp(req);
  if (await isLimited(env, ipKey, 600)) return fail(429, "slow", "มีการสมัครจากเครือข่ายนี้มากเกินไป ลองใหม่ในอีกสักครู่");
  await master(env);
  const nkey = phone + "|" + normName(name);

  let id = null, recovered = false;
  for (let i = 0; i < 4 && !id; i++) {
    const cand = newId();
    // new passport + its totals in one transaction (each bump applies only if the row before it changed)
    const [ins] = await env.DB.batch([
      env.DB.prepare("INSERT INTO passports (id, name, school, role, phone, nkey, created) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING RETURNING id")
        .bind(cand, name, school, role, phone, nkey, Date.now()),
      bumpIfChanged(env, "p"),
      bumpIfChanged(env, "r:" + role),
    ]);
    const r = ins.results[0];
    if (r) { id = r.id; break; }
    const ex = await env.DB.prepare("SELECT id FROM passports WHERE nkey = ?").bind(nkey).first();
    if (ex) { id = ex.id; recovered = true; } // same phone + same name = same person on a new phone
  }
  if (!id) return fail(500, "retry", "ระบบไม่ว่าง ลองใหม่อีกครั้ง");
  await bump(env, ipKey, 600);
  const state = await passportState(env, id);
  return json({ ok: true, id, token: await passToken(env, id), recovered, ...state, now: Date.now() });
}

async function me(env, req) {
  const pid = await passFromReq(env, req);
  if (!pid) return fail(401, "auth", "ไม่พบสมุดสะสมตรา");
  const state = await passportState(env, pid);
  if (!state) return fail(404, "gone", "ไม่พบสมุดสะสมตรา");
  return json({ ok: true, ...state, now: Date.now() });
}

async function stamp(env, req) {
  const pid = await passFromReq(env, req);
  if (!pid) return fail(401, "auth", "ไม่พบสมุดสะสมตรา");
  const b = await body(req);
  const p = parsePayload(b.c);
  if (!p) return fail(400, "code", "รหัสไม่ถูกต้อง");
  if (p.booth === EVENT.prizePoint.id) return fail(400, "prize", "นี่คือ QR เคาน์เตอร์แลกรางวัล");
  if (!BOOTH_IDS.includes(p.booth)) return fail(400, "code", "ไม่พบบูธนี้");
  const lk = "code:" + pid;
  if (await isLimited(env, lk, 15)) return fail(429, "slow", "ใส่รหัสผิดหลายครั้ง รอ 10 นาทีแล้วลองใหม่");
  const at = scanTime(b);
  if (!(await verifyCode(env, p, at))) {
    await bump(env, lk, 600);
    return fail(400, "expired", "รหัสไม่ถูกต้องหรือหมดอายุ ลองสแกน QR ล่าสุดที่บูธอีกครั้ง");
  }
  const fresh = await addStamp(env, pid, p.booth, Math.min(at, Date.now()), p.win != null ? "qr" : "code");
  const state = await passportState(env, pid);
  if (fresh) await noteProgress(env, pid, state.stamps);
  return json({ ok: true, booth: p.booth, fresh, ...state, now: Date.now() });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    if (!env.DB) return fail(503, "nodb", "ยังไม่ได้เชื่อมฐานข้อมูล D1");
    try {
      await master(env); // creates tables on first use; cached per isolate afterwards
      const route = req.method + " " + url.pathname;
      switch (route) {
        case "POST /api/join": return await join(env, req);
        case "GET /api/me": return await me(env, req);
        case "GET /api/ticket": {
          const pid = await passFromReq(env, req);
          if (!pid) return fail(401, "auth", "ไม่พบสมุดสะสมตรา");
          return json({ ok: true, redeem: await redeemState(env, pid), now: Date.now() });
        }
        case "POST /api/stamp": return await stamp(env, req);
        case "GET /api/ping": return json({ ok: true, now: Date.now() });
      }
      return fail(404, "nf", "not found");
    } catch (e) {
      console.error(e);
      return fail(500, "err", "ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้ง");
    }
  },
};
