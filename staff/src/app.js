// TGGC 2026 staff site: rotating booth QR (works offline once logged in), scan passports,
// prize point feed + hand-out, admin dashboard.
import { EVENT, BOOTH_IDS, REQUIRED, boothById } from "../../shared/event.js";
import { STEP, windowAt, codeFor, makePayload } from "../../shared/otp.js";
import { icon } from "../../shared/web/icons.js";
import { qrSvg } from "../../shared/web/qr.js";
import { startScanner } from "../../shared/web/scanner.js";
import { sfx, buzz, burst, fireworks } from "../../shared/web/fx.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const PRIZE = EVENT.prizePoint.id;
const KEY = "tggc2569-staff-v1";
const ROLE_TH = { student: "นักเรียน", teacher: "ครู", guest: "บุคคลทั่วไป" };
const fmt = (ms) => (ms ? new Date(ms).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }) : "");

let A = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } })();
const saveAuth = () => { try { A ? localStorage.setItem(KEY, JSON.stringify(A)) : localStorage.removeItem(KEY); } catch { /* ignore */ } };
const tokenExpired = () => !A || +A.token.split(".")[1] < Date.now();
let offset = (A && A.offset) || 0; // server clock − device clock
const now = () => Date.now() + offset;

// ---------------------------------------------------------------- api
async function api(path, data, method = data ? "POST" : "GET") {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 12000);
  const sent = Date.now();
  let r;
  try {
    r = await fetch(path, { method, signal: ctl.signal, headers: { "content-type": "application/json", ...(A ? { authorization: "Bearer " + A.token } : {}) }, body: data ? JSON.stringify(data) : undefined });
  } catch {
    setNet(false);
    throw Object.assign(new Error("ไม่มีสัญญาณอินเทอร์เน็ต"), { net: true });
  } finally { clearTimeout(t); }
  setNet(true);
  if ((r.headers.get("content-type") || "").includes("text/csv")) return r;
  const j = await r.json().catch(() => null);
  if (j && j.now) { offset = j.now - (sent + Date.now()) / 2; if (A) { A.offset = offset; saveAuth(); } }
  if (r.status === 401 && A) { A = null; saveAuth(); route(); }
  if (!r.ok || !j || j.ok === false) throw Object.assign(new Error((j && j.message) || "เกิดข้อผิดพลาด"), { code: j && j.error });
  return j;
}
let online = true;
function setNet(on) {
  online = on;
  const p = $("#netPill");
  if (p) { p.classList.toggle("off", !on); p.lastElementChild.textContent = on ? "ออนไลน์" : "ออฟไลน์ · QR ยังใช้ได้"; }
}

let toastT = 0;
function toast(m, err = false) { const t = $("#toast"); t.textContent = m; t.classList.toggle("err", err); t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 3200); }

// ---------------------------------------------------------------- router
let timers = [];
const clearTimers = () => { timers.forEach((t) => clearInterval(t)); timers = []; };
function show(name) { $$("[data-screen]").forEach((s) => (s.hidden = s.dataset.screen !== name)); scrollTo(0, 0); }

