// "Save my passport" picture (1080×1920, story size) drawn on a canvas right on the phone — no server, works offline.
// Graphics are plain SVG images (no foreignObject, so iPhone Safari can export the canvas); text uses the page's fonts.
// Shows the holder's name and school only (never the passport id or phone number).
import { EVENT } from "../../shared/event.js";
import { iconPath } from "../../shared/web/icons.js";
import { patternSvg } from "../../shared/web/patterns.js";
import { qrSvg } from "../../shared/web/qr.js";
import { medalFor, medalSVG } from "./badges.js";

const W = 1080, H = 1920;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

function img(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}
const svgImg = (svg) => img("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.includes("xmlns=") ? svg : svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ')));

// a stamp as a self-contained SVG (ring + booth name on the rim + icon + number), slightly rotated like a real one
function stampSvg(b, got, seed) {
  const no = String(b.no).padStart(2, "0");
  if (!got) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <circle cx="100" cy="100" r="84" fill="none" stroke="#bfdce1" stroke-width="5" stroke-dasharray="10 9"/>
      <text x="100" y="116" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="44" fill="#bfdce1">${no}</text></svg>`;
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

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
// largest font size (≤ max) at which `text` fits in `maxW`
function fit(ctx, text, maxW, weight, max, min, family) {
  let s = max;
  for (; s > min; s -= 2) { ctx.font = `${weight} ${s}px ${family}`; if (ctx.measureText(text).width <= maxW) break; }
  ctx.font = `${weight} ${s}px ${family}`;
  return s;
}

/** → Blob (JPEG) of the share card */
export async function shareCard({ pass, stamps, booths, cover, total }) {
  const fonts = [`800 80px Kanit`, `700 40px Kanit`, `600 34px "IBM Plex Sans Thai"`, `700 30px "Chakra Petch"`];
  await Promise.race([Promise.all(fonts.map((f) => document.fonts.load(f).catch(() => {}))), new Promise((r) => setTimeout(r, 2500))]);

  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  const n = booths.filter((b) => stamps[b.id]).length, all = booths.length, done = n >= total;
  const K = `Kanit, "IBM Plex Sans Thai", sans-serif`, B = `"IBM Plex Sans Thai", Kanit, sans-serif`, T = `"Chakra Petch", Kanit, sans-serif`;

  // background: the passport's own cover colours + pattern
  const g = ctx.createLinearGradient(0, 0, W * 0.6, H);
  g.addColorStop(0, cover.g[0]); g.addColorStop(0.45, cover.g[1]); g.addColorStop(1, cover.g[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  try {
    const pat = await svgImg(patternSvg(cover.pat, { w: W, h: H, u: 64, sw: 2.2, seed: hash(pass.id) % 9973 }).replaceAll("currentColor", "#ffffff"));
    ctx.globalAlpha = 0.15; ctx.drawImage(pat, 0, 0, W, H); ctx.globalAlpha = 1;
  } catch { /* plain background */ }

  // logo
  try {
    const logo = await img(document.querySelector(".brand img")?.src || "assets/logo-full.webp");
    const lw = 270, lh = (lw * logo.naturalHeight) / logo.naturalWidth;
    ctx.fillStyle = "#fff"; roundRect(ctx, (W - lw) / 2 - 22, 70, lw + 44, lh + 30, 30); ctx.fill();
    ctx.drawImage(logo, (W - lw) / 2, 85, lw, lh);
  } catch { /* no logo */ }

  // title + holder
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = cover.acc; ctx.font = `700 30px ${T}`;
  ctx.fillText("GEO PASSPORT · สมุดสะสมตรา TGGC 2026", W / 2, 352);
  ctx.fillStyle = "#fff"; fit(ctx, pass.name, W - 140, 800, 78, 44, K);
  ctx.fillText(pass.name, W / 2, 448);
  if (pass.school) { ctx.fillStyle = "rgba(255,255,255,.85)"; fit(ctx, pass.school, W - 160, 600, 34, 24, B); ctx.fillText(pass.school, W / 2, 500); }

  // medal + count
  const m = medalFor(n, all);
  const boxY = 540, boxH = 190;
  ctx.fillStyle = "rgba(0,0,0,.22)"; roundRect(ctx, 70, boxY, W - 140, boxH, 36); ctx.fill();
  if (m) { try { ctx.drawImage(await svgImg(medalSVG(m, { size: 140 })), 100, boxY + 12, 140, 168); } catch { /* skip */ } }
  ctx.textAlign = "left";
  const tx = m ? 268 : 110;
  ctx.fillStyle = cover.acc; ctx.font = `700 28px ${T}`;
  ctx.fillText(m ? m.en : "STAMP RALLY", tx, boxY + 58);
  ctx.fillStyle = "#fff"; fit(ctx, m ? `ระดับ ${m.th}` : "เริ่มสะสมตราแล้ว!", W - tx - 110, 700, 50, 32, K);
  ctx.fillText(m ? `ระดับ ${m.th}` : "เริ่มสะสมตราแล้ว!", tx, boxY + 116);
  ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.font = `600 32px ${B}`;
  ctx.fillText(done ? `สะสมครบ ${n}/${all} บูธ!` : `สะสมแล้ว ${n}/${all} บูธ`, tx, boxY + 162);

  // stamp page
  const px = 60, py = 770, pw = W - 120, ph = 860;
  ctx.fillStyle = "#fbfdf9"; roundRect(ctx, px, py, pw, ph, 40); ctx.fill();
  ctx.strokeStyle = "rgba(7,95,152,.06)"; ctx.lineWidth = 2;
  for (let x = px + 40; x < px + pw; x += 40) { ctx.beginPath(); ctx.moveTo(x, py + 20); ctx.lineTo(x, py + ph - 20); ctx.stroke(); }
  for (let y = py + 40; y < py + ph; y += 40) { ctx.beginPath(); ctx.moveTo(px + 20, y); ctx.lineTo(px + pw - 20, y); ctx.stroke(); }
  const cols = 5, cell = (pw - 50) / cols, sz = cell * 0.9, rows = Math.ceil(all / cols), rh = (ph - 50) / rows;
  const imgs = await Promise.all(booths.map((b) => svgImg(stampSvg(b, !!stamps[b.id], pass.id)).catch(() => null)));
  imgs.forEach((im, i) => {
    if (!im) return;
    const x = px + 25 + (i % cols) * cell + (cell - sz) / 2, y = py + 25 + Math.floor(i / cols) * rh + (rh - sz) / 2;
    ctx.globalAlpha = stamps[booths[i].id] ? 0.94 : 1; ctx.drawImage(im, x, y, sz, sz); ctx.globalAlpha = 1;
  });

  // footer: event + QR to the site (invites friends)
  const fy = 1670;
  ctx.fillStyle = "#fff"; ctx.font = `700 40px ${K}`;
  ctx.fillText(done ? "ครบทุกบูธแล้ว!" : "มาสะสมตราด้วยกัน!", 70, fy + 52);
  ctx.fillStyle = "rgba(255,255,255,.88)"; ctx.font = `600 28px ${B}`;
  ctx.fillText(`TGGC 2026 · ${EVENT.dateText}`, 70, fy + 100);
  ctx.fillText(`${EVENT.venue} ${EVENT.venueSub}`, 70, fy + 140);
  try {
    const q = await svgImg(await qrSvg(EVENT.participantUrl, { ecc: "M", margin: 2, color: "#021b2e" }));
    ctx.fillStyle = "#fff"; roundRect(ctx, W - 70 - 190, fy - 4, 190, 190, 22); ctx.fill();
    ctx.drawImage(q, W - 70 - 180, fy + 6, 170, 170);
  } catch { /* no QR */ }

  return new Promise((res) => c.toBlob((b) => res(b), "image/jpeg", 0.92));
}
