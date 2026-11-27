// Overlay frames for the livestream: transparent middle, glowing frame like the speaker cards, TGGC logo + LIVE,
// partner logos, event bar and the Facebook page. Leaves the bottom-left free for the lower thirds.
//   poster/live/frame/frame-full.png      logo, LIVE, partner logos, event bar, Facebook page
//   poster/live/frame/frame-minimal.png   frame, logo and LIVE only
//   poster/live/frame/preview.png         both over a sample shot, with a lower third on top
//   poster/live/canva/TGGC2026-frame.pptx editable in Canva (Create a design → Import file)
// Usage: node scripts/make-live-frame.mjs
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { layers, writePptx } from "./canva-layers.mjs";
import { root, live } from "./live-bars.mjs";

let pw;
try { pw = await import("playwright"); }
catch { pw = await import(process.env.PLAYWRIGHT_PATH || "playwright"); }
const chromium = pw.chromium || pw.default.chromium;

const out = live + "frame/";
mkdirSync(out, { recursive: true });
const uri = (f) => `data:image/png;base64,${readFileSync(root + f).toString("base64")}`;
const partners = ["02", "03", "04", "05", "06", "07", "08", "09", "10"]
  .map((n) => `<img data-img="poster/live/logos/${n}.png" src="${uri(`poster/live/logos/${n}.png`)}" alt="">`).join("");
const fb = `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="24" fill="#1877f2"/>
  <path fill="#fff" d="M26.6 38V26.4h3.9l.6-4.5h-4.5v-2.9c0-1.3.4-2.2 2.2-2.2h2.4v-4a32 32 0 0 0-3.5-.2c-3.5 0-5.8 2.1-5.8 6v3.3h-3.9v4.5h3.9V38z"/></svg>`;

const css = `
:root{--navy:#075f98;--sea:#0a98c7;--teal:#15a8a0;--mint:#2cc394;--deep:#063f6e;--glow:#3aa8ff}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1920px;height:1080px;overflow:hidden;background:transparent}
body{font-family:Kanit,sans-serif;color:#fff;-webkit-font-smoothing:antialiased}
.s{position:absolute;inset:0}
/* soft shade at the top so the logos read on any shot */
.shade{position:absolute;left:0;right:0;top:0;height:200px;background:linear-gradient(rgba(2,27,46,.45),rgba(2,27,46,0))}
.frame{position:absolute;inset:16px;border-radius:34px;border:3px solid rgba(143,212,255,.95);
  box-shadow:0 0 0 1px rgba(255,255,255,.3),0 0 22px rgba(58,168,255,.85),inset 0 0 22px rgba(58,168,255,.5)}
/* corner brackets */
.c{position:absolute;width:120px;height:120px;border:0 solid var(--mint);filter:drop-shadow(0 0 8px var(--mint))}
.c.tl{left:8px;top:8px;border-left-width:7px;border-top-width:7px;border-top-left-radius:40px}
.c.tr{right:8px;top:8px;border-right-width:7px;border-top-width:7px;border-top-right-radius:40px}
.c.bl{left:8px;bottom:8px;border-left-width:7px;border-bottom-width:7px;border-bottom-left-radius:40px}
.c.br{right:8px;bottom:8px;border-right-width:7px;border-bottom-width:7px;border-bottom-right-radius:40px}
.dash{position:absolute;height:5px;border-radius:5px;background:linear-gradient(90deg,var(--mint),#8fe9ff);box-shadow:0 0 10px var(--mint)}
.brand{position:absolute;left:52px;top:46px;display:flex;align-items:center;gap:18px}
.logo{background:#fff;border-radius:20px;padding:7px 12px;box-shadow:0 0 0 3px rgba(143,212,255,.9),0 0 18px rgba(58,168,255,.7),0 10px 24px rgba(0,0,0,.35)}
.logo img{display:block;height:74px}
.live{display:inline-flex;align-items:center;gap:12px;padding:10px 22px 10px 16px;border-radius:999px;font:700 24px/1 "Chakra Petch",Kanit,sans-serif;letter-spacing:.14em;
  background:rgba(2,27,46,.72);border:2px solid rgba(255,255,255,.28);box-shadow:0 0 18px rgba(255,59,92,.3)}
.live i{width:16px;height:16px;border-radius:50%;background:#ff3b5c;box-shadow:0 0 0 5px rgba(255,59,92,.28),0 0 14px #ff3b5c}
.live em{font-style:normal}
.live span{font-family:Kanit,sans-serif;letter-spacing:0;font-weight:500;color:#cfeaf5}
.partners{position:absolute;right:16px;top:16px;display:flex;align-items:center;gap:20px;padding:12px 30px 12px 34px;
  border-radius:0 30px 0 30px;background:linear-gradient(180deg,#fff,#f1f9ff);
  box-shadow:0 0 0 3px rgba(143,212,255,.95),0 0 20px rgba(58,168,255,.7),0 12px 26px rgba(0,0,0,.3)}
.partners img{height:58px;max-width:104px;object-fit:contain}
/* bottom tab, like the cards */
.bar{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);padding:9px 56px 11px;border-radius:24px 24px 0 0;white-space:nowrap;
  font:700 22px/1.2 "Chakra Petch",Kanit,sans-serif;letter-spacing:.04em;color:#fff;
  background:linear-gradient(95deg,var(--deep),var(--navy) 40%,var(--sea) 75%,var(--teal));
  box-shadow:0 0 0 3px rgba(143,212,255,.9),0 0 20px rgba(58,168,255,.7)}
.fb{position:absolute;right:16px;bottom:16px;display:flex;align-items:center;gap:12px;padding:9px 30px 9px 14px;border-radius:24px 0 30px 0;
  background:linear-gradient(180deg,#fff,#eef7ff);color:var(--deep);box-shadow:0 0 0 3px rgba(143,212,255,.95),0 0 20px rgba(58,168,255,.7)}
.fb svg{width:40px;height:40px;flex:none}
.fb small{display:block;font:700 13px/1 "Chakra Petch",Kanit,sans-serif;letter-spacing:.14em;color:#1877f2;text-transform:uppercase}
.fb b{display:block;margin-top:3px;font-size:22px;line-height:1.2;font-weight:700;color:#063f6e;white-space:nowrap}
`;

