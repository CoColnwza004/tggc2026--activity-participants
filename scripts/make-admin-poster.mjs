// A4 poster for the admin site: QR to the admin URL, what it does, and (optionally) the admin password.
// The password is never stored in the repo: pass it at run time, and keep the printed sheet with the organisers.
//   ADMIN_PIN_PRINT=xxxx node scripts/make-admin-poster.mjs [out.pdf]
// Without ADMIN_PIN_PRINT the poster has an empty box to write the password in by hand.
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname } from "node:path";
import { EVENT } from "../shared/event.js";
import { icon } from "../shared/web/icons.js";
import { qrSvg } from "../shared/web/qr.js";
import { patternSvg } from "../shared/web/patterns.js";

let pw;
try { pw = await import("playwright"); }
catch { pw = await import(process.env.PLAYWRIGHT_PATH || "playwright"); }
const chromium = pw.chromium || pw.default.chromium;

const root = fileURLToPath(new URL("../", import.meta.url));
const outPdf = process.argv[2] || root + "poster/admin-poster.pdf";
mkdirSync(dirname(outPdf), { recursive: true });
const pin = String(process.env.ADMIN_PIN_PRINT || "").replace(/\D/g, "");
const url = EVENT.adminUrl;
const shortUrl = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
const qr = await qrSvg(url, { ecc: "Q", margin: 2, color: "#021b2e" });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const features = [
  ["pen", "แก้ข้อมูลบูธ", "ชื่อบูธ ชื่อบนตรา ตำแหน่ง ไอคอน รายละเอียด และอัปโหลดโลโก้ (เว็บผู้เข้าร่วม/เจ้าหน้าที่เปลี่ยนตามใน ~1 นาที)"],
  ["sparkle", "แดชบอร์ดสถิติ", "ผู้เปิดสมุด ตราแต่ละบูธ ตราตามช่วงเวลา จำนวนตราต่อคน โรงเรียนที่ร่วมมากสุด (อัปเดตทุก 30 วินาที)"],
  ["gift", "รายชื่อผู้ยื่นตั๋ว", "ตรวจชื่อที่จับได้จากกล่องว่ายื่นตั๋วจริง · ยกเลิกเมื่อสแกนผิดคน"],
  ["download", "ข้อมูลระบบ", "ดาวน์โหลด CSV (เปิดด้วย Excel) · ล้างข้อมูลทดสอบก่อนเริ่มงาน"],
];
const pinBoxes = pin
  ? pin.split("").map((d) => `<i>${d}</i>`).join("")
  : Array.from({ length: 8 }, () => "<i></i>").join("");