function route() {
  clearTimers();
  releaseWake();
  closeCam();
  if (!A || tokenExpired()) { A = null; saveAuth(); show("login"); $("#lgName").value = localStorage.getItem(KEY + "-name") || ""; return; }
  const h = location.hash || "#/";
  let m;
  if ((m = h.match(/^#\/s\/([a-z0-9_-]+)/)) && (BOOTH_IDS.includes(m[1]) || m[1] === PRIZE)) return station(m[1]);
  if (h === "#/admin" && A.role === "admin") return admin();
  if (h === "#/lookup") return lookup();
  home();
}
addEventListener("hashchange", route);

// ---------------------------------------------------------------- login
$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#lgBtn"), err = $("#lgErr");
  btn.disabled = true; err.hidden = true;
  try {
    const name = $("#lgName").value.trim();
    const j = await api("/api/login", { name, pin: $("#lgPin").value.trim() });
    A = { token: j.token, role: j.role, name: j.name, secrets: j.secrets, offset };
    saveAuth();
    try { localStorage.setItem(KEY + "-name", name); } catch { /* ignore */ }
    $("#lgPin").value = "";
    location.hash = "#/";
    route();
  } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  finally { btn.disabled = false; }
});
$("#logoutBtn").onclick = () => { if (confirm("ออกจากระบบ?")) { A = null; saveAuth(); route(); } };

// ---------------------------------------------------------------- home
function home() {
  show("home");
  $("#whoami").textContent = `${A.name} · ${A.role === "admin" ? "แอดมิน" : "เจ้าหน้าที่"}`;
  $("#adminCard").hidden = A.role !== "admin";
  $("#stations").innerHTML = EVENT.booths.map((b) => `<a class="station-card" href="#/s/${b.id}" style="--c:${b.color}">${icon(b.icon)}<span class="no">BOOTH ${String(b.no).padStart(2, "0")} · ${esc(b.en)}</span><b>${esc(b.th)}</b><small>${esc(b.place)}</small></a>`).join("");
  $("#prizeStation").innerHTML = `<a class="station-card" href="#/s/${PRIZE}" style="--c:#c9971c">${icon("gift")}<span class="no">PRIZE POINT</span><b>${esc(EVENT.prizePoint.name)}</b><small>${esc(EVENT.prizePoint.place)}</small></a>`;
}

// ---------------------------------------------------------------- station (rotating QR)
let wake = null;
async function keepAwake() {
  try { if ("wakeLock" in navigator && !document.hidden) wake = await navigator.wakeLock.request("screen"); } catch { /* not allowed */ }
}
function releaseWake() { try { wake && wake.release(); } catch { /* ignore */ } wake = null; }
document.addEventListener("visibilitychange", () => { if (!document.hidden && !$("[data-screen=station]").hidden) keepAwake(); });

let curStation = null, lastWin = -1, lastCount = -1;
async function station(id) {
  curStation = id;
  const prize = id === PRIZE;
  const b = boothById(id);
  show("station");
  const scr = $("[data-screen=station]");
  scr.style.setProperty("--c", prize ? "#c9971c" : b.color);
  $("#stNo").textContent = prize ? "PRIZE POINT · จุดลุ้นรางวัล" : `BOOTH ${String(b.no).padStart(2, "0")} · ${b.en}`;
  $("#stName").textContent = b.th;
  $("#howTxt").textContent = prize
    ? "ผู้ที่สะสมตราครบทุกบูธ สแกน QR นี้ด้วยเว็บสะสมตรา แล้วแตะลูกโลกเพื่อลุ้นรางวัล"
    : "ผู้เข้าร่วมสแกน QR ด้วยเว็บสะสมตรา หรือกล้องมือถือ · หรือพิมพ์รหัส 6 หลักในเว็บ";
  $("#countLab").textContent = prize ? "ลุ้นไปแล้ว" : "ให้ตราไปแล้ว";
  $("#scanPassTxt").textContent = prize ? "สแกนตรวจสอบ / มอบรางวัล" : "สแกนสมุดผู้เข้าร่วม (กรณีสแกนไม่ได้)";
  $("#countNum").textContent = "–";
  $("#feed").innerHTML = "";
  lastWin = -1; lastCount = -1;
  $(".qr-stage").hidden = prize;
  $("#tkScan").hidden = !prize;
  $("#scanPassBtn").hidden = prize;
  keepAwake();
  if (!prize) {
    await tickQR();
    timers.push(setInterval(tickQR, 1000));
  }
  refreshStation();
  timers.push(setInterval(() => { if (!document.hidden) refreshStation(); }, prize ? 15000 : 30000));
}

async function tickQR() {
  const id = curStation;
  const t = now();
  const win = windowAt(t);
  const left = STEP - Math.floor((t / 1000) % STEP);
  $("#secsTxt").textContent = left;
  $("#timerArc").style.strokeDashoffset = String(94.25 * (1 - left / STEP));
  if (win === lastWin) return;
  lastWin = win;
  const secret = A.secrets[id];
  const code = await codeFor(secret, id, win);
  if (id !== curStation) return;
  const url = `${EVENT.participantUrl.replace(/#.*$/, "")}#s=${makePayload(id, win, code)}`;
  const card = $("#qrCard");
  card.classList.remove("swap"); void card.offsetWidth; card.classList.add("swap");
  $("#qrBox").innerHTML = await qrSvg(url, { ecc: "M", margin: 1 });
  $("#codeTxt").textContent = code.slice(0, 3) + " " + code.slice(3);
}

async function refreshStation() {
  const id = curStation;
  try {
    const j = await api(`/api/station/${id}`);
    if (id !== curStation) return;
    const cc = $(".count-card");
    if (lastCount >= 0 && j.count > lastCount) { cc.classList.remove("bump"); void cc.offsetWidth; cc.classList.add("bump"); }
    lastCount = j.count;
    $("#countNum").textContent = j.count.toLocaleString("th-TH");
    $("#countSub").textContent = "คน";
    $("#feed").innerHTML = id === PRIZE ? prizeFeed(j.recent) : (j.recent.length ? `<p class="feed-h">ล่าสุด</p>` : "") + j.recent.map((r) => `<div class="it"><b>${esc(r.name)}</b><time>${fmt(r.at)}</time><small>${esc(r.school || "")}${r.via && r.via.startsWith("staff") ? " · สแกนโดยเจ้าหน้าที่" : ""}</small></div>`).join("");
  } catch { /* offline: QR keeps working */ }
}

function prizeFeed(rows) {
  if (!rows.length) return `<p class="feed-h">ยังไม่มีผู้ลุ้นรางวัล</p>`;
  return `<p class="feed-h">ผลลุ้นล่าสุด</p>` + rows.map((r) => `<div class="it"><b>${esc(r.name)} ${r.prize ? `<span class="tag win">🎁 ${esc(r.prize_name)}</span>` : `<span class="tag lose">ไม่ได้รางวัล</span>`}</b>
    <small>${esc(r.school || "")} · ${esc(r.pid)} · ${fmt(r.at)}</small>
    <span class="act">${r.prize ? (r.claimed ? `<span class="tag done">✓ มอบแล้ว</span>` : `<button class="btn green mini" type="button" data-claim="${esc(r.pid)}">มอบแล้ว</button>`) : ""}</span></div>`).join("");
}

$("#feed").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-claim]");
  if (!b) return;
  b.disabled = true;
  try { await api("/api/claim", { pid: b.dataset.claim }); toast("บันทึกการมอบรางวัลแล้ว"); refreshStation(); }
  catch (ex) { toast(ex.message, true); b.disabled = false; }
});

