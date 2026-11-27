// Full-screen cards for the Facebook livestream, same look as the site and the lower thirds:
// navy sky, the real dotted globe, น้องจีออส, partner logos in the glowing white frame.
//   poster/live/standby.png   "live starting soon" (before the stream)
//   poster/live/ending.png    "thank you for watching" (end of the stream)
//   poster/live/canva/TGGC2026-standby.pptx, TGGC2026-ending.pptx   the same, editable in Canva (Create a design → Import file)
// Usage: node scripts/make-live-standby.mjs
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { EVENT } from "../shared/event.js";
import { layers, writePptx } from "./canva-layers.mjs";

let pw;
try { pw = await import("playwright"); }
catch { pw = await import(process.env.PLAYWRIGHT_PATH || "playwright"); }
const chromium = pw.chromium || pw.default.chromium;

const root = fileURLToPath(new URL("../", import.meta.url));
const out = root + "poster/live/";
mkdirSync(out + "canva", { recursive: true });

const PAGE_TH = "โรงเรียนชลประทานวิทยา";
const PAGE_EN = "Chonprathanwittaya School";

const globeJs = (await build({
  stdin: { contents: `import { createGlobe } from "./participant/src/globe.js";
    for (const c of document.querySelectorAll("canvas.globe")) createGlobe(c, { dots: 5200, size: 0.3, tilt: 0.36, round: true, dpr: 2 });
    document.fonts.ready.then(() => setTimeout(() => (window.__ready = true), 500));`, resolveDir: root, loader: "js" },
  bundle: true, format: "iife", minify: true, write: false, logLevel: "warning",
})).outputFiles[0].text;

const uri = (f, t = "image/png") => `data:${t};base64,${readFileSync(root + f).toString("base64")}`;
// partner logos (cut from the speaker cards), in the order of the cards' logo strip (no 01 กรมชลประทาน; 11 repeats 02)
const partners = ["02", "03", "04", "05", "06", "07", "08", "09", "10"]
  .map((n) => `<img data-img="poster/live/logos/${n}.png" src="${uri(`poster/live/logos/${n}.png`)}" alt="">`).join("");

const fb = `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="24" fill="#1877f2"/>
  <path fill="#fff" d="M26.6 38V26.4h3.9l.6-4.5h-4.5v-2.9c0-1.3.4-2.2 2.2-2.2h2.4v-4a32 32 0 0 0-3.5-.2c-3.5 0-5.8 2.1-5.8 6v3.3h-3.9v4.5h3.9V38z"/></svg>`;
const pin = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.6" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>`;
const cal = `<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></g></svg>`;

