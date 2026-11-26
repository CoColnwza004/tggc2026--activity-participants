// Promo posters for the stamp rally, rendered with Playwright + Chromium from the site's own artwork
// (logo, น้องจีออส, the real dotted globe and the real rubber stamps).
//   poster/poster-a4.png   2480×3508 (A4 @ 300 dpi, for print)
//   poster/poster-a4.pdf   A4 vector text, for print shops
//   poster/poster-social.png  2160×2700 (4:5, Facebook / Instagram / LINE)
//   poster/poster-story.png   1080×1920 (9:16, IG / FB / TikTok story)
// Usage: node scripts/make-poster.mjs
import { build } from "esbuild";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { EVENT, REQUIRED } from "../shared/event.js";
import { stampHTML, finalSealHTML } from "../participant/src/stamps.js";
import { prizeArt, icon } from "../shared/web/icons.js";
import { qrSvg } from "../shared/web/qr.js";

let pw;
try { pw = await import("playwright"); }
catch { pw = await import(process.env.PLAYWRIGHT_PATH || "playwright"); }
const chromium = pw.chromium || pw.default.chromium;

const root = fileURLToPath(new URL("../", import.meta.url));
// PRINT=1: large-format print files (standee) in poster/print/: a very high-res PNG, flattened into a PDF by
// scripts/flat-pdf.py (vector PDFs keep CSS effects as transparency groups that some viewers/RIPs draw wrong)
const PRINT = !!process.env.PRINT;
const out = root + "poster/";
mkdirSync(out, { recursive: true });

// the real globe, bundled for the page (still frame: the page runs with reduced motion)
const globeJs = (await build({
  stdin: { contents: `import { createGlobe } from "./participant/src/globe.js";
    for (const c of document.querySelectorAll("canvas.globe")) createGlobe(c, { dots: +c.dataset.dots || 3200, size: +c.dataset.size || 0.3, tilt: 0.36, round: true, dpr: ${PRINT ? 5 : 0} });
    document.fonts.ready.then(() => setTimeout(() => (window.__ready = true), 400));`, resolveDir: root, loader: "js" },
  bundle: true, format: "iife", minify: true, write: false, logLevel: "warning",
})).outputFiles[0].text;

const url = EVENT.participantUrl;
// CSS masks can't load file:// images (CORS), so the stamp textures go in as data URIs
const dataUri = (f) => `data:image/webp;base64,${readFileSync(root + f).toString("base64")}`;
const shortUrl = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
const qr = await qrSvg(url, { ecc: "Q", margin: 1, color: "#021b2e" });
const B = EVENT.booths;
const pick = (...nos) => nos.map((n) => B.find((b) => b.no === n));

// passport card: a page of real stamps, two slots still empty
const passport = (cls = "") => `<div class="pp ${cls}">
  <div class="pp-h"><b>GEO PASSPORT</b><span>สมุดสะสมตรา</span></div>
  <div class="pp-g">${pick(15, 3, 16, 23, 20, 6, 4).map((b, i) => `<div class="slot">${stampHTML(b, "poster" + i)}</div>`).join("")}
    <div class="slot empty"><i>08</i></div><div class="slot empty"><i>09</i></div></div>
  <div class="pp-bar"><i style="width:${(7 / 9) * 100}%"></i></div></div>`;

const ticket = (cls = "") => `<div class="tk ${cls}">
  <div class="tk-top"><small>TGGC 2026 · LUCKY DRAW</small><b>ตั๋วลุ้นรางวัล</b></div>
  <div class="tk-mid">${finalSealHTML()}</div>
  <div class="tk-cut"></div>
  <div class="tk-bot">ครบ ${REQUIRED} ตรา<br>ยื่นที่เคาน์เตอร์แลกรางวัล</div></div>`;

// prize pile: generic small appliances on a podium (illustration only; see EVENT.prizeNote)
const art = (k) => prizeArt(k);
const pile = `<div class="pile"><i class="pod"></i><i class="pod-top"></i><i class="glow"></i>
  <span class="pi fan">${art("fan")}</span><span class="pi fry">${art("airfryer")}</span><span class="pi ket">${art("kettle")}</span>
  <span class="pi gb">${art("gift")}</span><span class="pi dry">${art("hairdryer")}</span><span class="pi pil">${art("pillow")}</span><span class="pi gs">${art("gift")}</span></div>`;