$("#fsBtn").onclick = () => {
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
  else if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
};
document.addEventListener("fullscreenchange", () => $("[data-screen=station]").classList.toggle("fs", !!document.fullscreenElement));

// ---------------------------------------------------------------- camera: scan passports
let stopCam = null;
function closeCam() { if (stopCam) { stopCam(); stopCam = null; } $("#cam").hidden = true; }
$("#camClose").onclick = closeCam;
const passId = (text) => { const m = String(text).match(/GEOS-(?:PASS|TICKET):(G[0-9A-Z]{6})/) || String(text).trim().toUpperCase().match(/^(G[0-9A-Z]{6})$/); return m && m[1]; };

async function openCam(mode) {
  sfx.unlock();
  const cam = $("#cam");
  cam.hidden = false;
  $("#camResult").hidden = true;
  $("#camTitle").textContent = mode === "ticket" ? "สแกนตั๋วลุ้นรางวัล" : mode === "stamp" ? `ประทับตรา · บูธ ${boothById(curStation).no}` : "สแกน QR สมุดผู้เข้าร่วม";
  $("#camMsg").textContent = "หันกล้องไปที่ QR \"ของฉัน\" ในเว็บของผู้เข้าร่วม";
  let busy = false;
  stopCam = await startScanner($("#camVideo"), async (text) => {
    const id = passId(text);
    if (!id) { $("#camMsg").textContent = "QR นี้ไม่ใช่สมุดสะสมตรา"; return false; }
    if (busy) return false;
    busy = true;
    try {
      if (mode === "stamp") await staffStamp(id);
      else if (mode === "ticket") { closeCam(); openTicket(id); }
      else { closeCam(); location.hash = "#/lookup"; await showPassport(id); }
    } finally { busy = false; }
    return mode !== "stamp";
  }, { onError: () => { $("#camMsg").textContent = "เปิดกล้องไม่ได้ · อนุญาตการใช้กล้องในการตั้งค่าเบราว์เซอร์"; } });
}

