// TGGC 2026 staff site: rotating booth QR (works offline once logged in), scan passports,
// prize counter (ticket check → raffle slip). The admin dashboard is its own site (admin/).
import { EVENT, BOOTH_IDS, REQUIRED, boothById } from "../../shared/event.js";
import { STEP, windowAt, codeFor, makePayload } from "../../shared/otp.js";
import { icon } from "../../shared/web/icons.js";
import { qrSvg } from "../../shared/web/qr.js";
import { startScanner } from "../../shared/web/scanner.js";
import { sfx, buzz, burst } from "../../shared/web/fx.js";
import { loadBooths, logoUrl } from "../../shared/web/booths.js";
import { patternSvg, boothPattern } from "../../shared/web/patterns.js";

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
  const h = location.hash || "#/";
  let m;
  if (!A || tokenExpired()) {
    A = null; saveAuth(); show("login");
    $("#lgName").value = localStorage.getItem(KEY + "-name") || "";
    // opened from a booth poster QR (#/s/<id>): say which screen opens after login
    const to = (m = h.match(/^#\/s\/([a-z0-9_-]+)/)) && boothById(m[1]);
    $("#lgFor").hidden = !to;
    if (to) $("#lgFor").textContent = to.no ? `เข้าสู่ระบบแล้วจะเปิดจอ บูธ ${to.no} · ${to.th}` : `เข้าสู่ระบบแล้วจะเปิดจอ ${to.th}`;
    return;
  }
  if ((m = h.match(/^#\/s\/([a-z0-9_-]+)/)) && (BOOTH_IDS.includes(m[1]) || m[1] === PRIZE)) return station(m[1]);
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
    if (!/^#\/s\//.test(location.hash)) location.hash = "#/"; // keep the booth screen a poster QR asked for
    route();
qrSvg("warm-up").catch(() => {}); // load the QR library now, not when the first booth screen opens
  } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  finally { btn.disabled = false; }
});
$("#logoutBtn").onclick = () => { if (confirm("ออกจากระบบ?")) { A = null; saveAuth(); route(); } };

// ---------------------------------------------------------------- home
function home() {
  show("home");
  $("#whoami").textContent = `${A.name} · ${A.role === "admin" ? "แอดมิน" : "เจ้าหน้าที่"}`;
  $("#adminCard").hidden = A.role !== "admin";
  $("#adminCard").href = EVENT.adminUrl;
  $("#stations").innerHTML = EVENT.booths.map((b) => `<a class="station-card" href="#/s/${b.id}" style="--c:${b.color}">${cardPattern(b)}${b.logo ? `<img class="slogo" src="${logoUrl(b)}" alt="" loading="lazy">` : icon(b.icon)}<span class="no">BOOTH ${String(b.no).padStart(2, "0")}<em><i> · </i>${esc(b.en)}</em></span><b>${esc(b.th)}</b><small>${esc(b.place)}</small></a>`).join("");
  $("#prizeStation").innerHTML = `<a class="station-card" href="#/s/${PRIZE}" style="--c:#c9971c">${icon("gift")}<span class="no">PRIZE COUNTER</span><b>${esc(EVENT.prizePoint.name)}</b><small>${esc(EVENT.prizePoint.place)}</small></a>`;
}

// each booth card wears its poster pattern (drawn once, reused)
const patternImg = (kind, o) => "data:image/svg+xml," + encodeURIComponent(patternSvg(kind, o).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ').replaceAll("currentColor", "#fff"));
const cardPats = new Map();
const cardPattern = (b) => {
  if (!cardPats.has(b.no)) cardPats.set(b.no, `<img class="sc-pat" alt="" src="${patternImg(boothPattern(b.no), { w: 320, h: 200, u: 26, sw: 1.1, seed: b.no })}">`);
  return cardPats.get(b.no);
};

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
  // the same background pattern as this booth's printed QR poster
  // drawn as a picture (rasterised once by the browser), so it costs nothing while the QR and timer update
  $(".st-pat").innerHTML = prize ? "" : `<img alt="" src="${patternImg(boothPattern(b.no), { w: 1200, h: 900, u: 56, sw: 1.6, seed: b.no })}">`;
  $("#stNo").textContent = prize ? "PRIZE COUNTER" : `BOOTH ${String(b.no).padStart(2, "0")} · ${b.en}`;
  $("#stName").textContent = b.th;
  const lg = $("#stLogo");
  lg.hidden = prize || !b.logo;
  if (!lg.hidden) lg.src = logoUrl(b);
  $("#howTxt").textContent = prize
    ? "สแกนตั๋วในมือถือผู้เข้าร่วม แล้วให้เขียนชื่อลงใบจับฉลาก"
    : "ผู้เข้าร่วมสแกน QR ด้วยเว็บสะสมตรา หรือกล้องมือถือ · หรือพิมพ์รหัส 6 หลักในเว็บ";
  $("#countLab").textContent = prize ? "ยื่นตั๋วแล้ว" : "ให้ตราไปแล้ว";
  $("#scanPassTxt").textContent = prize ? "ตรวจสอบสมุด" : "สแกนสมุดผู้เข้าร่วม (กรณีสแกนไม่ได้)";
  $("#countNum").textContent = "–";
  $("#feed").innerHTML = "";
  lastWin = -1; lastCount = -1;
  $(".qr-stage").hidden = prize;
  $("#tkScan").hidden = !prize;
  $("#scanPassBtn").hidden = prize;
  $("#anBox").hidden = !prize;
  $("#anNow").hidden = true;
  keepAwake();
  if (!prize) {
    await tickQR();
    timers.push(setInterval(tickQR, 500));
  }
  refreshStation();
  timers.push(setInterval(() => { if (!document.hidden) refreshStation(); }, prize ? 15000 : 30000));
}

// QR for the current 30-second window. The next window's QR is built ahead of time, so the swap at the
// boundary is instant even on a slow device; a failed render is retried on the next tick (not 30 s later).
let qrBusy = false;
const qrCache = new Map(); // "booth:win" → { svg, code }
async function buildQR(id, win) {
  const k = id + ":" + win;
  if (qrCache.has(k)) return qrCache.get(k);
  const code = await codeFor(A.secrets[id], id, win);
  const url = `${EVENT.participantUrl.replace(/#.*$/, "")}#s=${makePayload(id, win, code)}`;
  // ECC "L": a screen is never smudged, and fewer, bigger modules are quicker for phone cameras to read
  const v = { svg: await qrSvg(url, { ecc: "L", margin: 2 }), code };
  qrCache.set(k, v);
  if (qrCache.size > 6) qrCache.delete(qrCache.keys().next().value);
  return v;
}
async function tickQR() {
  const id = curStation;
  if (!id || id === PRIZE) return;
  const t = now();
  const win = windowAt(t);
  const left = STEP - Math.floor((t / 1000) % STEP);
  $("#secsTxt").textContent = left;
  $("#timerArc").style.strokeDashoffset = String(94.25 * (1 - left / STEP));
  if (qrBusy) return;
  qrBusy = true;
  try {
    if (win !== lastWin) {
      const q = await buildQR(id, win);
      if (id !== curStation) return;
      const card = $("#qrCard");
      card.classList.remove("swap"); void card.offsetWidth; card.classList.add("swap");
      $("#qrBox").innerHTML = q.svg;
      $("#codeTxt").textContent = q.code.slice(0, 3) + " " + q.code.slice(3);
      lastWin = win; // only once it is really on screen
    } else if (left <= 8) {
      await buildQR(id, win + 1); // warm up the next one
    }
  } catch { /* try again on the next tick */ }
  finally { qrBusy = false; }
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
    if (id === PRIZE) refreshAnn();
    $("#feed").innerHTML = id === PRIZE ? prizeFeed(j.recent) : (j.recent.length ? `<p class="feed-h">ล่าสุด</p>` : `<p class="feed-h">ยังไม่มีผู้รับตรา · รายชื่อจะขึ้นที่นี่</p>`) + j.recent.map((r) => `<div class="it"><b>${esc(r.name)}</b><time>${fmt(r.at)}</time><small>${esc(r.school || "")}${r.via && r.via.startsWith("staff") ? " · สแกนโดยเจ้าหน้าที่" : ""}</small></div>`).join("");
  } catch { /* offline: QR keeps working */ }
}

function prizeFeed(rows) {
  if (!rows.length) return `<p class="feed-h">ยังไม่มีผู้ยื่นตั๋ว</p>`;
  return `<p class="feed-h">ยื่นตั๋วล่าสุด</p>` + rows.map((r) => `<div class="it"><b>${esc(r.name)}</b><time>${fmt(r.at)}</time>
    <small>${esc(r.school || "")} · ${esc(r.pid)}${r.staff ? " · สแกนโดย " + esc(r.staff) : ""}</small></div>`).join("");
}

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

// ---------------------------------------------------------------- prize counter: ticket → raffle slip
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
const slipBox = (r) => `<div class="tkm-res win"><small>✓ ตั๋วผ่าน · ${fmt(r.at)}</small><b>ยื่นใบจับฉลากให้ได้เลย</b>
  <span>ให้ผู้เข้าร่วม<strong>${esc(EVENT.raffle.slip)}</strong> · ${esc(EVENT.raffle.announce)}</span></div>`;
async function openTicket(id) {
  sfx.unlock();
  modal(`<p>กำลังตรวจตั๋ว ${esc(id)}…</p>`);
  let j;
  try { j = await api(`/api/passport/${id}`); }
  catch (e) { modal(`<div class="tkm-res lose"><b>ตรวจตั๋วไม่ได้</b><span>${esc(e.message)}</span></div><button class="btn ghost wide" type="button" data-mclose>ปิด</button>`); buzz([80, 40, 80]); return; }
  const n = BOOTH_IDS.filter((b) => j.stamps[b]).length;
  if (j.redeem) {
    modal(`${ticketHead(j)}<div class="tkm-res lose"><b>ตั๋วนี้ใช้ไปแล้ว</b><span>ยื่นเมื่อ ${fmt(j.redeem.at)}${j.redeem.by ? " · สแกนโดย " + esc(j.redeem.by) : ""} — ไม่ต้องให้ใบจับฉลากซ้ำ</span></div><button class="btn ghost wide" type="button" data-mclose>ปิด</button>`);
    buzz([80, 40, 80]);
    return;
  }
  if (n < REQUIRED) {
    modal(`${ticketHead(j)}<div class="tkm-res lose"><b>ยังไม่มีสิทธิ์</b><span>ขาดอีก ${REQUIRED - n} ตรา</span></div><button class="btn ghost wide" type="button" data-mclose>ปิด</button>`);
    buzz([80, 40, 80]);
    return;
  }
  modal(`${ticketHead(j)}<button class="tkm-draw" type="button" data-redeem="${esc(id)}"><span>🎟️</span>ยืนยันรับตั๋ว</button><p class="tkm-note">กดแล้วตั๋วนี้จะใช้ซ้ำไม่ได้</p><button class="btn ghost wide" type="button" data-mclose>ยกเลิก</button>`);
  sfx.pop(); buzz(40);
}
async function redeemFor(id, btn) {
  btn.disabled = true;
  let j;
  try { j = await api("/api/redeem", { pid: id }); }
  catch (e) { modal(`<div class="tkm-res lose"><b>ไม่สำเร็จ</b><span>${esc(e.message)}</span></div><button class="btn ghost wide" type="button" data-mclose>ปิด</button>`); buzz([80, 40, 80]); return; }
  if (!j.fresh) {
    modal(`${ticketHead(j)}<div class="tkm-res lose"><b>ตั๋วนี้ใช้ไปแล้ว</b><span>ยื่นเมื่อ ${fmt(j.redeem.at)}${j.redeem.by ? " · สแกนโดย " + esc(j.redeem.by) : ""}</span></div><button class="btn ghost wide" type="button" data-mclose>ปิด</button>`);
    return;
  }
  modal(`${ticketHead(j)}${slipBox(j.redeem)}<button class="btn wide" type="button" data-mclose>เสร็จ · สแกนคนต่อไป</button>`);
  sfx.win(); buzz([40, 60, 120]); burst(innerWidth / 2, innerHeight / 2, 90, 1);
}
$("#modalCard").addEventListener("click", (e) => {
  const d = e.target.closest("[data-redeem]");
  if (d) redeemFor(d.dataset.redeem, d);
});

// ---------------------------------------------------------------- prize counter: announce the raffle
const AN_KINDS = [
  { k: "soon", t: "เตรียมตัว! ใกล้เริ่มจับรางวัล", lab: "ใกล้เริ่ม" },
  { k: "start", t: "เริ่มจับรางวัลแล้ว!", lab: "เริ่มจับแล้ว" },
  { k: "winners", t: "ประกาศรายชื่อผู้โชคดี", lab: "ประกาศผล" },
  { k: "custom", t: "", lab: "ข้อความอื่น" },
];
let AN = { ann: null, subs: 0, rows: 0, page: 100 }, anKind = "start";
const anLine = (a) => [a.time ? `เวลา ${a.time} น.` : "", a.place ? `ที่ ${a.place}` : "", a.msg].filter(Boolean).join(" · ");
async function refreshAnn() {
  try { const j = await api("/api/announce"); AN = j; } catch { return; }
  if (curStation !== PRIZE) return;
  $("#anSub").textContent = `ขึ้นบนเว็บผู้เข้าร่วมทุกคน · แจ้งเตือนเข้ามือถือได้ ${AN.subs.toLocaleString("th-TH")} คน`;
  const box = $("#anNow");
  box.hidden = !AN.ann;
  if (AN.ann) box.innerHTML = `<small>ประกาศอยู่ตอนนี้ · ${fmt(AN.ann.at)} น.${AN.ann.by ? " · โดย " + esc(AN.ann.by) : ""}</small><b>${esc(AN.ann.title)}</b>${anLine(AN.ann) ? `<span>${esc(anLine(AN.ann))}</span>` : ""}<button type="button" class="an-clear" data-anclear>ยกเลิกประกาศ</button>`;
}
function openAnn() {
  const k = AN_KINDS.find((x) => x.k === anKind);
  const a = AN.ann && AN.ann.kind === anKind ? AN.ann : null;
  modal(`<div class="an-form"><h3>📣 ประกาศจับรางวัล</h3>
    <p class="an-hint">ขึ้นเป็นป้ายประกาศบนเว็บของผู้เข้าร่วม และ<b>แจ้งเตือนเข้ามือถือ ${AN.subs.toLocaleString("th-TH")} คน</b>ที่สะสมครบและเปิดรับการแจ้งเตือน</p>
    <div class="an-kinds">${AN_KINDS.map((x) => `<button type="button" class="${x.k === anKind ? "on" : ""}" data-ankind="${x.k}">${x.lab}</button>`).join("")}</div>
    <label class="field"><span>หัวข้อ</span><input class="input" id="anTitle" maxlength="80" value="${esc(a ? a.title : k.t)}" placeholder="เช่น เลื่อนเวลาจับรางวัล"></label>
    <label class="field"><span>สถานที่จับรางวัล${anKind === "start" || anKind === "soon" ? " *" : ""}</span><input class="input" id="anPlace" maxlength="120" value="${esc(a ? a.place : (AN.ann && AN.ann.place) || "")}" placeholder="แตะปุ่มด้านล่าง หรือพิมพ์เอง"></label>
    <div class="an-places">${(EVENT.raffle.places || []).map((p) => `<button type="button" data-anplace="${esc(p)}">${esc(p)}</button>`).join("")}</div>
    <div class="an-two"><label class="field"><span>เวลา (ถ้ามี)</span><input class="input" id="anTime" type="time" value="${esc(a ? a.time : "")}"></label>
      <label class="field"><span>ข้อความเพิ่มเติม (ถ้ามี)</span><input class="input" id="anMsg" maxlength="200" value="${esc(a ? a.msg : "")}" placeholder="เช่น นำตั๋วในมือถือมาด้วย"></label></div>
    <label class="an-check"><input type="checkbox" id="anPush" ${AN.subs ? "checked" : "disabled"}><span>ส่งแจ้งเตือนเข้ามือถือ (${AN.subs.toLocaleString("th-TH")} คน)</span></label>
    <div class="an-prev" id="anPrev"></div>
    <p class="err" id="anErr" hidden></p>
    <button class="btn gold wide" type="button" id="anSend">📣 ส่งประกาศ</button>
    <button class="btn ghost wide" type="button" data-mclose>ยกเลิก</button></div>`);
  anPreview();
}
function anPreview() {
  const v = { title: $("#anTitle").value.trim(), place: $("#anPlace").value.trim(), time: $("#anTime").value, msg: $("#anMsg").value.trim() };
  $("#anPrev").innerHTML = `<small>ตัวอย่างการแจ้งเตือนบนมือถือ</small><div class="an-noti"><img src="assets/icon-192.png" alt=""><div><b>📣 ${esc(v.title || "หัวข้อประกาศ")}</b><span>${esc(anLine(v) || "แตะเพื่อดูรายละเอียดการจับรางวัล")}</span></div></div>`;
}
async function sendAnn(btn) {
  const v = { kind: anKind, title: $("#anTitle").value.trim(), place: $("#anPlace").value.trim(), time: $("#anTime").value, msg: $("#anMsg").value.trim() };
  const push = $("#anPush").checked;
  const err = $("#anErr");
  err.hidden = true;
  if (!v.title) { err.textContent = "กรุณาใส่หัวข้อ"; err.hidden = false; return; }
  if ((anKind === "start" || anKind === "soon") && !v.place) { err.textContent = "กรุณาระบุสถานที่จับรางวัล"; err.hidden = false; return; }
  if (!confirm(`ส่งประกาศ "${v.title}"${push ? ` และแจ้งเตือนเข้ามือถือ ${AN.subs} คน` : ""}?`)) return;
  btn.disabled = true; btn.textContent = "กำลังส่ง…";
  let j;
  try { j = await api("/api/announce", v); }
  catch (e) { err.textContent = e.message; err.hidden = false; btn.disabled = false; btn.textContent = "📣 ส่งประกาศ"; return; }
  AN = { ...AN, ann: j.ann, subs: j.subs, rows: j.rows };
  sfx.win(); buzz([40, 60, 120]);
  if (!push || !j.rows) { annDone(j.ann, null); return; }
  // notify phone by phone, a few pages at a time (each page = one request to our server)
  const pages = Math.ceil(j.rows / j.page), tot = { sent: 0, failed: 0, gone: 0, done: 0 };
  modal(`<div class="an-sending"><h3>📣 ประกาศแล้ว</h3><p>กำลังส่งแจ้งเตือนเข้ามือถือ…</p><div class="an-bar"><i id="anBarFill"></i></div><b id="anProg">0 / ${j.subs}</b></div>`);
  let next = 0;
  async function worker() {
    while (next < pages) {
      const pg = next++;
      for (let tries = 0; tries < 3; tries++) {
        try {
          const r = await api("/api/announce/push", { id: j.ann.id, page: pg });
          tot.sent += r.sent; tot.failed += r.failed; tot.gone += r.gone;
          break;
        } catch { if (tries === 2) tot.failed += Math.min(j.page, j.rows - pg * j.page); }
      }
      tot.done++;
      const f = $("#anBarFill"); if (f) f.style.width = (100 * tot.done / pages) + "%";
      const pr = $("#anProg"); if (pr) pr.textContent = `${tot.sent} / ${j.subs}`;
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  annDone(j.ann, tot);
}
function annDone(a, tot) {
  modal(`<div class="an-sending"><h3>✓ ส่งประกาศแล้ว</h3><div class="an-done"><b>${esc(a.title)}</b>${anLine(a) ? `<span>${esc(anLine(a))}</span>` : ""}</div>
    ${tot ? `<p>แจ้งเตือนเข้ามือถือสำเร็จ <b>${tot.sent.toLocaleString("th-TH")}</b> คน${tot.failed ? ` · ไม่สำเร็จ ${tot.failed}` : ""}${tot.gone ? ` · ปิดรับแล้ว ${tot.gone}` : ""}</p>` : `<p>ขึ้นป้ายประกาศบนเว็บผู้เข้าร่วมแล้ว (ไม่ได้ส่งแจ้งเตือนเข้ามือถือ)</p>`}
    <p class="an-hint">ผู้ที่เปิดเว็บอยู่จะเห็นประกาศเด้งขึ้นภายในประมาณ 30 วินาที</p>
    <button class="btn wide" type="button" data-mclose>เสร็จ</button></div>`);
  refreshAnn();
}
$("#anBtn").onclick = () => { openAnn(); refreshAnn().then(() => { if (!$("#modal").hidden && $("#anTitle")) { const c = $("#anPush"); if (c && AN.subs && c.disabled) { c.disabled = false; c.checked = true; } } }); };
$("#anNow").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-anclear]");
  if (!b || !confirm("ยกเลิกประกาศนี้? (ป้ายประกาศจะหายจากเว็บผู้เข้าร่วม · ไม่ส่งแจ้งเตือน)")) return;
  b.disabled = true;
  try { await api("/api/announce/clear", {}); toast("ยกเลิกประกาศแล้ว"); refreshAnn(); }
  catch (ex) { toast(ex.message, true); b.disabled = false; }
});
$("#modalCard").addEventListener("click", (e) => {
  const k = e.target.closest("[data-ankind]");
  if (k) {
    const prev = AN_KINDS.find((x) => x.k === anKind), t = $("#anTitle");
    anKind = k.dataset.ankind;
    $$("[data-ankind]").forEach((b) => b.classList.toggle("on", b === k));
    if (!t.value.trim() || t.value === prev.t) t.value = AN_KINDS.find((x) => x.k === anKind).t; // keep a title typed by hand
    anPreview(); return;
  }
  const pl = e.target.closest("[data-anplace]");
  if (pl) { $("#anPlace").value = pl.dataset.anplace; anPreview(); return; }
  if (e.target.closest("#anSend")) sendAnn(e.target.closest("#anSend"));
});
$("#modalCard").addEventListener("input", (e) => { if (e.target.closest(".an-form")) anPreview(); });

// ---------------------------------------------------------------- lookup
function lookup() { show("lookup"); }
$("#lookupForm").addEventListener("submit", (e) => { e.preventDefault(); const id = passId($("#lookupId").value); if (!id) { toast("รหัสสมุดขึ้นต้นด้วย G ตามด้วย 6 ตัว", true); return; } showPassport(id); });
$("#lookupScan").onclick = () => openCam("lookup");

async function showPassport(id) {
  const out = $("#lookupOut");
  out.innerHTML = `<div class="pcard">กำลังค้นหา ${esc(id)}…</div>`;
  try {
    const j = await api(`/api/passport/${id}`);
    const p = j.passport, r = j.redeem;
    const n = BOOTH_IDS.filter((b) => j.stamps[b]).length;
    out.innerHTML = `<div class="pcard"><span class="id">${esc(p.id)}</span><h3>${esc(p.name)}</h3><div class="meta">${esc(p.school || "")} · ${ROLE_TH[p.role] || ""} · สะสม ${n}/${BOOTH_IDS.length} ตรา</div>
      <div class="pstamps">${EVENT.booths.map((b) => `<div class="${j.stamps[b.id] ? "on" : ""}" style="--c:${b.color}"><i>${b.no}</i>${esc(b.th)}${j.stamps[b.id] ? ` · ${fmt(j.stamps[b.id])}` : ""}</div>`).join("")}</div>
      ${r ? `<div class="drawbox win"><small>ยื่นตั๋วแล้ว · ${fmt(r.at)}${r.by ? " · สแกนโดย " + esc(r.by) : ""}</small><b>✓ มีสิทธิ์จับฉลาก</b>${A.role === "admin" ? `<button class="btn ghost" type="button" data-unredeem="${esc(p.id)}">ยกเลิกการยื่นตั๋ว (สแกนผิด)</button>` : ""}</div>`
        : `<div class="drawbox none">${n >= REQUIRED ? "สะสมครบแล้ว · ยังไม่ได้ยื่นตั๋ว" : `ยังสะสมไม่ครบ (ขาด ${REQUIRED - n} ตรา)`}</div>`}</div>`;
  } catch (e) { out.innerHTML = `<div class="pcard">${esc(e.message)}</div>`; }
}
$("#lookupOut").addEventListener("click", async (e) => {
  const c = e.target.closest("[data-unredeem]");
  if (!c) return;
  const pid = c.dataset.unredeem;
  if (!confirm("ยกเลิกการยื่นตั๋วของรหัสนี้? (ใช้เมื่อสแกนผิดคนเท่านั้น)")) return;
  c.disabled = true;
  try { await api("/api/admin/unredeem", { pid }); toast("ยกเลิกแล้ว"); showPassport(pid); }
  catch (ex) { toast(ex.message, true); c.disabled = false; }
});

// ---------------------------------------------------------------- boot
route();
qrSvg("warm-up").catch(() => {}); // load the QR library now, not when the first booth screen opens
// booth names/logos edited on the admin site: refresh the screen that shows them
loadBooths(() => {
  if (!$("[data-screen=home]").hidden) home();
  else if (curStation && curStation !== PRIZE && !$("[data-screen=station]").hidden) {
    const b = boothById(curStation);
    $("#stNo").textContent = `BOOTH ${String(b.no).padStart(2, "0")} · ${b.en}`;
    $("#stName").textContent = b.th;
    $("#stLogo").hidden = !b.logo;
    if (b.logo) $("#stLogo").src = logoUrl(b);
  }
});
if ("serviceWorker" in navigator && location.protocol === "https:") addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
