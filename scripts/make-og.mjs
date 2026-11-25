// Renders assets/og.jpg (1200×630 link preview for LINE / Facebook) with Playwright + Chromium.
// Usage: node scripts/make-og.mjs   (needs the `playwright` package and a Chromium it can launch)
import { writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

let chromium;
try { ({ chromium } = await import("playwright")); }
catch { ({ chromium } = await import(process.env.PLAYWRIGHT_PATH || "playwright")); }

const root = fileURLToPath(new URL("../", import.meta.url));
const a = (f) => pathToFileURL(root + "assets/" + f).href;
const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@600;800&family=Chakra+Petch:wght@700&display=swap" rel="stylesheet">
<style>
body{margin:0;width:1200px;height:630px;overflow:hidden;font-family:Kanit,sans-serif;color:#fff;
 background:radial-gradient(90% 90% at 75% 20%,#0b5f93,#063c62 45%,#021b2e)}
.g{position:absolute;right:40px;top:-60px;width:620px;height:620px;border-radius:50%;
 background:radial-gradient(circle at 35% 30%,#1b8fcf,#06446f 60%,#042c4a);box-shadow:0 0 120px rgba(44,195,148,.45)}
.g:after{content:"";position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,rgba(95,240,191,.55) 1.6px,transparent 2px) 0 0/16px 16px;
 -webkit-mask:radial-gradient(circle at 40% 45%,#000 30%,transparent 72%)}
.ring{position:absolute;right:-40px;top:150px;width:820px;height:200px;border:2px solid rgba(167,213,219,.5);border-radius:50%;transform:rotate(-20deg)}
.m{position:absolute;right:60px;bottom:-40px;height:560px;filter:drop-shadow(0 20px 40px rgba(0,0,0,.45))}
.logo{position:absolute;left:60px;top:50px;height:120px;background:#fff;border-radius:22px;padding:10px 16px}
.t{position:absolute;left:64px;top:210px}
.t b{display:block;font-weight:800;font-size:94px;line-height:1.02}
.t b:nth-child(2){background:linear-gradient(100deg,#7ff5cc,#2cc394 40%,#52d6ff);-webkit-background-clip:text;color:transparent}
.t b:nth-child(3){color:#a7d5db;font-size:72px}
.d{position:absolute;left:64px;bottom:44px;font-family:'Chakra Petch';font-size:26px;letter-spacing:.06em;color:#9ff3d4}
</style></head><body><div class="g"></div><div class="ring"></div>
<img class="logo" src="${a("logo-full.webp")}"><img class="m" src="${a("geos.webp")}">
<div class="t"><b>ตะลุยบูธ</b><b>สะสมตรา</b><b>ลุ้นรางวัล!</b></div>
<div class="d">TGGC 2026 · 28.11.2569 · CHONPRATHAN WITTAYA</div></body></html>`;
const tmp = root + "assets/_og.html";
writeFileSync(tmp, html);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.goto(pathToFileURL(tmp).href, { waitUntil: "networkidle" });
await p.waitForTimeout(500);
await p.screenshot({ path: root + "assets/og.jpg", type: "jpeg", quality: 84 });
await b.close();
(await import("node:fs")).unlinkSync(tmp);
console.log("assets/og.jpg");