async function staffStamp(pid) {
  const box = $("#camResult");
  box.hidden = false; box.className = "cam-result"; box.innerHTML = "กำลังบันทึก…";
  try {
    const j = await api("/api/stamp", { pid, booth: curStation });
    const n = BOOTH_IDS.filter((b) => j.stamps[b]).length;
    box.className = "cam-result " + (j.fresh ? "ok" : "warn");
    box.innerHTML = `<div class="big ${j.fresh ? "ok-t" : "warn-t"}">${j.fresh ? "✓ ประทับตราแล้ว" : "มีตราบูธนี้อยู่แล้ว"}</div><div>${esc(j.passport.name)} · ${esc(j.passport.school || "")}</div><small>${esc(pid)} · สะสม ${n}/${BOOTH_IDS.length} ตรา · ให้ผู้เข้าร่วมกดรีเฟรชหน้าสมุด</small>`;
    j.fresh ? (sfx.stamp(), buzz(40)) : buzz([40, 40, 40]);
    refreshStation();
  } catch (e) {
    box.className = "cam-result bad";
    box.innerHTML = `<div class="big bad-t">ไม่สำเร็จ</div><div>${esc(e.message)}</div>`;
    buzz([80, 40, 80]);
  }
}
$("#scanPassBtn").onclick = () => (curStation === PRIZE ? openCam("lookup") : openCam("stamp"));

// ---------------------------------------------------------------- prize point: ticket → draw → hand out
$("#tkScanBtn").onclick = () => openCam("ticket");
$("#tkForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = passId($("#tkId").value);
  if (!id) { toast("รหัสตั๋วขึ้นต้นด้วย G ตามด้วย 6 ตัว", true); return; }
  $("#tkId").value = "";
  openTicket(id);
});
const modal = (html) => { $("#modalCard").innerHTML = html; $("#modal").hidden = false; };
const closeModal = () => { $("#modal").hidden = true; if (curStation === PRIZE) refreshStation(); };
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal" || e.target.closest("[data-mclose]")) closeModal(); });