const css = `
:root{--navy:#075f98;--sea:#0a98c7;--teal:#15a8a0;--mint:#2cc394;--night:#021b2e;--gold:#ffd166;--ink:#0a2b42;--paper:#fbfdf9;
 --f-display:Kanit,sans-serif;--f-body:"IBM Plex Sans Thai",sans-serif;--f-tech:"Chakra Petch",Kanit,monospace}
*{box-sizing:border-box}html,body{margin:0}
body{font-family:var(--f-body);color:#fff;-webkit-font-smoothing:antialiased}
.poster{position:relative;width:1240px;height:1754px;overflow:hidden;padding:64px 72px 56px;display:flex;flex-direction:column;
 background:radial-gradient(110% 70% at 50% 30%,#0b5f93 0%,#063c62 45%,#021b2e 100%)}
.pat{position:absolute;inset:0;width:100%;height:100%;color:rgba(255,255,255,.13)}
.poster>*:not(.pat){position:relative}
.top{display:flex;align-items:center;justify-content:space-between}
.logo{height:118px;background:#fff;border-radius:24px;padding:10px 16px}
.badge{display:inline-flex;align-items:center;gap:12px;padding:12px 26px;border-radius:999px;background:#d93d4a;color:#fff;font-family:var(--f-tech);font-weight:700;font-size:26px;letter-spacing:.16em}
.badge .ico{width:30px;height:30px}
.kick{margin-top:46px;font-family:var(--f-tech);font-weight:700;font-size:26px;letter-spacing:.3em;color:#9ff3d4}
h1{margin:6px 0 0;font-family:var(--f-display);font-weight:800;font-size:104px;line-height:1.02}
h1 em{font-style:normal;background:linear-gradient(100deg,#7ff5cc,#2cc394 40%,#52d6ff);-webkit-background-clip:text;background-clip:text;color:transparent}
.lede{margin:14px 0 0;font-size:27px;line-height:1.5;color:rgba(233,246,248,.88)}
.main{display:grid;grid-template-columns:520px 1fr;gap:36px;margin-top:44px;align-items:stretch}
.qrc{display:grid;justify-items:center;padding:30px 30px 24px;border-radius:40px;background:#fff;color:var(--ink);box-shadow:0 0 0 10px rgba(255,255,255,.18),0 40px 80px -30px rgba(0,0,0,.6)}
.qr{width:440px;height:440px}.qr svg{display:block;width:100%;height:100%}
.qrc b{margin-top:14px;font-family:var(--f-display);font-weight:800;font-size:40px;color:var(--night)}
.qrc code{margin-top:8px;padding:6px 12px;border-radius:10px;background:#e6f6f0;color:#148e64;font-family:var(--f-tech);font-weight:700;font-size:17.5px;white-space:nowrap}
.login{display:flex;flex-direction:column;gap:18px}
.box{padding:26px 28px;border-radius:32px;background:rgba(2,27,46,.55);border:2px solid rgba(255,255,255,.22)}
.box small{display:block;font-family:var(--f-tech);font-weight:700;font-size:18px;letter-spacing:.2em;color:#9ff3d4}
.box small em{font-style:normal;font-family:var(--f-body);letter-spacing:0}
.box p{margin:8px 0 0;font-size:22px;line-height:1.45;color:rgba(255,255,255,.9)}
.pw{background:linear-gradient(150deg,#fff6d2,#f6d77a 45%,#e9b949);color:#2b1d00;border:0;box-shadow:0 0 0 6px rgba(255,209,102,.25),0 0 70px rgba(255,209,102,.3)}
.pw small{color:#7a5300}
.digits{display:flex;gap:10px;margin-top:14px}
.digits i{flex:1;height:96px;border-radius:18px;display:grid;place-items:center;background:#fff;font-style:normal;font-family:var(--f-tech);font-weight:700;font-size:62px;color:var(--night);box-shadow:inset 0 0 0 2px rgba(43,29,0,.18)}
.pw p{color:#4d3600;font-size:20px}
.steps{list-style:none;margin:14px 0 0;padding:0;display:grid;gap:10px;font-size:22px;line-height:1.4}
.steps li{display:flex;gap:12px;align-items:flex-start}
.steps li b{flex:none;width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:var(--mint);color:var(--night);font-family:var(--f-tech);font-size:21px}
.feat{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:34px}
.f{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:start;padding:22px;border-radius:28px;background:rgba(255,255,255,.08);border:1.5px solid rgba(167,213,219,.28)}
.f span{display:grid;place-items:center;width:60px;height:60px;border-radius:18px;background:linear-gradient(135deg,#0a98c7,#2cc394)}
.f span .ico{width:32px;height:32px;color:#fff}
.f b{display:block;font-family:var(--f-display);font-weight:700;font-size:28px;line-height:1.2}
.f p{margin:4px 0 0;font-size:19px;line-height:1.45;color:rgba(233,246,248,.85)}
.warn{display:flex;gap:16px;align-items:center;margin-top:auto;padding:20px 26px;border-radius:26px;background:#fdecee;color:#8a1c27;font-size:21px;line-height:1.45}
.warn .ico{flex:none;width:40px;height:40px;color:#d93d4a}
.warn b{font-family:var(--f-display)}
.foot{display:flex;justify-content:space-between;margin-top:16px;font-size:17px;color:rgba(255,255,255,.7)}
`;