const css = `
:root{--navy:#075f98;--sea:#0a98c7;--teal:#15a8a0;--mint:#2cc394;--night:#021b2e;--deep:#042c4a;--gold:#ffd166;--glow:#3aa8ff}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1920px;height:1080px;overflow:hidden}
body{font-family:Kanit,sans-serif;color:#fff;-webkit-font-smoothing:antialiased;background:var(--night)}
.s{position:absolute;inset:0;overflow:hidden;background:radial-gradient(120% 90% at 70% 30%,#0b5f93 0%,#063c62 40%,#021b2e 78%)}
.sky i{position:absolute;border-radius:50%;filter:blur(80px)}
.a1{width:60%;height:40%;left:-20%;top:40%;background:#2cc394;opacity:.22}
.a2{width:60%;height:45%;right:-15%;top:-10%;background:#0a98c7;opacity:.5}
.a3{width:80%;height:30%;left:10%;bottom:-14%;background:#15a8a0;opacity:.35}
.stars{position:absolute;inset:0;opacity:.5;background:radial-gradient(circle,#fff 1px,transparent 1.6px) 0 0/97px 89px,radial-gradient(circle,#9ff3d4 1px,transparent 1.6px) 41px 33px/151px 131px;
  -webkit-mask:linear-gradient(#000,transparent 70%)}
/* contour lines, like the card artwork */
.topo{position:absolute;left:-200px;top:120px;width:1100px;height:1100px;opacity:.12;border-radius:50%;
  background:repeating-radial-gradient(circle at 40% 45%,transparent 0 26px,#8fe9ff 26px 28px);-webkit-mask:radial-gradient(circle,#000 30%,transparent 70%)}
.globe{position:absolute;right:-250px;top:60px;width:1200px;height:1200px}
.geos{position:absolute;right:180px;bottom:120px;height:700px;filter:drop-shadow(0 30px 40px rgba(0,0,0,.45))}
.spark{position:absolute;width:44px;height:44px;background:var(--gold);clip-path:polygon(50% 0,61% 39%,100% 50%,61% 61%,50% 100%,39% 61%,0 50%,39% 39%);filter:drop-shadow(0 0 10px rgba(255,209,102,.8))}

/* glowing frame like the speaker cards */
.frame{position:absolute;inset:26px;border-radius:40px;border:3px solid rgba(143,212,255,.9);
  box-shadow:0 0 0 1px rgba(255,255,255,.25),0 0 28px rgba(58,168,255,.75),inset 0 0 28px rgba(58,168,255,.45)}
.frame::before,.frame::after{content:"";position:absolute;width:150px;height:6px;border-radius:6px;background:linear-gradient(90deg,var(--mint),#8fe9ff);box-shadow:0 0 12px var(--mint)}
.frame::before{left:70px;top:-4px}.frame::after{right:70px;bottom:-4px}

/* partner strip */
.partners{position:absolute;left:50%;top:26px;transform:translateX(-50%);display:flex;align-items:center;gap:34px;
  padding:16px 44px;border-radius:0 0 34px 34px;background:linear-gradient(180deg,#fff,#f1f9ff);
  box-shadow:0 0 0 3px rgba(143,212,255,.9),0 0 26px rgba(58,168,255,.7),0 20px 40px rgba(0,0,0,.3)}
.partners img{height:86px;max-width:150px;object-fit:contain}

.main{position:absolute;left:120px;top:190px;width:1020px}
.brand{display:flex;align-items:center;gap:26px}
.logo{background:#fff;border-radius:26px;padding:10px 16px;box-shadow:0 0 22px rgba(58,168,255,.6),0 16px 34px rgba(0,0,0,.4)}
.logo img{display:block;height:108px}
.live{display:inline-flex;align-items:center;gap:14px;padding:12px 26px 12px 20px;border-radius:999px;font:700 26px/1 "Chakra Petch",Kanit,sans-serif;letter-spacing:.14em;
  background:rgba(2,27,46,.55);border:2px solid rgba(255,255,255,.22);box-shadow:0 0 22px rgba(255,59,92,.25)}
.live em{font-style:normal}
.live.end i{background:var(--mint);box-shadow:0 0 0 6px rgba(44,195,148,.25),0 0 16px var(--mint)}
.live i{width:18px;height:18px;border-radius:50%;background:#ff3b5c;box-shadow:0 0 0 6px rgba(255,59,92,.25),0 0 16px #ff3b5c}
.live span{font-family:Kanit,sans-serif;letter-spacing:0;font-weight:500;color:#cfeaf5}
h1{margin-top:22px;font-weight:800;line-height:1.08;letter-spacing:-.005em}
h1 .l1{display:block;font-size:124px;line-height:1.25;color:#fff;text-shadow:0 8px 30px rgba(0,0,0,.35)}
h1 .l2{display:block;margin-top:0;font-size:56px;line-height:1.3;font-weight:700}
h1 .l2 [data-t]{background:linear-gradient(90deg,#8ff0c7,var(--mint) 45%,#5fd3ff);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.dots{display:inline-flex;gap:12px;margin-left:18px;vertical-align:middle}
.dots b{width:16px;height:16px;border-radius:50%;background:var(--mint);box-shadow:0 0 10px var(--mint)}
.dots b:nth-child(2){opacity:.65}.dots b:nth-child(3){opacity:.35}
.ev{margin-top:22px;padding-left:24px;border-left:5px solid var(--mint)}
.ev p{font-family:"IBM Plex Sans Thai",Kanit,sans-serif;font-weight:600;font-size:27px;line-height:1.5;color:#e8f6fb}
.ev small{display:block;margin-top:8px;font:700 20px/1.3 "Chakra Petch",sans-serif;letter-spacing:.12em;color:#8fe9ff;text-transform:uppercase}
.info{display:flex;gap:16px;margin-top:24px}
.chip{display:flex;align-items:center;gap:12px;padding:10px 24px 10px 18px;border-radius:18px;font-size:25px;font-weight:500;
  background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.22)}
.chip svg{width:30px;height:30px;color:var(--gold)}
.chip.d{background:linear-gradient(135deg,#ffe08a,#f6b93b);color:#2b1d00;border:0;font-weight:700}
.chip.d svg{color:#2b1d00}

/* Facebook box */
.fb{position:absolute;left:120px;bottom:112px;display:flex;align-items:center;gap:24px;padding:20px 40px 20px 22px;border-radius:28px;
  background:linear-gradient(180deg,#fff,#eef7ff);color:var(--deep);
  box-shadow:0 0 0 3px rgba(143,212,255,.95),0 0 28px rgba(58,168,255,.75),0 20px 40px rgba(0,0,0,.35)}
.fb svg{width:76px;height:76px;flex:none}
.fb small{display:block;font:700 19px/1 "Chakra Petch",Kanit,sans-serif;letter-spacing:.14em;color:#1877f2;text-transform:uppercase}
.fb b{display:block;margin-top:6px;font-size:36px;line-height:1.15;font-weight:700;color:#063f6e}
.fb span{display:block;font-size:23px;line-height:1.3;font-weight:500;color:var(--navy)}

/* bottom title bar, like the cards */
.bar{position:absolute;left:50%;bottom:26px;transform:translateX(-50%);padding:14px 70px 16px;border-radius:30px 30px 0 0;white-space:nowrap;
  font:700 28px/1 "Chakra Petch",Kanit,sans-serif;letter-spacing:.04em;color:#fff;
  background:linear-gradient(95deg,var(--deep),var(--navy) 40%,var(--sea) 75%,var(--teal));
  box-shadow:0 0 0 3px rgba(143,212,255,.9),0 0 24px rgba(58,168,255,.7)}
`;

