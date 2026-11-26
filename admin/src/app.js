// TGGC 2026 admin site: dashboard (live totals + charts), booth names/logos, ticket list, CSV, reset.
import { EVENT, REQUIRED } from "../../shared/event.js";
import { icon } from "../../shared/web/icons.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmtN = (n) => Number(n || 0).toLocaleString("th-TH");
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const hhmm = (ms) => new Date(ms).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
const ROLE = [["student", "นักเรียน", "var(--r1)"], ["teacher", "ครู", "var(--r2)"], ["guest", "บุคคลทั่วไป", "var(--r3)"]];
const DEFAULTS = Object.fromEntries(EVENT.booths.map((b) => [b.id, { ...b }]));
const ALL = EVENT.booths.length;

// ---------------------------------------------------------------- auth + api
const KEY = "tggc2569-admin-v1";
let A = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } })();
const saveAuth = () => { try { A ? localStorage.setItem(KEY, JSON.stringify(A)) : localStorage.removeItem(KEY); } catch { /* ignore */ } };
const expired = () => !A || +A.token.split(".")[1] < Date.now();

async function api(path, data, method = data ? "POST" : "GET") {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  let r;
  try {
    r = await fetch(path, { method, signal: ctl.signal, headers: { "content-type": "application/json", ...(A ? { authorization: "Bearer " + A.token } : {}) }, body: data ? JSON.stringify(data) : undefined });
  } catch { throw new Error("เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ต"); } finally { clearTimeout(t); }
  if ((r.headers.get("content-type") || "").includes("text/csv")) return r;
  const j = await r.json().catch(() => null);
  if (r.status === 401 && A) { A = null; saveAuth(); route(); }
  if (!r.ok || !j || j.ok === false) throw new Error((j && j.message) || "เกิดข้อผิดพลาด");
  return j;
}

let toastT = 0;
function toast(m, err = false) { const t = $("#toast"); t.textContent = m; t.classList.toggle("err", err); t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 3200); }

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#lgErr").hidden = true; $("#lgBtn").disabled = true;
  try {
    const j = await api("/api/login", { pin: $("#lgPin").value, name: $("#lgName").value });
    A = { token: j.token, name: j.name }; saveAuth();
    try { localStorage.setItem(KEY + "-name", j.name); } catch { /* ignore */ }
    $("#lgPin").value = "";
    route();
  } catch (ex) { $("#lgErr").textContent = ex.message; $("#lgErr").hidden = false; }
  finally { $("#lgBtn").disabled = false; }
});
$("#logoutBtn").onclick = () => { if (confirm("ออกจากระบบ?")) { A = null; saveAuth(); route(); } };

// ---------------------------------------------------------------- router
let tab = "dash", timer = 0;
function route() {
  clearInterval(timer);
  if (!A || expired()) {
    A = null; saveAuth();
    $("#app").hidden = true; $("#login").hidden = false;
    try { $("#lgName").value = localStorage.getItem(KEY + "-name") || ""; } catch { /* ignore */ }
    return;
  }
  $("#login").hidden = true; $("#app").hidden = false;
  $("#who").textContent = A.name;
  tab = (location.hash.match(/^#\/(\w+)/) || [])[1] || "dash";
  if (!["dash", "booths", "tickets", "data"].includes(tab)) tab = "dash";
  $$("[data-view]").forEach((v) => (v.hidden = v.dataset.view !== tab));
  $$(".tabs a").forEach((a) => a.classList.toggle("on", a.dataset.tab === tab));
  load();
  if (tab === "dash") timer = setInterval(() => { if (!document.hidden) load(true); }, 30000);
}
addEventListener("hashchange", route);
$("#refreshBtn").onclick = () => load();
function load(quiet) {
  if (tab === "dash") return loadDash(quiet);
  if (tab === "booths") return loadBooths();
  if (tab === "tickets") return loadTickets();
  if (tab === "data") return renderData();
}
const stamp = () => ($("#upd").textContent = "อัปเดต " + hhmm(Date.now()));

// ---------------------------------------------------------------- tooltip
const tip = $("#tip");
function showTip(html, x, y) {
  tip.innerHTML = html; tip.hidden = false;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, x - w / 2)) + "px";
  tip.style.top = (y - h - 12 < 8 ? y + 16 : y - h - 12) + "px";
}
const hideTip = () => (tip.hidden = true);
addEventListener("scroll", hideTip, { passive: true });