function ticketHead(j) {
  const p = j.passport, n = BOOTH_IDS.filter((b) => j.stamps[b]).length;
  return `<div class="tkm-head"><span class="id">${esc(p.id)}</span><h3>${esc(p.name)}</h3><div class="meta">${esc(p.school || "")} · ${ROLE_TH[p.role] || ""}</div>
    <div class="tkm-n ${n >= REQUIRED ? "ok" : "no"}">${n >= REQUIRED ? "✓" : "✗"} สะสม ${n}/${BOOTH_IDS.length} ตรา</div></div>`;
}
function resultBox(d, pid) {
  if (!d.win) return `<div class="tkm-res lose"><b>ไม่ได้รางวัล</b><span>ปีหน้ามาลุ้นใหม่นะ! ขอบคุณที่ร่วมกิจกรรม</span></div>`;
  return `<div class="tkm-res win"><small>ได้รับรางวัล</small><b>🎉 ${esc(d.prize.name)}</b>
    ${d.claimed ? `<span>✓ มอบแล้ว ${fmt(d.claimed)} โดย ${esc(d.claimedBy || "")}</span>` : `<button class="btn gold wide" type="button" data-give="${esc(pid)}">มอบรางวัลแล้ว</button>`}</div>`;
}
async function openTicket(id) {
  sfx.unlock();
  modal(`<p>กำลังตรวจตั๋ว ${esc(id)}…</p>`);
  let j;
  try { j = await api(`/api/passport/${id}`); }
  catch (e) { modal(`<div class="tkm-res lose"><b>ตรวจตั๋วไม่ได้</b><span>${esc(e.message)}</span></div><button class="btn ghost wide" type="button" data-mclose>ปิด</button>`); buzz([80, 40, 80]); return; }
  const n = BOOTH_IDS.filter((b) => j.stamps[b]).length;
  if (j.draw) {
    modal(`${ticketHead(j)}<p class="tkm-note">ตั๋วนี้ลุ้นไปแล้วเมื่อ ${fmt(j.draw.at)}</p>${resultBox(j.draw, id)}<button class="btn ghost wide" type="button" data-mclose>ปิด</button>`);
    buzz([40, 40, 40]);
    return;
  }
  if (n < REQUIRED) {
    modal(`${ticketHead(j)}<div class="tkm-res lose"><b>ยังไม่มีสิทธิ์ลุ้น</b><span>ขาดอีก ${REQUIRED - n} ตรา</span></div><button class="btn ghost wide" type="button" data-mclose>ปิด</button>`);
    buzz([80, 40, 80]);
    return;
  }
  modal(`${ticketHead(j)}<button class="tkm-draw" type="button" data-draw="${esc(id)}"><span>🎲</span>กดลุ้นรางวัล</button><button class="btn ghost wide" type="button" data-mclose>ยกเลิก</button>`);
  sfx.pop(); buzz(40);
}
async function drawFor(id, btn) {
  btn.disabled = true;
  const names = [...EVENT.prizes.map((p) => p.name), "ลุ้น…"];
  let i = 0;
  btn.outerHTML = `<div class="tkm-spin" id="tkSpin"><span>${esc(names[0])}</span></div>`;
  const spin = setInterval(() => { const el = $("#tkSpin span"); if (el) el.textContent = names[i++ % names.length]; sfx.tick(); }, 120);
  const t0 = Date.now();
  let j, err;
  try { j = await api("/api/draw", { pid: id }); } catch (e) { err = e; }
  await new Promise((r) => setTimeout(r, Math.max(0, 2600 - (Date.now() - t0))));
  clearInterval(spin);
  if (err) { modal(`<div class="tkm-res lose"><b>ลุ้นไม่สำเร็จ</b><span>${esc(err.message)}</span></div><button class="btn ghost wide" type="button" data-mclose>ปิด</button>`); return; }
  modal(`${ticketHead(j)}${resultBox(j.draw, id)}<button class="btn ghost wide" type="button" data-mclose>ปิด</button>`);
  if (j.draw.win) { sfx.win(); buzz([40, 60, 120]); fireworks(2400); burst(innerWidth / 2, innerHeight / 2, 120, 1.1); }
  else { sfx.lose(); buzz(60); }
}
$("#modalCard").addEventListener("click", async (e) => {
  const d = e.target.closest("[data-draw]");
  if (d) { drawFor(d.dataset.draw, d); return; }
  const g = e.target.closest("[data-give]");
  if (g) {
    g.disabled = true;
    try { const j = await api("/api/claim", { pid: g.dataset.give }); g.outerHTML = `<span>✓ มอบแล้ว ${fmt(j.draw.claimed)}</span>`; toast("บันทึกการมอบรางวัลแล้ว"); sfx.pop(); }
    catch (ex) { toast(ex.message, true); g.disabled = false; }
  }
});

// ---------------------------------------------------------------- lookup
function lookup() { show("lookup"); }
$("#lookupForm").addEventListener("submit", (e) => { e.preventDefault(); const id = passId($("#lookupId").value); if (!id) { toast("รหัสสมุดขึ้นต้นด้วย G ตามด้วย 6 ตัว", true); return; } showPassport(id); });
$("#lookupScan").onclick = () => openCam("lookup");

