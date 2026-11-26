// TGGC 2026 activity passport — participant app (vanilla JS, no framework).
import { EVENT, BOOTH_IDS, REQUIRED, boothById } from "../../shared/event.js";
import { parsePayload } from "../../shared/otp.js";
import { icon, prizeArt } from "../../shared/web/icons.js";
import { burst, fireworks, sfx, sound, buzz } from "../../shared/web/fx.js";
import { createGlobe } from "./globe.js";
import { stampHTML, finalSealHTML } from "./stamps.js";
import { boothMapSVG, schoolMapSVG } from "./maps.js";
import { loadBooths, logoUrl } from "../../shared/web/booths.js";
import { coverArt, coverFor } from "./covers.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const B = EVENT.booths;
const ALL = B.length;
const TOTAL = REQUIRED; // stamps needed to get the raffle ticket
const ROLE_TH = { student: "นักเรียน", teacher: "ครู", guest: "บุคคลทั่วไป" };
const DEMO = /[?&]demo=1/.test(location.search) || sessionStorage.getItem("tggc-demo") === "1";
if (DEMO) sessionStorage.setItem("tggc-demo", "1");

// ---------------------------------------------------------------- state
const KEY = "tggc2569-passport-v1";
const S = Object.assign(
  { pass: null, stamps: {}, pending: [], redeem: null, sound: true, synced: 0 },
  (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })()
);
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private mode */ } };
sound.on = S.sound !== false;

const count = () => BOOTH_IDS.filter((id) => S.stamps[id]).length;
const confirmed = () => BOOTH_IDS.filter((id) => S.stamps[id] && S.stamps[id].ok).length;

function applyServer(j) {
  if (!j || !j.passport) return;
  S.pass = { ...S.pass, id: j.passport.id, name: j.passport.name, school: j.passport.school, role: j.passport.role, token: j.token || S.pass?.token };
  const st = {};
  for (const [b, at] of Object.entries(j.stamps || {})) st[b] = { at, ok: true };
  for (const p of S.pending) if (!st[p.booth]) st[p.booth] = { at: p.at, ok: false };
  S.stamps = st;
  S.redeem = j.redeem || null;
  S.synced = Date.now();
  save();
}

// ---------------------------------------------------------------- api
async function api(path, data, method = data ? "POST" : "GET", wait = 12000) {
  if (DEMO) return demoApi(path, data);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), wait);
  let r;
  try {
    r = await fetch(path, {
      method, signal: ctl.signal,
      headers: { "content-type": "application/json", ...(S.pass ? { "x-pass": S.pass.id + "." + S.pass.token } : {}) },
      body: data ? JSON.stringify(data) : undefined,
    });
  } catch {
    throw Object.assign(new Error("ไม่มีสัญญาณอินเทอร์เน็ต"), { net: true });
  } finally { clearTimeout(t); }
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.ok === false) {
    // not our JSON (a Cloudflare error/limit page, a captive Wi-Fi portal…) or a server hiccup: worth retrying later
    if (!j || (r.status >= 500 && j.error !== "retry")) throw Object.assign(new Error((j && j.message) || "เครือข่ายไม่เสถียร ลองใหม่อีกครั้ง"), { net: true });
    throw Object.assign(new Error((j && j.message) || "เกิดข้อผิดพลาด"), { code: j && j.error, status: r.status });
  }
  return j;
}

// Demo mode: the whole flow runs in this browser so the site can be tried without a server.
function demoApi(path, data) {
  const D = JSON.parse(localStorage.getItem("tggc-demo-db") || "null") || {};
  const out = (extra = {}) => {
    localStorage.setItem("tggc-demo-db", JSON.stringify(D));
    return new Promise((res) => setTimeout(() => res({ ok: true, passport: { id: S.pass?.id || D.id, name: data?.name || S.pass?.name, school: data?.school ?? S.pass?.school, role: data?.role || S.pass?.role }, stamps: D.stamps || {}, redeem: D.redeem || null, token: "demo", now: Date.now(), ...extra }), 350));
  };
  if (path === "/api/join") { D.id = D.id || "G" + Math.random().toString(36).slice(2, 8).toUpperCase().replace(/[01IO]/g, "7"); D.stamps = D.stamps || {}; return out(); }
  if (path === "/api/me") return out();
  const p = parsePayload(data && data.c);
  if (!p) return Promise.reject(Object.assign(new Error("รหัสไม่ถูกต้อง"), { code: "code" }));
  if (path === "/api/stamp") {
    if (p.booth === EVENT.prizePoint.id) return Promise.reject(Object.assign(new Error("นี่คือ QR เคาน์เตอร์แลกรางวัล"), { code: "prize" }));
    D.stamps = D.stamps || {}; const fresh = !D.stamps[p.booth]; if (fresh) D.stamps[p.booth] = Date.now();
    return out({ booth: p.booth, fresh });
  }
  return Promise.reject(new Error("demo"));
}

// ---------------------------------------------------------------- pending queue (offline scans)
let flushing = false, flushTimer = 0;
async function flush() {
  if (flushing || !S.pass || !S.pending.length) return;
  flushing = true;
  try {
    while (S.pending.length) {
      const p = S.pending[0];
      try {
        const j = await api("/api/stamp", { c: p.c, at: p.at, sent: Date.now() });
        S.pending.shift();
        applyServer(j);
      } catch (e) {
        if (e.net) { schedule(); break; }
        S.pending.shift();
        if (!(S.stamps[p.booth] && S.stamps[p.booth].ok)) delete S.stamps[p.booth];
        save();
        toast(`ตราบูธ ${boothById(p.booth)?.no ?? ""} ไม่ผ่านการตรวจสอบ: ${e.message}`, true);
      }
    }
  } finally { flushing = false; save(); render(); }
}
function schedule() { clearTimeout(flushTimer); flushTimer = setTimeout(flush, 8000); }
addEventListener("online", flush);
document.addEventListener("visibilitychange", () => { if (!document.hidden && S.pending.length) flush(); });

