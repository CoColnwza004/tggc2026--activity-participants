// Staff site Worker (separate site, same D1 database as the participant site).
// PINs come from Worker secrets: STAFF_PIN (booth/prize staff) and ADMIN_PIN (dashboard + everything).
import { EVENT, BOOTH_IDS, REQUIRED } from "../shared/event.js";
import {
  json, fail, body, clientIp, master, boothSecret, staffToken, staffFromReq,
  isLimited, bump, passportState, addStamp, clean, hasAllStamps, redeemTicket,
} from "../shared/server.js";

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
    env.DB.prepare(id === EVENT.prizePoint.id ? "SELECT COUNT(*) AS n FROM redeems" : "SELECT COUNT(*) AS n FROM stamps WHERE booth = ?").bind(...(id === EVENT.prizePoint.id ? [] : [id])),
    id === EVENT.prizePoint.id
      ? env.DB.prepare(`SELECT r.pid, r.at, r.staff, p.name, p.school FROM redeems r JOIN passports p ON p.id = r.pid
                         ORDER BY r.at DESC LIMIT 40`)
      : env.DB.prepare(`SELECT s.pid, s.at, s.via, p.name, p.school FROM stamps s JOIN passports p ON p.id = s.pid
                         WHERE s.booth = ? ORDER BY s.at DESC LIMIT 8`).bind(id),
  ]);
  return { count: c.results[0].n, recent: last.results };
}

async function summary(env) {
  await master(env);
  const db = env.DB;
  const [pc, bc, comp, rc, roles] = await db.batch([
    db.prepare("SELECT COUNT(*) AS n FROM passports"),
    db.prepare("SELECT booth, COUNT(*) AS n FROM stamps GROUP BY booth"),
    db.prepare(`SELECT COUNT(*) AS n FROM (SELECT pid FROM stamps WHERE booth IN (${BOOTH_IDS.map(() => "?").join(",")}) GROUP BY pid HAVING COUNT(*) >= ?)`).bind(...BOOTH_IDS, REQUIRED),
    db.prepare("SELECT COUNT(*) AS n FROM redeems"),
    db.prepare("SELECT role, COUNT(*) AS n FROM passports GROUP BY role"),
  ]);
  return {
    passports: pc.results[0].n,
    booths: Object.fromEntries(bc.results.map((r) => [r.booth, r.n])),
    completed: comp.results[0].n,
    redeemed: rc.results[0].n || 0,
    roles: Object.fromEntries(roles.results.map((r) => [r.role, r.n])),
  };
}

const csvCell = (v) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // keep spreadsheet formulas from running
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const thTime = (ms) => (ms ? new Date(ms + 7 * 3600e3).toISOString().replace("T", " ").slice(0, 19) : "");

async function exportCsv(env) {
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.name, p.school, p.role, p.phone, p.created,
            (SELECT GROUP_CONCAT(booth || '@' || at) FROM stamps s WHERE s.pid = p.id) AS st,
            r.at AS redeemed, r.staff
       FROM passports p LEFT JOIN redeems r ON r.pid = p.id
      ORDER BY p.created`
  ).all();
  const head = ["รหัสสมุด", "ชื่อ", "โรงเรียน/หน่วยงาน", "ประเภท", "เบอร์โทร", "เวลาสมัคร", ...EVENT.booths.map((b) => `บูธ ${b.no} ${b.th}`), "จำนวนตรา", "เวลายื่นตั๋ว", "เจ้าหน้าที่ผู้สแกนตั๋ว"];
  const rows = [head];
  for (const r of results) {
    const st = Object.fromEntries((r.st || "").split(",").filter(Boolean).map((x) => x.split("@")));
    rows.push([
      r.id, r.name, r.school, { student: "นักเรียน", teacher: "ครู", guest: "บุคคลทั่วไป" }[r.role] || r.role, r.phone, thTime(r.created),
      ...EVENT.booths.map((b) => thTime(+st[b.id] || 0)), BOOTH_IDS.filter((b) => st[b]).length,
      thTime(r.redeemed), r.staff || "",
    ]);
  }
  const csv = "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  return new Response(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="tggc2569-activity-${Date.now()}.csv"`, "cache-control": "no-store" },
  });
}

async function api(env, req, url) {
  const route = req.method + " " + url.pathname;
  if (route === "POST /api/login") return login(env, req);
  if (route === "GET /api/ping") return json({ ok: true, now: Date.now() });

  const who = await staffFromReq(env, req);
  if (!who) return fail(401, "auth", "กรุณาเข้าสู่ระบบใหม่");
  const admin = who.role === "admin";

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
    return json({ ok: true, fresh, ...(await passportState(env, b.pid)), now: Date.now() });
  }
  if (route === "POST /api/redeem") {
    // prize counter: staff scanned the participant's ticket → record it once; the participant then fills in a raffle slip
    const b = await body(req);
    if (!/^G[0-9A-Z]{6}$/.test(b.pid || "")) return fail(400, "bad", "รหัสตั๋วไม่ถูกต้อง");
    const s0 = await passportState(env, b.pid);
    if (!s0) return fail(404, "nf", "ไม่พบตั๋ว/สมุดรหัสนี้");
    if (s0.redeem) return json({ ok: true, fresh: false, ...s0, now: Date.now() });
    if (!(await hasAllStamps(env, b.pid))) return fail(400, "incomplete", "ยังสะสมตราไม่ครบ ยังไม่มีสิทธิ์");
    const fresh = await redeemTicket(env, b.pid, who.name);
    return json({ ok: true, fresh, ...(await passportState(env, b.pid)), now: Date.now() });
  }

  if (!admin) return fail(403, "admin", "เฉพาะแอดมิน");
  if (route === "GET /api/admin/summary") return json({ ok: true, ...(await summary(env)), now: Date.now() });
  if (route === "GET /api/admin/export") return exportCsv(env);
  if (route === "GET /api/admin/redeemed") {
    // everyone who handed in a ticket: used to check a name drawn from the raffle box
    const { results } = await env.DB.prepare(
      `SELECT r.pid, r.at, r.staff, p.name, p.school, p.role FROM redeems r JOIN passports p ON p.id = r.pid ORDER BY r.at`
    ).all();
    return json({ ok: true, list: results, now: Date.now() });
  }
  if (route === "POST /api/admin/unredeem") {
    // undo a ticket scanned by mistake (admin only)
    const b = await body(req);
    if (!/^G[0-9A-Z]{6}$/.test(b.pid || "")) return fail(400, "bad", "ข้อมูลไม่ถูกต้อง");
    await env.DB.prepare("DELETE FROM redeems WHERE pid = ?").bind(b.pid).run();
    return json({ ok: true, ...(await passportState(env, b.pid)), now: Date.now() });
  }
  if (route === "POST /api/admin/reset") {
    // wipes test data before the real event: passports, stamps, tickets
    const b = await body(req);
    if (b.confirm !== "RESET") return fail(400, "confirm", "พิมพ์ RESET เพื่อยืนยัน");
    await env.DB.batch([
      env.DB.prepare("DELETE FROM stamps"),
      env.DB.prepare("DELETE FROM redeems"),
      env.DB.prepare("DELETE FROM passports"),
      env.DB.prepare("DELETE FROM attempts"),
    ]);
    return json({ ok: true, ...(await summary(env)), now: Date.now() });
  }
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
