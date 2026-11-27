// Two-window layout for the livestream: a big window for the shared screen and a small one for the live camera,
// both see-through, inside the same navy / glow theme as the standby screen.
//   poster/live/frame/frame-screen-camera.png   1920×1080, the two windows are transparent
//   poster/live/frame/preview-screen-camera.png with stand-ins in the windows
//   poster/live/canva/TGGC2026-frame-screen-camera.pptx   editable in Canva
// Window positions (px, for OBS / vMix): see WIN below; both are 16:9.
// Usage: node scripts/make-live-pip.mjs
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { layers, writePptx } from "./canva-layers.mjs";
import { root, live } from "./live-bars.mjs";
import { EVENT } from "../shared/event.js";

let pw;
try { pw = await import("playwright"); }
catch { pw = await import(process.env.PLAYWRIGHT_PATH || "playwright"); }
const chromium = pw.chromium || pw.default.chromium;

const out = live + "frame/";
mkdirSync(out, { recursive: true });
export const WIN = { screen: { x: 40, y: 118, w: 1360, h: 765 }, camera: { x: 1424, y: 118, w: 456, h: 257 } };
const R = 22;

const globeJs = (await build({
  stdin: { contents: `import { createGlobe } from "./participant/src/globe.js";
    for (const c of document.querySelectorAll("canvas.globe")) createGlobe(c, { dots: 4200, size: 0.3, tilt: 0.36, round: true, dpr: 2 });
    document.fonts.ready.then(() => setTimeout(() => (window.__ready = true), 500));`, resolveDir: root, loader: "js" },
  bundle: true, format: "iife", minify: true, write: false, logLevel: "warning",
})).outputFiles[0].text;

const uri = (f) => `data:image/png;base64,${readFileSync(root + f).toString("base64")}`;
const partners = ["02", "03", "04", "05", "06", "07", "08", "09", "10"]
  .map((n) => `<span><img data-img="poster/live/logos/${n}.png" src="${uri(`poster/live/logos/${n}.png`)}" alt=""></span>`).join("");
const fb = `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="24" fill="#1877f2"/>
  <path fill="#fff" d="M26.6 38V26.4h3.9l.6-4.5h-4.5v-2.9c0-1.3.4-2.2 2.2-2.2h2.4v-4a32 32 0 0 0-3.5-.2c-3.5 0-5.8 2.1-5.8 6v3.3h-3.9v4.5h3.9V38z"/></svg>`;

// rounded-rect path, for cutting the windows out of the background (evenodd)
const rr = ({ x, y, w, h }, r = R) => `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
const holes = `M0 0H1920V1080H0Z ${rr(WIN.screen)} ${rr(WIN.camera)}`;
const box = ({ x, y, w, h }) => `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;