async function sync(force = false) {
  if (!S.pass || (!force && Date.now() - S.synced < 45000)) return;
  try { applyServer(await api("/api/me")); render(); }
  catch (e) {
    if (e.status === 401 || e.status === 404) {
      // passport was removed on the server (e.g. test data reset): start over on this phone
      Object.assign(S, { pass: null, stamps: {}, pending: [], redeem: null, synced: 0 });
      save();
      toast("ไม่พบสมุดนี้ในระบบ (มีการล้างข้อมูลทดสอบ) กรุณาเปิดสมุดใหม่", true);
      location.hash = "#/join";
      route();
    }
  }
}

// ---------------------------------------------------------------- ui helpers
let toastT = 0;
function toast(msg, err = false) {
  const t = $("#toast");
  t.textContent = msg; t.classList.toggle("err", err); t.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 3600);
}
const fmtTime = (ms) => new Date(ms).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }) + " น.";
const eventDay = EVENT.start.slice(0, 10);
const at = (hhmm) => new Date(`${eventDay}T${hhmm}:00+07:00`).getTime();

function openSheet(html) {
  $("#sheetBody").innerHTML = html;
  $("#sheet").hidden = false;
  document.body.style.overflow = "hidden";
}
function closeSheet() { $("#sheet").hidden = true; document.body.style.overflow = ""; }
$("#sheet").addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeSheet(); });

// ---------------------------------------------------------------- static content
function fillStatic() {
  $("#heroDate").textContent = `${EVENT.dateText.replace("พฤศจิกายน", "พ.ย.")} · ${EVENT.venue.replace("โรงเรียน", "ร.ร.")}`;
  $("#heroLede").innerHTML = `ร่วมกิจกรรม${TOTAL >= ALL ? "ครบ" : ""} <b>${TOTAL} บูธ</b> รับตราประทับน้องจีออส แล้วนำตั๋วไปแลกสิทธิ์ลุ้นรางวัลที่<b>${esc(EVENT.prizePoint.name)}</b>`;
  $("#howBooths").textContent = `มีทั้งหมด ${ALL} บูธ · หอประชุมชูชาติ กำภู 60 ปี และข้างอาคาร 8 · ดูตำแหน่งได้ที่ผังงาน`;
  $("#howPrize").textContent = `ยื่นตั๋วให้เจ้าหน้าที่สแกนที่${EVENT.prizePoint.name} แล้ว${EVENT.raffle.slip}จับฉลาก · ${EVENT.prizePoint.place}`;
  $("#footText").innerHTML = `${esc(EVENT.title)}<br>${esc(EVENT.dateText)} · ${esc(EVENT.venue)} ${esc(EVENT.venueSub)}`;
  $("#progTitle").textContent = `${EVENT.title} · ${EVENT.dateText} · ${EVENT.venue} ${EVENT.venueSub}`;
  $("#prizeRail").innerHTML = EVENT.prizes.map((p) => `<div class="prize-card${p.art === "gift" ? " more" : ""}"><div class="pa">${prizeArt(p.art)}</div><b>${esc(p.name)}</b></div>`).join("");
  $("#prizeHead").textContent = EVENT.prizeHeadline;
  $("#prizeNote").textContent = EVENT.prizeNote;
  renderTimeline();
  renderMap();
}

function boothCard(b) {
  const got = S.stamps[b.id];
  return `<button class="bcard" type="button" data-booth="${b.id}" style="--c:${b.color}">
    <div class="bcard-top"><span class="no">BOOTH ${String(b.no).padStart(2, "0")}</span>${b.logo ? `<img class="blogo" src="${logoUrl(b)}" alt="" loading="lazy" decoding="async">` : icon(b.icon)}${got ? `<span class="got">${icon("check")}ได้ตราแล้ว</span>` : ""}</div>
    <div class="bcard-body"><b>${esc(b.th)}</b><span>${esc(b.en)}</span><small>${icon("place")}${esc(b.place)}</small></div></button>`;
}

function showBooth(id) {
  const b = boothById(id);
  if (!b) return;
  if (id === EVENT.prizePoint.id) {
    openSheet(`<div class="bs-head"><div class="ghost-stamp" style="color:#b98510;border-color:#e6c873">${icon("gift")}</div><div><span class="eyebrow">PRIZE POINT</span><h2>${esc(b.th)}</h2></div></div>
      <div class="meta"><span>${icon("place")}${esc(b.place)}</span><span>${icon("sparkle")}สะสมตราครบ ${TOTAL} บูธ แล้วนำตั๋วมาให้เจ้าหน้าที่สแกน จากนั้น${esc(EVENT.raffle.slip)}จับฉลาก</span></div>
      <a class="btn big" href="#/prize" data-close>ไปหน้าตั๋วลุ้นรางวัล</a>`);
    return;
  }
  const got = S.stamps[id];
  openSheet(`<div class="bs-head">${got ? stampHTML(b, S.pass?.id || "") : `<div class="ghost-stamp" style="color:${b.color};border-color:${b.color}66">${icon(b.icon)}</div>`}
      <div>${b.logo ? `<img class="bs-logo" src="${logoUrl(b)}" alt="โลโก้ ${esc(b.th)}">` : ""}<span class="eyebrow" style="color:${b.color}">BOOTH ${String(b.no).padStart(2, "0")} · ${esc(b.en)}</span><h2>${esc(b.th)}</h2></div></div>
    ${b.desc ? `<p style="margin:8px 0 0;font-size:15.5px">${esc(b.desc)}</p>` : ""}
    <div class="meta"><span>${icon("place")}${esc(b.place)}</span>
    ${got ? `<span style="color:var(--green);font-weight:600">${icon("check")}ได้รับตราเมื่อ ${fmtTime(got.at)}${got.ok ? "" : " (รอซิงก์)"}</span>` : `<span>${icon("scan")}ร่วมกิจกรรมเสร็จแล้ว สแกน QR บนจอเจ้าหน้าที่เพื่อรับตรา</span>`}</div>
    <div class="row"><a class="btn ghost" href="#/program/map" data-close data-focus="${b.id}">${icon("map")}<span>ดูบนผัง</span></a>${got ? "" : `<button class="btn" type="button" data-act="scan">${icon("scan")}<span>สแกนรับตรา</span></button>`}</div>`);
}

