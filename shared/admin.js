// Admin API, shared by the admin site (all of it) and the staff site (only what its screens still use).
// Every handler expects an already-verified admin token (see staffFromReq in server.js).
import { EVENT, BOOTH_IDS, REQUIRED } from "./event.js";
import {
  json, fail, body, master, readCounts, passportState, unredeemTicket, clean, boothConfig, dropBoothCache, BUCKET, rebuildTotals,
} from "./server.js";

const ROLE_TH = { student: "นักเรียน", teacher: "ครู", guest: "บุคคลทั่วไป" };
export const BOOTH_ICONS = ["map", "satellite", "compass", "drone", "globe", "leaf", "mountain", "pin", "star", "book", "uni", "plane", "drop"];
const LOGO_MIME = { "image/webp": 1, "image/png": 1, "image/jpeg": 1 };

/** headline numbers, straight from the running totals (~30-60 small rows) */
async function summary(env) {
  await master(env);
  const c = await readCounts(env);
  const pick = (prefix) => Object.fromEntries(Object.entries(c).filter(([k]) => k.startsWith(prefix)).map(([k, n]) => [k.slice(prefix.length), n]));
  const t = pick("t:");
  return {
    passports: c.p || 0,
    booths: pick("b:"),
    completed: c.done || 0,
    redeemed: c.rd || 0,
    roles: pick("r:"),
    // stamps per 15-minute bucket: [[bucket start ms, count], …] in time order
    timeline: Object.entries(t).map(([k, n]) => [+k * BUCKET, n]).sort((a, b) => a[0] - b[0]),
    bucket: BUCKET,
  };
}

// distribution of stamps per passport + top schools: one pass over passports (no stamp scan), cached briefly
let AN = null, AN_AT = 0;
async function analytics(env) {
  if (AN && Date.now() - AN_AT < 15000) return AN;
  const [d, s] = await env.DB.batch([
    env.DB.prepare("SELECT n, COUNT(*) AS c FROM passports GROUP BY n"),
    env.DB.prepare(`SELECT COALESCE(NULLIF(TRIM(school), ''), '(ไม่ระบุ)') AS school, COUNT(*) AS people, SUM(n >= ?) AS done, SUM(n) AS stamps
                      FROM passports GROUP BY 1 ORDER BY people DESC, done DESC LIMIT 15`).bind(REQUIRED),
  ]);
  const dist = Array(BOOTH_IDS.length + 1).fill(0);
  for (const r of d.results) dist[Math.min(BOOTH_IDS.length, Math.max(0, r.n))] += r.c;
  AN = { dist, schools: s.results };
  AN_AT = Date.now();
  return AN;
}

const csvCell = (v) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // keep spreadsheet formulas from running
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const thTime = (ms) => (ms ? new Date(ms + 7 * 3600e3).toISOString().replace("T", " ").slice(0, 19) : "");

async function exportCsv(env) {
  const cfg = (await boothConfig(env)).booths;
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.name, p.school, p.role, p.phone, p.created,
            (SELECT GROUP_CONCAT(booth || '@' || at) FROM stamps s WHERE s.pid = p.id) AS st,
            r.at AS redeemed, r.staff
       FROM passports p LEFT JOIN redeems r ON r.pid = p.id
      ORDER BY p.created`
  ).all();
  const head = ["รหัสสมุด", "ชื่อ", "โรงเรียน/หน่วยงาน", "ประเภท", "เบอร์โทร", "เวลาสมัคร", ...EVENT.booths.map((b) => `บูธ ${b.no} ${cfg[b.id]?.th || b.th}`), "จำนวนตรา", "เวลายื่นตั๋ว", "เจ้าหน้าที่ผู้สแกนตั๋ว"];
  const rows = [head];
  for (const r of results) {
    const st = Object.fromEntries((r.st || "").split(",").filter(Boolean).map((x) => x.split("@")));
    rows.push([
      r.id, r.name, r.school, ROLE_TH[r.role] || r.role, r.phone, thTime(r.created),
      ...EVENT.booths.map((b) => thTime(+st[b.id] || 0)), BOOTH_IDS.filter((b) => st[b]).length,
      thTime(r.redeemed), r.staff || "",
    ]);
  }
  const csv = "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  return new Response(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="tggc2569-activity-${Date.now()}.csv"`, "cache-control": "no-store" },
  });
}