const prizeBox = (cls = "") => `<div class="prizes ${cls}"><i class="rays"></i><div class="pz-copy"><small>PRIZES · ของรางวัล</small><h2>ลุ้นรับ<br><em>เครื่องใช้ไฟฟ้า</em></h2>
  <p>และของรางวัลอีกมากมาย!</p><span class="pz-note">${EVENT.prizeNote}</span></div>${pile}</div>`;

const steps = [
  ["qr", "สแกน QR", "เปิดสมุดสะสมตราในมือถือ<br>ไม่ต้องโหลดแอป"],
  ["stamp", `ตะลุย ${B.length} บูธ`, "ร่วมกิจกรรม แล้วสแกน QR<br>ที่บูธเพื่อรับตราจีออส"],
  ["gift", "รับตั๋ว ลุ้นรางวัล", `ครบ ${REQUIRED} ตรา ยื่นตั๋วให้สแกน<br>เขียนชื่อหย่อนกล่องจับฉลาก`],
];
const stepIcon = { qr: icon("qr"), stamp: icon("passport"), gift: icon("gift") };
const stepsHTML = steps.map(([k, t, d], i) => `<div class="step"><span class="n">${i + 1}</span><span class="si">${stepIcon[k]}</span><b>${t}</b><p>${d}</p></div>`).join("");

const qrBlock = (cls = "") => `<div class="qrb ${cls}"><div class="qr">${qr}</div>
  <div class="qrt"><small>SCAN TO START</small><b>สแกนเลย!</b><span>เริ่มสะสมตราได้ทันที</span><code>${shortUrl}</code></div></div>`;

const sky = `<div class="sky"><i class="a1"></i><i class="a2"></i><i class="a3"></i><i class="stars"></i></div>`;
const head = (cls = "") => `<header class="top ${cls}"><img class="logo" src="assets-src/logo-full.png" alt="">
  <div class="date"><small>${EVENT.dateText.split(" ")[0]}</small><b>28</b><span>พ.ย. 2569</span></div></header>`;
const title = `<h1><span class="l1">ตะลุยบูธ</span><span class="l2">สะสมตรา</span><span class="l3">ลุ้นรางวัล!</span></h1>`;
const where = `<div class="where">${icon("pin")}<div><b>${EVENT.venue}</b><span>${EVENT.venueSub}</span></div></div>`;