// ---------------------------------------------------------------- renders
function renderTop() {
  const n = count();
  const tb = $("#tbPass");
  tb.hidden = !S.pass;
  $("#tbCount").textContent = `${n}/${ALL}`;
  tb.style.setProperty("--p", Math.min(100, (n / TOTAL) * 100));
  $("#soundBtn").innerHTML = icon(sound.on ? "sound" : "mute");
  $("#soundBtn").setAttribute("aria-label", sound.on ? "ปิดเสียง" : "เปิดเสียง");
}

function renderHome() {
  const n = count();
  const cta = $("#heroCta");
  if (!S.pass) { cta.href = "#/join"; cta.firstElementChild.textContent = "เปิดสมุดสะสมตรา"; }
  else if (n >= TOTAL) { cta.href = "#/prize"; cta.firstElementChild.textContent = S.redeem ? "ยื่นตั๋วแล้ว ✓" : "รับตั๋วลุ้นรางวัล!"; }
  else { cta.href = "#scan"; cta.firstElementChild.textContent = "สแกนรับตรา"; }
  $("#heroBubble").textContent = !S.pass ? "มาตะลุยบูธกัน!" : n >= TOTAL ? (S.redeem ? "ขอให้โชคดีนะ!" : "ครบแล้ว! ไปแลกตั๋วกัน!") : n ? `อีก ${TOTAL - n} บูธ สู้ ๆ!` : "เริ่มบูธแรกกันเลย!";

  const pc = $("#homeProgress");
  pc.hidden = !S.pass;
  if (S.pass) {
    pc.innerHTML = `<div class="ring" style="--p:${Math.min(100, (n / TOTAL) * 100)}"><b>${n}<small>/${ALL}</small></b></div>
      <h3>${n >= TOTAL ? "สะสมครบทุกบูธแล้ว! 🎉" : `สวัสดี ${esc(S.pass.name.split(" ")[0])}`}</h3>
      <p>${n >= TOTAL ? `ไปที่${esc(EVENT.prizePoint.name)} ${esc(EVENT.prizePoint.place)}` : `สะสมแล้ว ${n} จาก ${ALL} ตรา · อีก ${TOTAL - n} ตราก็ได้ตั๋วลุ้นรางวัล`}</p>
      <div class="mini-stamps">${B.map((b) => `<i class="${S.stamps[b.id] ? "on" : ""}" style="--c:${b.color}"></i>`).join("")}</div>
      <a class="btn ${n >= TOTAL ? "green" : "ghost"}" href="${n >= TOTAL ? "#/prize" : "#/passport"}">${n >= TOTAL ? icon("gift") + `<span>${S.redeem ? "ยื่นตั๋วแล้ว · ดูขั้นต่อไป" : "รับตั๋วลุ้นรางวัล"}</span>` : icon("passport") + "<span>เปิดสมุดสะสมตรา</span>"}</a>`;
  }
  $("#boothRail").innerHTML = B.map(boothCard).join("");
  renderNow();
}

function renderNow() {
  const now = Date.now();
  const items = EVENT.schedule.map((s) => ({ ...s, a: at(s.t), b: at(s.e) }));
  const card = $("#nowCard");
  const start = new Date(EVENT.start).getTime(), end = new Date(EVENT.end).getTime();
  if (now < start - 86400e3 * 0 && now < start) {
    const d = Math.ceil((start - now) / 86400e3);
    card.innerHTML = `<div class="nc-time"><small>อีก</small>${d}<small>วัน</small></div><div><b>${esc(EVENT.dateText)}</b><span>${esc(EVENT.venue)} ${esc(EVENT.venueSub)} · บูธเปิด ${esc(EVENT.schedule.find((s) => s.tag === "booth")?.t || "")} น.</span><a href="#/program">ดูกำหนดการ →</a></div>`;
    return;
  }
  if (now > end) {
    card.innerHTML = `<div class="nc-time"><small>THANK</small>YOU</div><div><b>ขอบคุณที่ร่วมงาน TGGC 2026</b><span>แล้วพบกันใหม่ปีหน้า!</span></div>`;
    return;
  }
  const cur = items.filter((s) => now >= s.a && now < s.b);
  const next = items.find((s) => s.a > now);
  const show = cur.find((s) => s.tag !== "booth") || cur[0] || next;
  if (!show) { card.hidden = true; return; }
  card.innerHTML = `<div class="nc-time"><small>${cur.includes(show) ? "NOW" : "NEXT"}</small>${show.t}</div><div><b>${cur.includes(show) ? '<i class="live-dot" style="display:inline-block;margin-right:6px"></i>' : ""}${esc(show.title)}</b><span>${esc(show.place)}</span><a href="#/program">กำหนดการทั้งหมด →</a></div>`;
}

