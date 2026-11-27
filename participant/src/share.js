// Shareable pictures of the passport (1080×1920, story size), drawn on a canvas on the phone — no server, works offline.
// Four collections; the last two unlock with more stamps. Each hides small details worth a second look
// (microprint, a postmark, the plane flying along the route, a constellation named after the holder…).
// Graphics are plain SVG images (no foreignObject, so iPhone Safari can export the canvas). Shows the holder's name and
// school only — never the passport id or phone number.
import { EVENT } from "../../shared/event.js";
import { iconPath } from "../../shared/web/icons.js";
import { patternSvg } from "../../shared/web/patterns.js";
import { qrSvg } from "../../shared/web/qr.js";
import { BOOTH_XY } from "./maps.js";
import { medalFor, medalSVG } from "./badges.js";

export const COLLECTIONS = [
  { id: "passport", th: "พาสปอร์ต", en: "PASSPORT", need: 1, icon: "passport" },
  { id: "boarding", th: "บอร์ดดิ้งพาส", en: "BOARDING PASS", need: 1, icon: "plane" },
  { id: "holo", th: "การ์ดโฮโลแกรม", en: "HOLO CARD", need: 10, icon: "sparkle" },
  { id: "stars", th: "เส้นทางดวงดาว", en: "STAR ROUTE", need: 15, icon: "star" },
];

