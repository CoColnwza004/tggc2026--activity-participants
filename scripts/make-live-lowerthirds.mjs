// Lower-third name bars for the livestream (speaker / guest names), same look as the speaker cards
// and the participant site: white glass card with the blue glow frame, Kanit, navy → sea → mint.
//   poster/live/lower-third-XX.png   1920×1080, transparent: drop on top of the video at 0,0 (OBS / vMix)
//   poster/live/cut/lower-third-XX.png  the bar alone, trimmed (to place by hand)
//   poster/live/preview.png          every bar over a sample frame, for checking
// Logos in poster/live/logos/XX.png were cut out of the speaker cards.
// Usage: node scripts/make-live-lowerthirds.mjs
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

let pw;
try { pw = await import("playwright"); }
catch { pw = await import(process.env.PLAYWRIGHT_PATH || "playwright"); }
const chromium = pw.chromium || pw.default.chromium;

const root = fileURLToPath(new URL("../", import.meta.url));
const out = root + "poster/live/";
mkdirSync(out + "cut", { recursive: true });

// name, then position lines (same order as the speaker cards)
const PEOPLE = [
  ["นายวิทยา แก้วมี", ["อธิบดีกรมชลประทาน"]],
  ["นางสาวนิตยา เทพอรุณรัตน์", ["ผู้อำนวยการโรงเรียนชลประทานวิทยา", "และประธานคณะกรรมการจัดการแข่งขันฯ"]],
  ["นายเทพพร อาจเวทย์", ["ผู้อำนวยการโรงเรียนโยธินบูรณะ"]],
  ["รองศาสตราจารย์ ดร.พรรณี ชีวินศิริวัฒน์", ["นายกสมาคมภูมิศาสตร์แห่งประเทศไทย", "และรองประธานสมาคมนักภูมิศาสตร์เอเชีย"]],
  ["พันเอก ดร.สมโภช ปัณฑวังกูร", ["กรมแผนที่ทหาร"]],
  ["นายรสุ สืบสหการ", ["ผู้อำนวยการวิทยาลัยการชลประทาน กรมชลประทาน", "สถาบันสมทบมหาวิทยาลัยเกษตรศาสตร์"]],
  ["นายชัยยะ พึ่งโพธิ์สภ", ["เลขาธิการสมาคมศิษย์เก่าวิศวกรรมชลประทาน", "ในพระบรมราชูปถัมภ์"]],
  ["นายอลงกต ปากาศ", ["สำนักงานพัฒนาเทคโนโลยีอวกาศและภูมิสารสนเทศ", "(องค์การมหาชน)"]],
  ["นางสาววิลาสลักษม์ วงศ์เยาว์ฟ้า", ["รองประธานฝ่ายสนับสนุนธุรกิจ", "บริษัท อีเอสอาร์ไอ (ประเทศไทย) จำกัด"]],
  ["นายธีรชาย ช่ำชอง", ["สมาคมการสำรวจและการแผนที่แห่งประเทศไทย"]],
  ["นายเลอศักดิ์ ริ้วตระกูลไพบูลย์", ["ผู้จัดการโรงเรียนชลประทานวิทยา"]],
];

const dataUri = (f) => `data:image/png;base64,${readFileSync(root + f).toString("base64")}`;
const mark = dataUri("assets-src/logo-mark.png");
const pad = (n) => String(n).padStart(2, "0");