const SCREENS = {
  standby: { pill: ["LIVE", "ถ่ายทอดสด"], l1: "รอสักครู่", l2: "การถ่ายทอดสดกำลังจะเริ่มขึ้น", dots: true, fb: "Live on Facebook · ถ่ายทอดสดทางเพจ" },
  ending: { end: true, pill: ["END", "จบการถ่ายทอดสด"], l1: "ขอบคุณที่รับชม", l2: "แล้วพบกันใหม่", fb: "Follow us · ติดตามข่าวสารได้ที่เพจ" },
};

const html = (S) => `<!doctype html><html lang="th"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@500;700;800&family=Chakra+Petch:wght@700&family=IBM+Plex+Sans+Thai:wght@600&display=swap" rel="stylesheet">
<style>${css}</style></head><body><div class="s">
  <div class="sky"><i class="a1"></i><i class="a2"></i><i class="a3"></i></div><div class="stars"></div><div class="topo"></div>
  <canvas class="globe"></canvas>
  <img class="geos" data-img="assets-src/geos-hd.png" src="${uri("assets-src/geos-hd.png")}" alt="">
  <i class="spark" style="right:880px;top:330px"></i><i class="spark" style="right:120px;top:300px;transform:scale(.7)"></i><i class="spark" style="right:660px;bottom:180px;transform:scale(.55)"></i>
  <div class="frame"></div>
  <div class="partners">${partners}</div>
  <div class="main">
    <div class="brand"><div class="logo"><img data-img="assets-src/logo-full.png" src="${uri("assets-src/logo-full.png")}" alt=""></div>
      <div class="live${S.end ? " end" : ""}"><i></i><em data-t>${S.pill[0]}</em> <span data-t>${S.pill[1]}</span></div></div>
    <h1><span class="l1" data-t>${S.l1}</span><span class="l2"><span data-t data-color="#2cc394">${S.l2}</span>${S.dots ? `<span class="dots"><b></b><b></b><b></b></span>` : ""}</span></h1>
    <div class="ev"><p data-t>การแข่งขันอัจฉริยภาพทางด้านภูมิศาสตร์และภูมิสารสนเทศแห่งประเทศไทย<br>ระดับมัธยมศึกษา ครั้งที่ 3 พ.ศ. 2569</p></div>
    <div class="info"><div class="chip d">${cal}<span data-t>${EVENT.dateText}</span></div><div class="chip">${pin}<span data-t>${EVENT.venue} ${EVENT.venueSub}</span></div></div>
  </div>
  <div class="fb">${fb}<div><small data-t>${S.fb}</small><b data-t>${PAGE_TH}</b><span data-t>${PAGE_EN}</span></div></div>
  <div class="bar"><span data-t>The 3rd Thailand Geography Genius Challenge 2026 (TGGC2026)</span></div>
</div><script>${globeJs}</script></body></html>`;

const tmp = out + ".tmp.html";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
for (const [name, S] of Object.entries(SCREENS)) {
  writeFileSync(tmp, html(S));
  const p = await ctx.newPage();
  await p.goto(pathToFileURL(tmp).href, { waitUntil: "networkidle" });
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  await p.screenshot({ path: out + name + ".png" });
  const bg = out + `.${name}-bg.png`;
  const L = await layers(p, bg);
  await p.close();
  writePptx([{ name, ...L }], out + `canva/TGGC2026-${name}.pptx`, out + ".spec.json");
  for (const f of [bg, out + ".spec.json"]) rmSync(f);
  console.log(`poster/live/${name}.png`);
}
await b.close();
rmSync(tmp);