async function showPassport(id) {
  const out = $("#lookupOut");
  out.innerHTML = `<div class="pcard">กำลังค้นหา ${esc(id)}…</div>`;
  try {
    const j = await api(`/api/passport/${id}`);
    const p = j.passport, d = j.draw;
    const n = BOOTH_IDS.filter((b) => j.stamps[b]).length;
    out.innerHTML = `<div class="pcard"><span class="id">${esc(p.id)}</span><h3>${esc(p.name)}</h3><div class="meta">${esc(p.school || "")} · ${ROLE_TH[p.role] || ""} · สะสม ${n}/${BOOTH_IDS.length} ตรา</div>
      <div class="pstamps">${EVENT.booths.map((b) => `<div class="${j.stamps[b.id] ? "on" : ""}" style="--c:${b.color}"><i>${b.no}</i>${esc(b.th)}${j.stamps[b.id] ? ` · ${fmt(j.stamps[b.id])}` : ""}</div>`).join("")}</div>
      ${d ? (d.win
        ? `<div class="drawbox win"><small>ผลลุ้น · ${fmt(d.at)}</small><b>🎁 ${esc(d.prize.name)}</b>${d.claimed ? `<div>✓ มอบแล้วเมื่อ ${fmt(d.claimed)} โดย ${esc(d.claimedBy || "")}</div><button class="btn ghost" type="button" data-unclaim="${esc(p.id)}">ยกเลิกการมอบ (กดผิด)</button>` : `<button class="btn gold" type="button" data-claim2="${esc(p.id)}">ยืนยันมอบรางวัล</button>`}</div>`
        : `<div class="drawbox lose"><small>ผลลุ้น · ${fmt(d.at)}</small><b>ไม่ได้รางวัล</b></div>`)
        : `<div class="drawbox none">${n >= REQUIRED ? "สะสมครบแล้ว · ยังไม่ได้ลุ้น" : `ยังสะสมไม่ครบ (ขาด ${REQUIRED - n} ตรา)`}</div>`}</div>`;
  } catch (e) { out.innerHTML = `<div class="pcard">${esc(e.message)}</div>`; }
}
$("#lookupOut").addEventListener("click", async (e) => {
  const c = e.target.closest("[data-claim2],[data-unclaim]");
  if (!c) return;
  const pid = c.dataset.claim2 || c.dataset.unclaim;
  const undo = !!c.dataset.unclaim;
  if (undo && !confirm("ยกเลิกการมอบรางวัลของรหัสนี้?")) return;
  c.disabled = true;
  try { await api("/api/claim", { pid, undo }); toast(undo ? "ยกเลิกแล้ว" : "บันทึกการมอบรางวัลแล้ว"); sfx.pop(); showPassport(pid); }
  catch (ex) { toast(ex.message, true); c.disabled = false; }
});

