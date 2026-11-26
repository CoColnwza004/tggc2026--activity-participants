// Booth QR posters for staff: one A4 poster per booth, each with its own background pattern.
// The QR opens the staff site straight on that booth's screen (<staffUrl>#/s/<id>): staff log in once with
// the PIN, then the screen shows the rotating stamp QR for participants. The poster QR itself gives no stamp,
// so a photo of it shared around is useless to participants.
//   poster/booths/booth-01.pdf … booth-23.pdf   A4, flattened 300 dpi (prints the same everywhere)
//   poster/booths/booth-posters-all.pdf         all 23 pages in one file (for the print shop)
//   poster/booths/preview.png                   contact sheet
// Names and logos come from the live site (admin edits), falling back to shared/event.js.
// Usage: node scripts/make-booth-posters.mjs [booth no …]
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { EVENT } from "../shared/event.js";
import { stampHTML } from "../participant/src/stamps.js";
import { icon } from "../shared/web/icons.js";
import { qrSvg } from "../shared/web/qr.js";
import { applyBooths } from "../shared/web/booths.js";
import { patternSvg, boothPattern, PATTERNS } from "../shared/web/patterns.js";

let pw;
try { pw = await import("playwright"); }
catch { pw = await import(process.env.PLAYWRIGHT_PATH || "playwright"); }
const chromium = pw.chromium || pw.default.chromium;

const root = fileURLToPath(new URL("../", import.meta.url));
const out = root + "poster/booths/";
mkdirSync(out, { recursive: true });
const only = process.argv.slice(2).map(Number).filter(Boolean);

// live booth names/logos (curl: goes through the proxy when there is one)
const curl = (url, bin = false) => execFileSync("curl", ["-sfL", "--max-time", "20", url], { encoding: bin ? "buffer" : "utf8", maxBuffer: 8e6 });
const logos = {};
try {
  const cfg = JSON.parse(curl(EVENT.participantUrl + "api/booths"));
  applyBooths(cfg);
  for (const b of EVENT.booths) if (b.logo) {
    const buf = curl(`${EVENT.participantUrl}api/logo/${b.id}?v=${b.logo}`, true);
    const mime = buf[0] === 0x89 ? "image/png" : buf[0] === 0xff ? "image/jpeg" : "image/webp";
    logos[b.id] = `data:${mime};base64,${buf.toString("base64")}`;
  }
  console.log(`booth details: live (${Object.keys(cfg.booths || {}).length} edited, ${Object.keys(logos).length} logos)`);
} catch { console.log("booth details: shared/event.js (live site not reachable)"); }

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const dataUri = (f) => `data:image/webp;base64,${readFileSync(root + f).toString("base64")}`;
const pad = (n) => String(n).padStart(2, "0");