// ---------- booth details ----------
const txt = (v, n) => { const s = clean(v, n); return s || null; };
async function saveBooth(env, id, b, who) {
  const en = txt(String(b.en || "").toUpperCase().replace(/[^A-Z0-9 .&\-·×'()/]/g, ""), 30);
  const icon = BOOTH_ICONS.includes(b.icon) ? b.icon : null;
  const desc = String(b.desc || "").replace(/[\u0000-\u0009\u000b-\u001f<>]/g, "").trim().slice(0, 400) || null;
  await env.DB.prepare(
    `INSERT INTO booth_cfg (id, th, en, place, icon, descr, logo, updated, staff) VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?7, ?8)
     ON CONFLICT (id) DO UPDATE SET th = ?2, en = ?3, place = ?4, icon = ?5, descr = ?6, updated = ?7, staff = ?8`
  ).bind(id, txt(b.th, 120), en, txt(b.place, 160), icon, desc, Date.now(), who.name).run();
}
async function saveLogo(env, id, data, who) {
  const m = /^data:(image\/(?:webp|png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(String(data || ""));
  if (!m || !LOGO_MIME[m[1]]) return "ไฟล์รูปไม่ถูกต้อง (รองรับ PNG, JPG, WebP)";
  if (m[2].length > 400000) return "รูปใหญ่เกินไป (ไม่เกิน 300 KB หลังย่อ)";
  const v = Date.now().toString(36);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO booth_logo (id, v, mime, data) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (id) DO UPDATE SET v = ?2, mime = ?3, data = ?4").bind(id, v, m[1], m[2]),
    env.DB.prepare(
      `INSERT INTO booth_cfg (id, logo, updated, staff) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (id) DO UPDATE SET logo = ?2, updated = ?3, staff = ?4`
    ).bind(id, v, Date.now(), who.name),
  ]);
  return null;
}

/** returns a Response, or null when the route is not an admin route */
export async function adminApi(env, req, url, who) {
  const route = req.method + " " + url.pathname;
  if (!url.pathname.startsWith("/api/admin/")) return null;
  if (who.role !== "admin") return fail(403, "admin", "เฉพาะแอดมิน");

  if (route === "GET /api/admin/summary") return json({ ok: true, ...(await summary(env)), now: Date.now() });
  if (route === "GET /api/admin/analytics") return json({ ok: true, ...(await summary(env)), ...(await analytics(env)), required: REQUIRED, now: Date.now() });
  if (route === "GET /api/admin/export") return exportCsv(env);
  if (route === "GET /api/admin/redeemed") {
    // everyone who handed in a ticket: used to check a name drawn from the raffle box
    const { results } = await env.DB.prepare(
      `SELECT r.pid, r.at, r.staff, p.name, p.school, p.role FROM redeems r JOIN passports p ON p.id = r.pid ORDER BY r.at`
    ).all();
    return json({ ok: true, list: results, now: Date.now() });
  }
  if (route === "POST /api/admin/unredeem") {
    const b = await body(req);
    if (!/^G[0-9A-Z]{6}$/.test(b.pid || "")) return fail(400, "bad", "ข้อมูลไม่ถูกต้อง");
    await unredeemTicket(env, b.pid);
    return json({ ok: true, ...(await passportState(env, b.pid)), now: Date.now() });
  }
  if (route === "GET /api/admin/passports") {
    // everyone who opened a passport (newest first), to find and remove test entries
    const { results } = await env.DB.prepare(
      `SELECT p.id, p.name, p.school, p.role, p.phone, p.created, p.n, r.at AS redeemed
         FROM passports p LEFT JOIN redeems r ON r.pid = p.id ORDER BY p.created DESC LIMIT 5000`
    ).all();
    return json({ ok: true, list: results, total: BOOTH_IDS.length, now: Date.now() });
  }
  if (route === "POST /api/admin/passports/delete") {
    // delete chosen passports with their stamps and ticket, then recompute every total — one transaction
    const b = await body(req);
    const ids = [...new Set(Array.isArray(b.ids) ? b.ids : [])].filter((x) => /^G[0-9A-Z]{6}$/.test(x));
    if (!ids.length || ids.length > 1000) return fail(400, "bad", "เลือกได้ 1–1,000 รายการต่อครั้ง");
    const db = env.DB, stmts = [];
    for (let i = 0; i < ids.length; i += 90) { // D1: at most 100 bound values per statement
      const part = ids.slice(i, i + 90), q = part.map(() => "?").join(",");
      stmts.push(
        db.prepare(`DELETE FROM stamps WHERE pid IN (${q})`).bind(...part),
        db.prepare(`DELETE FROM redeems WHERE pid IN (${q})`).bind(...part),
        db.prepare(`DELETE FROM attempts WHERE k IN (${q})`).bind(...part.map((x) => "code:" + x)),
        db.prepare(`DELETE FROM passports WHERE id IN (${q})`).bind(...part),
      );
    }
    const res = await db.batch([...stmts, ...rebuildTotals(db)]);
    AN = null; // dashboard cache
    const deleted = res.filter((_, i) => i < stmts.length && i % 4 === 3).reduce((a, r) => a + r.meta.changes, 0);
    return json({ ok: true, deleted, ...(await summary(env)), now: Date.now() });
  }
  if (route === "POST /api/admin/reset") {
    // wipes test data before the real event: passports, stamps, tickets (booth details and logos stay)
    const b = await body(req);
    if (b.confirm !== "RESET") return fail(400, "confirm", "พิมพ์ RESET เพื่อยืนยัน");
    await env.DB.batch(["stamps", "redeems", "completed", "counts", "passports", "attempts"].map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
    AN = null;
    return json({ ok: true, ...(await summary(env)), now: Date.now() });
  }

  // booth details + logos
  if (route === "GET /api/admin/booths") return json({ ok: true, ...(await boothConfig(env, true)), icons: BOOTH_ICONS, now: Date.now() });
  const m = url.pathname.match(/^\/api\/admin\/booths\/([a-z0-9_-]+)(\/logo)?$/);
  if (m && BOOTH_IDS.includes(m[1])) {
    const id = m[1];
    let err = null;
    if (req.method === "PUT" && !m[2]) await saveBooth(env, id, await body(req), who);
    else if (req.method === "DELETE" && !m[2]) await env.DB.batch([env.DB.prepare("DELETE FROM booth_cfg WHERE id = ?").bind(id), env.DB.prepare("DELETE FROM booth_logo WHERE id = ?").bind(id)]);
    else if (req.method === "POST" && m[2]) err = await saveLogo(env, id, (await body(req)).data, who);
    else if (req.method === "DELETE" && m[2]) await env.DB.batch([env.DB.prepare("DELETE FROM booth_logo WHERE id = ?").bind(id), env.DB.prepare("UPDATE booth_cfg SET logo = NULL, updated = ? WHERE id = ?").bind(Date.now(), id)]);
    else return fail(405, "method", "method not allowed");
    if (err) return fail(400, "logo", err);
    dropBoothCache();
    return json({ ok: true, ...(await boothConfig(env, true)), now: Date.now() });
  }
  return fail(404, "nf", "not found");
}