function renderPassport() {
  if (!S.pass) return;
  const n = count();
  const p = S.pass;
  const cv = coverArt(p.id);
  $("#ppCover").setAttribute("style", cv.style);
  $("#ppCover").innerHTML = `${cv.svg}<div class="pp-top"><img src="assets/logo-mark.webp" alt="" width="42" height="42"><div><b>GEO PASSPORT</b><span>สมุดสะสมตรา TGGC 2026</span></div></div>
    <div class="pp-holder"><div><small>HOLDER · ผู้ถือสมุด</small><div class="nm">${esc(p.name)}</div></div>
      <button class="qr-btn" type="button" data-act="myqr">${icon("qr")}QR ของฉัน</button>
      <div class="sc">${esc(p.school || ROLE_TH[p.role] || "")}${p.school && ROLE_TH[p.role] ? " · " + ROLE_TH[p.role] : ""}</div>
      <div class="pp-id">${esc(p.id)}</div></div>
    <span class="pp-ed" title="ลายสมุดของคุณ (สุ่มให้)"><small>No.${String(cv.c.no).padStart(2, "0")}</small>ลาย${esc(cv.c.th)}</span>
    <div class="pp-mrz">P&lt;THA&lt;TGGC2026&lt;&lt;${esc(p.id)}&lt;&lt;${"&lt;".repeat(20)}</div>`;

  $("#journey").innerHTML = `<div class="seg">${B.map((b) => `<i class="${S.stamps[b.id] ? (S.stamps[b.id].ok ? "on" : "on pending") : ""}" style="--c:${b.color}"></i>`).join("")}</div>
    <div class="seg-lab"><span>สะสมแล้ว <b>${n}</b> / ${ALL} บูธ</span><span>${n >= TOTAL ? "รับตั๋วลุ้นรางวัลได้แล้ว!" : `อีก ${TOTAL - n} ตรา ได้ตั๋วลุ้นรางวัล`}</span></div>`;

  $("#ppCount").textContent = `${n} / ${ALL}`;
  $("#stampGrid").innerHTML = B.map((b) => {
    const s = S.stamps[b.id];
    return `<button class="slot ${s ? "got" : ""} ${s && !s.ok ? "pend" : ""}" type="button" data-booth="${b.id}" style="--c:${b.color}">
      <div class="well">${s ? stampHTML(b, p.id) : `<div class="empty">${icon(b.icon)}<em>${String(b.no).padStart(2, "0")}</em></div>`}</div>
      <div class="cap"><b>${b.no}. ${esc(b.th)}</b>${s ? `<small class="${s.ok ? "ok" : "wait"}">${s.ok ? "✓ " + fmtTime(s.at) : "⏳ รอซิงก์"}</small>` : ""}</div></button>`;
  }).join("");

  const done = $("#ppDone");
  done.hidden = n < TOTAL;
  if (n >= TOTAL) {
    done.innerHTML = `${finalSealHTML()}<div><h3>ครบทุกบูธแล้ว!</h3><p>ได้ตรา Geo Genius สีทอง · รับตั๋วแล้วไปยื่นให้เจ้าหน้าที่สแกนที่${esc(EVENT.prizePoint.name)} ${esc(EVENT.prizePoint.place)}</p><a class="btn" href="#/prize">${icon("gift")}<span>${S.redeem ? "ยื่นตั๋วแล้ว · ดูขั้นต่อไป" : "รับตั๋วลุ้นรางวัล"}</span></a></div>`;
  }
  const note = $("#syncNote");
  note.hidden = !S.pending.length;
  note.innerHTML = `${icon("cloud")}มี ${S.pending.length} ตรารอส่งเข้าระบบ จะส่งให้อัตโนมัติเมื่อมีสัญญาณ`;
}

function renderPrize() {
  const body = $("#prizeBody");
  const n = count();
  const sky = `<div class="hero-sky" aria-hidden="true"><i class="aur a1"></i><i class="aur a2"></i><i class="stars"></i></div>`;
  const rail = `<div class="sec-title"><h2>ของรางวัล</h2><span>ตัวอย่าง</span></div><div class="prize-rail">${$("#prizeRail").innerHTML}</div><p class="prize-note">${esc(EVENT.prizeNote)}</p>`;
  if (!S.pass) {
    body.innerHTML = `<div class="prize-stage">${sky}<div class="orb locked">${icon("lock")}</div><h1>ลุ้นรางวัล</h1><p>เปิดสมุดสะสมตรา แล้วร่วมกิจกรรมให้ครบ ${TOTAL} บูธ เพื่อรับตั๋วลุ้นรางวัล</p><a class="btn green" href="#/join">เปิดสมุดสะสมตรา</a></div>${rail}`;
    return;
  }
  if (S.redeem) {
    body.innerHTML = redeemedHTML(S.redeem) + rail;
    if (S.seenRedeem !== S.redeem.at) { // celebrate once on this phone
      S.seenRedeem = S.redeem.at; save();
      sfx.win(); buzz([40, 60, 40, 60, 120]); fireworks(3000); burst(innerWidth / 2, innerHeight * 0.35, 140, 1.2);
    }
    return;
  }
  if (n < TOTAL || confirmed() < TOTAL) {
    const missing = B.filter((b) => !S.stamps[b.id]);
    body.innerHTML = `<div class="prize-stage">${sky}<div class="orb locked">${icon("lock")}</div>
      <h1>${n < TOTAL ? `อีก ${TOTAL - n} ตรา!` : "รอซิงก์ตราสักครู่"}</h1>
      <p>${n < TOTAL ? `สะสมตราให้ครบ ${TOTAL} บูธ เพื่อรับตั๋วลุ้นรางวัล` : "ตราบางดวงยังไม่ได้ส่งเข้าระบบ ต่ออินเทอร์เน็ตแล้วลองใหม่"}</p>
      ${missing.length ? `<p class="need-h">บูธที่ยังไม่ได้ตรา · แตะเพื่อดูรายละเอียด</p><div class="need">${missing.map((b) => `<button type="button" data-booth="${b.id}" style="--c:${b.color}" title="${esc(b.th)}">${b.no}</button>`).join("")}</div>` : ""}</div>${rail}`;
    return;
  }
  const p = S.pass;
  body.innerHTML = `<div class="prize-stage tk-stage">${sky}<span class="tk-kick">READY · ครบทุกบูธแล้ว!</span><h1>ตั๋วลุ้นรางวัลของคุณ</h1>
    <div class="ticket">
      <span class="tk-shine" aria-hidden="true"></span>
      <div class="tk-top"><img src="assets/logo-mark.webp" alt="" width="44" height="44"><div><b>PRIZE DRAW TICKET</b><span>ตั๋วลุ้นรางวัล TGGC 2026</span></div><em>ADMIT ONE</em></div>
      <div class="tk-qr" id="ticketQr" aria-label="QR ตั๋วลุ้นรางวัล"></div>
      <div class="tk-id">${esc(p.id)}</div>
      <div class="tk-cut" aria-hidden="true"></div>
      <div class="tk-bottom"><div><small>ผู้ถือตั๋ว</small><b>${esc(p.name)}</b><span>${esc(p.school || ROLE_TH[p.role] || "")}</span></div>
        <div class="tk-count"><b>${n}<small>/${ALL}</small></b><span>ตรา</span></div></div>
      <img class="tk-geos" src="assets/geos-front.webp" alt="" width="118" height="156">
    </div>
    <p class="tk-wait"><i class="live-dot"></i>รอเจ้าหน้าที่สแกน… หน้านี้จะอัปเดตเอง</p>
    <ol class="steps2"><li><b>1</b><span>ไปที่ <strong>${esc(EVENT.prizePoint.name)}</strong> · ${esc(EVENT.prizePoint.place)}</span></li><li><b>2</b><span>ยื่นตั๋วนี้ให้เจ้าหน้าที่สแกน QR (เพิ่มความสว่างหน้าจอด้วยนะ) · 1 คน ใช้ได้ 1 ครั้ง</span></li><li><b>3</b><span><strong>${esc(EVENT.raffle.slip)}จับฉลาก</strong> · ${esc(EVENT.raffle.announce)}</span></li></ol></div>${rail}`;
  import("../../shared/web/qr.js").then(({ qrSvg }) => qrSvg("GEOS-TICKET:" + p.id, { margin: 1 })).then((svg) => { const el = $("#ticketQr"); if (el) el.innerHTML = svg; }).catch(() => {});
  watchRedeem();
}

