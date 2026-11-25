// TGGC 2026 activity passport — participant app (vanilla JS, no framework).
import { EVENT, BOOTH_IDS, boothById } from "../../shared/event.js";
import { parsePayload } from "../../shared/otp.js";
import { icon, prizeArt } from "../../shared/web/icons.js";
import { burst, fireworks, drift, sfx, sound, buzz } from "../../shared/web/fx.js";
import { createGlobe } from "./globe.js";
import { stampHTML, finalSealHTML } from "./stamps.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const B = EVENT.booths;
const TOTAL = B.length;
const ROLE_TH = { student: "นักเรียน", teacher: "ครู", guest: "บุคคลทั่วไป" };
const DEMO = /[?&]demo=1/.test(location.search) || sessionStorage.getItem("tggc-demo") === "1";
if (DEMO) sessionStorage.setItem("tggc-demo", "1");

// ---------------------------------------------------------------- state
const KEY = "tggc2569-passport-v1";
const S = Object.assign(
  { pass: null, stamps: {}, pending: [], draw: null, sound: true, synced: 0, prizeCode: null },
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
  S.draw = j.draw || null;
  S.synced = Date.now();
  save();
}

// ---------------------------------------------------------------- api
async function api(path, data, method = data ? "POST" : "GET") {
  if (DEMO) return demoApi(path, data);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 12000);
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
    if (r.status >= 500 && (!j || j.error === "err")) throw Object.assign(new Error((j && j.message) || "ระบบไม่ว่าง"), { net: true });
    throw Object.assign(new Error((j && j.message) || "เกิดข้อผิดพลาด"), { code: j && j.error, status: r.status });
  }
  return j;
}