const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><base href="${pathToFileURL(root).href}">
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@500;700;800&family=Chakra+Petch:wght@700&family=IBM+Plex+Sans+Thai:wght@400;600&display=swap" rel="stylesheet">
<style>${css}</style></head><body><div class="poster">
${patternSvg("contour", { w: 1240, h: 1754, u: 70, sw: 2, seed: 7 })}
<header class="top"><img class="logo" src="assets-src/logo-full.png" alt=""><span class="badge">${icon("lock")}ADMIN ONLY</span></header>
<div class="kick">TGGC 2026 · ADMIN</div>
<h1>เว็บ<em>แอดมิน</em><br>ระบบสะสมตรา</h1>
<p class="lede">จัดการบูธ ดูสถิติแบบสด และตรวจรายชื่อผู้ยื่นตั๋วลุ้นรางวัล · ใช้ได้ทั้งมือถือ ไอแพด และคอมพิวเตอร์</p>
<div class="main">
  <div class="qrc"><div class="qr">${qr}</div><b>สแกนเข้าเว็บแอดมิน</b><code>${esc(shortUrl)}</code></div>
  <div class="login">
    <div class="box pw"><small>PASSWORD <em>· รหัสผ่านแอดมิน</em></small><div class="digits">${pinBoxes}</div>
      <p>${pin ? "ใส่ในช่อง “PIN แอดมิน” หน้าเข้าสู่ระบบ" : "เขียนรหัสผ่านลงในช่อง (อย่าติดในที่สาธารณะ)"}</p></div>
    <div class="box"><small>HOW TO <em>· วิธีเข้าใช้</em></small>
      <ol class="steps"><li><b>1</b><span>สแกน QR หรือพิมพ์ลิงก์ด้านซ้าย</span></li><li><b>2</b><span>ใส่ชื่อผู้ดูแล และรหัสผ่าน</span></li><li><b>3</b><span>เลือกเมนู: ภาพรวม · บูธ · ผู้ยื่นตั๋ว · ข้อมูลระบบ</span></li></ol></div>
  </div>
</div>
<div class="feat">${features.map(([ic, t, d]) => `<div class="f"><span>${icon(ic)}</span><div><b>${t}</b><p>${d}</p></div></div>`).join("")}</div>
<div class="warn">${icon("lock")}<div><b>เอกสารสำหรับผู้ดูแลระบบเท่านั้น</b> · ห้ามติดในที่สาธารณะหรือถ่ายรูปส่งต่อ ใครมีรหัสนี้แก้ข้อมูลบูธและล้างข้อมูลทั้งหมดได้</div></div>
<div class="foot"><span>${esc(EVENT.short)} · ${esc(EVENT.dateText)}</span><span>${esc(EVENT.venue)}</span></div>
</div></body></html>`;

const tmpDir = dirname(outPdf);
const tmp = tmpDir + "/_admin-poster.html", png = tmpDir + "/_admin-poster.png";
writeFileSync(tmp, html);
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1240, height: 1754 }, deviceScaleFactor: 2 })).newPage();
await p.goto(pathToFileURL(tmp).href, { waitUntil: "networkidle" });
await p.evaluate(() => document.fonts.ready);
const over = await p.evaluate(() => { const P = document.querySelector(".poster").getBoundingClientRect(); return [...document.querySelectorAll(".poster > :not(.pat) *")].filter((e) => e.getBoundingClientRect().bottom > P.bottom - 20).length; });
await p.screenshot({ path: png });
await b.close();
execFileSync("python3", [root + "scripts/flat-pdf.py", png, outPdf, "210", "297", "90"], { stdio: "inherit" });
if (process.env.KEEP_PNG) execFileSync("cp", [png, outPdf.replace(/\.pdf$/, ".png")]);
rmSync(tmp); rmSync(png);
if (over) console.log("WARNING: content overflows the page");