const css = `
:root{--navy:#075f98;--sea:#0a98c7;--teal:#15a8a0;--mint:#2cc394;--green:#148e64;--mist:#a7d5db;--night:#021b2e;--deep:#042c4a;--gold:#ffd166;--paper:#fbfdf9;--ink:#0a2b42;
 --f-display:Kanit,sans-serif;--f-body:"IBM Plex Sans Thai",sans-serif;--f-tech:"Chakra Petch",Kanit,monospace}
*{box-sizing:border-box}html,body{margin:0}
body{font-family:var(--f-body);color:#fff;-webkit-font-smoothing:antialiased}
.poster{position:relative;overflow:hidden;background:radial-gradient(120% 70% at 50% 18%,#0b5f93 0%,#063c62 38%,#021b2e 72%)}
.sky{position:absolute;inset:0;pointer-events:none}
.sky i{position:absolute;border-radius:50%;filter:blur(70px)}
.sky .a1{width:80%;height:30%;left:-30%;top:22%;background:#2cc394;opacity:.28}
.sky .a2{width:70%;height:32%;right:-30%;top:-6%;background:#0a98c7;opacity:.5}
.sky .a3{width:90%;height:24%;left:5%;bottom:-8%;background:#15a8a0;opacity:.35}
.sky .stars{inset:0;width:auto;height:auto;border-radius:0;filter:none;opacity:.55;
 background:radial-gradient(circle,#fff 1px,transparent 1.6px) 0 0/97px 89px,radial-gradient(circle,#9ff3d4 1px,transparent 1.6px) 41px 33px/151px 131px;
 -webkit-mask:linear-gradient(#000,transparent 55%)}
.globe{position:absolute;display:block}
.top{position:relative;display:flex;align-items:center;justify-content:space-between}
.logo{background:#fff;border-radius:26px;padding:12px 18px;box-shadow:0 20px 50px -10px rgba(0,0,0,.5)}
.date{display:grid;justify-items:center;line-height:1;font-family:var(--f-display);color:#2b1d00;border-radius:24px;
 background:linear-gradient(150deg,#fff3c4,#f2cf6b 45%,#e9b949);box-shadow:0 0 0 5px rgba(233,185,73,.25),0 0 60px rgba(233,185,73,.4)}
.date small{font-weight:500}.date b{font-weight:800}.date span{font-weight:700}
h1{margin:0;font-family:var(--f-display);font-weight:800;line-height:1;letter-spacing:-.01em;position:relative}
h1 span{display:block}
h1 .l2{background:linear-gradient(100deg,#7ff5cc,#2cc394 40%,#52d6ff);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 30px rgba(44,195,148,.35))}
h1 .l3{color:var(--gold);text-shadow:0 0 40px rgba(255,209,102,.4)}
.kick{display:inline-flex;align-items:center;gap:.6em;font-family:var(--f-tech);font-weight:700;letter-spacing:.22em;color:#9ff3d4;
 border:1.5px solid rgba(159,243,212,.45);border-radius:999px;background:rgba(2,27,46,.4)}
.kick i{width:.6em;height:.6em;border-radius:50%;background:var(--mint);box-shadow:0 0 12px var(--mint)}
.geos{position:absolute;filter:drop-shadow(0 30px 40px rgba(0,0,0,.5)) drop-shadow(0 0 40px rgba(127,245,204,.25))}
/* passport card */
.pp{position:absolute;background:var(--paper);color:var(--ink);border-radius:26px;box-shadow:0 40px 80px -20px rgba(0,0,0,.6),inset 0 0 0 1px #dcecef}
.pp-h{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px dashed #bfdce1}
.pp-h b{font-family:var(--f-tech);letter-spacing:.16em;color:var(--navy)}
.pp-h span{font-family:var(--f-display);font-weight:500;color:#4d7083}
.pp-g{display:grid;grid-template-columns:repeat(3,1fr)}
.slot{display:grid;place-items:center;aspect-ratio:1}
.slot.empty i{display:grid;place-items:center;width:84%;aspect-ratio:1;border-radius:50%;border:2.5px dashed #bfdce1;font-style:normal;font-family:var(--f-tech);font-weight:700;color:#bfdce1}
.pp-bar{border-radius:99px;background:#e3f1f3;overflow:hidden}.pp-bar i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--teal),var(--mint))}
/* stamps (same artwork as the site) */
.stamp{position:relative;width:92%;aspect-ratio:1;color:var(--ink);transform:rotate(var(--rot,0deg));
 -webkit-mask:url(assets/ink-grunge.webp) var(--mx,0) var(--my,0)/150% auto;mask:url(assets/ink-grunge.webp) var(--mx,0) var(--my,0)/150% auto;mix-blend-mode:multiply;opacity:.92}
.stamp svg{position:absolute;inset:0;width:100%;height:100%;color:var(--ink)}
.stamp svg,.stamp .st-seal{color:var(--ink)}
.stamp text{font-family:var(--f-tech);font-weight:700;letter-spacing:.1em}
.stamp .st-bot{font-size:12px;letter-spacing:.16em}
.stamp .st-face{position:absolute;left:20.5%;top:20.5%;width:59%;height:59%;border-radius:50%;background:var(--ink);-webkit-mask:url(assets/geos-ink.webp) center/cover;mask:url(assets/geos-ink.webp) center/cover}
.stamp .st-seal{position:absolute;left:40.5%;top:66%;width:19%;height:19%;border-radius:50%;display:grid;place-items:center;background:var(--ink);box-shadow:0 0 0 3px var(--paper),0 0 0 5px var(--ink)}
.stamp .st-seal svg{position:static;width:62%;height:62%;color:#fff}
.stamp-final{--ink:#9a6c00!important}
/* golden ticket */
.tk{position:absolute;color:#2b1d00;border-radius:24px;background:linear-gradient(155deg,#fff6d2,#f6d77a 40%,#e9b949);
 box-shadow:0 0 0 4px rgba(255,243,196,.5),0 0 80px rgba(233,185,73,.45),0 40px 70px -20px rgba(0,0,0,.6);text-align:center;overflow:hidden}
.tk-top small{display:block;font-family:var(--f-tech);font-weight:700;letter-spacing:.18em;opacity:.7}
.tk-top b{font-family:var(--f-display);font-weight:800;display:block;line-height:1.1}
.tk-mid{display:grid;place-items:center}.tk-mid .stamp{mix-blend-mode:multiply;opacity:.9}
.tk-cut{position:relative;border-top:3px dashed rgba(43,29,0,.3)}
.tk-cut:before,.tk-cut:after{content:"";position:absolute;top:-17px;width:32px;height:32px;border-radius:50%;background:#06395d}
.tk-cut:before{left:-18px}.tk-cut:after{right:-18px}
.tk-bot{font-family:var(--f-display);font-weight:700}
.spark{position:absolute;color:var(--gold);filter:drop-shadow(0 0 14px rgba(255,209,102,.8))}
/* steps */
.steps{display:grid;grid-template-columns:repeat(3,1fr);position:relative}
.step{position:relative;border-radius:28px;background:linear-gradient(160deg,rgba(255,255,255,.12),rgba(255,255,255,.04));border:1.5px solid rgba(167,213,219,.28);text-align:center;display:grid;justify-items:center;backdrop-filter:blur(8px)}
.step .n{position:absolute;font-family:var(--f-tech);font-weight:700;color:#2b1d00;background:var(--gold);border-radius:50%;display:grid;place-items:center;box-shadow:0 0 24px rgba(255,209,102,.6)}
.step .si{display:grid;place-items:center;border-radius:50%;background:radial-gradient(circle at 30% 30%,#2cc394,#15a8a0 50%,#075f98);box-shadow:0 0 30px rgba(44,195,148,.45)}
.step .si .ico{color:#fff}
.step b{font-family:var(--f-display);font-weight:700;line-height:1.2}
.step p{margin:0;color:rgba(233,246,248,.82);line-height:1.45}
/* prizes: copy + appliance pile */
.prizes{position:relative;border-radius:34px;background:radial-gradient(120% 90% at 80% 100%,#fff3c4 0,#f6d77a 40%,#e9b949 75%,#d99a2b);color:#2b1d00;box-shadow:0 0 0 5px rgba(233,185,73,.25),0 0 90px rgba(233,185,73,.35);display:grid;grid-template-columns:auto 1fr;align-items:center}
.prizes .rays{position:absolute;inset:0;border-radius:inherit;overflow:hidden;pointer-events:none}
.prizes .rays:before{content:"";position:absolute;right:-30%;bottom:-60%;width:160%;aspect-ratio:1;background:repeating-conic-gradient(from 0deg,rgba(255,255,255,.26) 0 7deg,transparent 7deg 18deg);-webkit-mask:radial-gradient(closest-side,#000 30%,transparent);mask:radial-gradient(closest-side,#000 30%,transparent)}
.pz-copy{position:relative;z-index:2}
.pz-copy small{display:block;font-family:var(--f-tech);font-weight:700;letter-spacing:.2em;opacity:.7}
.prizes h2{margin:0;font-family:var(--f-display);font-weight:800;line-height:1.08}
.prizes h2 em{font-style:normal;display:inline-block;padding:0 .18em .04em;border-radius:.2em;background:#c8102e;color:#fff;box-shadow:0 .08em 0 #8e0b20;transform:rotate(-2deg);white-space:nowrap;margin-top:.08em}
.pz-copy p{margin:.35em 0 0;font-family:var(--f-display);font-weight:700}
.pz-note{display:block;margin-top:.6em;font-size:12px;opacity:.7;line-height:1.3}
.pile{position:relative;z-index:1;aspect-ratio:1.5}
.pile .pod{position:absolute;left:3%;right:3%;bottom:0;height:22%;border-radius:50%;background:linear-gradient(#b30f2a,#7c0a1c);box-shadow:0 10px 20px rgba(80,20,0,.35)}
.pile .pod-top{position:absolute;left:3%;right:3%;bottom:7%;height:22%;border-radius:50%;background:radial-gradient(70% 90% at 50% 30%,#ff5a6e,#d4183a 60%,#b30f2a);box-shadow:inset 0 3px 0 rgba(255,255,255,.35)}
.pile .glow{position:absolute;left:10%;right:10%;top:0;bottom:20%;background:radial-gradient(closest-side,rgba(255,255,255,.75),transparent);}
.pi{position:absolute;display:block;filter:drop-shadow(0 6px 8px rgba(60,30,0,.28))}
.pi svg{display:block;width:100%;height:auto}
.pi.fan{left:0;bottom:18%;width:31%}
.pi.fry{left:23%;bottom:19%;width:27%}
.pi.ket{left:46%;bottom:19%;width:27%}
.pi.gb{right:0;bottom:19%;width:28%}
.pi.dry{left:6%;bottom:2%;width:30%;transform:rotate(-6deg)}
.pi.pil{left:38%;bottom:0;width:25%}
.pi.gs{right:8%;bottom:2%;width:18%;transform:rotate(8deg)}
.prizes.stack{grid-template-columns:1fr;text-align:center;justify-items:center}

/* QR */
.qrb{display:flex;align-items:center;border-radius:34px;background:#fff;color:var(--ink);box-shadow:0 0 0 6px rgba(44,195,148,.35),0 0 90px rgba(44,195,148,.35),0 40px 80px -20px rgba(0,0,0,.6)}
.qr svg{display:block;width:100%;height:100%}
.qrt small{display:block;font-family:var(--f-tech);font-weight:700;letter-spacing:.2em;color:var(--teal)}
.qrt b{display:block;font-family:var(--f-display);font-weight:800;line-height:1.05;color:var(--navy)}
.qrt span{display:block;font-family:var(--f-display);font-weight:500;color:#4d7083}
.qrt code{display:inline-block;font-family:var(--f-tech);font-weight:700;color:var(--green);background:#e6f6f0;border-radius:10px}
.where{display:flex;align-items:center;position:relative;z-index:2}.lede,.kick,.steps,.duo,.bottom{position:relative;z-index:2}.where .ico{color:var(--gold);flex:none}
.where b{display:block;font-family:var(--f-display);font-weight:700;line-height:1.2}.where span{display:block;color:var(--mist)}
.partners h3{margin:0;font-family:var(--f-tech);font-weight:700;letter-spacing:.2em;color:#9ff3d4}
.chips{display:flex;flex-wrap:wrap}
.chips span{border-radius:999px;background:rgba(255,255,255,.07);border:1px solid rgba(167,213,219,.22);color:rgba(233,246,248,.9);line-height:1.3}
.chips span em{font-style:normal;font-family:var(--f-tech);font-weight:700;color:var(--mint)}
.foot{color:rgba(233,246,248,.7);text-align:center;line-height:1.5}

/* ===== A4: 1240×1754 ===== */
.a4{width:1240px;height:1754px;padding:64px 72px}
.a4 .top .logo{height:132px}
.a4 .date{width:156px;height:156px;align-content:center;gap:2px}.a4 .date small{font-size:22px}.a4 .date b{font-size:76px}.a4 .date span{font-size:22px}
.a4 .kick{margin-top:30px;padding:10px 22px;font-size:20px}
.a4 h1{margin-top:14px;font-size:128px}.a4 h1 .l3{font-size:100px;margin-top:4px}
.a4 .lede{margin:18px 0 0;font-size:26px;line-height:1.55;color:rgba(233,246,248,.9);max-width:500px}.a4 .lede b{color:#fff}
.a4 .globe{right:-470px;top:-150px;width:1460px;height:1460px}
.a4 .geos{right:150px;top:320px;height:490px}
.a4 .pp{right:350px;top:640px;width:280px;padding:16px 16px 14px;transform:rotate(-9deg)}
.a4 .pp-h{padding-bottom:8px;margin-bottom:6px}.a4 .pp-h b{font-size:16px}.a4 .pp-h span{font-size:15px}
.a4 .pp-g{gap:2px}.a4 .slot.empty i{font-size:18px}.a4 .pp-bar{height:10px;margin-top:8px}
.a4 .stamp .st-seal{box-shadow:0 0 0 2px var(--paper),0 0 0 3.5px var(--ink)}
.a4 .tk{right:40px;top:650px;width:230px;padding:18px 16px 16px;transform:rotate(10deg)}
.a4 .tk-top small{font-size:12px}.a4 .tk-top b{font-size:32px}.a4 .tk-mid{padding:8px 0 12px}.a4 .tk-mid .stamp{width:140px}
.a4 .tk-bot{padding-top:12px;font-size:16px}
.a4 .s1{right:600px;top:480px;width:46px}.a4 .s2{right:70px;top:300px;width:34px}.a4 .s3{right:300px;top:1000px;width:28px}
.a4 .where{margin-top:24px}.a4 .steps{margin-top:118px;gap:22px}
.a4 .step{grid-template-columns:auto 1fr;justify-items:start;text-align:left;align-items:center;column-gap:14px;row-gap:2px;padding:26px 18px 22px 20px}.a4 .step .si{grid-row:span 2}
.a4 .step .n{top:-18px;left:18px;width:42px;height:42px;font-size:23px}
.a4 .step .si{width:70px;height:70px}.a4 .step .si .ico{width:36px;height:36px}
.a4 .step b{font-size:27px}.a4 .step p{font-size:17.5px}
.a4 .duo{display:grid;grid-template-columns:1fr 440px;gap:20px;margin-top:34px}
.a4 .prizes{padding:18px 8px 14px 24px;gap:0;grid-template-columns:262px 1fr}.a4 .pz-copy small{font-size:13px;margin-bottom:6px}.a4 .prizes h2{font-size:38px}.a4 .pz-copy p{font-size:21px}.a4 .pz-note{font-size:11.5px;max-width:225px}
.a4 .pile{width:112%;margin:-58px -4% -6px -6%}
.a4 .qrb{padding:20px;gap:16px}.a4 .qr{width:184px;height:184px;flex:none}
.a4 .qrt small{font-size:13px}.a4 .qrt b{font-size:44px;margin:4px 0;white-space:nowrap}.a4 .qrt span{font-size:21px}.a4 .qrt code{margin-top:12px;padding:5px 7px;font-size:11px;white-space:nowrap}
.a4 .bottom{display:grid;gap:12px;margin-top:24px}
.a4 .where{gap:14px}.a4 .where .ico{width:46px;height:46px}.a4 .where b{font-size:30px}.a4 .where span{font-size:21px}
.a4 .partners h3{font-size:15px;margin-bottom:10px}.a4 .chips{gap:6px}.a4 .chips span{padding:3px 11px;font-size:13.5px}.a4 .chips span em{margin-right:5px}
.a4 .foot{font-size:14px}

/* ===== social 4:5: 1080×1350 ===== */
.soc{width:1080px;height:1350px;padding:52px 60px}
.soc .top .logo{height:116px;padding:10px 14px;border-radius:22px}
.soc .date{width:138px;height:138px;align-content:center;gap:2px;border-radius:22px}.soc .date small{font-size:18px}.soc .date b{font-size:62px}.soc .date span{font-size:18px}
.soc .kick{margin-top:30px;padding:8px 18px;font-size:16px}
.soc h1{margin-top:14px;font-size:118px}.soc h1 .l3{font-size:94px;margin-top:6px}
.soc .globe{right:-380px;top:-50px;width:1200px;height:1200px}
.soc .geos{right:90px;top:370px;height:400px}
.soc .pp{right:320px;top:600px;width:240px;padding:13px 13px 11px;transform:rotate(-9deg)}
.soc .pp-h{padding-bottom:6px;margin-bottom:4px}.soc .pp-h b{font-size:13px}.soc .pp-h span{font-size:12px}
.soc .slot.empty i{font-size:14px}.soc .pp-bar{height:8px;margin-top:6px}
.soc .stamp .st-seal{box-shadow:0 0 0 1.5px var(--paper),0 0 0 3px var(--ink)}
.soc .tk{right:24px;top:690px;width:190px;padding:14px 12px 12px;transform:rotate(10deg)}
.soc .tk-top small{font-size:10px}.soc .tk-top b{font-size:26px}.soc .tk-mid{padding:6px 0 10px}.soc .tk-mid .stamp{width:112px}.soc .tk-bot{padding-top:10px;font-size:13px}
.soc .tk-cut:before,.soc .tk-cut:after{width:26px;height:26px;top:-14px}
.soc .s1{right:520px;top:500px;width:38px}.soc .s2{right:40px;top:330px;width:28px}.soc .s3{right:250px;top:870px;width:24px}
.soc .lede{margin:18px 0 0;font-size:24px;line-height:1.5;color:rgba(233,246,248,.9);max-width:430px}.soc .lede b{color:#fff}
.soc .row{position:absolute;left:60px;right:60px;bottom:52px;display:grid;grid-template-columns:1.2fr 1fr;gap:22px;align-items:stretch}
.soc .prizes{padding:16px 6px 12px 20px;grid-template-columns:206px 1fr}.soc .pz-copy small{font-size:10.5px;margin-bottom:4px}.soc .prizes h2{font-size:28px}.soc .pz-copy p{font-size:17px}.soc .pz-note{font-size:10px}
.soc .pile{width:112%;margin:-70px -8% -6px -2%}
.soc .qrb{padding:18px;gap:16px}.soc .qr{width:170px;height:170px;flex:none}
.soc .qrt small{font-size:11px}.soc .qrt b{font-size:40px;margin:2px 0}.soc .qrt span{font-size:17px}.soc .qrt code{margin-top:8px;padding:4px 6px;font-size:10.5px;white-space:nowrap}
.soc .where{position:absolute;left:60px;bottom:380px;gap:12px}.soc .where .ico{width:40px;height:40px}.soc .where b{font-size:26px}.soc .where span{font-size:18px}

/* ===== story 9:16: 1080×1920 ===== */
.sto{width:1080px;height:1920px;padding:90px 70px}
.sto .top .logo{height:130px;padding:10px 16px;border-radius:24px}
.sto .date{width:150px;height:150px;align-content:center;gap:2px}.sto .date small{font-size:20px}.sto .date b{font-size:68px}.sto .date span{font-size:20px}
.sto .kick{margin-top:50px;padding:10px 20px;font-size:18px}
.sto h1{margin-top:18px;font-size:150px;text-align:left}.sto h1 .l3{font-size:118px;margin-top:8px}
.sto .globe{left:50%;margin-left:-680px;top:400px;width:1360px;height:1360px}
.sto .geos{left:50%;margin-left:-70px;top:840px;height:390px}
.sto .pp{left:44px;top:900px;width:270px;padding:14px 14px 12px;transform:rotate(-10deg)}
.sto .pp-h{padding-bottom:7px;margin-bottom:5px}.sto .pp-h b{font-size:14px}.sto .pp-h span{font-size:13px}
.sto .slot.empty i{font-size:15px}.sto .pp-bar{height:9px;margin-top:7px}
.sto .stamp .st-seal{box-shadow:0 0 0 2px var(--paper),0 0 0 3px var(--ink)}
.sto .tk{right:36px;top:880px;width:210px;padding:16px 14px 14px;transform:rotate(10deg)}
.sto .tk-top small{font-size:11px}.sto .tk-top b{font-size:28px}.sto .tk-mid{padding:6px 0 10px}.sto .tk-mid .stamp{width:124px}.sto .tk-bot{padding-top:10px;font-size:14px}
.sto .s1{left:360px;top:1190px;width:40px}.sto .s2{right:110px;top:780px;width:32px}.sto .s3{right:330px;top:1180px;width:26px}
.sto .where{margin-top:30px;gap:12px}.sto .where .ico{width:44px;height:44px}.sto .where b{font-size:30px}.sto .where span{font-size:20px}
.sto .qrb{position:absolute;left:70px;right:70px;bottom:120px;padding:24px;gap:24px}.sto .qr{width:220px;height:220px;flex:none}
.sto .qrt small{font-size:14px}.sto .qrt b{font-size:60px;margin:4px 0}.sto .qrt span{font-size:22px}.sto .qrt code{margin-top:12px;padding:6px 8px;font-size:13px;white-space:nowrap}
.sto .prizes{position:absolute;left:70px;right:70px;bottom:420px;padding:22px 14px 18px 34px;grid-template-columns:372px 1fr}.sto .pz-copy small{font-size:14px;margin-bottom:6px}.sto .prizes h2{font-size:52px}.sto .pz-copy p{font-size:27px}.sto .pz-note{font-size:13px}
.sto .pile{width:110%;margin:-80px -4% -8px -4%}
`;