const css = `
:root { --navy:#075f98; --sea:#0a98c7; --teal:#15a8a0; --mint:#2cc394; --deep:#063f6e; --ink:#0a2b42; --glow:#3aa8ff; --gold:#ffd166; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1920px; height: 1080px; background: transparent; overflow: hidden; }
body { font-family: "Kanit", "Noto Sans Thai", sans-serif; position: relative; }
.stage { position: absolute; inset: 0; }
.lt { position: absolute; left: 96px; bottom: 72px; display: flex; align-items: flex-end; }

/* logo badge */
.badge { position: relative; z-index: 2; width: 176px; height: 176px; flex: none; margin-right: -26px; margin-bottom: 10px;
  border-radius: 34px; padding: 4px; background: linear-gradient(140deg, #8fd4ff, var(--glow) 35%, var(--mint) 100%);
  box-shadow: 0 0 0 1px rgba(255,255,255,.6), 0 0 26px rgba(58,168,255,.75), 0 14px 34px rgba(4,44,74,.35); }
.badge .in { width: 100%; height: 100%; border-radius: 30px; background: radial-gradient(circle at 50% 35%, #fff 55%, #eef7ff);
  display: grid; place-items: center; padding: 16px; box-shadow: inset 0 0 18px rgba(58,168,255,.25); }
.badge img { max-width: 100%; max-height: 100%; object-fit: contain; }
.badge.wide { width: 236px; }

/* card */
.card { position: relative; z-index: 1; min-width: 640px; border-radius: 26px; padding: 3px;
  background: linear-gradient(100deg, #a9dcff, var(--glow) 30%, #7fd0ff 60%, var(--mint));
  box-shadow: 0 0 0 1px rgba(255,255,255,.55), 0 0 30px rgba(58,168,255,.7), 0 18px 40px rgba(4,44,74,.35); }
.card .in { position: relative; overflow: hidden; border-radius: 23px; background: linear-gradient(180deg, #ffffff 0%, #f5fbff 100%); }
/* dotted globe, like the site */
.card .in::before { content: ""; position: absolute; right: -70px; top: -120px; width: 340px; height: 340px; border-radius: 50%;
  background: radial-gradient(circle, rgba(10,152,199,.22) 1.6px, transparent 2.2px) 0 0 / 13px 13px;
  -webkit-mask: radial-gradient(circle, #000 35%, transparent 70%); mask: radial-gradient(circle, #000 35%, transparent 70%); }
/* soft sun, like the cards */
.card .in::after { content: ""; position: absolute; left: 30px; top: -150px; width: 300px; height: 300px; border-radius: 50%;
  background: radial-gradient(circle, rgba(255,209,102,.32), rgba(255,209,102,0) 68%); }
.top { position: relative; z-index: 1; padding: 20px 48px 12px 60px; }
.tag { display: flex; align-items: center; gap: 10px; font: 700 17px/1 "Chakra Petch", "Kanit", sans-serif; letter-spacing: .18em;
  color: var(--teal); text-transform: uppercase; }
.tag img { width: 30px; height: 30px; }
.tag i { width: 7px; height: 7px; border-radius: 50%; background: var(--mint); box-shadow: 0 0 8px var(--mint); }
.name { margin-top: 6px; font-weight: 700; font-size: 62px; line-height: 1.32; color: var(--deep); white-space: nowrap; letter-spacing: .005em;
  background: linear-gradient(180deg, #0a5d9c, #063f6e); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.role { position: relative; z-index: 1; padding: 13px 48px 15px 60px; color: #fff; font-weight: 500; font-size: 30px; line-height: 1.42; white-space: nowrap;
  background: linear-gradient(95deg, var(--deep) 0%, var(--navy) 38%, var(--sea) 72%, var(--teal) 100%); }
.role::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 3px; background: linear-gradient(90deg, var(--mint), #8fe9ff 50%, var(--gold)); }
.role::after { content: ""; position: absolute; right: 22px; bottom: 14px; width: 54px; height: 10px;
  background: repeating-linear-gradient(115deg, rgba(255,255,255,.5) 0 4px, transparent 4px 10px); }
/* tech line off the end of the card, like the frame on the cards */
.wire { position: absolute; left: calc(100% + 14px); top: 44px; display: flex; align-items: center; gap: 10px; }
.wire b { width: 150px; height: 3px; border-radius: 3px; background: linear-gradient(90deg, var(--glow), rgba(58,168,255,0)); box-shadow: 0 0 8px rgba(58,168,255,.8); }
.wire i { width: 12px; height: 12px; border-radius: 50%; border: 3px solid #fff; background: var(--mint); box-shadow: 0 0 10px var(--mint); order: -1; }
`;