const css = `
:root{--navy:#075f98;--sea:#0a98c7;--teal:#15a8a0;--mint:#2cc394;--deep:#063f6e;--glow:#3aa8ff;--gold:#ffd166}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1920px;height:1080px;overflow:hidden;background:transparent}
body{font-family:Kanit,sans-serif;color:#fff;-webkit-font-smoothing:antialiased}
.bg{position:absolute;inset:0;overflow:hidden;clip-path:path(evenodd,'${holes}');
  background:radial-gradient(120% 90% at 75% 20%,#0b5f93 0%,#063c62 40%,#021b2e 80%)}
.bg i.a{position:absolute;border-radius:50%;filter:blur(80px)}
.stars{position:absolute;inset:0;opacity:.45;background:radial-gradient(circle,#fff 1px,transparent 1.6px) 0 0/97px 89px,radial-gradient(circle,#9ff3d4 1px,transparent 1.6px) 41px 33px/151px 131px}
.topo{position:absolute;left:-300px;bottom:-500px;width:1200px;height:1200px;opacity:.1;border-radius:50%;
  background:repeating-radial-gradient(circle at 40% 45%,transparent 0 26px,#8fe9ff 26px 28px);-webkit-mask:radial-gradient(circle,#000 30%,transparent 70%)}
.globe{position:absolute;right:-420px;bottom:-520px;width:1100px;height:1100px;opacity:.9}
.frame{position:absolute;inset:14px;border-radius:32px;border:3px solid rgba(143,212,255,.9);box-shadow:0 0 22px rgba(58,168,255,.75)}
.win{position:absolute;border-radius:${R}px;border:3px solid rgba(143,212,255,.98);
  box-shadow:0 0 0 1px rgba(255,255,255,.35),0 0 24px rgba(58,168,255,.85),0 0 0 9px rgba(2,27,46,.35)}
.win::before,.win::after{content:"";position:absolute;width:90px;height:90px;border:0 solid var(--mint);filter:drop-shadow(0 0 7px var(--mint))}
.win::before{left:-9px;top:-9px;border-left-width:6px;border-top-width:6px;border-top-left-radius:${R + 8}px}
.win::after{right:-9px;bottom:-9px;border-right-width:6px;border-bottom-width:6px;border-bottom-right-radius:${R + 8}px}
.tab{position:absolute;display:inline-flex;align-items:center;gap:10px;padding:7px 18px 7px 14px;border-radius:999px;font:700 17px/1 "Chakra Petch",Kanit,sans-serif;letter-spacing:.14em;
  background:rgba(2,27,46,.88);border:2px solid rgba(143,212,255,.6);box-shadow:0 0 14px rgba(58,168,255,.5);white-space:nowrap}
.tab i{width:12px;height:12px;border-radius:50%;background:#ff3b5c;box-shadow:0 0 0 4px rgba(255,59,92,.28),0 0 10px #ff3b5c}
.tab.s i{background:var(--mint);box-shadow:0 0 0 4px rgba(44,195,148,.28),0 0 10px var(--mint)}
.tab span{font-family:Kanit,sans-serif;letter-spacing:0;font-weight:500;color:#cfeaf5}
.head{position:absolute;left:40px;top:26px;height:72px;display:flex;align-items:center;gap:18px}
.logo{background:#fff;border-radius:16px;padding:5px 10px;box-shadow:0 0 0 3px rgba(143,212,255,.9),0 0 16px rgba(58,168,255,.6)}
.logo img{display:block;height:58px}
.live{display:inline-flex;align-items:center;gap:10px;padding:9px 20px 9px 14px;border-radius:999px;font:700 21px/1 "Chakra Petch",sans-serif;letter-spacing:.14em;
  background:rgba(2,27,46,.6);border:2px solid rgba(255,255,255,.25)}
.live i{width:14px;height:14px;border-radius:50%;background:#ff3b5c;box-shadow:0 0 0 5px rgba(255,59,92,.25),0 0 12px #ff3b5c}
.ttl b{display:block;font-size:26px;font-weight:700;line-height:1.25;white-space:nowrap}
.ttl small{display:block;font:700 15px/1.3 "Chakra Petch",sans-serif;letter-spacing:.12em;color:#8fe9ff;text-transform:uppercase}
.fb{position:absolute;right:40px;top:30px;display:flex;align-items:center;gap:12px;padding:8px 24px 8px 10px;border-radius:999px;
  background:linear-gradient(180deg,#fff,#eef7ff);color:var(--deep);box-shadow:0 0 0 3px rgba(143,212,255,.95),0 0 18px rgba(58,168,255,.6)}
.fb svg{width:46px;height:46px;flex:none}
.fb small{display:block;font:700 12px/1 "Chakra Petch",sans-serif;letter-spacing:.14em;color:#1877f2;text-transform:uppercase}
.fb b{display:block;margin-top:3px;font-size:22px;line-height:1.15;font-weight:700;color:#063f6e;white-space:nowrap}
.partners{position:absolute;left:${WIN.camera.x}px;top:${WIN.camera.y + WIN.camera.h + 24}px;width:${WIN.camera.w}px;padding:16px 18px;border-radius:22px;
  display:grid;grid-template-columns:repeat(3,1fr);gap:10px 14px;background:linear-gradient(180deg,#fff,#f1f9ff);
  box-shadow:0 0 0 3px rgba(143,212,255,.95),0 0 20px rgba(58,168,255,.6)}
.partners small{grid-column:1/-1;font:700 13px/1 "Chakra Petch",Kanit,sans-serif;letter-spacing:.16em;color:var(--teal);text-transform:uppercase;text-align:center}
.partners span{height:78px;display:flex;align-items:center;justify-content:center;overflow:hidden}
.partners img{display:block;width:auto;height:auto;max-width:126px;max-height:74px}
.geos{position:absolute;right:70px;bottom:22px;height:300px;filter:drop-shadow(0 18px 26px rgba(0,0,0,.45))}
.spark{position:absolute;width:30px;height:30px;background:var(--gold);clip-path:polygon(50% 0,61% 39%,100% 50%,61% 61%,50% 100%,39% 61%,0 50%,39% 39%);filter:drop-shadow(0 0 8px rgba(255,209,102,.8))}
.foot{position:absolute;left:40px;top:${WIN.screen.y + WIN.screen.h + 22}px;display:flex;align-items:center;gap:16px}
.chip{display:flex;align-items:center;gap:10px;padding:10px 22px;border-radius:16px;font-size:22px;font-weight:500;white-space:nowrap;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.22)}
.chip.d{background:linear-gradient(135deg,#ffe08a,#f6b93b);color:#2b1d00;border:0;font-weight:700}
`;