function redeemedHTML(r) {
  const p = S.pass;
  return `<div class="result-card win redeemed"><div class="rays"></div><span class="kick">TICKET ACCEPTED</span>
    <div class="rd-check">${icon("check")}</div>
    <h1>ยื่นตั๋วเรียบร้อย!</h1><p class="rd-sub">เจ้าหน้าที่สแกนตั๋วแล้ว · ${fmtTime(r.at)}</p>
    <div class="rd-next"><small>ขั้นต่อไป</small>
      <div class="rd-step"><b>✍️</b><span><strong>${esc(EVENT.raffle.slip)}จับฉลาก</strong>ที่${esc(EVENT.prizePoint.name)}</span></div>
      <div class="rd-step"><b>📣</b><span>${esc(EVENT.raffle.announce)} ตั้งใจฟังชื่อตัวเองนะ!</span></div></div>
    <div class="who"><b>${esc(p.name)}</b>${esc(p.school || "")}<br><code>${esc(p.id)}</code></div></div>`;
}

let tlSig = "";
function renderTimeline(onlyIfChanged = false) {
  const now = Date.now();
  // the "happening now" dot moves on by itself: re-render only when an item starts or ends
  const sig = EVENT.schedule.map((s) => (now >= at(s.e) ? "p" : now >= at(s.t) ? "n" : "f")).join("");
  if (onlyIfChanged && sig === tlSig) return;
  tlSig = sig;
  const color = { reg: "#0a98c7", stage: "#075f98", main: "#148e64", booth: "#15a8a0", break: "#86a4b1" };
  const label = { reg: "ลงทะเบียน", stage: "พิธีการ", main: "การแข่งขัน", booth: "กิจกรรม", break: "พัก" };
  $("#timeline").innerHTML = EVENT.schedule.map((s) => {
    const a = at(s.t), b = at(s.e);
    const cls = now >= a && now < b ? "now" : now >= b ? "past" : "";
    return `<li class="${cls}" style="--c:${color[s.tag] || "#0a98c7"}"><div class="tm">${s.t}<small>${s.e}</small></div><i class="dot"></i>
      <div class="ev"><span class="tag">${label[s.tag] || ""}</span>${cls === "now" ? '<span class="live"><i class="live-dot"></i>กำลังดำเนินการ</span>' : ""}<b>${esc(s.title)}</b><span class="pl">${icon("place")}${esc(s.place)}</span></div></li>`;
  }).join("");
}

function renderMap() {
  const M = EVENT.maps;
  const n = B.filter((b) => S.stamps[b.id]).length;
  $("#mapCard").innerHTML = `
    <figure class="map-fig"><figcaption><b>${esc(M.booths.title)}</b><button type="button" class="mv-open" data-mapview="booths">${icon("expand")}เต็มจอ</button></figcaption>
      <div class="map-svg" data-mapview="booths" title="แตะเพื่อขยาย">${boothMapSVG(S.stamps)}</div>
      <p class="map-note"><i class="pin-sample"></i>สีเขียว = ได้ตราแล้ว (${n}/${B.length}) · แตะผังเพื่อขยาย · แตะชื่อบูธด้านล่างเพื่อชี้ตำแหน่ง</p></figure>`;
  $("#mapLegend").innerHTML = B.map((b) => `<li><button type="button" data-booth="${b.id}" style="--c:${b.color}"><span class="n">${b.no}</span><span><b>${esc(b.th)}</b><small>${esc(b.place)}</small></span>${S.stamps[b.id] ? `<span class="ok">${icon("check")}</span>` : ""}</button></li>`).join("") +
    `<li><button type="button" data-booth="${EVENT.prizePoint.id}" style="--c:#c9971c"><span class="n">★</span><span><b>${esc(EVENT.prizePoint.th)}</b><small>${esc(EVENT.prizePoint.place)}</small></span></button></li>`;
  $("#schoolMap").innerHTML = `<figure class="map-fig"><figcaption><b>${esc(M.school.title)}</b><button type="button" class="mv-open" data-mapview="school">${icon("expand")}เต็มจอ</button></figcaption>
      <div class="map-svg" data-mapview="school" title="แตะเพื่อขยาย">${schoolMapSVG()}</div></figure>
    <ol class="places">${EVENT.places.map((p) => `<li><button type="button" data-place-focus="${p.no}"><span class="pn"><i>${p.no}</i></span><div><b>${esc(p.name)}</b>${p.lines.map((l) => `<small>• ${esc(l)}</small>`).join("")}</div></button></li>`).join("")}</ol>`;
}

