// How-to signs (A4, print): one for participants, one for staff.
//   poster/guide-participant.png + .pdf
//   poster/guide-staff.png + .pdf
// Screens come from poster/shots/ (make them first: node scripts/guide-shots.mjs).
// Usage: node scripts/make-guide.mjs
import { writeFileSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { EVENT, REQUIRED } from "../shared/event.js";
import { icon } from "../shared/web/icons.js";
import { qrSvg } from "../shared/web/qr.js";

let pw;
try { pw = await import("playwright"); } catch { pw = await import(process.env.PLAYWRIGHT_PATH || "playwright"); }
const chromium = pw.chromium || pw.default.chromium;

const root = fileURLToPath(new URL("../", import.meta.url));
const STAFF_URL = process.env.STAFF_URL || "https://tggc2569-activity-staff.ktxcdd.workers.dev/";
const bare = (u) => u.replace(/^https?:\/\//, "").replace(/\/$/, "");
const N = EVENT.booths.length;

const phone = (shot, cls = "") => `<div class="ph ${cls}"><img src="poster/shots/${shot}.png" alt=""><span class="eg">ตัวอย่าง</span></div>`;
const step = (n, shot, title, text) => `<div class="st"><span class="n">${n}</span>${phone(shot)}<b>${title}</b><p>${text}</p></div>`;
const tip = (ic, title, text) => `<div class="tp"><span class="ti">${icon(ic)}</span><div><b>${title}</b><p>${text}</p></div></div>`;
const btn = (t) => `<span class="ui">${t}</span>`;

const css = `
:root{--navy:#075f98;--sea:#0a98c7;--teal:#15a8a0;--mint:#2cc394;--green:#148e64;--mist:#a7d5db;--night:#021b2e;--gold:#ffd166;--ink:#0a2b42;--muted:#4d7083;--line:#dcecef;
 --f-display:Kanit,sans-serif;--f-body:"IBM Plex Sans Thai",sans-serif;--f-tech:"Chakra Petch",Kanit,monospace}
*{box-sizing:border-box}html,body{margin:0}
body{font-family:var(--f-body);color:var(--ink);-webkit-font-smoothing:antialiased}
.pg{position:relative;width:1240px;height:1754px;overflow:hidden;background:#eef7f8}
.pg:before{content:"";position:absolute;inset:0;background:radial-gradient(circle,#cfe6ea 1.4px,transparent 1.8px) 0 0/26px 26px;opacity:.7}
.hd{position:relative;display:flex;align-items:center;gap:30px;padding:46px 56px 44px;color:#fff;overflow:hidden;
 background:radial-gradient(120% 140% at 85% 0%,#0b5f93,#063c62 45%,#021b2e)}
.hd:after{content:"";position:absolute;right:-120px;bottom:-260px;width:620px;height:620px;border-radius:50%;
 background:radial-gradient(circle,rgba(95,240,191,.5) 1.6px,transparent 2px) 0 0/15px 15px;-webkit-mask:radial-gradient(circle,#000 30%,transparent 70%);opacity:.6}
.hd .logo{height:118px;background:#fff;border-radius:22px;padding:10px 14px;flex:none;position:relative;z-index:1}
.hd .tt{flex:1;position:relative;z-index:1}
.hd small{display:inline-flex;align-items:center;gap:8px;font-family:var(--f-tech);font-weight:700;letter-spacing:.2em;font-size:17px;color:#9ff3d4}
.hd small i{width:9px;height:9px;border-radius:50%;background:var(--mint);box-shadow:0 0 10px var(--mint)}
.hd h1{margin:6px 0 0;font-family:var(--f-display);font-weight:800;font-size:64px;line-height:1.05}
.hd h1 em{font-style:normal;background:linear-gradient(100deg,#7ff5cc,#2cc394 40%,#52d6ff);-webkit-background-clip:text;background-clip:text;color:transparent}
.hd p{margin:8px 0 0;font-size:21px;color:rgba(233,246,248,.88)}
.qr{position:relative;z-index:1;flex:none;display:grid;justify-items:center;gap:6px;padding:14px 14px 10px;border-radius:22px;background:#fff;color:var(--ink);box-shadow:0 0 0 5px rgba(44,195,148,.35),0 20px 40px -10px rgba(0,0,0,.5)}
.qr .q{width:150px;height:150px}.qr svg{display:block;width:100%;height:100%}
.qr b{font-family:var(--f-display);font-size:19px;color:var(--navy);line-height:1}
.qr code{font-family:var(--f-tech);font-weight:700;font-size:10.5px;color:var(--green)}
.bd{position:relative;padding:30px 56px 0}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
.st{position:relative;display:grid;justify-items:center;text-align:center;padding:26px 18px 20px;border-radius:26px;background:#fff;border:1.5px solid var(--line);box-shadow:0 1px 2px rgba(7,95,152,.06),0 12px 30px rgba(7,95,152,.1)}
.st .n{position:absolute;left:16px;top:14px;width:50px;height:50px;border-radius:50%;display:grid;place-items:center;font-family:var(--f-tech);font-weight:700;font-size:27px;color:#fff;
 background:radial-gradient(circle at 30% 30%,#2cc394,#15a8a0 50%,#075f98);box-shadow:0 6px 16px rgba(21,168,160,.45)}
.st b{display:block;margin-top:14px;font-family:var(--f-display);font-weight:700;font-size:25px;line-height:1.2;color:var(--navy)}
.st p{margin:6px 0 0;font-size:16.5px;line-height:1.5;color:var(--muted)}
.ui{display:inline-block;padding:0 9px;border-radius:8px;background:#e3f3f6;color:var(--navy);font-weight:700;white-space:nowrap}
.ph{position:relative;width:166px;aspect-ratio:390/844;border-radius:26px;padding:6px;background:#0a1d2a;box-shadow:0 16px 30px -10px rgba(2,27,46,.55),inset 0 0 0 1.5px #2c4656}
.ph img{display:block;width:100%;height:100%;border-radius:20px;object-fit:cover}
.ph:before{content:"";position:absolute;left:50%;top:10px;width:46px;height:6px;margin-left:-23px;border-radius:9px;background:#0a1d2a;z-index:1}
.eg{position:absolute;right:-12px;top:22px;padding:2px 9px;border-radius:8px;background:#fff3cd;color:#8a6100;font-size:11px;font-weight:700;transform:rotate(8deg);box-shadow:0 3px 8px rgba(0,0,0,.2)}
.tips{margin-top:24px;padding:22px 24px;border-radius:26px;background:#fff;border:1.5px solid var(--line)}
.tips h2{margin:0 0 12px;font-family:var(--f-display);font-size:24px;color:var(--navy)}
.tg{display:grid;grid-template-columns:1fr 1fr;gap:14px 26px}
.tp{display:flex;gap:12px;align-items:flex-start}
.ti{flex:none;width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:#e3f6ef;color:var(--green)}
.ti .ico{width:24px;height:24px}
.tp b{display:block;font-family:var(--f-display);font-weight:700;font-size:19px;line-height:1.25}
.tp p{margin:2px 0 0;font-size:15.5px;line-height:1.5;color:var(--muted)}
.ft{position:absolute;left:56px;right:56px;bottom:26px;display:flex;justify-content:space-between;font-size:14px;color:var(--muted)}
.ft b{font-family:var(--f-tech);letter-spacing:.12em;color:var(--teal)}
/* staff */
.sec{display:flex;align-items:center;gap:12px;margin:0 0 14px;font-family:var(--f-display);font-size:30px;font-weight:700;color:var(--navy)}
.sec .tag{font-family:var(--f-tech);font-size:14px;letter-spacing:.16em;color:#fff;background:var(--teal);border-radius:999px;padding:4px 12px}
.sec.gold .tag{background:#c9971c}
.g4{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
.flow{display:flex;align-items:stretch;gap:0;margin-top:4px}
.fl{flex:1;position:relative;display:grid;justify-items:center;align-content:start;gap:6px;text-align:center;padding:16px 10px 14px;background:#fff;border:1.5px solid var(--line);border-radius:20px}
.fl+.fl{margin-left:28px}.fl+.fl:before{content:"";position:absolute;left:-24px;top:50%;margin-top:-10px;border:10px solid transparent;border-left:14px solid #c9971c}
.fl .ti{background:#fff3d6;color:#a46f00}
.fl b{font-family:var(--f-display);font-size:18px;line-height:1.25;color:var(--ink)}
.fl small{font-size:13.5px;line-height:1.4;color:var(--muted)}
.g4 .ph{width:138px}.prize-row .ph{width:132px}
.prize-row{display:grid;grid-template-columns:150px 1fr;gap:24px;align-items:center;padding:22px;border-radius:26px;background:linear-gradient(140deg,#fff8e1,#fff);border:1.5px solid #f2d98a}
.warn{display:flex;gap:10px;align-items:center;margin-top:12px;padding:10px 14px;border-radius:14px;background:#fff0f1;color:#a5202c;font-weight:600;font-size:15.5px}
.warn .ico{width:22px;height:22px;flex:none}
`;

const head = (kick, title, sub, qrUrl, qrLabel) => async () => `<header class="hd"><img class="logo" src="assets-src/logo-full.png" alt="">
  <div class="tt"><small><i></i>${kick}</small><h1>${title}</h1><p>${sub}</p></div>
  <div class="qr"><div class="q">${await qrSvg(qrUrl, { ecc: "Q", margin: 1, color: "#021b2e" })}</div><b>${qrLabel}</b><code>${bare(qrUrl)}</code></div></header>`;

const participant = async () => `<div class="pg">${await head("HOW TO · GEO PASSPORT", `สะสมตรา<em>น้องจีออส</em><br>ง่าย ๆ 6 ขั้นตอน`, "ไม่ต้องโหลดแอป · ใช้มือถือเครื่องไหนก็ได้ · ฟรี", EVENT.participantUrl, "สแกนเริ่มเลย!")()}
  <div class="bd">
    <div class="grid">
      ${step(1, "p-join", "เปิดสมุดสะสมตรา", `สแกน QR มุมขวาบน กรอกชื่อ โรงเรียน<br>และเบอร์โทร แล้วกด ${btn("เปิดสมุดเลย!")}`)}
      ${step(2, "p-scan", "ร่วมกิจกรรม แล้วสแกน", `ทำกิจกรรมที่บูธ กดปุ่ม ${btn("สแกน")} ตรงกลาง<br>แล้วส่องกล้องไปที่ QR บนจอเจ้าหน้าที่`)}
      ${step(3, "p-stamp", "ได้ตราน้องจีออส!", `ตราประทับเด้งขึ้นทันที<br>กด ${btn("สแกนต่อ")} ไปบูธถัดไปได้เลย`)}
      ${step(4, "p-passport", "ดูตราที่สะสมได้", `เมนู ${btn("สมุดตรา")} บอกว่าได้ตราไหนแล้ว<br>และยังขาดอีกกี่บูธ`)}
      ${step(5, "p-ticket", `ครบ ${REQUIRED} ตรา รับตั๋ว`, `ไปที่เมนู ${btn("ลุ้นรางวัล")}<br>จะได้ตั๋วลุ้นรางวัลสีทองพร้อม QR`)}
      ${step(6, "p-result", "ยื่นตั๋ว ลุ้นรางวัล!", `ให้เจ้าหน้าที่${EVENT.prizePoint.th}สแกนตั๋ว<br>ผลจะขึ้นบนมือถือของคุณทันที`)}
    </div>
    <div class="tips"><h2>ติดปัญหา? ทำแบบนี้</h2><div class="tg">
      ${tip("keypad", "สแกน QR ที่บูธไม่ได้", `กด ${btn("พิมพ์รหัส 6 หลักแทน")} เลือกเลขบูธ แล้วพิมพ์รหัสบนจอเจ้าหน้าที่ หรือเปิด ${btn("QR ของฉัน")} ในสมุดตราให้เจ้าหน้าที่สแกนให้`)}
      ${tip("cloud", "อินเทอร์เน็ตหลุด", "สแกนต่อได้เลย ระบบจะเก็บตราไว้และส่งเข้าระบบเองเมื่อกลับมาออนไลน์ (ควรต่อเน็ตให้ได้ภายใน 10 นาที)")}
      ${tip("user", "เปลี่ยนมือถือ / เผลอลบข้อมูล", "เปิดสมุดใหม่ด้วยชื่อ-นามสกุลและเบอร์โทรเดิม ระบบจะดึงสมุดและตราเดิมคืนให้")}
      ${tip("gift", "ลุ้นรางวัลได้ 1 ครั้งต่อคน", `ต้องสะสมครบ ${REQUIRED} ตราก่อน · ตั๋ว 1 ใบลุ้นได้ครั้งเดียว · ของรางวัลมีจำนวนจำกัด`)}
    </div></div>
  </div>
  <div class="ft"><span>${EVENT.title}</span><b>${EVENT.short}</b></div></div>`;

const staff = async () => `<div class="pg">${await head("STAFF GUIDE · คู่มือเจ้าหน้าที่", `ระบบ<em>สะสมตรา</em> สำหรับเจ้าหน้าที่`, "ใช้มือถือหรือแท็บเล็ต เปิดเว็บเจ้าหน้าที่ แล้วทำตามขั้นตอนด้านล่าง", STAFF_URL, "เว็บเจ้าหน้าที่")()}
  <div class="bd">
    <h2 class="sec"><span class="tag">BOOTH</span>เจ้าหน้าที่ประจำบูธ</h2>
    <div class="g4">
      ${step(1, "s-login", "เข้าสู่ระบบ", `ใส่ชื่อเจ้าหน้าที่ และ PIN<br>ที่ได้รับแจ้ง แล้วกด ${btn("เข้าสู่ระบบ")}`)}
      ${step(2, "s-home", "เลือกบูธของคุณ", "แตะการ์ดบูธที่ประจำอยู่<br>(ดูหมายเลขบูธให้ถูกต้อง)")}
      ${step(3, "s-station", "ตั้งจอให้ผู้เข้าร่วมสแกน", `กดไอคอน ${btn("เต็มจอ")} มุมขวาบน · QR และรหัส<br>6 หลักเปลี่ยนเองทุก 30 วินาที`)}
    </div>
    <div class="tips" style="margin-top:20px"><div class="tg">
      ${tip("scan", "ผู้เข้าร่วมสแกนไม่ได้", `บอกรหัส 6 หลักบนจอให้พิมพ์ หรือกด ${btn("สแกนสมุดผู้เข้าร่วม")} แล้วสแกน "QR ของฉัน" จากมือถือผู้เข้าร่วม ระบบประทับตราให้ทันที`)}
      ${tip("cloud", "อินเทอร์เน็ตหลุด", "เปิดหน้าจอบูธค้างไว้ QR ยังเปลี่ยนต่อได้แม้ออฟไลน์ ผู้เข้าร่วมสแกนแล้วตราจะส่งเข้าระบบเองเมื่อกลับมาออนไลน์")}
    </div></div>

    <h2 class="sec gold" style="margin-top:26px"><span class="tag">PRIZE</span>${EVENT.prizePoint.th}</h2>
    <div class="prize-row">${phone("s-prize")}
      <div><div class="flow">
        <div class="fl"><span class="ti">${icon("camera")}</span><b>สแกนตั๋ว</b><small>เลือก "${EVENT.prizePoint.th}" แล้วกด ${btn("สแกนตั๋วลุ้นรางวัล")}</small></div>
        <div class="fl"><span class="ti">${icon("check")}</span><b>ตรวจสิทธิ์</b><small>ระบบบอกว่าครบ ${REQUIRED} ตราหรือยัง</small></div>
        <div class="fl"><span class="ti">${icon("sparkle")}</span><b>กดลุ้น</b><small>กด ${btn("กดลุ้นรางวัล")} ผลขึ้นทั้งสองจอ</small></div>
        <div class="fl"><span class="ti">${icon("gift")}</span><b>มอบของ</b><small>ได้รางวัล ส่งของแล้วกด ${btn("มอบรางวัลแล้ว")}</small></div>
      </div>
      <p style="margin:14px 2px 0;font-size:15.5px;line-height:1.55;color:var(--muted)">สแกนกล้องไม่ติด พิมพ์รหัสบนตั๋ว (เช่น G7K2M9Q) แทนได้ · ตั๋วที่ลุ้นแล้วสแกนซ้ำจะขึ้นผลเดิม พร้อมเวลาและชื่อเจ้าหน้าที่ที่มอบของ ลุ้นซ้ำไม่ได้</p></div>
    </div>

    <div class="tips"><h2>ข้อควรรู้</h2><div class="tg">
      ${tip("sparkle", "เตรียมเครื่องให้พร้อม", "เสียบสายชาร์จ ปรับความสว่างจอสูงสุด ปิดโหมดประหยัดพลังงาน ระบบจะพยายามกันจอดับให้")}
      ${tip("search", "ผู้เข้าร่วมถามว่าได้ตราไหนแล้ว", `ที่หน้าเลือกจุด กด ${btn("ตรวจสอบสมุดผู้เข้าร่วม")} แล้วสแกน QR ของเขา`)}
    </div>
    <div class="warn">${icon("lock")}ห้ามติด PIN ไว้บนป้ายหรือหน้าจอ และห้ามส่งต่อให้ผู้เข้าร่วม</div></div>
  </div>
  <div class="ft"><span>${EVENT.title}</span><b>${EVENT.short} · STAFF</b></div></div>`;

const doc = (inner) => `<!doctype html><html lang="th"><head><meta charset="utf-8"><base href="${pathToFileURL(root).href}">
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@500;700;800&family=Chakra+Petch:wght@700&family=IBM+Plex+Sans+Thai:wght@400;600;700&display=swap" rel="stylesheet">
<style>${css}</style></head><body>${inner}</body></html>`;

const tmp = root + "poster/_guide.html";
const b = await chromium.launch();
for (const [name, make] of [["guide-participant", participant], ["guide-staff", staff]]) {
  writeFileSync(tmp, doc(await make()));
  const ctx = await b.newContext({ viewport: { width: 1240, height: 1754 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(pathToFileURL(tmp).href, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  const over = await p.evaluate(() => [...document.querySelectorAll(".pg *")].filter((e) => e.getBoundingClientRect().bottom > 1754 - 50 && !e.closest(".ft")).map((e) => e.className).slice(0, 4));
  await p.screenshot({ path: root + `poster/${name}.png` });
  await p.pdf({ path: root + `poster/${name}.pdf`, width: "210mm", height: "297mm", printBackground: true, pageRanges: "1", scale: (210 / 25.4 * 96) / 1240 });
  console.log(`poster/${name}.png`, over.length ? "OVERFLOW " + over.join(",") : "");
  await ctx.close();
}
await b.close();
rmSync(tmp);
