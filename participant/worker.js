// Participant site Worker: static files come straight from Cloudflare's asset store
// (they never reach this code); only /api/* runs here.
import { EVENT, BOOTH_IDS } from "../shared/event.js";
import { parsePayload } from "../shared/otp.js";
import {
  json, fail, body, clientIp, master, passToken, passFromReq, verifyCode, bumpCount,
  newId, normName, clean, passportState, stampAndState, bumpIfChanged, redeemState, boothConfig, logoResponse,
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
  await master(env);
  const nkey = phone + "|" + normName(name);
  const db = env.DB, now = Date.now();

  // one round trip: limit check + new passport + its totals + "is this person already registered?"
  for (let i = 0; i < 4; i++) {
    const cand = newId();
    const res = await db.batch([
      db.prepare("SELECT n FROM attempts WHERE k = ? AND until > ?").bind(ipKey, now),
      db.prepare(`INSERT INTO passports (id, name, school, role, phone, nkey, created) SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
                   WHERE NOT EXISTS (SELECT 1 FROM attempts WHERE k = ?8 AND until > ?7 AND n >= 600)
                   ON CONFLICT DO NOTHING RETURNING id`).bind(cand, name, school, role, phone, nkey, now, ipKey),
      bumpIfChanged(env, "p"),
      bumpIfChanged(env, "r:" + role),
      db.prepare(`INSERT INTO attempts (k, n, until) VALUES (?1, 1, ?2)
                   ON CONFLICT (k) DO UPDATE SET n = CASE WHEN until < ?3 THEN 1 ELSE n + 1 END, until = CASE WHEN until < ?3 THEN ?2 ELSE until END`)
        .bind(ipKey, now + 600e3, now),
      db.prepare("SELECT id FROM passports WHERE nkey = ?").bind(nkey),
    ]);
    if ((res[0].results[0]?.n || 0) >= 600) return fail(429, "slow", "มีการสมัครจากเครือข่ายนี้มากเกินไป ลองใหม่ในอีกสักครู่");
    const created = res[1].results[0]?.id;
    if (created) {
      const state = { passport: { id: created, name, school, role, created: now }, stamps: {}, redeem: null };
      return json({ ok: true, id: created, token: await passToken(env, created), recovered: false, ...state, now: Date.now() });
    }
    const ex = res[5].results[0]?.id;
    if (ex) { // same phone + same name = same person on a new phone
      const state = await passportState(env, ex);
      return json({ ok: true, id: ex, token: await passToken(env, ex), recovered: true, ...state, now: Date.now() });
    }
    // otherwise the random id was taken: try another
  }
  return fail(500, "retry", "ระบบไม่ว่าง ลองใหม่อีกครั้ง");
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
  const at = scanTime(b);
  if (!(await verifyCode(env, p, at))) { // pure CPU, no database
    const n = await bumpCount(env, lk, 600);
    if (n > 15) return fail(429, "slow", "ใส่รหัสผิดหลายครั้ง รอ 10 นาทีแล้วลองใหม่");
    return fail(400, "expired", "รหัสไม่ถูกต้องหรือหมดอายุ ลองสแกน QR ล่าสุดที่บูธอีกครั้ง");
  }
  // valid code: stamp + totals + fresh passport in one transaction / one round trip
  const r = await stampAndState(env, pid, p.booth, Math.min(at, Date.now()), p.win != null ? "qr" : "code", { limitKey: lk, limitMax: 15 });
  if (r.limited) return fail(429, "slow", "ใส่รหัสผิดหลายครั้ง รอ 10 นาทีแล้วลองใหม่");
  if (!r.state) return fail(404, "gone", "ไม่พบสมุดสะสมตรา");
  return json({ ok: true, booth: p.booth, fresh: r.fresh, ...r.state, now: Date.now() });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    if (!env.DB) return fail(503, "nodb", "ยังไม่ได้เชื่อมฐานข้อมูล D1");
    const t0 = Date.now();
    try {
      const res = await route(env, req, url);
      res.headers.set("server-timing", `app;dur=${Date.now() - t0}`); // time spent in the Worker + database
      return res;
    } catch (e) {
      console.error(e);
      return fail(500, "err", "ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้ง");
    }
  },
};

async function route(env, req, url) {
  await master(env); // creates tables on first use; cached per isolate afterwards
  const lm = req.method === "GET" && url.pathname.match(/^\/api\/logo\/(b\d+)$/);
  if (lm && BOOTH_IDS.includes(lm[1])) return logoResponse(env, lm[1]);
  switch (req.method + " " + url.pathname) {
    case "POST /api/join": return join(env, req);
    case "GET /api/me": return me(env, req);
    case "GET /api/ticket": {
      const pid = await passFromReq(env, req);
      if (!pid) return fail(401, "auth", "ไม่พบสมุดสะสมตรา");
      return json({ ok: true, redeem: await redeemState(env, pid), now: Date.now() });
    }
    case "POST /api/stamp": return stamp(env, req);
    case "GET /api/ping": return json({ ok: true, now: Date.now() });
    case "GET /api/booths": return json({ ok: true, ...(await boothConfig(env)), now: Date.now() });
  }
  return fail(404, "nf", "not found");
}