// full-screen viewer: the map drawn large inside a scroll box; + / − change its width around the current centre
let mvZoom = 1;
function openMapView(kind) {
  const school = kind === "school";
  $("#mvTitle").textContent = school ? EVENT.maps.school.title : EVENT.maps.booths.title;
  $("#mvInner").innerHTML = school ? schoolMapSVG() : boothMapSVG(S.stamps);
  $("#mvHint").textContent = school ? "เลื่อนเพื่อดูผัง · ใช้ปุ่ม + − ซูม" : "แตะหมายเลขบูธเพื่อดูรายละเอียด · ใช้ปุ่ม + − ซูม";
  $("#mapView").hidden = false;
  document.documentElement.classList.add("lock");
  const sc = $("#mvScroll"), r = school ? 1045 / 575 : 1000 / 790;
  mvZoom = Math.min(2.5, Math.max(1, (sc.clientHeight * r) / sc.clientWidth)); // portrait phone: fill the height; "−" shows the whole plan
  mvLayout(school ? 0.62 : 0.28, school ? 0.4 : 0.42);
}
function mvLayout(fx, fy) {
  const sc = $("#mvScroll"), svg = $("#mvInner svg");
  if (!svg) return;
  const vb = svg.viewBox.baseVal, ratio = vb.width / vb.height;
  const fit = Math.min(sc.clientWidth, sc.clientHeight * ratio); // zoom 1 = whole plan on screen
  const w = Math.round(fit * mvZoom);
  $("#mvInner").style.width = w + "px";
  $("#mvInner").style.marginTop = Math.max(0, (sc.clientHeight - w / ratio) / 2) + "px";
  sc.scrollLeft = fx * w - sc.clientWidth / 2;
  sc.scrollTop = fy * (w / ratio) - sc.clientHeight / 2;
  $("#mvOut").disabled = mvZoom <= 1; $("#mvIn").disabled = mvZoom >= 4;
}
function mvZoomBy(k) {
  const sc = $("#mvScroll"), inner = $("#mvInner");
  const fx = (sc.scrollLeft + sc.clientWidth / 2) / inner.offsetWidth, fy = (sc.scrollTop + sc.clientHeight / 2) / inner.offsetHeight;
  mvZoom = Math.min(4, Math.max(1, mvZoom * k));
  mvLayout(fx, fy);
}
function closeMapView() { $("#mapView").hidden = true; document.documentElement.classList.remove("lock"); $("#mvInner").innerHTML = ""; }
$("#mvClose").onclick = closeMapView;
$("#mvIn").onclick = () => mvZoomBy(1.5);
$("#mvOut").onclick = () => mvZoomBy(1 / 1.5);
addEventListener("resize", () => { if (!$("#mapView").hidden) mvLayout(0.5, 0.5); });

function focusPlace(no) {
  const d = $(`#schoolMap [data-place="${no}"]`);
  if (!d) return;
  d.scrollIntoView({ behavior: "smooth", block: "center" });
  d.classList.remove("focus"); void d.getBoundingClientRect(); d.classList.add("focus");
}
function focusBooth(id) {
  const d = $(`#mapCard [data-dot="${id}"]`);
  if (!d) return;
  d.scrollIntoView({ behavior: "smooth", block: "center" });
  d.classList.remove("focus"); void d.getBoundingClientRect(); d.classList.add("focus");
}