// ---------------------------------------------------------------- dashboard
let D = null, CFG = { booths: {} };
async function loadDash(quiet) {
  try {
    const [d, c] = await Promise.all([api("/api/admin/analytics"), quiet && CFG.v != null ? Promise.resolve(CFG) : api("/api/booths")]);
    D = d; CFG = c; stamp(); renderDash();
  } catch (ex) { if (!quiet) toast(ex.message, true); }
}
const boothOf = (id) => ({ ...DEFAULTS[id], ...(CFG.booths[id] || {}) });
const logoSrc = (id) => (CFG.booths[id]?.logo ? `/api/logo/${id}?v=${CFG.booths[id].logo}` : "");

function renderDash() {
  if (!D) return;
  const stamps = Object.values(D.booths).reduce((a, b) => a + b, 0);
  const top = Object.entries(D.booths).sort((a, b) => b[1] - a[1])[0];
  const kp = [
    ["ผู้เปิดสมุด", fmtN(D.passports), `นร. ${fmtN(D.roles.student)} · ครู ${fmtN(D.roles.teacher)} · ทั่วไป ${fmtN(D.roles.guest)}`],
    ["ตราที่ให้ทั้งหมด", fmtN(stamps), D.passports ? `เฉลี่ย ${(stamps / D.passports).toFixed(1)} ตรา/คน` : "–"],
    ["สะสมครบ " + REQUIRED + " ตรา", fmtN(D.completed), `${pct(D.completed, D.passports)}% ของผู้เปิดสมุด`],
    ["ยื่นตั๋วแล้ว", fmtN(D.redeemed), "= ใบจับฉลากในกล่อง"],
    ["ครบแต่ยังไม่ยื่นตั๋ว", fmtN(Math.max(0, D.completed - D.redeemed)), "คน"],
    ["บูธที่คนมากที่สุด", top && top[1] ? `${boothOf(top[0]).no}. ${boothOf(top[0]).th}` : "–", top && top[1] ? `${fmtN(top[1])} ตรา` : "ยังไม่มีข้อมูล", true],
  ];
  $("#kpis").innerHTML = kp.map(([a, b, c, t]) => `<div class="kpi"><span>${a}</span><b class="${t ? "txt" : ""}">${esc(b)}</b><small>${esc(c)}</small></div>`).join("");
  timeChart(); boothBars(); funnel(); distChart(); roles(); schools();
}