const W = 1080, H = 1920;
const K = `Kanit, "IBM Plex Sans Thai", sans-serif`, B = `"IBM Plex Sans Thai", Kanit, sans-serif`, T = `"Chakra Petch", Kanit, sans-serif`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const rng = (seed) => { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const hhmm = (ms) => new Date(ms).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
const pad = (n, l = 2) => String(n).padStart(l, "0");

// ---------------------------------------------------------------- drawing helpers
const img = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const svgImg = (svg) => img("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.includes("xmlns=") ? svg : svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ')));
const iconImg = (name, color, size = 48, sw = 2) => svgImg(`<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${iconPath(name)}</svg>`);
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function fit(ctx, text, maxW, weight, max, min, family) {
  let s = max;
  for (; s > min; s -= 2) { ctx.font = `${weight} ${s}px ${family}`; if (ctx.measureText(text).width <= maxW) break; }
  ctx.font = `${weight} ${s}px ${family}`;
  return s;
}
function text(ctx, s, x, y, { font, color = "#fff", align = "left", alpha = 1, base = "alphabetic" } = {}) {
  ctx.save(); if (font) ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base; ctx.globalAlpha = alpha; ctx.fillText(s, x, y); ctx.restore();
}
// film grain: barely visible, makes flat colour look printed
function grain(ctx, seed, n = 9000, a = 0.05) {
  const R = rng(seed); ctx.save();
  for (let i = 0; i < n; i++) { ctx.fillStyle = R() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`; ctx.fillRect(R() * W, R() * H, 1.6, 1.6); }
  ctx.restore();
}
// banknote-style microprint along a line (only readable when you zoom in)
function microprint(ctx, s, x, y, w, color, alpha = 0.45, size = 11) {
  ctx.save(); ctx.font = `700 ${size}px ${T}`; ctx.fillStyle = color; ctx.globalAlpha = alpha; ctx.textBaseline = "middle";
  ctx.beginPath(); ctx.rect(x, y - size, w, size * 2); ctx.clip();
  const unit = ctx.measureText(s).width;
  for (let cx = x; cx < x + w; cx += unit) ctx.fillText(s, cx, y);
  ctx.restore();
}
// holographic foil: pastel rainbow + diagonal light bands
function foil(ctx, x, y, w, h, r, alpha = 1, gold = false) {
  ctx.save(); rr(ctx, x, y, w, h, r); ctx.clip();
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  const stops = gold ? ["#fff3c4", "#f2cf6b", "#fff8de", "#e0a93a", "#fff3c4", "#c9971c"] : ["#ffd1f2", "#c3e8ff", "#d9ffe9", "#fff6c7", "#e5d2ff", "#bff6ff"];
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.globalAlpha = alpha; ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 0.35 * alpha; ctx.fillStyle = "#fff";
  for (let i = -2; i < 6; i++) { ctx.beginPath(); const bx = x + i * w * 0.28; ctx.moveTo(bx, y + h); ctx.lineTo(bx + w * 0.08, y + h); ctx.lineTo(bx + w * 0.5, y); ctx.lineTo(bx + w * 0.42, y); ctx.fill(); }
  ctx.restore();
}
function barcode(ctx, seedStr, x, y, w, h, color) {
  const R = rng(hash(seedStr)); ctx.save(); ctx.fillStyle = color;
  let cx = x;
  while (cx < x + w - 4) { const bw = 1 + Math.floor(R() * 4); if (R() > 0.35) ctx.fillRect(cx, y, bw * 1.6, h); cx += bw * 1.6 + 2 + Math.floor(R() * 3); }
  ctx.restore();
}

// a stamp as a self-contained SVG (ring + booth name on the rim + icon + number), slightly rotated like a real one
function stampSvg(b, got, seed, faded = "#bfdce1") {
  const no = pad(b.no);
  if (!got) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <circle cx="100" cy="100" r="84" fill="none" stroke="${faded}" stroke-width="5" stroke-dasharray="10 9"/>
      <text x="100" y="116" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="44" fill="${faded}">${no}</text></svg>`;
  }
  const rot = (hash(seed + b.id) % 25) - 12;
  const label = esc(String(b.en || b.name).toUpperCase());
  const fs = Math.min(17, Math.max(10, 200 / (label.length * 0.74))).toFixed(1);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
    <defs><path id="a" d="M 31 100 A 69 69 0 0 1 169 100"/><path id="b" d="M 19 100 A 81 81 0 0 0 181 100"/></defs>
    <g transform="rotate(${rot} 100 100)" fill="none" stroke="${b.color}">
      <circle cx="100" cy="100" r="95" stroke-width="6"/><circle cx="100" cy="100" r="88" stroke-width="1.6" stroke-dasharray="2 3.2"/><circle cx="100" cy="100" r="61" stroke-width="3"/>
      <g fill="${b.color}" stroke="none" font-family="Arial, Helvetica, sans-serif" font-weight="700">
        <text font-size="${fs}" letter-spacing="1.5"><textPath href="#a" startOffset="50%" text-anchor="middle">${label}</textPath></text>
        <text font-size="12" letter-spacing="2"><textPath href="#b" startOffset="50%" text-anchor="middle">TGGC 2026 · BOOTH ${no}</textPath></text>
        <text x="100" y="146" text-anchor="middle" font-size="24">${no}</text>
      </g>
      <g transform="translate(73 62) scale(2.25)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconPath(b.icon)}</g>
    </g></svg>`;
}
// post-office cancellation over the newest stamp: a dated ring + wavy lines
function postmarkSvg(color, dateText) {
  const waves = [0, 1, 2, 3, 4].map((i) => `<path d="M118 ${62 + i * 16} q 18 -10 36 0 t 36 0 t 36 0 t 36 0" />`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 270 200" width="270" height="200">
    <g fill="none" stroke="${color}" stroke-width="3.2" opacity=".78" transform="rotate(-10 135 100)">
      <circle cx="68" cy="100" r="58"/><circle cx="68" cy="100" r="50" stroke-width="1.4"/>${waves}
      <defs><path id="p" d="M 24 100 A 44 44 0 0 1 112 100"/></defs>
      <text fill="${color}" stroke="none" font-family="Arial, sans-serif" font-weight="700" font-size="13" letter-spacing="2"><textPath href="#p" startOffset="50%" text-anchor="middle">PAK KRET · NONTHABURI</textPath></text>
      <text x="68" y="106" fill="${color}" stroke="none" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="17">${esc(dateText)}</text>
      <text x="68" y="128" fill="${color}" stroke="none" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="11" letter-spacing="1.5">TGGC 2026</text>
    </g></svg>`;
}
async function drawQR(ctx, x, y, size, pad = 12, bg = "#fff") {
  try {
    const q = await svgImg(await qrSvg(EVENT.participantUrl, { ecc: "M", margin: 1, color: "#021b2e" }));
    ctx.fillStyle = bg; rr(ctx, x, y, size, size, 18); ctx.fill();
    ctx.drawImage(q, x + pad, y + pad, size - pad * 2, size - pad * 2);
  } catch { /* no QR */ }
}
async function drawLogo(ctx, x, y, w, plate = true) {
  try {
    const logo = await img(document.querySelector(".brand img")?.src || "assets/logo-full.webp");
    const h = (w * logo.naturalHeight) / logo.naturalWidth;
    if (plate) { ctx.fillStyle = "#fff"; rr(ctx, x - 16, y - 12, w + 32, h + 24, 22); ctx.fill(); }
    ctx.drawImage(logo, x, y, w, h);
    return h;
  } catch { return 0; }
}
const geosSrc = () => document.querySelector(".hero-geos")?.src || "assets/geos.webp";

// ---------------------------------------------------------------- facts about this passport
const RARITY = [
  [1, "LEGENDARY", "ตำนาน", 5, "#ffd166"], [15 / 23, "EPIC", "มหากาพย์", 4, "#d6a8ff"],
  [10 / 23, "SUPER RARE", "หายากมาก", 3, "#8fdcff"], [5 / 23, "RARE", "หายาก", 2, "#7ff5cc"], [0, "COMMON", "ทั่วไป", 1, "#cfe3ea"],
];
function facts({ pass, stamps, booths, total }) {
  const all = booths.length;
  const got = booths.filter((b) => stamps[b.id]).map((b) => ({ b, at: +(stamps[b.id].at || stamps[b.id]) || 0 })).sort((a, c) => a.at - c.at || a.b.no - c.b.no);
  const n = got.length, done = n >= total;
  const first = got[0]?.at || 0, last = got[n - 1]?.at || 0;
  const mins = first && last ? Math.max(1, Math.round((last - first) / 60000)) : 0;
  const [, rarity, rarityTh, stars, rarityColor] = RARITY.find(([f]) => n >= Math.ceil(f * all)) || RARITY[4];
  const zones = new Set(got.map((g) => g.b.place)).size, zonesAll = new Set(booths.map((b) => b.place)).size;
  // little achievements, computed from the stamp times
  const ach = [];
  if (done) ach.push(["gift", "Geo Genius", "สะสมครบทุกบูธ"]);
  const eventDay = EVENT.start.slice(0, 10);
  if (first && first < new Date(`${eventDay}T09:30:00+07:00`).getTime() && first > new Date(`${eventDay}T00:00:00+07:00`).getTime()) ach.push(["clock", "Early Bird", "ตราแรกก่อน 09:30 น."]);
  for (let i = 0; i + 4 < n; i++) if (got[i + 4].at - got[i].at <= 15 * 60000) { ach.push(["sparkle", "Speedrunner", "5 ตราภายใน 15 นาที"]); break; }
  if (stamps.b23 || got.some((g) => g.b.icon === "star")) ach.push(["star", "Star Gazer", "ไปถึงท้องฟ้าจำลอง"]);
  if (zones >= zonesAll && n >= 4) ach.push(["compass", "All Zones", `ครบทุกโซน ${zonesAll} โซน`]);
  let run = 1, best = 1;
  for (let i = 1; i < n; i++) { run = got[i].b.no === got[i - 1].b.no + 1 ? run + 1 : 1; best = Math.max(best, run); }
  if (best >= 5) ach.push(["map", "Route Master", `เดินตามเลขบูธ ${best} บูธติด`]);
  // constellation name: the holder's first name without a title
  const given = String(pass.name || "").replace(/^(เด็กหญิง|เด็กชาย|ด\.ญ\.|ด\.ช\.|นางสาว|น\.ส\.|นาง|นาย|ครู|ว่าที่ร้อยตรี|ว่าที่ ร\.ต\.)\s*/, "").split(/\s+/)[0] || "นักสำรวจ";
  const serial = pad((hash("serial:" + pass.id) % 9000) + 1000, 4);
  return { all, got, n, done, first, last, mins, rarity, rarityTh, stars, rarityColor, zones, zonesAll, ach: ach.slice(0, 3), given, serial, medal: medalFor(n, all) };
}

// ---------------------------------------------------------------- collection 1: passport data page
async function passport(ctx, d, f) {
  const { pass, cover } = d;
  const gold = f.done;
  const g = ctx.createLinearGradient(0, 0, W * 0.6, H);
  g.addColorStop(0, cover.g[0]); g.addColorStop(0.45, cover.g[1]); g.addColorStop(1, cover.g[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  try { const pat = await svgImg(patternSvg(cover.pat, { w: W, h: H, u: 64, sw: 2.2, seed: hash(pass.id) % 9973 }).replaceAll("currentColor", "#ffffff")); ctx.globalAlpha = 0.14; ctx.drawImage(pat, 0, 0, W, H); ctx.globalAlpha = 1; } catch { /* plain */ }
  grain(ctx, hash(pass.id));
  // stitched cover edge + microprint
  ctx.save(); ctx.setLineDash([16, 12]); ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,255,255,.35)"; rr(ctx, 26, 26, W - 52, H - 52, 40); ctx.stroke(); ctx.restore();
  microprint(ctx, "TGGC2026·GEOPASSPORT·13.9°N100.5°E·", 60, 46, W - 120, "#fff", 0.4);
  microprint(ctx, "ภูมิศาสตร์·ภูมิสารสนเทศ·ชลประทานวิทยา·", 60, H - 46, W - 120, "#fff", 0.4);

  await drawLogo(ctx, 92, 92, 170);
  text(ctx, "GEO PASSPORT", 312, 150, { font: `700 44px ${T}`, color: cover.acc });
  text(ctx, "หนังสือเดินทางนักสำรวจ · TGGC 2026", 312, 196, { font: `600 30px ${B}`, color: "rgba(255,255,255,.88)" });
  // rarity stars, top right
  for (let i = 0; i < 5; i++) text(ctx, "★", W - 96 - (4 - i) * 34, 142, { font: `700 32px ${B}`, color: i < f.stars ? f.rarityColor : "rgba(255,255,255,.22)", align: "center" });
  text(ctx, f.rarity, W - 96, 186, { font: `700 22px ${T}`, color: f.rarityColor, align: "right" });

  // data page
  const px = 70, py = 268, pw = W - 140, ph = 1440;
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16; ctx.fillStyle = "#fbfaf3"; rr(ctx, px, py, pw, ph, 34); ctx.fill(); ctx.restore();
  ctx.save(); rr(ctx, px, py, pw, ph, 34); ctx.clip();
  // guilloche-ish background lines on the page
  ctx.strokeStyle = "rgba(7,95,152,.07)"; ctx.lineWidth = 1.4;
  for (let i = 0; i < 26; i++) { ctx.beginPath(); for (let x = px; x <= px + pw; x += 12) { const y = py + 40 + i * 18 + Math.sin(x / 70 + i * 0.6) * 10; x === px ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); }
  ctx.restore();
  // holder fields
  const lab = (s, x, y) => text(ctx, s, x, y, { font: `700 19px ${T}`, color: "#7a93a0" });
  lab("HOLDER · ผู้ถือหนังสือเดินทาง", px + 46, py + 70);
  ctx.fillStyle = "#0a2b42"; fit(ctx, pass.name, pw - 330, 800, 64, 36, K); ctx.fillText(pass.name, px + 46, py + 140);
  lab("SCHOOL · โรงเรียน/หน่วยงาน", px + 46, py + 196);
  text(ctx, pass.school || "—", px + 46, py + 238, { font: `600 32px ${B}`, color: "#0a2b42" });
  lab("ISSUED AT · ออกให้ ณ", px + 46, py + 294);
  text(ctx, `${EVENT.venue} · ${EVENT.dateShort}`, px + 46, py + 334, { font: `600 28px ${B}`, color: "#0a2b42" });
  lab("EDITION · ลายปก", px + 520, py + 294);
  text(ctx, `No.${pad(cover.no)} ${cover.th}`, px + 520, py + 334, { font: `600 28px ${B}`, color: "#0a2b42" });
  // medal box on the right
  if (f.medal) { try { ctx.drawImage(await svgImg(medalSVG(f.medal, { size: 150 })), px + pw - 210, py + 40, 150, 180); } catch { /* skip */ } }
  text(ctx, f.medal ? f.medal.th : "นักสำรวจหน้าใหม่", px + pw - 135, py + 250, { font: `700 24px ${K}`, color: "#075f98", align: "center" });
  // stamps
  const gx = px + 30, gy = py + 380, gw = pw - 60, cols = 5, cell = gw / cols, sz = cell * 0.9, rows = Math.ceil(f.all / cols), rh = 176;
  const imgs = await Promise.all(d.booths.map((b) => svgImg(stampSvg(b, !!d.stamps[b.id], pass.id)).catch(() => null)));
  imgs.forEach((im, i) => { if (!im) return; const x = gx + (i % cols) * cell + (cell - sz) / 2, y = gy + Math.floor(i / cols) * rh; ctx.globalAlpha = d.stamps[d.booths[i].id] ? 0.95 : 1; ctx.drawImage(im, x, y, sz, sz); ctx.globalAlpha = 1; });
  // postmark across the newest stamp
  if (f.n) {
    const li = d.booths.indexOf(f.got[f.n - 1].b), x = gx + (li % cols) * cell, y = gy + Math.floor(li / cols) * rh;
    const date = new Date(f.last).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).toUpperCase();
    try { ctx.drawImage(await svgImg(postmarkSvg("#3c4a7a", date)), Math.min(x - 20, px + pw - 290), y - 6, 270, 200); } catch { /* skip */ }
  }
  // holographic security seal (bottom-right corner of the page)
  const sx = px + pw - 150, sy = py + ph - 150;
  ctx.save(); ctx.beginPath(); ctx.arc(sx, sy, 92, 0, Math.PI * 2); ctx.clip(); foil(ctx, sx - 92, sy - 92, 184, 184, 0, 1, gold); ctx.restore();
  ctx.save(); ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, sy, 78, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  text(ctx, gold ? "GENIUS" : "GEO", sx, sy + 6, { font: `800 ${gold ? 34 : 44}px ${K}`, color: "rgba(10,43,66,.6)", align: "center" });
  text(ctx, "AUTHENTIC · 2026", sx, sy + 38, { font: `700 13px ${T}`, color: "rgba(10,43,66,.55)", align: "center" });
  // machine readable zone
  const mrz1 = `P<GEO<TGGC2026<<${f.given.length && /^[A-Za-z]/.test(f.given) ? f.given.toUpperCase().slice(0, 12) : "EXPLORER"}<<<<<<<<<<<<<<<<<<<<<`.slice(0, 44);
  const mrz2 = `${f.serial}<${pad(f.n)}${pad(f.all)}<THA<${(hash(pass.id) % 900000 + 100000)}<<<<<<<<<<<<<<<<<<<<<`.slice(0, 44);
  text(ctx, mrz1, px + 46, py + ph - 92, { font: `600 27px ui-monospace, "Courier New", monospace`, color: "rgba(10,43,66,.55)" });
  text(ctx, mrz2, px + 46, py + ph - 52, { font: `600 27px ui-monospace, "Courier New", monospace`, color: "rgba(10,43,66,.55)" });

  // footer
  text(ctx, f.done ? "ครบทุกบูธแล้ว!" : `สะสมแล้ว ${f.n}/${f.all} บูธ`, 80, 1786, { font: `800 46px ${K}` });
  text(ctx, `${EVENT.short} · ${EVENT.dateText}`, 80, 1836, { font: `600 26px ${B}`, color: "rgba(255,255,255,.85)" });
  await drawQR(ctx, W - 80 - 150, 1730, 150, 10);
}

// ---------------------------------------------------------------- collection 2: boarding pass
async function boarding(ctx, d, f) {
  const { pass, cover } = d;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#04213a"); g.addColorStop(1, cover.g[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  try { const pat = await svgImg(patternSvg("routes", { w: W, h: H, u: 80, sw: 2, seed: hash(pass.id) % 997 }).replaceAll("currentColor", "#ffffff")); ctx.globalAlpha = 0.12; ctx.drawImage(pat, 0, 0, W, H); ctx.globalAlpha = 1; } catch { /* plain */ }
  grain(ctx, hash(pass.id) + 7, 7000, 0.04);
  text(ctx, "TGGC AIRWAYS", W / 2, 150, { font: `800 58px ${K}`, align: "center" });
  text(ctx, "ขึ้นเครื่องสู่การเป็น Geo Genius", W / 2, 200, { font: `600 30px ${B}`, color: cover.acc, align: "center" });

  // ticket body
  const tx = 80, ty = 270, tw = W - 160, th = 1360, cut = ty + 960;
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20; ctx.fillStyle = "#fff"; rr(ctx, tx, ty, tw, th, 36); ctx.fill(); ctx.restore();
  // header band in the cover colours
  ctx.save(); rr(ctx, tx, ty, tw, th, 36); ctx.clip();
  const hb = ctx.createLinearGradient(tx, 0, tx + tw, 0); hb.addColorStop(0, cover.g[0]); hb.addColorStop(1, cover.g[2]);
  ctx.fillStyle = hb; ctx.fillRect(tx, ty, tw, 130);
  try { ctx.drawImage(await iconImg("plane", "#fff", 60, 1.8), tx + 40, ty + 34, 60, 60); } catch { /* skip */ }
  text(ctx, "BOARDING PASS", tx + 120, ty + 76, { font: `700 40px ${T}` });
  text(ctx, "บัตรผ่านขึ้นเครื่อง · GEO CLASS", tx + 120, ty + 110, { font: `600 22px ${B}`, color: "rgba(255,255,255,.85)" });
  text(ctx, f.rarity, tx + tw - 40, ty + 80, { font: `700 26px ${T}`, color: "#fff", align: "right" });
  // watermark mascot
  try { const geos = await img(geosSrc()); ctx.globalAlpha = 0.07; ctx.drawImage(geos, tx + tw - 420, ty + 260, 380, 446); ctx.globalAlpha = 1; } catch { /* skip */ }
  ctx.restore();

  // FROM → TO with the plane flying along the arc (its position = progress)
  text(ctx, "FROM", tx + 60, ty + 200, { font: `700 20px ${T}`, color: "#7a93a0" });
  text(ctx, "CPW", tx + 60, ty + 320, { font: `800 128px ${T}`, color: "#0a2b42" });
  text(ctx, "ชลประทานวิทยา", tx + 60, ty + 362, { font: `600 24px ${B}`, color: "#4d7083" });
  text(ctx, "TO", tx + tw - 60, ty + 200, { font: `700 20px ${T}`, color: "#7a93a0", align: "right" });
  text(ctx, "GEO", tx + tw - 60, ty + 320, { font: `800 128px ${T}`, color: f.done ? "#c9971c" : cover.g[1], align: "right" });
  text(ctx, "Geo Genius", tx + tw - 60, ty + 362, { font: `600 24px ${B}`, color: "#4d7083", align: "right" });
  ctx.font = `800 128px ${T}`;
  const ax = tx + 60 + ctx.measureText("CPW").width + 34, bx = tx + tw - 60 - ctx.measureText("GEO").width - 34, ay = ty + 300, lift = 52;
  ctx.save(); ctx.setLineDash([10, 10]); ctx.lineWidth = 4; ctx.strokeStyle = "#bfdce1";
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + bx) / 2, ay - lift * 2, bx, ay); ctx.stroke(); ctx.restore();
  const p = Math.max(0.04, Math.min(1, f.n / f.all)), qx = (t) => (1 - t) ** 2 * ax + 2 * (1 - t) * t * ((ax + bx) / 2) + t * t * bx, qy = (t) => (1 - t) ** 2 * ay + 2 * (1 - t) * t * (ay - lift * 2) + t * t * ay;
  ctx.save(); ctx.lineWidth = 5; ctx.strokeStyle = cover.g[1]; ctx.beginPath(); for (let t = 0; t <= p; t += 0.01) t === 0 ? ctx.moveTo(qx(t), qy(t)) : ctx.lineTo(qx(t), qy(t)); ctx.stroke(); ctx.restore();
  const angle = Math.atan2(qy(p + 0.01) - qy(p), qx(p + 0.01) - qx(p));
  try { const pl = await iconImg("plane", "#0a2b42", 64, 2.2); ctx.save(); ctx.translate(qx(p), qy(p)); ctx.rotate(angle + Math.PI / 2); ctx.drawImage(pl, -32, -32, 64, 64); ctx.restore(); } catch { /* skip */ }
  text(ctx, `${Math.round(p * 100)}%`, (ax + bx) / 2, ay - lift - 40, { font: `700 26px ${T}`, color: cover.g[1], align: "center" });

  // fields
  const field = (label, value, x, y, w, big = false) => {
    text(ctx, label, x, y, { font: `700 19px ${T}`, color: "#7a93a0" });
    ctx.fillStyle = "#0a2b42"; fit(ctx, value, w, 700, big ? 46 : 36, 22, big ? K : B); ctx.fillText(value, x, y + (big ? 54 : 46));
  };
  field("PASSENGER · ผู้โดยสาร", pass.name, tx + 60, ty + 440, tw - 120, true);
  field("SCHOOL · โรงเรียน", pass.school || "—", tx + 60, ty + 560, tw - 120);
  const c4 = (tw - 120) / 4;
  field("FLIGHT", `GEO ${f.serial}`, tx + 60, ty + 670, c4 - 10);
  field("DATE", "28 NOV", tx + 60 + c4, ty + 670, c4 - 10);
  field("BOARDING", f.first ? hhmm(f.first) : "--:--", tx + 60 + c4 * 2, ty + 670, c4 - 10);
  field("SEAT", `${f.n}${"ABCDEF"[hash(pass.id) % 6]}`, tx + 60 + c4 * 3, ty + 670, c4 - 10);
  field("CLASS · ระดับ", f.medal ? f.medal.th : "Economy Explorer", tx + 60, ty + 780, (tw - 120) / 2);
  field("GATE · บูธล่าสุด", f.n ? `${pad(f.got[f.n - 1].b.no)} · ${f.got[f.n - 1].b.en}` : "—", tx + 60 + (tw - 120) / 2, ty + 780, (tw - 120) / 2);

  // perforation with notches
  ctx.save(); ctx.fillStyle = g; // same gradient as the background, so the notches look cut out
  ctx.beginPath(); ctx.arc(tx, cut, 30, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(tx + tw, cut, 30, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.setLineDash([4, 14]); ctx.lineCap = "round"; ctx.lineWidth = 5; ctx.strokeStyle = "#cfdfe4"; ctx.beginPath(); ctx.moveTo(tx + 50, cut); ctx.lineTo(tx + tw - 50, cut); ctx.stroke(); ctx.restore();
  text(ctx, "ฉีกตามรอยปรุ · TEAR HERE", W / 2, cut - 14, { font: `700 14px ${T}`, color: "#a9bcc4", align: "center" });

  // stub: seat map of the 23 booths + barcode + QR
  text(ctx, "SEAT MAP · บูธที่ได้ตรา", tx + 60, cut + 70, { font: `700 19px ${T}`, color: "#7a93a0" });
  const sw = 52, sg = 12;
  d.booths.forEach((b, i) => {
    const x = tx + 60 + (i % 12) * (sw + sg), y = cut + 96 + Math.floor(i / 12) * (sw + sg);
    const on = !!d.stamps[b.id];
    ctx.fillStyle = on ? b.color : "#eef4f6"; rr(ctx, x, y, sw, sw, 12); ctx.fill();
    text(ctx, pad(b.no), x + sw / 2, y + sw / 2 + 1, { font: `700 20px ${T}`, color: on ? "#fff" : "#a9bcc4", align: "center", base: "middle" });
  });
  barcode(ctx, pass.id + f.n, tx + 60, cut + 260, tw - 340, 90, "#0a2b42");
  text(ctx, `${f.serial} ${pad(f.n)}${pad(f.all)} GEO2026`, tx + 60, cut + 380, { font: `600 22px ui-monospace, "Courier New", monospace`, color: "#4d7083" });
  await drawQR(ctx, tx + tw - 230, cut + 214, 170, 8, "#fff");

  text(ctx, "ห้ามพับ · DO NOT BEND · กรุณาสะสมตราให้ครบก่อนประตูปิด", W / 2, 1700, { font: `600 22px ${B}`, color: "rgba(255,255,255,.7)", align: "center" });
  text(ctx, `${EVENT.short} · ${EVENT.dateText} · ${EVENT.venue}`, W / 2, 1760, { font: `600 26px ${B}`, color: "rgba(255,255,255,.88)", align: "center" });
}

// ---------------------------------------------------------------- collection 3: holographic trading card
async function holo(ctx, d, f) {
  const { pass, cover } = d;
  const gold = f.done;
  const g = ctx.createRadialGradient(W / 2, H * 0.4, 100, W / 2, H * 0.5, H * 0.8);
  g.addColorStop(0, gold ? "#3a2a05" : "#1b1240"); g.addColorStop(1, "#05070f");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const R = rng(hash(pass.id));
  for (let i = 0; i < 160; i++) { ctx.fillStyle = `rgba(255,255,255,${0.2 + R() * 0.6})`; const s = R() * 2.4; ctx.fillRect(R() * W, R() * H, s, s); }
  // the card
  const cx = 90, cy = 180, cw = W - 180, ch = 1360;
  ctx.save(); ctx.shadowColor = gold ? "rgba(255,209,102,.55)" : "rgba(150,120,255,.55)"; ctx.shadowBlur = 80; ctx.fillStyle = "#fff"; rr(ctx, cx, cy, cw, ch, 44); ctx.fill(); ctx.restore();
  foil(ctx, cx, cy, cw, ch, 44, 1, gold);
  // inner panel
  const ix = cx + 34, iy = cy + 34, iw = cw - 68, ih = ch - 68;
  ctx.fillStyle = "#0b1b33"; rr(ctx, ix, iy, iw, ih, 28); ctx.fill();
  // header row: rarity + stamps
  text(ctx, f.rarity, ix + 34, iy + 62, { font: `800 34px ${T}`, color: f.rarityColor });
  for (let i = 0; i < 5; i++) text(ctx, "★", ix + 34 + i * 34, iy + 104, { font: `700 30px ${B}`, color: i < f.stars ? f.rarityColor : "rgba(255,255,255,.2)" });
  text(ctx, "STAMPS", ix + iw - 34, iy + 52, { font: `700 20px ${T}`, color: "rgba(255,255,255,.6)", align: "right" });
  text(ctx, `${f.n}/${f.all}`, ix + iw - 34, iy + 106, { font: `800 56px ${T}`, color: "#fff", align: "right" });
  // art window
  const ax = ix + 34, ay = iy + 140, aw = iw - 68, ah = 640;
  ctx.save(); rr(ctx, ax, ay, aw, ah, 22); ctx.clip();
  const ag = ctx.createLinearGradient(ax, ay, ax + aw, ay + ah); ag.addColorStop(0, cover.g[0]); ag.addColorStop(1, cover.g[2]);
  ctx.fillStyle = ag; ctx.fillRect(ax, ay, aw, ah);
  try { const pat = await svgImg(patternSvg(cover.pat, { w: aw, h: ah, u: 44, sw: 1.8, seed: hash(pass.id) % 997 }).replaceAll("currentColor", "#ffffff")); ctx.globalAlpha = 0.2; ctx.drawImage(pat, ax, ay, aw, ah); ctx.globalAlpha = 1; } catch { /* plain */ }
  const sun = ctx.createRadialGradient(ax + aw / 2, ay + ah * 0.55, 10, ax + aw / 2, ay + ah * 0.55, aw * 0.5);
  sun.addColorStop(0, "rgba(255,255,255,.55)"); sun.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = sun; ctx.fillRect(ax, ay, aw, ah);
  try { const geos = await img(geosSrc()); const gh = ah * 0.9, gw2 = (gh * geos.naturalWidth) / geos.naturalHeight; ctx.drawImage(geos, ax + (aw - gw2) / 2, ay + ah - gh - 6, gw2, gh); } catch { /* skip */ }
  foil(ctx, ax, ay, aw, ah, 0, 0.18, gold); // holo sheen over the art
  ctx.restore();
  ctx.save(); ctx.lineWidth = 6; ctx.strokeStyle = gold ? "#f2cf6b" : "rgba(255,255,255,.75)"; rr(ctx, ax, ay, aw, ah, 22); ctx.stroke(); ctx.restore();
  // medal "type" badge over the art corner
  if (f.medal) { try { ctx.drawImage(await svgImg(medalSVG(f.medal, { size: 130 })), ax + aw - 150, ay + 18, 130, 156); } catch { /* skip */ } }
  // name plate
  ctx.fillStyle = "#fff"; fit(ctx, pass.name, iw - 68, 800, 62, 34, K); ctx.fillText(pass.name, ix + 34, ay + ah + 82);
  text(ctx, pass.school || "นักสำรวจอิสระ", ix + 34, ay + ah + 126, { font: `600 28px ${B}`, color: "rgba(255,255,255,.75)" });
  // ability
  const by = ay + ah + 160;
  ctx.fillStyle = "rgba(255,255,255,.08)"; rr(ctx, ix + 34, by, iw - 68, 116, 20); ctx.fill();
  text(ctx, "ABILITY", ix + 60, by + 40, { font: `700 20px ${T}`, color: f.rarityColor });
  text(ctx, f.medal ? `${f.medal.th} — ${f.medal.en}` : "นักสำรวจหน้าใหม่ — ROOKIE", ix + 60, by + 86, { font: `700 34px ${K}`, color: "#fff" });
  // stat bars
  const stats = [
    ["ความเพียร · GRIT", f.n / f.all],
    ["การสำรวจ · ZONES", f.zones / Math.max(1, f.zonesAll)],
    ["ความเร็ว · SPEED", f.mins ? Math.min(1, (f.n / (f.mins / 60)) / 20) : 0],
  ];
  stats.forEach(([lab, v], i) => {
    const y = by + 170 + i * 62;
    text(ctx, lab, ix + 34, y, { font: `700 22px ${T}`, color: "rgba(255,255,255,.75)" });
    ctx.fillStyle = "rgba(255,255,255,.12)"; rr(ctx, ix + 330, y - 22, iw - 400, 24, 12); ctx.fill();
    const bg2 = ctx.createLinearGradient(ix + 330, 0, ix + iw - 70, 0); bg2.addColorStop(0, "#7ff5cc"); bg2.addColorStop(1, gold ? "#ffd166" : "#8fdcff");
    ctx.fillStyle = bg2; rr(ctx, ix + 330, y - 22, Math.max(24, (iw - 400) * v), 24, 12); ctx.fill();
  });
  // card number + copyright, tiny
  text(ctx, `No. ${f.serial} / 2026`, ix + 34, iy + ih - 26, { font: `700 20px ${T}`, color: "rgba(255,255,255,.55)" });
  text(ctx, "© TGGC 2026 · GEO COLLECTION · SERIES 1", ix + iw - 34, iy + ih - 26, { font: `700 18px ${T}`, color: "rgba(255,255,255,.45)", align: "right" });
  // sparkles
  for (let i = 0; i < 9; i++) {
    const x = cx + R() * cw, y = cy + R() * ch, s = 10 + R() * 18;
    ctx.save(); ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y); ctx.quadraticCurveTo(x, y, x, y + s); ctx.quadraticCurveTo(x, y, x - s, y); ctx.quadraticCurveTo(x, y, x, y - s); ctx.fill(); ctx.restore();
  }
  text(ctx, gold ? "LEGENDARY GOLD EDITION" : "GEO COLLECTION · HOLO CARD", W / 2, 1620, { font: `700 30px ${T}`, color: gold ? "#ffd166" : "#c9b8ff", align: "center" });
  text(ctx, `${EVENT.short} · ${EVENT.dateText}`, W / 2, 1666, { font: `600 26px ${B}`, color: "rgba(255,255,255,.8)", align: "center" });
  await drawQR(ctx, W / 2 - 80, 1700, 160, 10);
}

// ---------------------------------------------------------------- collection 4: star route (the walk as a constellation)
async function stars(ctx, d, f) {
  const { pass } = d;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#020716"); g.addColorStop(0.55, "#0a1d3f"); g.addColorStop(1, "#103a5c");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const R = rng(hash(pass.id) + 3);
  // milky way band
  ctx.save(); ctx.translate(W / 2, H * 0.42); ctx.rotate(-0.5);
  const mw = ctx.createLinearGradient(0, -260, 0, 260); mw.addColorStop(0, "rgba(140,170,255,0)"); mw.addColorStop(0.5, "rgba(170,200,255,.13)"); mw.addColorStop(1, "rgba(140,170,255,0)");
  ctx.fillStyle = mw; ctx.fillRect(-W, -260, W * 2, 520); ctx.restore();
  for (let i = 0; i < 420; i++) { const s = R() < 0.92 ? 1.3 : 2.6; ctx.fillStyle = `rgba(255,255,255,${0.15 + R() * 0.7})`; ctx.fillRect(R() * W, R() * H, s, s); }

  text(ctx, "MY STAR ROUTE", W / 2, 150, { font: `700 34px ${T}`, color: "#9fd8ff", align: "center" });
  ctx.fillStyle = "#fff"; fit(ctx, `กลุ่มดาว${f.given}`, W - 160, 800, 84, 44, K); ctx.textAlign = "center"; ctx.fillText(`กลุ่มดาว${f.given}`, W / 2, 252); ctx.textAlign = "left";
  text(ctx, "เส้นทางที่ฉันเดินสะสมตรา เรียงตามเวลาจริง", W / 2, 304, { font: `600 30px ${B}`, color: "rgba(255,255,255,.8)", align: "center" });

  // map the booth plan (1000×790) into the sky area, keeping proportions
  const xs = Object.values(BOOTH_XY).map((p) => p[0]), ys = Object.values(BOOTH_XY).map((p) => p[1]);
  const minX = Math.min(...xs) - 40, maxX = Math.max(...xs) + 40, minY = Math.min(...ys) - 60, maxY = Math.max(...ys) + 60;
  const box = { x: 80, y: 380, w: W - 160, h: 900 };
  const s = Math.min(box.w / (maxX - minX), box.h / (maxY - minY));
  const ox = box.x + (box.w - (maxX - minX) * s) / 2, oy = box.y + (box.h - (maxY - minY) * s) / 2;
  const P = (no) => { const [x, y] = BOOTH_XY[no] || [0, 0]; return [ox + (x - minX) * s, oy + (y - minY) * s]; };
  // ghost of the real site plan: walkway and the hall
  ctx.save(); ctx.strokeStyle = "rgba(159,216,255,.13)"; ctx.lineWidth = 18; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(ox + (168 - minX) * s, oy + (40 - minY) * s); ctx.lineTo(ox + (168 - minX) * s, oy + (512 - minY) * s); ctx.lineTo(ox + (850 - minX) * s, oy + (512 - minY) * s); ctx.stroke();
  ctx.lineWidth = 2; ctx.setLineDash([8, 10]); ctx.strokeRect(ox + (246 - minX) * s, oy + (58 - minY) * s, (656 - 246) * s, (492 - 58) * s);
  ctx.restore();
  text(ctx, "หอประชุม", ox + (451 - minX) * s, oy + (120 - minY) * s, { font: `600 24px ${B}`, color: "rgba(159,216,255,.35)", align: "center" });
  text(ctx, "ท้องฟ้าจำลอง", P(23)[0], P(23)[1] + 64, { font: `600 22px ${B}`, color: "rgba(159,216,255,.45)", align: "center" });
  // unvisited booths: faint dots
  d.booths.forEach((b) => { if (d.stamps[b.id]) return; const [x, y] = P(b.no); ctx.fillStyle = "rgba(255,255,255,.22)"; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); });
  // the route: glowing lines in visit order
  if (f.n > 1) {
    ctx.save(); ctx.lineJoin = "round"; ctx.lineCap = "round";
    for (const [w, a] of [[16, 0.08], [8, 0.18], [3, 0.9]]) {
      ctx.lineWidth = w; ctx.strokeStyle = `rgba(150,225,255,${a})`; ctx.beginPath();
      f.got.forEach((gg, i) => { const [x, y] = P(gg.b.no); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    }
    ctx.restore();
  }
  // stars (bigger = earlier? no: bigger = later, the route "grows")
  f.got.forEach((gg, i) => {
    const [x, y] = P(gg.b.no), r = 7 + (i / Math.max(1, f.n - 1)) * 7;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4); glow.addColorStop(0, "rgba(255,255,255,.9)"); glow.addColorStop(0.3, "rgba(160,220,255,.35)"); glow.addColorStop(1, "rgba(160,220,255,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(x, y - r * 1.8); ctx.quadraticCurveTo(x, y, x + r * 1.8, y); ctx.quadraticCurveTo(x, y, x, y + r * 1.8); ctx.quadraticCurveTo(x, y, x - r * 1.8, y); ctx.quadraticCurveTo(x, y, x, y - r * 1.8); ctx.fill();
  });
  if (f.n) {
    const [fx, fy] = P(f.got[0].b.no), [lx, ly] = P(f.got[f.n - 1].b.no);
    const tag = (s2, x, y, col) => { ctx.font = `700 22px ${T}`; const w2 = ctx.measureText(s2).width + 24; ctx.fillStyle = col; rr(ctx, x - w2 / 2, y - 20, w2, 36, 18); ctx.fill(); text(ctx, s2, x, y + 6, { font: `700 22px ${T}`, color: "#04213a", align: "center" }); };
    tag(`START ${hhmm(f.first)}`, fx + (fx > W / 2 ? -110 : 110), fy - 30, "#7ff5cc");
    if (f.n > 1) tag(`${f.done ? "FINISH" : "NOW"} ${hhmm(f.last)}`, lx + (lx > W / 2 ? -40 : 120), ly - 54, "#ffd166");
  }

  // stats
  const sy = 1320;
  const statBox = (label, value, x) => {
    ctx.fillStyle = "rgba(255,255,255,.07)"; rr(ctx, x, sy, 290, 140, 24); ctx.fill();
    text(ctx, label, x + 145, sy + 46, { font: `700 20px ${T}`, color: "#9fd8ff", align: "center" });
    ctx.fillStyle = "#fff"; fit(ctx, value, 260, 800, 46, 26, K); ctx.textAlign = "center"; ctx.fillText(value, x + 145, sy + 108); ctx.textAlign = "left";
  };
  statBox("ดวงดาว · STARS", `${f.n}/${f.all}`, 80);
  statBox("เวลาเดิน · TIME", f.mins ? (f.mins >= 60 ? `${Math.floor(f.mins / 60)} ชม. ${f.mins % 60} น.` : `${f.mins} นาที`) : "—", 395);
  statBox("โซน · ZONES", `${f.zones}/${f.zonesAll}`, 710);
  // achievements
  const ay = 1500;
  if (f.ach.length) {
    text(ctx, "ACHIEVEMENTS · ความสำเร็จพิเศษ", 80, ay, { font: `700 22px ${T}`, color: "#9fd8ff" });
    let x = 80;
    for (const [ic, en, th] of f.ach) {
      ctx.font = `700 26px ${K}`; const w1 = ctx.measureText(en).width; ctx.font = `600 20px ${B}`; const w2 = ctx.measureText(th).width;
      const w = Math.max(w1, w2) + 92;
      if (x + w > W - 80) break;
      ctx.fillStyle = "rgba(255,209,102,.14)"; rr(ctx, x, ay + 20, w, 92, 22); ctx.fill();
      ctx.strokeStyle = "rgba(255,209,102,.5)"; ctx.lineWidth = 2; rr(ctx, x, ay + 20, w, 92, 22); ctx.stroke();
      try { ctx.drawImage(await iconImg(ic, "#ffd166", 40, 2.2), x + 20, ay + 46, 40, 40); } catch { /* skip */ }
      text(ctx, en, x + 72, ay + 60, { font: `700 26px ${K}`, color: "#ffd166" });
      text(ctx, th, x + 72, ay + 94, { font: `600 20px ${B}`, color: "rgba(255,255,255,.8)" });
      x += w + 16;
    }
  }
  text(ctx, `${EVENT.short} · ${EVENT.dateText}`, 80, 1740, { font: `700 30px ${K}` });
  text(ctx, "13.9°N 100.5°E · ท้องฟ้าเหนือชลประทานวิทยา", 80, 1784, { font: `600 22px ${B}`, color: "rgba(255,255,255,.6)" });
  await drawQR(ctx, W - 80 - 160, 1660, 160, 10);
}

const DRAW = { passport, boarding, holo, stars };

/** → Blob (JPEG) of one collection's picture */
export async function shareCard(kind, d) {
  const fonts = [`800 80px Kanit`, `700 40px Kanit`, `600 34px "IBM Plex Sans Thai"`, `700 30px "Chakra Petch"`];
  await Promise.race([Promise.all(fonts.map((x) => document.fonts.load(x).catch(() => {}))), new Promise((r) => setTimeout(r, 2500))]);
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  await (DRAW[kind] || passport)(ctx, d, facts(d));
  return new Promise((res) => c.toBlob((b) => res(b), "image/jpeg", 0.92));
}
export const unlocked = (col, n) => n >= col.need;