const css = `
:root{--night:#021b2e;--mint:#2cc394;--gold:#ffd166;--ink:#0a2b42;--paper:#fbfdf9;
 --f-display:Kanit,sans-serif;--f-body:"IBM Plex Sans Thai",sans-serif;--f-tech:"Chakra Petch",Kanit,monospace}
*{box-sizing:border-box}html,body{margin:0}
body{font-family:var(--f-body);color:#fff;-webkit-font-smoothing:antialiased}
.poster{position:relative;width:1240px;height:1754px;overflow:hidden;padding:60px 70px 54px;display:flex;flex-direction:column;
 background:radial-gradient(110% 70% at 50% 46%,color-mix(in srgb,var(--c) 78%,#021b2e) 0%,color-mix(in srgb,var(--c) 42%,#021b2e) 55%,#021b2e 100%)}
.pat{position:absolute;inset:0;width:100%;height:100%;color:rgba(255,255,255,.2)}
.poster>*:not(.pat){position:relative}
.top{display:flex;align-items:center;justify-content:space-between}
.logo{height:112px;background:#fff;border-radius:24px;padding:10px 16px}
.staff{display:grid;justify-items:end;gap:6px}
.staff b{display:inline-flex;align-items:center;gap:12px;padding:12px 24px;border-radius:999px;background:var(--gold);color:#2b1d00;font-family:var(--f-tech);font-weight:700;font-size:26px;letter-spacing:.16em}
.staff b .ico{width:30px;height:30px}
.staff span{font-family:var(--f-display);font-weight:500;font-size:24px;color:rgba(255,255,255,.88)}
.head{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:34px;margin-top:40px}
.no{display:grid;justify-items:center;line-height:1;font-family:var(--f-tech);font-weight:700}
.no small{font-size:30px;letter-spacing:.34em;margin-right:-.34em;opacity:.9}
.no b{font-size:208px;letter-spacing:-.02em;margin-top:-6px;text-shadow:0 10px 40px rgba(0,0,0,.35)}
.nm{min-width:0}
.nm h1{margin:0;font-family:var(--f-display);font-weight:700;line-height:1.14;text-wrap:balance;text-shadow:0 4px 24px rgba(0,0,0,.35)}
.nm .en{display:block;margin-top:12px;font-family:var(--f-tech);font-weight:700;font-size:27px;letter-spacing:.16em;color:#9ff3d4}
.nm .pl{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:22px;color:rgba(255,255,255,.85);line-height:1.35}
.nm .pl .ico{width:26px;height:26px;flex:none;color:var(--gold)}
.mid{flex:1;display:grid;place-items:center}
.card{position:relative;display:grid;justify-items:center;width:700px;padding:34px 34px 26px;border-radius:44px;background:#fff;color:var(--ink);
 box-shadow:0 0 0 12px rgba(255,255,255,.22),0 50px 90px -30px rgba(0,0,0,.65)}
.badge{position:absolute;top:-38px;left:50%;transform:translateX(-50%);width:110px;height:110px;border-radius:50%;background:#fff;display:grid;place-items:center;
 box-shadow:0 0 0 8px var(--c),0 12px 30px rgba(0,0,0,.3);overflow:hidden;color:var(--c)}
.badge img{width:84%;height:84%;object-fit:contain}.badge .ico{width:56px;height:56px}
.qr{width:560px;height:560px;margin-top:56px}.qr svg{display:block;width:100%;height:100%}
.card h2{margin:18px 0 0;font-family:var(--f-display);font-weight:800;font-size:46px;line-height:1.1;color:#021b2e;text-align:center}
.card p{margin:8px 0 0;font-size:22px;color:#4d7083;text-align:center}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:4px}
.step{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:start;padding:20px 18px;border-radius:26px;background:rgba(2,27,46,.55);border:2px solid rgba(255,255,255,.2)}
.step i{display:grid;place-items:center;width:48px;height:48px;border-radius:50%;background:var(--gold);color:#2b1d00;font-style:normal;font-family:var(--f-tech);font-weight:700;font-size:26px}
.step b{display:block;font-family:var(--f-display);font-weight:700;font-size:25px;line-height:1.2}
.step span{display:block;margin-top:4px;font-size:18px;line-height:1.4;color:rgba(255,255,255,.86)}
.note{display:grid;grid-template-columns:1fr auto;gap:22px;align-items:center;margin-top:20px;padding:18px 22px 18px 28px;border-radius:28px;background:var(--paper);color:var(--ink)}
.note small em{font-style:normal;font-family:var(--f-body);letter-spacing:0}
.note small{display:block;font-family:var(--f-tech);font-weight:700;letter-spacing:.18em;font-size:16px;color:var(--c2)}
.note b{display:block;margin-top:2px;font-family:var(--f-display);font-weight:700;font-size:30px;line-height:1.2}
.note span{display:block;margin-top:4px;font-size:19px;line-height:1.4;color:#4d7083}
.note .seal{width:128px;height:128px;display:grid;place-items:center}
.foot{display:flex;justify-content:space-between;gap:20px;margin-top:16px;font-size:16px;color:rgba(255,255,255,.75)}
.foot b{font-family:var(--f-tech);letter-spacing:.12em}
/* stamps (same artwork as the site) */
.stamp{position:relative;width:100%;aspect-ratio:1;color:var(--ink);transform:rotate(var(--rot,0deg));
 -webkit-mask:url(assets/ink-grunge.webp) var(--mx,0) var(--my,0)/150% auto;mask:url(assets/ink-grunge.webp) var(--mx,0) var(--my,0)/150% auto;mix-blend-mode:multiply;opacity:.92}
.stamp svg{position:absolute;inset:0;width:100%;height:100%;color:var(--ink)}
.stamp text{font-family:var(--f-tech);font-weight:700;letter-spacing:.1em}
.stamp .st-bot{font-size:12px;letter-spacing:.16em}
.stamp .st-face{position:absolute;left:20.5%;top:20.5%;width:59%;height:59%;border-radius:50%;background:var(--ink);-webkit-mask:url(assets/geos-ink.webp) center/cover;mask:url(assets/geos-ink.webp) center/cover}
.stamp .st-seal{position:absolute;left:40.5%;top:66%;width:19%;height:19%;border-radius:50%;display:grid;place-items:center;background:var(--ink);box-shadow:0 0 0 2px var(--paper),0 0 0 3.5px var(--ink);color:var(--ink)}
.stamp .st-seal svg{position:static;width:62%;height:62%;color:#fff}
`;