// ---------------------------------------------------------------- admin
let S = null;
async function admin() {
  show("admin");
  await loadAdmin();
  timers.push(setInterval(() => { if (!document.hidden) loadAdmin(true); }, 30000));
}
async function loadAdmin(quiet = false) {
  try { S = await api("/api/admin/summary"); renderAdmin(quiet); }
  catch (e) { $("#admUpdated").textContent = e.message; }
}
function renderAdmin(quiet) {
  $("#admUpdated").textContent = "อัปเดต " + fmt(Date.now());
  const k = [
    ["ผู้เปิดสมุด", S.passports, `นร. ${S.roles.student || 0} · ครู ${S.roles.teacher || 0} · ทั่วไป ${S.roles.guest || 0}`],
    ["ตราที่ให้ทั้งหมด", Object.values(S.booths).reduce((a, b) => a + b, 0), "ดวง"],
    ["สะสมครบ", S.completed, S.passports ? Math.round((S.completed / S.passports) * 100) + "% ของผู้เปิดสมุด" : ""],
    ["ลุ้นแล้ว", S.draws, `ได้รางวัล ${S.wins} คน`],
    ["มอบรางวัลแล้ว", S.claimed, `ค้างรับ ${S.wins - S.claimed}`],
    ["ของรางวัลเหลือ", S.prizes.filter((p) => p.active).reduce((a, p) => a + p.remaining, 0), "ชิ้น"],
  ];
  $("#kpis").innerHTML = k.map(([a, b, c]) => `<div class="kpi"><span>${a}</span><b>${Number(b).toLocaleString("th-TH")}</b><small>${c}</small></div>`).join("");
  const max = Math.max(1, ...Object.values(S.booths));
  $("#boothBars").innerHTML = EVENT.booths.map((b) => `<div class="barrow" style="--c:${b.color}"><span>${b.no}. ${esc(b.th)}</span><span class="track"><i style="width:${((S.booths[b.id] || 0) / max) * 100}%"></i></span><b>${S.booths[b.id] || 0}</b></div>`).join("");
  if (!quiet || !document.activeElement || !document.activeElement.closest(".panel")) {
    renderPrizeRows(S.prizes);
    $("#setRate").value = Math.round(S.settings.winRate * 100);
    $("#setExpected").value = S.settings.expected || "";
  }
}
function renderPrizeRows(list) {
  const arts = [["doll", "ตุ๊กตา"], ["pen", "เครื่องเขียน"], ["fan", "พัดลม"], ["gift", "ของขวัญ"]];
  $("#prizeTable").innerHTML = list.map((p) => `<div class="prow" data-id="${esc(p.id)}">
    <label class="field"><span>ชื่อรางวัล</span><input class="input" data-k="name" value="${esc(p.name)}" maxlength="60"></label>
    <label class="field"><span>จำนวนทั้งหมด</span><input class="input" data-k="total" type="number" min="0" value="${p.total}"></label>
    <label class="field"><span>คงเหลือ</span><input class="input" data-k="remaining" type="number" min="0" value="${p.remaining}"></label>
    <label class="field"><span>รูป</span><select class="input" data-k="art">${arts.map(([v, t]) => `<option value="${v}" ${p.art === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>
    <label class="on"><input type="checkbox" data-k="active" ${p.active ? "checked" : ""}>เปิดแจก</label>
    <span class="gauge"><i style="width:${p.total ? (p.remaining / p.total) * 100 : 0}%"></i></span></div>`).join("");
}
function readPrizeRows() {
  return $$("#prizeTable .prow").map((r) => {
    const v = (k) => r.querySelector(`[data-k=${k}]`);
    return { id: r.dataset.id, name: v("name").value, total: v("total").value, remaining: v("remaining").value, art: v("art").value, active: v("active").checked };
  });
}
$("#addPrize").onclick = () => {
  const rows = readPrizeRows();
  rows.push({ id: "p" + Date.now().toString(36), name: "ของรางวัลใหม่", total: 10, remaining: 10, art: "gift", active: true });
  renderPrizeRows(rows);
};
$("#savePrizes").onclick = async (e) => {
  e.target.disabled = true;
  try { S = await api("/api/admin/prizes", { prizes: readPrizeRows() }); renderAdmin(false); toast("บันทึกของรางวัลแล้ว"); }
  catch (ex) { toast(ex.message, true); } finally { e.target.disabled = false; }
};
$("#saveSettings").onclick = async (e) => {
  e.target.disabled = true;
  try { S = await api("/api/admin/settings", { winRate: (+$("#setRate").value || 0) / 100, expected: +$("#setExpected").value || 0 }); renderAdmin(false); toast("บันทึกการตั้งค่าแล้ว"); }
  catch (ex) { toast(ex.message, true); } finally { e.target.disabled = false; }
};
$("#admRefresh").onclick = () => loadAdmin();
$("#exportBtn").onclick = async () => {
  try {
    const r = await api("/api/admin/export");
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tggc2569-สะสมตรา-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "")}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch (ex) { toast(ex.message, true); }
};
$("#resetBtn").onclick = async () => {
  if ($("#resetTxt").value.trim() !== "RESET") { toast("พิมพ์ RESET ให้ถูกต้องก่อน", true); return; }
  if (!confirm("ลบข้อมูลทั้งหมดจริงหรือไม่? ย้อนกลับไม่ได้")) return;
  try { S = await api("/api/admin/reset", { confirm: "RESET" }); $("#resetTxt").value = ""; renderAdmin(false); toast("ล้างข้อมูลแล้ว"); }
  catch (ex) { toast(ex.message, true); }
};

// ---------------------------------------------------------------- boot
route();
if ("serviceWorker" in navigator && location.protocol === "https:") addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