let progTab = "schedule";
setInterval(() => { if (view === "program" && progTab === "schedule" && !document.hidden) renderTimeline(true); }, 20000);
function renderProgram(tab) {
  progTab = tab;
  $$("#progTabs a").forEach((a) => a.setAttribute("aria-selected", String(a.dataset.tab === tab)));
  $$("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== tab));
  if (tab === "booths") $("#boothList").innerHTML = B.map(boothCard).join("");
  if (tab === "map") renderMap();
  if (tab === "schedule") renderTimeline();
}

// ---------------------------------------------------------------- router
let view = "home", heroGlobe = null;
const TITLES = { home: "", join: "เปิดสมุด", passport: "สมุดสะสมตรา", prize: "ลุ้นรางวัล", program: "สูจิบัตร" };
function route() {
  const h = location.hash || "#/";
  if (/[#&]s=/.test(h)) { history.replaceState(null, "", location.pathname + location.search + "#/"); setTimeout(() => handleCode(h, "link"), 50); }
  if (h === "#scan") { history.replaceState(null, "", location.pathname + location.search + (S.pass ? "#/passport" : "#/join")); openScanner(); }
  let [, v, sub] = (location.hash || "#/").match(/^#\/?([a-z]*)\/?([a-z]*)/) || [];
  v = v || "home";
  if (!TITLES.hasOwnProperty(v)) v = "home";
  if (v === "passport" && !S.pass) v = "join";
  if (v === "join" && S.pass) v = "passport";
  const changed = v !== view;
  view = v;
  const apply = () => {
    $$("[data-view]").forEach((s) => (s.hidden = s.dataset.view !== v));
    $$("[data-nav]").forEach((a) => a.toggleAttribute("aria-current", a.dataset.nav === v || (v === "join" && a.dataset.nav === "passport")));
    $$("[data-nav]").forEach((a) => a.getAttribute("aria-current") !== null && a.setAttribute("aria-current", "page"));
    $("#tbTitle").textContent = TITLES[v];
    $(".brand").hidden = v !== "home";
    render();
    if (v === "program") renderProgram(sub || "schedule");
    if (changed) scrollTo({ top: 0 });
  };
  if (changed && document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(apply);
  else apply();
  if (v === "home" && !heroGlobe) heroGlobe = createGlobe($("#heroGlobe"), { size: 0.34 });
  if (v === "passport" || v === "prize") sync();
}
addEventListener("hashchange", route);

function render() {
  renderTop();
  if (view === "home") renderHome();
  if (view === "passport") renderPassport();
  if (view === "prize") renderPrize();
  if (view === "program" && (progTab === "map" || progTab === "booths")) renderProgram(progTab);
}

// ---------------------------------------------------------------- join
$("#jPhone").addEventListener("input", (e) => {
  const d = e.target.value.replace(/\D/g, "").slice(0, 10);
  e.target.value = d.length > 6 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
});
$("#joinForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  sfx.unlock();
  const f = e.target, err = $("#joinErr"), btn = $("#joinBtn");
  const data = { name: f.name.value.trim(), school: f.school.value.trim(), role: f.role.value, phone: f.phone.value.replace(/\D/g, ""), website: f.website.value };
  $$(".input", f).forEach((i) => i.classList.remove("bad"));
  let bad = null;
  if (data.name.length < 2) bad = [f.name, "กรุณากรอกชื่อ-นามสกุล"];
  else if (!/^0\d{8,9}$/.test(data.phone)) bad = [f.phone, "กรุณากรอกเบอร์โทร 9–10 หลัก ขึ้นต้นด้วย 0"];
  if (bad) { bad[0].classList.add("bad"); bad[0].focus(); err.textContent = bad[1]; err.hidden = false; return; }
  err.hidden = true;
  btn.disabled = true; btn.classList.add("loading");
  try {
    const j = await api("/api/join", data);
    S.pass = { id: j.id || j.passport.id, token: j.token, name: j.passport.name, school: j.passport.school, role: j.passport.role };
    applyServer(j);
    toast(j.recovered ? "กู้คืนสมุดสะสมตราเรียบร้อย!" : `เปิดสมุดสำเร็จ! คุณได้สมุดลาย${coverFor(S.pass.id).th}`);
    sfx.pop(); buzz(30);
    const r = $("#joinBtn").getBoundingClientRect(); burst(r.left + r.width / 2, r.top, 60, 0.7);
    location.hash = "#/passport";
    if (pendingCode) { const c = pendingCode; pendingCode = null; setTimeout(() => handleCode(c.text, c.src), 600); }
  } catch (ex) {
    err.textContent = ex.message; err.hidden = false;
  } finally { btn.disabled = false; btn.classList.remove("loading"); }
});

// ---------------------------------------------------------------- scanning & codes
let stopCam = null, scanMode = "booth", pickBooth = null, pendingCode = null, busy = false;

async function openScanner(mode = "booth") {
  sfx.unlock();
  if (!S.pass) { location.hash = "#/join"; toast("เปิดสมุดสะสมตราก่อนนะ"); return; }
  scanMode = mode;
  heroGlobe?.pause(); // give the phone's CPU to the camera decoder
  const sc = $("#scanner");
  sc.hidden = false;
  document.body.style.overflow = "hidden";
  $("#scTitle").textContent = mode === "prize" ? "สแกน QR จุดลุ้นรางวัล" : "สแกน QR ที่บูธ";
  $("#scSub").textContent = mode === "prize" ? "QR บนจอเจ้าหน้าที่จุดลุ้นรางวัล" : "หันกล้องไปที่ QR บนจอเจ้าหน้าที่";
  $("#scManualBtn").hidden = mode === "prize";
  showManual(false);
  setScanMsg("กำลังเปิดกล้อง…");
  const { startScanner, hasCamera } = await import("../../shared/web/scanner.js");
  if (!hasCamera()) { setScanMsg("เบราว์เซอร์นี้เปิดกล้องไม่ได้ ใช้การพิมพ์รหัสแทน", true); showManual(mode !== "prize"); return; }
  stopCam = await startScanner($("#scVideo"), async (text) => {
    const p = parsePayload(text);
    if (!p) { setScanMsg("QR นี้ไม่ใช่ของกิจกรรมสะสมตรา", true); buzz(80); return false; }
    closeScanner();
    handleCode(text, "camera");
    return true;
  }, {
    onError: () => { setScanMsg("เปิดกล้องไม่ได้ · อนุญาตการใช้กล้องในการตั้งค่าเบราว์เซอร์ หรือพิมพ์รหัสแทน", true); if (mode !== "prize") showManual(true); },
  });
  if (stopCam && !$("#scanner").hidden) setScanMsg("");
}
function closeScanner() {
  if (stopCam) { stopCam(); stopCam = null; }
  heroGlobe?.resume();
  $("#scanner").hidden = true;
  document.body.style.overflow = "";
}
function setScanMsg(t, err = false) { const m = $("#scMsg"); m.textContent = t; m.classList.toggle("err", err); }
function showManual(on) {
  $("#scManual").hidden = !on;
  $("#scManualBtn").parentElement.hidden = on;
  if (on) {
    $("#scBooths").innerHTML = B.map((b) => `<button type="button" data-pick="${b.id}" style="--c:${b.color}" aria-pressed="${pickBooth === b.id}" aria-label="บูธ ${b.no} ${esc(b.th)}">${b.no}</button>`).join("");
    $("#scPicked").textContent = pickBooth ? `บูธ ${boothById(pickBooth).no} · ${boothById(pickBooth).th}` : "แตะหมายเลขบูธ";
    $("#scCode").value = "";
  }
}
$("#scClose").onclick = closeScanner;
$("#scManualBtn").onclick = () => showManual(true);
$("#scBackCam").onclick = () => { showManual(false); if (!stopCam) openScanner(scanMode); };
$("#scBooths").addEventListener("click", (e) => {
  const b = e.target.closest("[data-pick]"); if (!b) return;
  pickBooth = b.dataset.pick;
  $$("#scBooths [data-pick]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  $("#scPicked").textContent = `บูธ ${boothById(pickBooth).no} · ${boothById(pickBooth).th}`;
  $("#scCode").focus();
});
$("#scCode").addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6); });
$("#scManual").addEventListener("submit", (e) => {
  e.preventDefault();
  const code = $("#scCode").value;
  if (!pickBooth) { toast("เลือกบูธก่อน", true); return; }
  if (!/^\d{6}$/.test(code)) { toast("รหัสต้องมี 6 หลัก", true); return; }
  closeScanner();
  handleCode(`${pickBooth}..${code}`, "typed");
});

/** a booth/prize code arrived (camera, typed, or a link opened from the phone's own camera app) */
async function handleCode(text, src) {
  const p = parsePayload(text);
  if (!p) { toast("QR ไม่ถูกต้อง", true); return; }
  if (!S.pass) { pendingCode = { text: p.raw, src }; location.hash = "#/join"; toast("เปิดสมุดสะสมตราก่อน แล้วระบบจะให้ตราอัตโนมัติ"); return; }
  if (p.booth === EVENT.prizePoint.id) {
    location.hash = "#/prize";
    toast(count() < TOTAL ? `ยังสะสมไม่ครบ ขาดอีก ${TOTAL - count()} ตรา` : "ยื่นตั๋วให้เจ้าหน้าที่สแกนได้เลย", count() < TOTAL);
    return;
  }
  const b = boothById(p.booth);
  if (!b) { toast("ไม่พบบูธนี้", true); return; }
  if (S.stamps[b.id]) { toast(`คุณได้ตราบูธ ${b.no} · ${b.th} แล้ว`); location.hash = "#/passport"; return; }
  if (busy) { toast("กำลังส่งตราก่อนหน้า รอสักครู่แล้วสแกนอีกครั้ง"); return; }
  busy = true;
  const scannedAt = Date.now();
  toast(`กำลังรับตราบูธ ${b.no}…`);
  try {
    // slow venue Wi-Fi: after 6 s the stamp is kept on the phone and sent again in the background
    const j = await api("/api/stamp", { c: p.raw, at: scannedAt, sent: Date.now() }, "POST", 6000);
    applyServer(j);
    celebrate(b);
  } catch (e) {
    if (e.net) {
      // offline: show the stamp now, verify when the signal is back
      S.pending.push({ c: p.raw, booth: b.id, at: scannedAt });
      S.stamps[b.id] = { at: scannedAt, ok: false };
      save(); schedule();
      celebrate(b, true);
    } else {
      toast(e.message, true); buzz([60, 40, 60]);
      if (e.code === "prize") location.hash = "#/prize";
    }
  } finally { busy = false; }
}

function celebrate(b, offline = false) {
  location.hash = "#/passport";
  const n = count();
  const ce = $("#celebrate");
  const slot = $("#ceSlot");
  slot.classList.remove("slam");
  slot.innerHTML = stampHTML(b, S.pass.id);
  $(".ce-splash").style.setProperty("--c", b.color);
  $("#ceKicker").textContent = (offline ? "ได้รับตรา! (จะซิงก์เมื่อมีสัญญาณ)" : "ได้รับตราประทับ!") + ` · บูธ ${b.no}`;
  $("#ceTitle").textContent = b.th;
  $("#ceSub").textContent = n >= TOTAL ? `ครบแล้ว! รับตั๋วลุ้นรางวัล แล้วไปยื่นที่${EVENT.prizePoint.name}` : `สะสมแล้ว ${n} จาก ${ALL} ตรา · อีก ${TOTAL - n} ตราได้ตั๋วลุ้นรางวัล`;
  $("#ceDots").innerHTML = B.map((x) => `<i class="${S.stamps[x.id] ? "on" : ""} ${x.id === b.id ? "new" : ""}" style="--c:${x.color}"></i>`).join("");
  $("#ceGo").innerHTML = n >= TOTAL ? `${icon("gift")}<span>รับตั๋วลุ้นรางวัล</span>` : `<span>ดูสมุดตรา</span>`;
  $("#ceMore").hidden = n >= TOTAL;
  ce.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => slot.classList.add("slam")));
  setTimeout(() => {
    const card = $(".ce-card");
    card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
    const sp = $(".ce-splash"); sp.classList.remove("go"); void sp.offsetWidth; sp.classList.add("go");
    sfx.stamp(); buzz([25, 30, 70]);
    const r = slot.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, n >= TOTAL ? 160 : 90, n >= TOTAL ? 1.2 : 0.9);
    if (n >= TOTAL) { setTimeout(() => { fireworks(2200); sfx.win(); }, 500); }
  }, 400);
  render();
}
$("#ceGo").onclick = () => { $("#celebrate").hidden = true; location.hash = count() >= TOTAL ? "#/prize" : "#/passport"; };
$("#ceMore").onclick = () => { $("#celebrate").hidden = true; openScanner(); };