// Demo mode: the whole flow runs in this browser so the site can be tried without a server.
function demoApi(path, data) {
  const D = JSON.parse(localStorage.getItem("tggc-demo-db") || "null") || { prizes: EVENT.prizes.map((p) => ({ ...p, remaining: p.qty })) };
  const out = (extra = {}) => {
    localStorage.setItem("tggc-demo-db", JSON.stringify(D));
    return new Promise((res) => setTimeout(() => res({ ok: true, passport: { id: S.pass?.id || D.id, name: data?.name || S.pass?.name, school: data?.school ?? S.pass?.school, role: data?.role || S.pass?.role }, stamps: D.stamps || {}, draw: D.draw || null, token: "demo", now: Date.now(), ...extra }), 350));
  };
  if (path === "/api/join") { D.id = D.id || "G" + Math.random().toString(36).slice(2, 8).toUpperCase().replace(/[01IO]/g, "7"); D.stamps = D.stamps || {}; return out(); }
  if (path === "/api/me") return out();
  const p = parsePayload(data && data.c);
  if (!p) return Promise.reject(Object.assign(new Error("รหัสไม่ถูกต้อง"), { code: "code" }));
  if (path === "/api/stamp") {
    if (p.booth === EVENT.prizePoint.id) return Promise.reject(Object.assign(new Error("นี่คือ QR จุดลุ้นรางวัล"), { code: "prize" }));
    D.stamps = D.stamps || {}; const fresh = !D.stamps[p.booth]; if (fresh) D.stamps[p.booth] = Date.now();
    return out({ booth: p.booth, fresh });
  }
  if (path === "/api/draw") {
    if (!D.draw) {
      const stock = D.prizes.filter((z) => z.remaining > 0);
      const win = stock.length && Math.random() < EVENT.winRate;
      const z = win ? stock[(Math.random() * stock.length) | 0] : null;
      if (z) z.remaining--;
      D.draw = { win: !!z, prize: z ? { id: z.id, name: z.name, art: z.art } : null, at: Date.now(), claimed: null };
    }
    return out();
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

async function sync(force = false) {
  if (!S.pass || (!force && Date.now() - S.synced < 45000)) return;
  try { applyServer(await api("/api/me")); render(); }
  catch (e) {
    if (e.status === 401 || e.status === 404) { toast("ไม่พบสมุดนี้ในระบบ กรุณาเปิดสมุดใหม่", true); }
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
  $("#heroLede").innerHTML = `ร่วมกิจกรรมครบ <b>${TOTAL} บูธ</b> รับตราประทับน้องจีออส แล้วไปลุ้นของรางวัลที่<b>${esc(EVENT.prizePoint.name)}</b>`;
  $("#howBooths").textContent = `มีทั้งหมด ${TOTAL} บูธ ทั่วงาน · ดูตำแหน่งได้ที่ผังงาน`;
  $("#howPrize").textContent = `${EVENT.prizePoint.name} · ${EVENT.prizePoint.place}`;
  $("#footText").innerHTML = `${esc(EVENT.title)}<br>${esc(EVENT.dateText)} · ${esc(EVENT.venue)} ${esc(EVENT.venueSub)}`;
  $("#progTitle").textContent = `${EVENT.title} · ${EVENT.dateText} · ${EVENT.venue} ${EVENT.venueSub}`;
  $("#prizeRail").innerHTML = EVENT.prizes.map((p) => `<div class="prize-card"><div class="pa">${prizeArt(p.art)}</div><b>${esc(p.name)}</b></div>`).join("");
  renderTimeline();
  renderMap();
}

function boothCard(b) {
  const got = S.stamps[b.id];
  return `<button class="bcard" type="button" data-booth="${b.id}" style="--c:${b.color}">
    <div class="bcard-top"><span class="no">BOOTH ${String(b.no).padStart(2, "0")}</span>${icon(b.icon)}${got ? `<span class="got">${icon("check")}ได้ตราแล้ว</span>` : ""}</div>
    <div class="bcard-body"><b>${esc(b.name)}</b><span>${esc(b.th)}</span><small>${icon("place")}${esc(b.place)}</small></div></button>`;
}

function showBooth(id) {
  const b = boothById(id);
  if (!b) return;
  if (id === EVENT.prizePoint.id) {
    openSheet(`<div class="bs-head"><div class="ghost-stamp" style="color:#b98510;border-color:#e6c873">${icon("gift")}</div><div><span class="eyebrow">PRIZE POINT</span><h2>${esc(b.name)}</h2></div></div>
      <div class="meta"><span>${icon("place")}${esc(b.place)}</span><span>${icon("sparkle")}สะสมตราครบ ${TOTAL} บูธ แล้วสแกน QR ที่จุดนี้เพื่อลุ้นรางวัล</span></div>
      <a class="btn big" href="#/prize" data-close>ไปหน้าลุ้นรางวัล</a>`);
    return;
  }
  const got = S.stamps[id];
  openSheet(`<div class="bs-head">${got ? stampHTML(b, S.pass?.id || "") : `<div class="ghost-stamp" style="color:${b.color};border-color:${b.color}66">${icon(b.icon)}</div>`}
      <div><span class="eyebrow" style="color:${b.color}">BOOTH ${String(b.no).padStart(2, "0")}</span><h2>${esc(b.name)}</h2><div style="color:var(--muted);font-weight:600">${esc(b.th)}</div></div></div>
    <p style="margin:8px 0 0;font-size:15.5px">${esc(b.desc)}</p>
    <div class="meta"><span>${icon("place")}${esc(b.place)}</span>
    ${got ? `<span style="color:var(--green);font-weight:600">${icon("check")}ได้รับตราเมื่อ ${fmtTime(got.at)}${got.ok ? "" : " (รอซิงก์)"}</span>` : `<span>${icon("scan")}ร่วมกิจกรรมเสร็จแล้ว สแกน QR บนจอเจ้าหน้าที่เพื่อรับตรา</span>`}</div>
    <div class="row"><a class="btn ghost" href="#/program/map" data-close>${icon("map")}<span>ดูบนผัง</span></a>${got ? "" : `<button class="btn" type="button" data-act="scan">${icon("scan")}<span>สแกนรับตรา</span></button>`}</div>`);
}

// ---------------------------------------------------------------- renders
function renderTop() {
  const n = count();
  const tb = $("#tbPass");
  tb.hidden = !S.pass;
  $("#tbCount").textContent = `${n}/${TOTAL}`;
  tb.style.setProperty("--p", (n / TOTAL) * 100);
  $("#soundBtn").innerHTML = icon(sound.on ? "sound" : "mute");
  $("#soundBtn").setAttribute("aria-label", sound.on ? "ปิดเสียง" : "เปิดเสียง");
}

function renderHome() {
  const n = count();
  const cta = $("#heroCta");
  if (!S.pass) { cta.href = "#/join"; cta.firstElementChild.textContent = "เปิดสมุดสะสมตรา"; }
  else if (n >= TOTAL) { cta.href = "#/prize"; cta.firstElementChild.textContent = S.draw ? "ดูผลลุ้นรางวัล" : "ไปลุ้นรางวัลกันเลย!"; }
  else { cta.href = "#scan"; cta.firstElementChild.textContent = "สแกนรับตรา"; }
  $("#heroBubble").textContent = !S.pass ? "มาตะลุยบูธกัน!" : n >= TOTAL ? "ครบแล้ว! ไปลุ้นกัน!" : n ? `อีก ${TOTAL - n} บูธ สู้ ๆ!` : "เริ่มบูธแรกกันเลย!";

  const pc = $("#homeProgress");
  pc.hidden = !S.pass;
  if (S.pass) {
    pc.innerHTML = `<div class="ring" style="--p:${(n / TOTAL) * 100}"><b>${n}<small>/${TOTAL}</small></b></div>
      <h3>${n >= TOTAL ? "สะสมครบทุกบูธแล้ว! 🎉" : `สวัสดี ${esc(S.pass.name.split(" ")[0])}`}</h3>
      <p>${n >= TOTAL ? `ไปที่${esc(EVENT.prizePoint.name)} ${esc(EVENT.prizePoint.place)}` : `สะสมแล้ว ${n} จาก ${TOTAL} ตรา · อีก ${TOTAL - n} บูธก็ได้ลุ้นรางวัล`}</p>
      <div class="mini-stamps">${B.map((b) => `<i class="${S.stamps[b.id] ? "on" : ""}" style="--c:${b.color}"></i>`).join("")}</div>
      <a class="btn ${n >= TOTAL ? "green" : "ghost"}" href="${n >= TOTAL ? "#/prize" : "#/passport"}">${n >= TOTAL ? icon("gift") + "<span>ไปลุ้นรางวัล</span>" : icon("passport") + "<span>เปิดสมุดสะสมตรา</span>"}</a>`;
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
  $("#ppCover").innerHTML = `<div class="pp-top"><img src="assets/logo-mark.webp" alt="" width="42" height="42"><div><b>GEO PASSPORT</b><span>สมุดสะสมตรา TGGC 2026</span></div></div>
    <div class="pp-holder"><div><small>HOLDER · ผู้ถือสมุด</small><div class="nm">${esc(p.name)}</div></div>
      <button class="qr-btn" type="button" data-act="myqr">${icon("qr")}QR ของฉัน</button>
      <div class="sc">${esc(p.school || ROLE_TH[p.role] || "")}${p.school && ROLE_TH[p.role] ? " · " + ROLE_TH[p.role] : ""}</div>
      <div class="pp-id">${esc(p.id)}</div></div>
    <div class="pp-mrz">P&lt;THA&lt;TGGC2026&lt;&lt;${esc(p.id)}&lt;&lt;${"&lt;".repeat(20)}</div>`;

  const idx = B.reduce((m, b, i) => (S.stamps[b.id] ? i : m), -1);
  const pct = TOTAL > 1 ? (n / TOTAL) : 1;
  $("#journey").innerHTML = `<div class="track"></div><div class="fill" style="width:calc((100% - 44px) * ${Math.max(0, (n - 1) / Math.max(1, TOTAL - 1))})"></div>
    <img class="walker" src="assets/geos-front.webp" alt="" width="118" height="156" style="left:calc(22px + (100% - 44px) * ${Math.max(0, idx) / Math.max(1, TOTAL - 1)})" ${idx < 0 ? "hidden" : ""}>
    <ol>${B.map((b) => `<li class="${S.stamps[b.id] ? (S.stamps[b.id].ok ? "on" : "on pending") : ""}" style="--c:${b.color}"><span class="node">${icon(b.icon)}</span><span>${String(b.no).padStart(2, "0")}</span></li>`).join("")}</ol>`;
  void pct;

  $("#ppCount").textContent = `${n} / ${TOTAL}`;
  $("#stampGrid").innerHTML = B.map((b) => {
    const s = S.stamps[b.id];
    return `<button class="slot ${s ? "got" : ""} ${s && !s.ok ? "pend" : ""}" type="button" data-booth="${b.id}" style="--c:${b.color}">
      <div class="well">${s ? stampHTML(b, p.id) : `<div class="empty">${icon(b.icon)}<em>BOOTH ${String(b.no).padStart(2, "0")}</em></div>`}</div>
      <div class="cap"><b>${esc(b.name)}</b>${s ? `<small class="${s.ok ? "ok" : "wait"}">${s.ok ? "✓ " + fmtTime(s.at) : "⏳ รอซิงก์"}</small>` : `<small>${esc(b.th)}</small>`}</div></button>`;
  }).join("");

  const done = $("#ppDone");
  done.hidden = n < TOTAL;
  if (n >= TOTAL) {
    done.innerHTML = `${finalSealHTML()}<div><h3>ครบทุกบูธแล้ว!</h3><p>ได้ตรา Geo Genius สีทอง · ไปลุ้นรางวัลที่ ${esc(EVENT.prizePoint.place)}</p><a class="btn" href="#/prize">${icon("gift")}<span>${S.draw ? "ดูผลลุ้นรางวัล" : "ไปลุ้นรางวัล"}</span></a></div>`;
  }
  const note = $("#syncNote");
  note.hidden = !S.pending.length;
  note.innerHTML = `${icon("cloud")}มี ${S.pending.length} ตรารอส่งเข้าระบบ จะส่งให้อัตโนมัติเมื่อมีสัญญาณ`;
}

function renderPrize() {
  const body = $("#prizeBody");
  const n = count();
  const sky = `<div class="hero-sky" aria-hidden="true"><i class="aur a1"></i><i class="aur a2"></i><i class="stars"></i></div>`;
  if (!S.pass) {
    body.innerHTML = `<div class="prize-stage">${sky}<div class="orb locked">${icon("lock")}</div><h1>ลุ้นรางวัล</h1><p>เปิดสมุดสะสมตรา แล้วร่วมกิจกรรมให้ครบ ${TOTAL} บูธ เพื่อรับสิทธิ์ลุ้นของรางวัล</p><a class="btn green" href="#/join">เปิดสมุดสะสมตรา</a></div>
      <div class="sec-title"><h2>ของรางวัล</h2></div><div class="prize-rail">${$("#prizeRail").innerHTML}</div>`;
    return;
  }
  if (S.draw) { body.innerHTML = resultHTML(S.draw, false); return; }
  if (n < TOTAL || confirmed() < TOTAL) {
    const missing = B.filter((b) => !S.stamps[b.id]);
    body.innerHTML = `<div class="prize-stage">${sky}<div class="orb locked">${icon("lock")}</div>
      <h1>${n < TOTAL ? `อีก ${TOTAL - n} ตรา!` : "รอซิงก์ตราสักครู่"}</h1>
      <p>${n < TOTAL ? `สะสมตราให้ครบ ${TOTAL} บูธ เพื่อปลดล็อกการลุ้นรางวัล` : "ตราบางดวงยังไม่ได้ส่งเข้าระบบ ต่ออินเทอร์เน็ตแล้วลองใหม่"}</p>
      ${missing.length ? `<div class="need">${missing.map((b) => `<a href="#booth-${b.id}" data-booth="${b.id}" style="--c:${b.color}"><i>${icon(b.icon)}</i><span><b>บูธ ${b.no} · ${esc(b.name)}</b><small>${esc(b.place)}</small></span></a>`).join("")}</div>` : ""}</div>
      <div class="sec-title"><h2>ของรางวัล</h2></div><div class="prize-rail">${$("#prizeRail").innerHTML}</div>`;
    return;
  }
  if (S.prizeCode && Date.now() - S.prizeCode.at < 8 * 60e3) {
    body.innerHTML = `<div class="prize-stage">${sky}<p style="margin:0 0 6px;font-family:var(--f-tech);letter-spacing:.2em;color:var(--mist)">READY · พร้อมแล้ว</p>
      <button class="orb ready" type="button" data-act="draw"><b>แตะเพื่อลุ้น!<small>${icon("sparkle")}</small></b></button>
      <h1>ลุ้นรางวัลได้ 1 ครั้ง</h1><p>ตั้งใจ อธิษฐาน แล้วแตะลูกโลกได้เลย!</p></div>`;
    return;
  }
  body.innerHTML = `<div class="prize-stage">${sky}<div class="orb">${icon("gift")}</div><h1>พร้อมลุ้นแล้ว!</h1>
    <p>คุณสะสมตราครบ ${TOTAL} บูธแล้ว ไปที่จุดลุ้นรางวัลเพื่อรับสิทธิ์ลุ้น</p>
    <ol class="steps2"><li><b>1</b><span>ไปที่ <strong>${esc(EVENT.prizePoint.name)}</strong> · ${esc(EVENT.prizePoint.place)}</span></li><li><b>2</b><span>สแกน QR บนจอเจ้าหน้าที่จุดลุ้นรางวัล</span></li><li><b>3</b><span>แตะลูกโลกเพื่อลุ้น! ได้รางวัลรับของได้ทันที</span></li></ol>
    <button class="btn green" type="button" data-act="scan-prize">${icon("scan")}<span>สแกน QR จุดลุ้นรางวัล</span></button></div>
    <div class="sec-title"><h2>ของรางวัล</h2></div><div class="prize-rail">${$("#prizeRail").innerHTML}</div>`;
}

function resultHTML(d, fresh) {
  const p = S.pass;
  if (d.win) {
    return `<div class="result-card win"><div class="rays"></div><span class="kick">CONGRATULATIONS</span>
      <h1>เย้! ยินดีด้วย 🎉</h1><div style="font-family:var(--f-display);font-size:18px;font-weight:700">คุณคือผู้โชคดี!</div>
      <div class="pa">${prizeArt(d.prize?.art)}</div><span class="prize-name">${esc(d.prize?.name || "ของรางวัล")}</span>
      <p>${d.claimed ? "รับรางวัลเรียบร้อยแล้ว ขอบคุณที่ร่วมสนุกกับ TGGC 2026" : "แสดงหน้านี้กับเจ้าหน้าที่ที่จุดลุ้นรางวัลเพื่อรับของรางวัลได้เลย"}</p>
      ${d.claimed ? `<span class="claimed">${icon("check")}รับของแล้ว · ${fmtTime(d.claimed)}</span>` : ""}
      <div class="who"><b>${esc(p.name)}</b>${esc(p.school || "")}<br><code>${esc(p.id)}</code></div>
      ${fresh ? `<button class="btn ghost" type="button" data-act="close-draw" style="background:#fff">เยี่ยมไปเลย!</button>` : ""}</div>`;
  }
  const lines = ["ปีหน้ามาลุ้นใหม่นะ!", "เกือบแล้ว! ปีหน้ามาลุ้นกันใหม่", "โชคยังไม่เข้าข้าง แต่ความรู้เต็มกระเป๋าแล้ว!"];
  const line = lines[(p.id.charCodeAt(3) || 0) % lines.length];
  return `<div class="result-card lose"><span class="kick" style="color:var(--teal)">THANK YOU</span><h1>${line}</h1>
    <img class="lose-geos" src="assets/geos-front.webp" alt="" width="118" height="156">
    <p>รอบนี้ยังไม่ได้รางวัล แต่น้องจีออสขอบคุณที่ร่วมสะสมตราครบทุกบูธ เป็นนักสำรวจตัวจริงเลย! 💙💚</p>
    <div class="who"><b>${esc(p.name)}</b>${esc(p.school || "")}<br><code>${esc(p.id)}</code></div>
    ${fresh ? `<button class="btn" type="button" data-act="close-draw">ขอบคุณนะ!</button>` : ""}</div>`;
}

function renderTimeline() {
  const now = Date.now();
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
  const M = EVENT.map;
  const kinds = {
    hall: { fill: "#d9ecf7", stroke: "#0a98c7" }, main: { fill: "#d5f1e6", stroke: "#148e64" },
    bld: { fill: "#eef3f5", stroke: "#a7c5cf" }, plaza: { fill: "#fff6dc", stroke: "#e2c46c" },
    field: { fill: "#bfe8c9", stroke: "#2cc394" },
  };
  const shapes = M.buildings.map((b) => {
    const k = kinds[b.kind] || kinds.bld;
    const lines = b.kind === "field" ? `<g stroke="#fff" stroke-opacity=".8" stroke-width="1.5" fill="none"><rect x="${b.x + 8}" y="${b.y + 8}" width="${b.w - 16}" height="${b.h - 16}" rx="4"/><path d="M${b.x + 8} ${b.y + b.h / 2}h${b.w - 16}"/><circle cx="${b.x + b.w / 2}" cy="${b.y + b.h / 2}" r="14"/></g>` : "";
    return { bg: `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="10" fill="${k.fill}" stroke="${k.stroke}" stroke-width="1.5"/>${lines}`,
      label: `<text class="mlabel" x="${b.x + b.w / 2}" y="${b.y + 17}" text-anchor="middle">${esc(b.name)}</text>` };
  });
  const pin = (p, label, color, id) => `<g class="pin" data-booth="${id}" tabindex="0" role="button" aria-label="${esc(p.name)}">
      <circle class="pulse" cx="${p.x}" cy="${p.y}" r="12" fill="${color}" opacity=".5"/>
      <path d="M${p.x} ${p.y + 2} c-10 -12 -13 -15 -13 -22 a13 13 0 0 1 26 0 c0 7 -3 10 -13 22z" fill="${color}" stroke="#fff" stroke-width="2"/>
      <text x="${p.x}" y="${p.y - 16}" text-anchor="middle">${label}</text></g>`;
  const pins = B.map((b) => pin(b, b.no, S.stamps[b.id] ? "#148e64" : b.color, b.id)).join("") +
    pin(EVENT.prizePoint, "★", "#c9971c", EVENT.prizePoint.id);
  const g = M.gate;
  $("#mapCard").innerHTML = `<svg viewBox="0 0 360 480" role="img" aria-label="ผังงาน">
    <defs><pattern id="grass" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M0 16 16 0" stroke="#d3ecd9" stroke-width="1"/></pattern></defs>
    <rect width="360" height="480" fill="#eaf6ef"/><rect width="360" height="480" fill="url(#grass)"/>
    ${M.image ? `<image href="${esc(M.image)}" x="0" y="0" width="360" height="480" preserveAspectRatio="xMidYMid slice"/>` : `
    <path d="M0 200 H30 Q50 200 50 220 V288 H222 M50 200 V92 H262 M50 288 V392" stroke="#fff" stroke-width="14" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M0 200 H30 Q50 200 50 220 V288 H222 M50 200 V92 H262 M50 288 V392" stroke="#cfe0e4" stroke-width="1" fill="none" stroke-dasharray="6 6"/>
    ${shapes.map((x) => x.bg).join("")}${shapes.map((x) => x.label).join("")}
    <g transform="translate(${g.x} ${g.y})"><rect x="-14" y="-12" width="28" height="24" rx="6" fill="#075f98"/><path d="M-6 4V-4h12v8" stroke="#fff" stroke-width="2" fill="none"/></g>
    <text class="mlabel" x="${g.x + 20}" y="${g.y + 28}">${esc(g.name)}</text>`}
    <g transform="translate(326 34)"><circle r="20" fill="#fff" stroke="#bfdce1"/><path d="M0 -14 5 2H-5z" fill="#d93d4a"/><path d="M0 14 5 -2H-5z" fill="#86a4b1"/><text y="-22" text-anchor="middle" class="mlabel" style="font-family:var(--f-tech);font-weight:700">N</text></g>
    ${pins}</svg>`;
  $("#mapLegend").innerHTML = [...B, EVENT.prizePoint].map((b) => {
    const prize = b.id === EVENT.prizePoint.id;
    return `<li><button type="button" data-booth="${b.id}" style="--c:${prize ? "#c9971c" : b.color}"><span class="n">${prize ? "★" : b.no}</span><span><b>${esc(prize ? b.name : b.name + " · " + b.th)}</b><small>${esc(b.place)}</small></span>${S.stamps[b.id] ? `<span class="ok">${icon("check")}</span>` : ""}</button></li>`;
  }).join("");
}

function renderProgram(tab) {
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
    toast(j.recovered ? "กู้คืนสมุดสะสมตราเรียบร้อย!" : "เปิดสมุดสะสมตราสำเร็จ!");
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
  $("#scanner").hidden = true;
  document.body.style.overflow = "";
}
function setScanMsg(t, err = false) { const m = $("#scMsg"); m.textContent = t; m.classList.toggle("err", err); }
function showManual(on) {
  $("#scManual").hidden = !on;
  $("#scManualBtn").parentElement.hidden = on;
  if (on) {
    $("#scBooths").innerHTML = B.map((b) => `<button type="button" data-pick="${b.id}" style="--c:${b.color}" aria-pressed="${pickBooth === b.id}"><i>${b.no}</i>${esc(b.name)}</button>`).join("");
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
    if (count() < TOTAL) { location.hash = "#/prize"; toast(`ยังสะสมไม่ครบ ขาดอีก ${TOTAL - count()} บูธ`, true); return; }
    S.prizeCode = { c: p.raw, at: Date.now() }; save();
    location.hash = "#/prize"; render();
    sfx.pop(); buzz(40);
    return;
  }
  const b = boothById(p.booth);
  if (!b) { toast("ไม่พบบูธนี้", true); return; }
  if (S.stamps[b.id]) { toast(`คุณได้ตราบูธ ${b.no} · ${b.name} แล้ว`); location.hash = "#/passport"; return; }
  if (busy) return;
  busy = true;
  const scannedAt = Date.now();
  try {
    const j = await api("/api/stamp", { c: p.raw, at: scannedAt, sent: Date.now() });
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
  $("#ceKicker").textContent = offline ? "ได้รับตรา! (จะซิงก์เมื่อมีสัญญาณ)" : "ได้รับตราประทับ!";
  $("#ceTitle").textContent = `บูธ ${b.no} · ${b.name}`;
  $("#ceSub").textContent = n >= TOTAL ? `ครบทุกบูธแล้ว! ไปลุ้นรางวัลที่ ${EVENT.prizePoint.place}` : `สะสมแล้ว ${n} จาก ${TOTAL} ตรา · อีก ${TOTAL - n} บูธ`;
  $("#ceDots").innerHTML = B.map((x) => `<i class="${S.stamps[x.id] ? "on" : ""} ${x.id === b.id ? "new" : ""}" style="--c:${x.color}"></i>`).join("");
  $("#ceGo").innerHTML = n >= TOTAL ? `${icon("gift")}<span>ไปลุ้นรางวัล</span>` : `<span>ดูสมุดตรา</span>`;
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

// ---------------------------------------------------------------- draw
let dxGlobe = null;
async function startDraw() {
  if (!S.prizeCode) return;
  sfx.unlock();
  const fx = $("#drawfx");
  fx.hidden = false; fx.classList.remove("charge");
  $("#dxResult").hidden = true; $("#dxResult").innerHTML = "";
  $(".dx-slot").hidden = false;
  document.body.style.overflow = "hidden";
  if (!dxGlobe) dxGlobe = createGlobe($("#dxGlobe"), { size: 0.3, speed: 0.4, dots: 3200 });
  dxGlobe.setSpeed(0.6);
  sfx.whoosh();
  const names = [...EVENT.prizes.map((p) => p.name), "ลุ้น…", "น้องจีออสกำลังเลือก…"];
  let i = 0;
  const slot = $("#dxSlot");
  const spin = setInterval(() => { slot.textContent = names[i++ % names.length]; sfx.tick(); }, 140);
  const t0 = Date.now();
  const ramp = setInterval(() => { const t = (Date.now() - t0) / 1000; dxGlobe.setSpeed(0.6 + t * t * 2.2); }, 50);
  setTimeout(() => fx.classList.add("charge"), 1200);
  let res, err;
  try { res = await api("/api/draw", { c: S.prizeCode.c, at: S.prizeCode.at, sent: Date.now() }); } catch (e) { err = e; }
  const wait = Math.max(0, 3600 - (Date.now() - t0));
  await new Promise((r) => setTimeout(r, wait));
  clearInterval(spin); clearInterval(ramp);
  if (err) {
    fx.hidden = true; document.body.style.overflow = ""; dxGlobe.setSpeed(0.4);
    if (err.code === "expired" || err.code === "code") { S.prizeCode = null; save(); }
    toast(err.net ? "ต้องเชื่อมต่ออินเทอร์เน็ตเพื่อลุ้นรางวัล ลองใหม่อีกครั้ง" : err.message, true);
    render();
    return;
  }
  applyServer(res);
  S.prizeCode = null; save();
  const fl = $(".dx-flash"); fl.classList.remove("go"); void fl.offsetWidth; fl.classList.add("go");
  $(".dx-slot").hidden = true;
  dxGlobe.setSpeed(0.25);
  fx.classList.remove("charge");
  const d = S.draw;
  const out = $("#dxResult");
  out.innerHTML = resultHTML(d, true);
  out.hidden = false;
  if (d && d.win) { sfx.win(); buzz([40, 60, 40, 60, 120]); fireworks(3600); burst(innerWidth / 2, innerHeight * 0.4, 160, 1.3); }
  else { sfx.lose(); buzz(60); drift(30); }
  render();
}
function closeDraw() { $("#drawfx").hidden = true; document.body.style.overflow = ""; location.hash = "#/prize"; render(); }

// ---------------------------------------------------------------- my QR
async function showMyQR() {
  openSheet(`<h2>QR ของฉัน</h2><p style="margin:0;color:var(--muted)">ให้เจ้าหน้าที่สแกน กรณีมือถือสแกน QR ของบูธไม่ได้ หรือเพื่อตรวจสอบรางวัล</p><div class="qr-box" id="myQr"></div><div class="center"><div class="big-id">${esc(S.pass.id)}</div><div>${esc(S.pass.name)}</div></div>`);
  const { qrSvg } = await import("../../shared/web/qr.js");
  const el = $("#myQr"); if (el) el.innerHTML = await qrSvg("GEOS-PASS:" + S.pass.id, { margin: 1 });
}

// ---------------------------------------------------------------- global clicks
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-act]");
  if (a) {
    const act = a.dataset.act;
    if (act === "scan") { closeSheet(); openScanner("booth"); }
    if (act === "scan-prize") openScanner("prize");
    if (act === "myqr") showMyQR();
    if (act === "draw") startDraw();
    if (act === "close-draw") closeDraw();
    return;
  }
  const bt = e.target.closest("[data-booth]");
  if (bt) { e.preventDefault(); showBooth(bt.dataset.booth); return; }
  const scanLink = e.target.closest('a[href="#scan"]');
  if (scanLink) { e.preventDefault(); openScanner(); }
});
$("#mapCard").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.dataset.booth) showBooth(e.target.dataset.booth); });
$("#scanFab").onclick = () => openScanner("booth");
$("#soundBtn").onclick = () => { sound.on = !sound.on; S.sound = sound.on; save(); renderTop(); if (sound.on) sfx.pop(); };
addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!$("#scanner").hidden) closeScanner();
  else if (!$("#sheet").hidden) closeSheet();
  else if (!$("#celebrate").hidden) $("#celebrate").hidden = true;
});
document.addEventListener("visibilitychange", () => { if (!document.hidden) { sync(); flush(); renderNow(); } });
setInterval(() => { if (view === "home") renderNow(); }, 60000);

// ---------------------------------------------------------------- boot
fillStatic();
if (DEMO) $("#demoFlag").hidden = false;
route();
flush();
sync(true);
if ("serviceWorker" in navigator && !DEMO && location.protocol === "https:") {
  addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