const html = `<!doctype html><html lang="th"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@500;700&family=Chakra+Petch:wght@700&display=swap" rel="stylesheet">
<style>${css}</style></head><body>
<div class="bg"><i class="a" style="width:60%;height:40%;right:-15%;top:-12%;background:#0a98c7;opacity:.45"></i>
  <i class="a" style="width:60%;height:35%;left:-20%;bottom:-15%;background:#2cc394;opacity:.2"></i>
  <div class="stars"></div><div class="topo"></div><canvas class="globe"></canvas></div>
<div class="frame"></div>
<div class="win" style="${box(WIN.screen)}"></div>
<div class="win" style="${box(WIN.camera)}"></div>
<div class="tab s" style="left:${WIN.screen.x + 26}px;top:${WIN.screen.y - 17}px"><i></i><em data-t style="font-style:normal">SCREEN</em> <span data-t>หน้าจอนำเสนอ</span></div>
<div class="tab" style="left:${WIN.camera.x + 22}px;top:${WIN.camera.y - 17}px"><i></i><em data-t style="font-style:normal">LIVE CAM</em> <span data-t>ถ่ายทอดสด</span></div>
<div class="head"><div class="logo"><img data-img="assets-src/logo-full.png" src="${uri("assets-src/logo-full.png")}" alt=""></div>
  <div class="live"><i></i><span data-t>LIVE</span></div>
  <div class="ttl"><small data-t>The 3rd Thailand Geography Genius Challenge 2026</small><b data-t>การแข่งขันอัจฉริยภาพทางด้านภูมิศาสตร์และภูมิสารสนเทศแห่งประเทศไทย ครั้งที่ 3</b></div></div>
<div class="fb">${fb}<div><small data-t>Facebook Live</small><b data-t>โรงเรียนชลประทานวิทยา</b></div></div>
<div class="partners"><small data-t>ร่วมจัดโดย · Partners</small>${partners}</div>
<img class="geos" data-img="assets-src/geos-hd.png" src="${uri("assets-src/geos-hd.png")}" alt="">
<i class="spark" style="right:330px;bottom:230px"></i><i class="spark" style="right:40px;bottom:300px;transform:scale(.6)"></i>
<div class="foot"><div class="chip d"><span data-t>${EVENT.dateText}</span></div><div class="chip"><span data-t>${EVENT.venue} ${EVENT.venueSub}</span></div></div>
<script>${globeJs}</script></body></html>`;

const tmp = live + ".tmp.html";
writeFileSync(tmp, html);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
const p = await ctx.newPage();
await p.goto(pathToFileURL(tmp).href, { waitUntil: "networkidle" });
await p.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
await p.screenshot({ path: out + "frame-screen-camera.png", omitBackground: true });
const slide = { name: "screen + camera", ...(await layers(p, live + ".pip-bg.png", { transparent: true })) };
// preview with stand-ins in the two windows
await p.addStyleTag({ content: `body{background:linear-gradient(#000,#000)}
  .demo{position:absolute;display:grid;place-items:center;font:600 34px Kanit;color:#5b6b78;border-radius:${R}px}` });
await p.evaluate((W) => {
  const add = (r, bg, t) => { const d = document.createElement("div"); d.className = "demo"; Object.assign(d.style, { left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px", background: bg, zIndex: -1 }); d.textContent = t; document.body.prepend(d); };
  add(W.screen, "linear-gradient(135deg,#f4f7fa,#dfe7ee)", "Screen share 1360 × 765");
  add(W.camera, "radial-gradient(circle at 50% 40%,#56646f,#232d36)", "Camera 456 × 257");
}, WIN);
await p.screenshot({ path: out + "preview-screen-camera.png" });
await b.close();
writePptx([slide], live + "canva/TGGC2026-frame-screen-camera.pptx", live + ".spec.json");
for (const f of [tmp, live + ".spec.json", slide.bg]) rmSync(f);
console.log("frame/frame-screen-camera.png · windows:", JSON.stringify(WIN));