// ---------------------------------------------------------------- waiting at the prize counter
let watchT = 0;
function watchRedeem() {
  clearTimeout(watchT);
  if (view !== "prize" || S.redeem || !S.pass || count() < TOTAL || DEMO) return;
  watchT = setTimeout(async () => {
    if (!document.hidden && view === "prize" && !S.redeem) {
      try {
        // light check (one row); fetch the full passport only once the ticket has been scanned
        const t = await api("/api/ticket");
        if (t.redeem) applyServer(await api("/api/me"));
      } catch { /* keep waiting */ }
      if (S.redeem) { render(); return; }
    }
    watchRedeem();
  }, 3000);
}

// ---------------------------------------------------------------- my QR
async function showMyQR() {
  openSheet(`<h2>QR ของฉัน</h2><p style="margin:0;color:var(--muted)">ให้เจ้าหน้าที่สแกน กรณีมือถือสแกน QR ของบูธไม่ได้ หรือเพื่อตรวจสอบสิทธิ์</p><div class="qr-box" id="myQr"></div><div class="center"><div class="big-id">${esc(S.pass.id)}</div><div>${esc(S.pass.name)}</div></div>`);
  const { qrSvg } = await import("../../shared/web/qr.js");
  const el = $("#myQr"); if (el) el.innerHTML = await qrSvg("GEOS-PASS:" + S.pass.id, { margin: 1 });
}

// ---------------------------------------------------------------- global clicks
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-act]");
  if (a) {
    const act = a.dataset.act;
    if (act === "scan") { closeSheet(); openScanner("booth"); }
    if (act === "myqr") showMyQR();
    return;
  }
  const fo = e.target.closest("[data-focus]");
  if (fo) setTimeout(() => focusBooth(fo.dataset.focus), 450);
  const mv = e.target.closest("[data-mapview]");
  if (mv) { e.preventDefault(); openMapView(mv.dataset.mapview); return; }
  const pf = e.target.closest("[data-place-focus]");
  if (pf) { focusPlace(pf.dataset.placeFocus); return; }
  const bt = e.target.closest("[data-booth]");
  if (bt) {
    e.preventDefault();
    if (bt.closest("#mapLegend") && bt.dataset.booth !== EVENT.prizePoint.id) { focusBooth(bt.dataset.booth); return; }
    showBooth(bt.dataset.booth);
    return;
  }
  const scanLink = e.target.closest('a[href="#scan"]');
  if (scanLink) { e.preventDefault(); openScanner(); }
});
$("#scanFab").onclick = () => openScanner("booth");
$("#soundBtn").onclick = () => { sound.on = !sound.on; S.sound = sound.on; save(); renderTop(); if (sound.on) sfx.pop(); };
addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!$("#scanner").hidden) closeScanner();
  else if (!$("#sheet").hidden) closeSheet();
  else if (!$("#mapView").hidden) closeMapView();
  else if (!$("#celebrate").hidden) $("#celebrate").hidden = true;
});
document.addEventListener("visibilitychange", () => { if (!document.hidden) { sync(); flush(); renderNow(); } });
setInterval(() => { if (view === "home") renderNow(); }, 60000);

// ---------------------------------------------------------------- boot
fillStatic();
loadBooths(() => { fillStatic(); render(); }); // names/logos edited on the admin site
if (DEMO) $("#demoFlag").hidden = false;
route();
flush();
sync(true);
if ("serviceWorker" in navigator && !DEMO && location.protocol === "https:") {
  addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