const spark = (cls) => `<svg class="spark ${cls}" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12z"/></svg>`;
const hero = (dots, size) => `<canvas class="globe" data-dots="${dots}" data-size="${size}"></canvas>
  <img class="geos" src="assets-src/geos-hd.png" alt="">${passport()}${ticket()}${spark("s1")}${spark("s2")}${spark("s3")}`;
const lede = `ร่วมกิจกรรมภูมิศาสตร์และภูมิสารสนเทศ<br>สะสม<b>ตราน้องจีออส</b>ให้ครบ แล้วลุ้น<br><b>เครื่องใช้ไฟฟ้า</b>และของรางวัลอีกมากมาย!`;

const pages = {
  a4: `<div class="poster a4">${sky}${hero(5200, 0.3)}${head()}
    <div class="kick"><i></i>GEO PASSPORT · STAMP RALLY</div>${title}<p class="lede">${lede}</p>${where}
    <div class="steps">${stepsHTML}</div>
    <div class="duo">${prizeBox()}${qrBlock()}</div>
    <div class="bottom">
      <div class="partners"><h3>${B.length} บูธกิจกรรมจากหน่วยงานชั้นนำ</h3><div class="chips">${B.map((b) => `<span><em>${String(b.no).padStart(2, "0")}</em>${b.th}</span>`).join("")}</div></div>
      <div class="foot">${EVENT.title}</div></div></div>`,
  soc: `<div class="poster soc">${sky}${hero(4600, 0.3)}${head()}
    <div class="kick"><i></i>GEO PASSPORT · STAMP RALLY</div>${title}<p class="lede">${lede}</p>${where}
    <div class="row">${prizeBox()}${qrBlock()}</div></div>`,
  sto: `<div class="poster sto">${sky}${hero(5000, 0.3)}${head()}
    <div class="kick"><i></i>GEO PASSPORT · STAMP RALLY</div>${title}${where}
    ${prizeBox("wide")}${qrBlock()}</div>`,
};