const table = (head, rows, nCols = []) => `<div class="tbl-wrap"><table><thead><tr>${head.map((h, i) => `<th class="${nCols.includes(i) ? "n" : ""}">${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td class="${nCols.includes(i) ? "n" : ""}">${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
/** clean axis: whole-number step of 1/2/5 × 10^k, about 4 ticks, top = first tick at or above max */
function axis(max) {
  const raw = Math.max(1, max) / 4, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p;
  const step = Math.max(1, (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p);
  const top = Math.max(step, Math.ceil(Math.max(1, max) / step) * step);
  return { top, step, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, k) => k * step) };
}

// stamps per 15 minutes: area (10% wash) + 2px line, crosshair + tooltip
function timeChart() {
  const el = $("#chTime");
  const B = D.bucket, raw = new Map(D.timeline.map(([t, n]) => [t, n]));
  if (!raw.size) { el.innerHTML = `<p class="empty">ยังไม่มีการประทับตรา</p>`; $("#tbTime").innerHTML = ""; return; }
  let t0 = Math.min(...raw.keys()), t1 = Math.max(...raw.keys());
  const nowB = Math.floor(Date.now() / B) * B;
  if (nowB > t1 && nowB - t1 < 6 * 3600e3) t1 = nowB; // show the quiet time since the last stamp (same day)
  const pts = [];
  for (let t = t0; t <= t1; t += B) pts.push([t, raw.get(t) || 0]);
  const W = Math.max(320, el.clientWidth), H = 240, L = 40, R = 14, T = 16, Bm = 26;
  const ax = axis(Math.max(...pts.map((p) => p[1]))), ymax = ax.top;
  const n = pts.length, x = (i) => L + (n === 1 ? (W - L - R) / 2 : (i / (n - 1)) * (W - L - R)), y = (v) => T + (1 - v / ymax) * (H - T - Bm);
  let g = "";
  for (const v of ax.ticks) { const yy = y(v); g += `<line class="${v ? "grid" : "base"}" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/><text x="${L - 6}" y="${yy + 4}" text-anchor="end">${fmtN(v)}</text>`; }
  // hour ticks
  const step = n > 40 ? 4 * 2 : 4; // every hour (or 2 h when long)
  pts.forEach(([t], i) => { if (new Date(t).getUTCMinutes() === 0 && (Math.round((t - t0) / B) % step === 0 || n <= 8)) g += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${hhmm(t)}</text>`; });
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p[1]).toFixed(1)}`).join("");
  const area = `${line}L${x(n - 1).toFixed(1)} ${y(0)}L${x(0).toFixed(1)} ${y(0)}Z`;
  const peak = pts.reduce((a, p, i) => (p[1] > pts[a][1] ? i : a), 0);
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="กราฟจำนวนตราต่อช่วง 15 นาที">${g}
    <path d="${area}" fill="var(--series-wash)"/><path d="${line}" fill="none" stroke="var(--series)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <text class="val" x="${x(peak)}" y="${y(pts[peak][1]) - 8}" text-anchor="middle">${fmtN(pts[peak][1])}</text>
    <g id="xh" visibility="hidden"><line class="xh" y1="${T}" y2="${H - Bm}"/><circle r="4.5" fill="var(--series)" stroke="#fff" stroke-width="2"/></g>
    <rect class="hit" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - Bm}"/></svg>`;
  const svg = el.firstElementChild, xh = $("#xh", svg), hit = $(".hit", svg);
  const move = (ev) => {
    const r = svg.getBoundingClientRect(), px = ((ev.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(n - 1, Math.round(((px - L) / (W - L - R)) * (n - 1))));
    xh.setAttribute("visibility", "visible");
    $("line", xh).setAttribute("x1", x(i)); $("line", xh).setAttribute("x2", x(i));
    $("circle", xh).setAttribute("cx", x(i)); $("circle", xh).setAttribute("cy", y(pts[i][1]));
    showTip(`<b>${fmtN(pts[i][1])} ตรา</b>${hhmm(pts[i][0])}–${hhmm(pts[i][0] + B)} น.`, r.left + (x(i) / W) * r.width, r.top + (y(pts[i][1]) / H) * r.height);
  };
  hit.addEventListener("pointermove", move); hit.addEventListener("pointerdown", move);
  hit.addEventListener("pointerleave", () => { xh.setAttribute("visibility", "hidden"); hideTip(); });
  $("#tbTime").innerHTML = table(["ช่วงเวลา", "ตรา"], pts.filter((p) => p[1]).map(([t, v]) => [`${hhmm(t)}–${hhmm(t + B)}`, fmtN(v)]), [1]);
}

// per-booth horizontal bars (HTML rows: logo + name, bar, value at the tip)
function boothBars() {
  const rows = EVENT.booths.map((b) => ({ id: b.id, b: boothOf(b.id), v: D.booths[b.id] || 0 })).sort((a, b) => b.v - a.v || a.b.no - b.b.no);
  const max = Math.max(1, ...rows.map((r) => r.v));
  $("#chBooths").innerHTML = `<div class="hbars">${rows.map((r) => `<div class="hb" data-tip="${esc(`<b>${fmtN(r.v)} ตรา</b>${r.b.no}. ${r.b.th}<br>${pct(r.v, D.passports)}% ของผู้เปิดสมุด`)}">
      <span class="hb-l">${logoSrc(r.id) ? `<img src="${logoSrc(r.id)}" alt="">` : `<em>${r.b.no}</em>`}<span>${esc(r.b.th)}</span></span>
      <span class="hb-t"><i style="width:${(r.v / max) * 100}%"></i></span><b>${fmtN(r.v)}</b></div>`).join("")}</div>`;
  $("#tbBooths").innerHTML = table(["บูธ", "ตรา", "% ของผู้เปิดสมุด"], rows.map((r) => [`${r.b.no}. ${esc(r.b.th)}`, fmtN(r.v), pct(r.v, D.passports) + "%"]), [1, 2]);
}

// passport → ≥1 stamp → half → complete → ticket (ordinal bars, one hue)
function funnel() {
  const dist = D.dist, sum = (from) => dist.slice(from).reduce((a, b) => a + b, 0), half = Math.ceil(REQUIRED / 2);
  const st = [["เปิดสมุด", D.passports], ["ได้ตราอย่างน้อย 1", sum(1)], [`ได้ ${half} ตราขึ้นไป`, sum(half)], [`ครบ ${REQUIRED} ตรา`, D.completed], ["ยื่นตั๋วแล้ว", D.redeemed]];
  const max = Math.max(1, st[0][1]);
  $("#chFunnel").innerHTML = `<div class="hbars fn">${st.map(([l, v]) => `<div class="hb" data-tip="${esc(`<b>${fmtN(v)} คน</b>${l} · ${pct(v, D.passports)}%`)}"><span class="hb-l"><span>${l}</span></span>
    <span class="hb-t"><i style="width:${(v / max) * 100}%"></i></span><b>${fmtN(v)}<small>${pct(v, D.passports)}%</small></b></div>`).join("")}</div>`;
  $("#tbFunnel").innerHTML = table(["ขั้น", "คน", "%"], st.map(([l, v]) => [l, fmtN(v), pct(v, D.passports) + "%"]), [1, 2]);
}

// people by number of stamps (columns 0…23, 4px rounded caps, square at the baseline)
function distChart() {
  const el = $("#chDist"), d = D.dist, n = d.length;
  if (!D.passports) { el.innerHTML = `<p class="empty">ยังไม่มีผู้เปิดสมุด</p>`; $("#tbDist").innerHTML = ""; return; }
  const W = Math.max(300, el.clientWidth), H = 190, L = 34, R = 6, T = 18, Bm = 22;
  const ax = axis(Math.max(...d)), ymax = ax.top, slot = (W - L - R) / n, bw = Math.min(24, slot - 2);
  const y = (v) => T + (1 - v / ymax) * (H - T - Bm);
  let g = "";
  for (const v of ax.ticks) { const yy = y(v); g += `<line class="${v ? "grid" : "base"}" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/><text x="${L - 6}" y="${yy + 4}" text-anchor="end">${fmtN(v)}</text>`; }
  const peak = d.indexOf(Math.max(...d));
  d.forEach((v, i) => {
    const cx = L + slot * i + slot / 2, x0 = cx - bw / 2, top = y(v), base = y(0), r = Math.min(4, bw / 2, base - top);
    const path = v ? `M${x0} ${base}V${top + r}Q${x0} ${top} ${x0 + r} ${top}H${x0 + bw - r}Q${x0 + bw} ${top} ${x0 + bw} ${top + r}V${base}Z` : "";
    g += `<g data-tip="${esc(`<b>${fmtN(v)} คน</b>สะสมได้ ${i} ตรา${i === REQUIRED ? " (ครบ)" : ""}`)}"><rect class="hit" x="${L + slot * i}" y="${T}" width="${slot}" height="${H - T - Bm}"/>${path ? `<path class="mark" d="${path}"/>` : ""}</g>`;
    if (i % (slot < 16 ? 5 : 1) === 0 || i === n - 1) g += `<text x="${cx}" y="${H - 6}" text-anchor="middle">${i}</text>`;
    if (v && (i === peak || i === n - 1)) g += `<text class="val" x="${cx}" y="${top - 5}" text-anchor="middle">${fmtN(v)}</text>`;
  });
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="จำนวนคนตามจำนวนตราที่สะสมได้">${g}</svg>`;
  $("#tbDist").innerHTML = table(["จำนวนตรา", "คน"], d.map((v, i) => [i, fmtN(v)]), [1]);
}

function roles() {
  const tot = ROLE.reduce((a, [k]) => a + (D.roles[k] || 0), 0);
  $("#chRoles").innerHTML = tot ? `<div class="seg">${ROLE.map(([k, l, c]) => (D.roles[k] ? `<i style="flex:${D.roles[k]};background:${c}" data-tip="${esc(`<b>${fmtN(D.roles[k])} คน</b>${l} · ${pct(D.roles[k], tot)}%`)}"></i>` : "")).join("")}</div>
    <div class="legend">${ROLE.map(([k, l, c]) => `<span><i style="background:${c}"></i>${l} <b>${fmtN(D.roles[k])}</b> (${pct(D.roles[k] || 0, tot)}%)</span>`).join("")}</div>` : `<p class="empty">ยังไม่มีผู้เปิดสมุด</p>`;
  $("#tbRoles").innerHTML = table(["ประเภท", "คน", "%"], ROLE.map(([k, l]) => [l, fmtN(D.roles[k]), pct(D.roles[k] || 0, tot) + "%"]), [1, 2]);
}

function schools() {
  $("#tbSchools").innerHTML = D.schools.length
    ? table(["โรงเรียน / หน่วยงาน", "คน", `ครบ ${REQUIRED}`, "ตรา"], D.schools.map((s) => [esc(s.school), fmtN(s.people), fmtN(s.done), fmtN(s.stamps)]), [1, 2, 3])
    : `<p class="empty">ยังไม่มีข้อมูล</p>`;
}

// hover tooltips for HTML bars / SVG columns / segments
document.addEventListener("pointerover", (e) => {
  const t = e.target.closest("[data-tip]");
  if (!t || !t.closest("[data-view=dash]")) return;
  const r = t.getBoundingClientRect();
  showTip(t.dataset.tip, r.left + r.width / 2, r.top);
  $$(".on", t.parentElement).forEach((x) => x.classList.remove("on")); t.classList.add("on");
});
document.addEventListener("pointerout", (e) => { const t = e.target.closest("[data-tip]"); if (t) { t.classList.remove("on"); hideTip(); } });
let rsz = 0;
addEventListener("resize", () => { clearTimeout(rsz); rsz = setTimeout(() => { if (tab === "dash" && D) renderDash(); }, 150); });

// ---------------------------------------------------------------- booths
let ICONS = [];
async function loadBooths() {
  try { const j = await api("/api/admin/booths"); CFG = j; ICONS = j.icons; stamp(); renderBooths(); }
  catch (ex) { toast(ex.message, true); }
}
function boothCard(def) {
  const o = CFG.booths[def.id] || {}, b = { ...def, ...o }, edited = Object.keys(o).length > 0;
  return `<form class="be" data-id="${def.id}" style="--c:${def.color}" autocomplete="off">
    <div class="be-h">
      <label class="logo-box" title="อัปโหลดโลโก้">${o.logo ? `<img src="/api/logo/${def.id}?v=${o.logo}" alt="โลโก้">` : icon("download")}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" data-logo></label>
      <div><div class="be-no">BOOTH ${String(def.no).padStart(2, "0")}${edited ? "<em>แก้ไขแล้ว</em>" : ""}</div><div class="be-t">${esc(b.th)}</div>
        <div class="be-links">${o.logo ? `<button type="button" class="del" data-act="nologo">ลบโลโก้</button>` : `<span class="sub">แตะกรอบเพื่อใส่โลโก้</span>`}${edited ? `<button type="button" class="del" data-act="reset">คืนค่าเดิมทั้งหมด</button>` : ""}</div></div>
    </div>
    <label class="field"><span>ชื่อบูธ</span><input class="input" name="th" maxlength="120" value="${esc(b.th)}" placeholder="${esc(def.th)}" required></label>
    <label class="field"><span>ชื่อบนตราประทับ (อังกฤษ)</span><input class="input" name="en" maxlength="30" value="${esc(b.en)}" placeholder="${esc(def.en)}" style="text-transform:uppercase"><small>ตัวพิมพ์ใหญ่ ไม่เกิน 30 ตัว · ยาวแล้วตัวอักษรบนตราจะเล็กลง</small></label>
    <label class="field"><span>ตำแหน่ง</span><input class="input" name="place" maxlength="160" value="${esc(b.place)}" placeholder="${esc(def.place)}"></label>
    <div class="field"><span>ไอคอนบนตรา</span><div class="icons">${ICONS.map((k) => `<label title="${k}"><input type="radio" name="icon" value="${k}" ${b.icon === k ? "checked" : ""}><span>${icon(k)}</span></label>`).join("")}</div></div>
    <label class="field"><span>รายละเอียดกิจกรรม (ไม่บังคับ)</span><textarea class="input" name="desc" maxlength="400" placeholder="แสดงเมื่อผู้เข้าร่วมแตะดูบูธ">${esc(b.desc || "")}</textarea></label>
    <div class="be-foot"><small>${o.th || o.en || o.place || o.icon || o.desc ? "" : "ใช้ค่าเริ่มต้นจากสูจิบัตร"}</small><button class="btn sm" type="submit" disabled>บันทึก</button></div>
  </form>`;
}
function renderBooths() {
  const q = $("#bq").value.trim().toLowerCase();
  $("#booths").innerHTML = EVENT.booths.filter((d) => !q || [d.th, d.en, CFG.booths[d.id]?.th, CFG.booths[d.id]?.en, String(d.no)].some((v) => String(v || "").toLowerCase().includes(q))).map(boothCard).join("");
}
$("#bq").addEventListener("input", renderBooths);
$("#booths").addEventListener("input", (e) => { const f = e.target.closest(".be"); if (f && !e.target.matches("[data-logo]")) { f.classList.add("dirty"); $("button[type=submit]", f).disabled = false; } });
$("#booths").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target, id = f.dataset.id, d = DEFAULTS[id], v = Object.fromEntries(new FormData(f));
  // store only what differs from the programme, so later fixes to the defaults still show through
  const body = {};
  for (const k of ["th", "en", "place", "icon", "desc"]) { const val = String(v[k] || "").trim(); body[k] = val && val !== String(d[k] || "").trim() && !(k === "en" && val.toUpperCase() === d.en) ? val : ""; }
  const btn = $("button[type=submit]", f); btn.disabled = true;
  try { CFG = { ...CFG, ...(await api(`/api/admin/booths/${id}`, body, "PUT")) }; toast(`บันทึกบูธ ${d.no} แล้ว`); f.outerHTML = boothCard(d); }
  catch (ex) { toast(ex.message, true); btn.disabled = false; }
});
$("#booths").addEventListener("click", async (e) => {
  const a = e.target.closest("[data-act]"); if (!a) return;
  const f = a.closest(".be"), id = f.dataset.id, d = DEFAULTS[id];
  if (a.dataset.act === "reset" && !confirm(`คืนค่าบูธ ${d.no} เป็นค่าเริ่มต้น (รวมลบโลโก้)?`)) return;
  if (a.dataset.act === "nologo" && !confirm("ลบโลโก้บูธนี้?")) return;
  try {
    CFG = { ...CFG, ...(await api(`/api/admin/booths/${id}${a.dataset.act === "nologo" ? "/logo" : ""}`, null, "DELETE")) };
    toast("เรียบร้อย"); f.outerHTML = boothCard(d);
  } catch (ex) { toast(ex.message, true); }
});
$("#booths").addEventListener("change", async (e) => {
  if (!e.target.matches("[data-logo]") || !e.target.files[0]) return;
  const f = e.target.closest(".be"), id = f.dataset.id;
  try {
    toast("กำลังอัปโหลดโลโก้…");
    const data = await shrink(e.target.files[0]);
    CFG = { ...CFG, ...(await api(`/api/admin/booths/${id}/logo`, { data })) };
    toast("อัปโหลดโลโก้แล้ว"); f.outerHTML = boothCard(DEFAULTS[id]);
  } catch (ex) { toast(ex.message || "อ่านไฟล์รูปไม่ได้", true); }
});
/** fit the logo into 320×320 (transparent edges kept), as WebP when the browser can make one, else PNG */
function shrink(file) {
  return new Promise((res, rej) => {
    if (file.size > 15e6) return rej(new Error("ไฟล์ใหญ่เกิน 15 MB"));
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const S = 320, k = Math.min(1, S / Math.max(img.naturalWidth || S, img.naturalHeight || S));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round((img.naturalWidth || S) * k)); c.height = Math.max(1, Math.round((img.naturalHeight || S) * k));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let d = c.toDataURL("image/webp", 0.9);
      if (!d.startsWith("data:image/webp")) d = c.toDataURL("image/png");
      res(d);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("อ่านไฟล์รูปไม่ได้")); };
    img.src = url;
  });
}

// ---------------------------------------------------------------- tickets
let RD = [];
async function loadTickets() {
  try { RD = (await api("/api/admin/redeemed")).list; stamp(); renderTickets(); } catch (ex) { toast(ex.message, true); }
}
function renderTickets() {
  const q = $("#tq").value.trim().toLowerCase();
  const list = q ? RD.filter((r) => [r.name, r.school, r.pid].some((v) => String(v || "").toLowerCase().includes(q))) : RD;
  $("#tInfo").textContent = q ? `พบ ${fmtN(list.length)} จาก ${fmtN(RD.length)} คน` : `ยื่นตั๋วแล้วทั้งหมด ${fmtN(RD.length)} คน`;
  $("#tlist").innerHTML = list.slice(0, 300).map((r) => `<div class="tl"><b>${esc(r.name)}</b><time>${hhmm(r.at)}</time>
    <button class="btn ghost sm" type="button" data-unredeem="${esc(r.pid)}">ยกเลิก</button>
    <small>${esc(r.school || "")} · ${esc(r.pid)}${r.staff ? " · สแกนโดย " + esc(r.staff) : ""}</small></div>`).join("")
    + (list.length > 300 ? `<p class="sub">แสดง 300 รายการแรก พิมพ์ค้นหาเพื่อกรอง</p>` : "") + (!RD.length ? `<p class="empty">ยังไม่มีผู้ยื่นตั๋ว</p>` : "");
}
$("#tq").addEventListener("input", renderTickets);
$("#tlist").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-unredeem]"); if (!b) return;
  const r = RD.find((x) => x.pid === b.dataset.unredeem);
  if (!confirm(`ยกเลิกการยื่นตั๋วของ ${r ? r.name : b.dataset.unredeem}? (ใช้เมื่อสแกนผิดคนเท่านั้น)`)) return;
  b.disabled = true;
  try { await api("/api/admin/unredeem", { pid: b.dataset.unredeem }); toast("ยกเลิกแล้ว"); loadTickets(); } catch (ex) { toast(ex.message, true); b.disabled = false; }
});

// ---------------------------------------------------------------- data
function renderData() {
  $("#links").innerHTML = [["เว็บผู้เข้าร่วม (สะสมตรา)", EVENT.participantUrl], ["เว็บเจ้าหน้าที่", EVENT.participantUrl.replace("tggc2569-activity.", "tggc2569-activity-staff.")]]
    .map(([l, u]) => `<li>${l}: <a href="${u}" target="_blank" rel="noopener">${u}</a></li>`).join("");
}
$("#exportBtn").onclick = async () => {
  try {
    const r = await api("/api/admin/export"), blob = await r.blob(), a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tggc2569-สะสมตรา-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "")}.csv`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch (ex) { toast(ex.message, true); }
};
$("#resetBtn").onclick = async () => {
  if ($("#resetTxt").value.trim() !== "RESET") { toast("พิมพ์ RESET ให้ถูกต้องก่อน", true); return; }
  if (!confirm("ลบข้อมูลผู้เข้าร่วมทั้งหมดจริงหรือไม่? ย้อนกลับไม่ได้")) return;
  try { await api("/api/admin/reset", { confirm: "RESET" }); $("#resetTxt").value = ""; toast("ล้างข้อมูลแล้ว"); } catch (ex) { toast(ex.message, true); }
};

route();