async function page(b) {
  const kind = boothPattern(b.no);
  const url = `${EVENT.staffUrl}#/s/${b.id}`;
  const qr = await qrSvg(url, { ecc: "Q", margin: 2, color: "#021b2e" });
  const nameSize = b.th.length > 34 ? 50 : b.th.length > 22 ? 58 : 68;
  const pat = PATTERNS[kind];
  return `<div class="poster" style="--c:${b.color};--c2:color-mix(in srgb,${b.color} 75%,#021b2e)">
  ${patternSvg(kind, { w: 1240, h: 1754, u: 64, sw: 2.2, seed: b.no })}
  <header class="top"><img class="logo" src="assets-src/logo-full.png" alt="">
    <div class="staff"><b>${icon("user")}STAFF ONLY</b><span>สำหรับเจ้าหน้าที่ประจำบูธ</span></div></header>
  <div class="head"><div class="no"><small>BOOTH</small><b>${pad(b.no)}</b></div>
    <div class="nm"><h1 style="font-size:${nameSize}px">${esc(b.th)}</h1><span class="en">${esc(b.en)}</span>
      <span class="pl" style="font-size:${b.place.length > 48 ? 19 : 22}px">${icon("pin")}${esc(b.place)}</span></div></div>
  <div class="mid"><div class="card">
    <span class="badge">${logos[b.id] ? `<img src="${logos[b.id]}" alt="">` : icon(b.icon)}</span>
    <div class="qr">${qr}</div>
    <h2>สแกนเพื่อเปิดจอบูธ ${pad(b.no)}</h2>
    <p>ใช้มือถือหรือแท็บเล็ตประจำบูธ · ใส่ PIN เจ้าหน้าที่</p></div></div>
  <div class="steps">
    <div class="step"><i>1</i><div><b>สแกน QR นี้</b><span>ด้วยกล้องมือถือ/แท็บเล็ตที่จะตั้งไว้ที่บูธ</span></div></div>
    <div class="step"><i>2</i><div><b>ใส่ชื่อ + PIN</b><span>ครั้งแรกครั้งเดียว ใช้ได้ทั้งวันงาน</span></div></div>
    <div class="step"><i>3</i><div><b>ตั้งจอให้สแกน</b><span>จอขึ้น QR รับตรา เปลี่ยนทุก 30 วินาที กด "เต็มจอ"</span></div></div>
  </div>
  <div class="note"><div><small>FOR PARTICIPANTS <em>· ผู้เข้าร่วม</em></small><b>รับตรา: สแกน QR บนจอของเจ้าหน้าที่</b>
    <span>QR บนโปสเตอร์นี้ใช้เปิดระบบเท่านั้น สแกนแล้วไม่ได้ตรา · ตราที่จะได้รับจากบูธนี้ →</span></div>
    <div class="seal">${stampHTML(b, "poster")}</div></div>
  <div class="foot"><span>ลายประจำบูธ: ${pat.th} · <b>${pat.en}</b></span><span>${esc(EVENT.short)} · ${esc(EVENT.dateText)}</span></div>
</div>`;
}

const doc = (inner) => `<!doctype html><html lang="th"><head><meta charset="utf-8"><base href="${pathToFileURL(root).href}">
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@500;700;800&family=Chakra+Petch:wght@700&family=IBM+Plex+Sans+Thai:wght@400;600&display=swap" rel="stylesheet">
<style>${css.replaceAll("url(assets/ink-grunge.webp)", `url(${dataUri("assets/ink-grunge.webp")})`).replaceAll("url(assets/geos-ink.webp)", `url(${dataUri("assets/geos-ink.webp")})`)}</style></head><body>${inner}</body></html>`;

const tmp = out + "_tmp.html";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1240, height: 1754 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
const p = await ctx.newPage();
const pngs = [];
const booths = EVENT.booths.filter((b) => !only.length || only.includes(b.no));
for (const b of booths) {
  writeFileSync(tmp, doc(await page(b)));
  await p.goto(pathToFileURL(tmp).href, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  // nothing may spill out of the page or overlap the next block
  const bad = await p.evaluate(() => {
    const P = document.querySelector(".poster").getBoundingClientRect();
    const out = [...document.querySelectorAll(".poster > :not(.pat) *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.bottom > P.bottom - 20 || r.right > P.right - 20 || r.left < P.left + 20); }).map((e) => e.className.baseVal ?? e.className);
    const h1 = document.querySelector(".nm h1"), lines = Math.round(h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight));
    return { out: out.slice(0, 4), lines };
  });
  const png = out + `_booth-${pad(b.no)}.png`;
  await p.screenshot({ path: png });
  pngs.push(png);
  execFileSync("python3", [root + "scripts/flat-pdf.py", png, out + `booth-${pad(b.no)}.pdf`, "210", "297", "88"], { stdio: "pipe" });
  console.log(`booth ${pad(b.no)} ${boothPattern(b.no).padEnd(13)} name lines: ${bad.lines}${bad.out.length ? "  OVERFLOW: " + bad.out.join(", ") : ""}`);
}
await browser.close();
rmSync(tmp);

if (!only.length) {
  execFileSync("python3", [root + "scripts/flat-pdf.py", pngs.join(","), out + "booth-posters-all.pdf", "210", "297", "88"], { stdio: "inherit" });
  // contact sheet: 6 × 4 thumbnails
  execFileSync("python3", ["-c", `
import sys
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
fs = sys.argv[2:]
tw, th, g = 400, 566, 16
sheet = Image.new("RGB", (6 * tw + 7 * g, 4 * th + 5 * g), "#0b1d2b")
for i, f in enumerate(fs):
    im = Image.open(f).convert("RGB").resize((tw, th), Image.LANCZOS)
    sheet.paste(im, (g + (i % 6) * (tw + g), g + (i // 6) * (th + g)))
sheet.save(sys.argv[1], optimize=True)
`, out + "preview.png", ...pngs], { stdio: "inherit" });
}
for (const f of pngs) if (existsSync(f)) rmSync(f);