const html = (full) => `<!doctype html><html lang="th"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@500;700&family=Chakra+Petch:wght@700&display=swap" rel="stylesheet">
<style>${css}</style></head><body><div class="s">
  <div class="shade"></div><div class="frame"></div>
  <i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>
  <i class="dash" style="left:180px;top:13px;width:120px"></i><i class="dash" style="right:180px;bottom:13px;width:120px"></i>
  <div class="brand"><div class="logo"><img data-img="assets-src/logo-full.png" src="${uri("assets-src/logo-full.png")}" alt=""></div>
    <div class="live"><i></i><em data-t>LIVE</em> <span data-t>ถ่ายทอดสด</span></div></div>
  ${full ? `<div class="partners">${partners}</div>
  <div class="bar"><span data-t>The 3rd Thailand Geography Genius Challenge 2026 (TGGC2026)</span></div>
  <div class="fb">${fb}<div><small data-t>Facebook Live</small><b data-t>CPW - geolympiad</b></div></div>` : ""}
</div><script>document.fonts.ready.then(() => setTimeout(() => (window.__ready = true), 300))</script></body></html>`;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const tmp = live + ".tmp.html", slides = [];
for (const [name, full] of [["frame-full", true], ["frame-minimal", false]]) {
  writeFileSync(tmp, html(full));
  const p = await ctx.newPage();
  await p.goto(pathToFileURL(tmp).href, { waitUntil: "networkidle" });
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  await p.screenshot({ path: out + name + ".png", omitBackground: true });
  slides.push({ name, ...(await layers(p, live + `.${name}-bg.png`, { transparent: true })) });
  await p.close();
  console.log(`frame/${name}.png`);
}
// preview: each frame over a plain stand-in for the camera with a speaker lower third on top
const png = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
const tile = (f) => `<div class="t" style="background-image:url(${png(live + "lower-third-01.png")}),url(${png(out + f)}),radial-gradient(70% 80% at 60% 40%,#55636f,#26313b 60%,#151c23)"></div>`;
writeFileSync(tmp, `<!doctype html><html><head><meta charset="utf-8"><style>*{margin:0}body{background:#021b2e;padding:20px;display:grid;gap:20px;width:1000px}
.t{aspect-ratio:16/9;background-size:100% 100%,100% 100%,100% 100%,cover;background-position:center;border-radius:8px}</style></head><body>${tile("frame-full.png")}${tile("frame-minimal.png")}</body></html>`);
const p = await ctx.newPage();
await p.setViewportSize({ width: 1000, height: 400 });
await p.goto(pathToFileURL(tmp).href);
await p.screenshot({ path: out + "preview.png", fullPage: true });
await b.close();
writePptx(slides, live + "canva/TGGC2026-frame.pptx", live + ".spec.json");
for (const f of [tmp, live + ".spec.json", ...slides.map((s) => s.bg)]) rmSync(f);
console.log("frame/preview.png");