const fontLink = `<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@500;700&family=Chakra+Petch:wght@700&display=swap" rel="stylesheet">`;

const bar = ([name, roles], i) => {
  const logo = `poster/live/logos/${pad(i + 1)}.png`;
  const img = readFileSync(root + logo);
  const w = img.readUInt32BE(16), h = img.readUInt32BE(20);
  return `<div class="lt">
  <div class="badge${w / h > 1.5 ? " wide" : ""}"><div class="in"><img src="${dataUri(logo)}" alt=""></div></div>
  <div class="card"><div class="in">
    <div class="top"><div class="tag"><img src="${mark}" alt=""><span>TGGC 2026</span><i></i><span>The 3rd Thailand Geography Genius Challenge</span></div>
      <div class="name">${name}</div></div>
    <div class="role">${roles.join("<br>")}</div>
  </div><div class="wire"><b></b><i></i></div></div>
</div>`;
};

const page = (body, bg = "") => `<!doctype html><html lang="th"><head><meta charset="utf-8">${fontLink}<style>${css}${bg}</style></head>
<body><div class="stage">${body}</div><script>document.fonts.ready.then(() => setTimeout(() => (window.__ready = true), 300))</script></body></html>`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const tmp = out + ".tmp.html";
const shots = [];
for (const [i, p] of PEOPLE.entries()) {
  writeFileSync(tmp, page(bar(p, i)));
  const tab = await ctx.newPage();
  await tab.goto(pathToFileURL(tmp).href);
  await tab.waitForFunction(() => window.__ready, null, { timeout: 30000 });
  const f = `lower-third-${pad(i + 1)}.png`;
  await tab.screenshot({ path: out + f, omitBackground: true });
  // element only (trimmed, keeps the glow) for placing by hand
  const r = await tab.evaluate(() => { const a = document.querySelector(".lt").getBoundingClientRect(), b = document.querySelector(".wire").getBoundingClientRect();
    return { x: a.left, y: a.top, w: Math.max(a.right, b.right) - a.left, h: a.height }; });
  const m = 36, x = Math.max(0, Math.floor(r.x - m)), y = Math.max(0, Math.floor(r.y - m));
  await tab.screenshot({ path: out + "cut/" + f, omitBackground: true, clip: { x, y, width: Math.ceil(r.w + 2 * m), height: Math.min(1080 - y, Math.ceil(r.h + 2 * m)) } });
  await tab.close();
  shots.push(f);
  console.log(f, "·", p[0]);
}

// preview sheet: each bar over a sample frame (the speaker card art, dimmed)
const sample = `data:image/jpeg;base64,${readFileSync(root + "assets/og.jpg").toString("base64")}`;
const tiles = shots.map((f) => `<div class="t" style="background-image:url(data:image/png;base64,${readFileSync(out + f).toString("base64")}),linear-gradient(rgba(2,27,46,.45),rgba(2,27,46,.45)),url(${sample})"></div>`).join("");
writeFileSync(tmp, `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box} body{background:#021b2e;padding:24px;display:grid;grid-template-columns:repeat(3,616px);gap:20px;width:${616 * 3 + 40 + 48}px}
.t{aspect-ratio:16/9;background-size:100% 100%,100% 100%,cover;background-position:center;border-radius:10px}</style></head><body>${tiles}</body></html>`);
const tab = await ctx.newPage();
await tab.setViewportSize({ width: 616 * 3 + 88, height: 400 });
await tab.goto(pathToFileURL(tmp).href);
await tab.screenshot({ path: out + "preview.png", fullPage: true });
await browser.close();
rmSync(tmp);
console.log("preview.png");