const doc = (inner, w, h) => `<!doctype html><html lang="th"><head><meta charset="utf-8"><base href="${pathToFileURL(root).href}">
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@500;700;800&family=Chakra+Petch:wght@700&family=IBM+Plex+Sans+Thai:wght@400;600&display=swap" rel="stylesheet">
<style>${css.replaceAll("url(assets/ink-grunge.webp)", `url(${dataUri("assets/ink-grunge.webp")})`).replaceAll("url(assets/geos-ink.webp)", `url(${dataUri("assets/geos-ink.webp")})`)}</style></head><body>${inner}<script>${globeJs}</script></body></html>`;

const tmp = root + "poster/_tmp.html";
const b = await chromium.launch();
const shots = [["a4", 1240, 1754, 2], ["soc", 1080, 1350, 2], ["sto", 1080, 1920, 1]];
for (const [k, w, h, dsf] of shots) {
  if (process.argv[2] && process.argv[2] !== k) continue;
  writeFileSync(tmp, doc(pages[k], w, h));
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: PRINT ? 5 : dsf, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto(pathToFileURL(tmp).href, { waitUntil: "networkidle" });
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
  const name = { a4: "poster-a4", soc: "poster-social", sto: "poster-story" }[k];
  if (PRINT) {
    mkdirSync(out + "print", { recursive: true });
    await p.screenshot({ path: out + `print/_${name}.png` });
    console.log(`poster/print/_${name}.png (${w * 5}×${h * 5})`);
    await ctx.close(); continue;
  }
  await p.screenshot({ path: out + name + ".png" });
  if (k === "a4") await p.pdf({ path: out + name + ".pdf", width: "210mm", height: "297mm", printBackground: true, pageRanges: "1", scale: 210 / 25.4 * 96 / w });
  const over = await p.evaluate((H) => [...document.querySelectorAll(".poster *")].filter((e) => !e.closest(".sky") && e.getBoundingClientRect().bottom > H).map((e) => e.className.baseVal ?? e.className).slice(0, 5), h);
  console.log("poster/" + name + ".png", over.length ? "OVERFLOW: " + over.join(", ") : "");
  await ctx.close();
}
await b.close();
rmSync(tmp);
