// Shared look + renderer for the livestream lower thirds (speakers, MapMatters teams, awards):
// white glass card with the blue glow frame like the speaker cards, Kanit, navy → sea → mint like the site.
// renderSet() writes, for each bar: a 1920×1080 transparent PNG, a trimmed PNG in cut/, a preview sheet,
// and one Canva-editable .pptx with every bar as a slide (see canva-layers.mjs).
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { layers, writePptx } from "./canva-layers.mjs";

let pw;
try { pw = await import("playwright"); }
catch { pw = await import(process.env.PLAYWRIGHT_PATH || "playwright"); }
const chromium = pw.chromium || pw.default.chromium;

export const root = fileURLToPath(new URL("../", import.meta.url));
export const live = root + "poster/live/";
export const dataUri = (f) => `data:image/png;base64,${readFileSync(root + f).toString("base64")}`;
export const pad = (n) => String(n).padStart(2, "0");
export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const mark = dataUri("assets-src/logo-mark.png");

const css = `
:root { --navy:#075f98; --sea:#0a98c7; --teal:#15a8a0; --mint:#2cc394; --deep:#063f6e; --ink:#0a2b42; --glow:#3aa8ff; --gold:#ffd166; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1920px; height: 1080px; background: transparent; overflow: hidden; }
body { font-family: "Kanit", "Noto Sans Thai", sans-serif; position: relative; }
.stage { position: absolute; inset: 0; }
.lt { position: absolute; left: 96px; bottom: 72px; display: flex; align-items: flex-end; }

/* badge on the left: a logo, a team number or a medal */
.badge { position: relative; z-index: 2; width: 176px; height: 176px; flex: none; margin-right: -26px; margin-bottom: 10px;
  border-radius: 34px; padding: 4px; background: linear-gradient(140deg, #8fd4ff, var(--glow) 35%, var(--mint) 100%);
  box-shadow: 0 0 0 1px rgba(255,255,255,.6), 0 0 26px rgba(58,168,255,.75), 0 14px 34px rgba(4,44,74,.35); }
.badge .in { width: 100%; height: 100%; border-radius: 30px; background: radial-gradient(circle at 50% 35%, #fff 55%, #eef7ff);
  display: grid; place-items: center; padding: 16px; box-shadow: inset 0 0 18px rgba(58,168,255,.25); }
.badge img { max-width: 100%; max-height: 100%; object-fit: contain; }
.badge.wide { width: 236px; }
.badge.num .in { background: radial-gradient(circle at 30% 20%, #1a8fcf, #075f98 45%, #063f6e); display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 0; }
.badge.num small { font: 700 22px/1 "Chakra Petch", sans-serif; letter-spacing: .3em; margin-left: .3em; color: #8ff0c7; }
.badge.num b { font: 700 84px/1.05 "Chakra Petch", sans-serif; color: #fff; text-shadow: 0 0 18px rgba(143,233,255,.6); }
.badge.medal .in { padding: 0; }
.badge.medal svg { width: 128px; height: 128px; }

/* card */
.card { position: relative; z-index: 1; min-width: 640px; border-radius: 26px; padding: 3px;
  background: linear-gradient(100deg, #a9dcff, var(--glow) 30%, #7fd0ff 60%, var(--mint));
  box-shadow: 0 0 0 1px rgba(255,255,255,.55), 0 0 30px rgba(58,168,255,.7), 0 18px 40px rgba(4,44,74,.35); }
.card .in { position: relative; overflow: hidden; border-radius: 23px; background: linear-gradient(180deg, #ffffff 0%, #f5fbff 100%); }
.card .in::before { content: ""; position: absolute; right: -70px; top: -120px; width: 340px; height: 340px; border-radius: 50%;
  background: radial-gradient(circle, rgba(10,152,199,.22) 1.6px, transparent 2.2px) 0 0 / 13px 13px;
  -webkit-mask: radial-gradient(circle, #000 35%, transparent 70%); mask: radial-gradient(circle, #000 35%, transparent 70%); }
.card .in::after { content: ""; position: absolute; left: 30px; top: -150px; width: 300px; height: 300px; border-radius: 50%;
  background: radial-gradient(circle, rgba(255,209,102,.32), rgba(255,209,102,0) 68%); }
.top { position: relative; z-index: 1; padding: 20px 48px 12px 60px; }
.tag { display: flex; align-items: center; gap: 10px; font: 700 17px/1 "Chakra Petch", "Kanit", sans-serif; letter-spacing: .18em;
  color: var(--teal); text-transform: uppercase; white-space: nowrap; }
.tag img { width: 30px; height: 30px; }
.tag i { width: 7px; height: 7px; border-radius: 50%; background: var(--mint); box-shadow: 0 0 8px var(--mint); }
.award { display: flex; align-items: center; gap: 16px; margin: 2px 0 8px; }
.award b { padding: 6px 22px 8px; border-radius: 999px; font-size: 30px; line-height: 1.25; font-weight: 700; white-space: nowrap;
  color: #3b2600; background: linear-gradient(135deg, #ffe9a3, #ffd166 45%, #f0a925); box-shadow: 0 4px 14px rgba(240,169,37,.35), inset 0 1px 0 rgba(255,255,255,.7); }
.award.silver b { color: #1f3242; background: linear-gradient(135deg, #ffffff, #dbe5ee 45%, #a7b8c7); box-shadow: 0 4px 14px rgba(120,140,160,.35), inset 0 1px 0 #fff; }
.award.bronze b { color: #3d1d05; background: linear-gradient(135deg, #ffd8b0, #e8a56a 45%, #b8743f); box-shadow: 0 4px 14px rgba(184,116,63,.35), inset 0 1px 0 rgba(255,255,255,.6); }
.award.honor b { color: #fff; background: linear-gradient(135deg, #3fd6a6, #15a8a0 50%, #0a7fa8); box-shadow: 0 4px 14px rgba(21,168,160,.35), inset 0 1px 0 rgba(255,255,255,.4); }
.award span { font-size: 28px; font-weight: 500; color: var(--navy); white-space: nowrap; }
.name { margin-top: 6px; font-weight: 700; font-size: 62px; line-height: 1.32; color: var(--deep); white-space: nowrap; letter-spacing: .005em;
  background: linear-gradient(180deg, #0a5d9c, #063f6e); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.role { position: relative; z-index: 1; padding: 13px 104px 15px 60px; color: #fff; font-weight: 500; font-size: 30px; line-height: 1.42; white-space: nowrap;
  background: linear-gradient(95deg, var(--deep) 0%, var(--navy) 38%, var(--sea) 72%, var(--teal) 100%); }
.role::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 3px; background: linear-gradient(90deg, var(--mint), #8fe9ff 50%, var(--gold)); }
.role::after { content: ""; position: absolute; right: 22px; bottom: 14px; width: 54px; height: 10px;
  background: repeating-linear-gradient(115deg, rgba(255,255,255,.5) 0 4px, transparent 4px 10px); }
.wire { position: absolute; left: calc(100% + 14px); top: 44px; display: flex; align-items: center; gap: 10px; }
.wire b { width: 150px; height: 3px; border-radius: 3px; background: linear-gradient(90deg, var(--glow), rgba(58,168,255,0)); box-shadow: 0 0 8px rgba(58,168,255,.8); }
.wire i { width: 12px; height: 12px; border-radius: 50%; border: 3px solid #fff; background: var(--mint); box-shadow: 0 0 10px var(--mint); order: -1; }
`;

const fontLink = `<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@500;700&family=Chakra+Petch:wght@700&display=swap" rel="stylesheet">`;

// badge contents
export function logoBadge(file) {
  const img = readFileSync(root + file), w = img.readUInt32BE(16), h = img.readUInt32BE(20);
  return `<div class="badge${w / h > 1.5 ? " wide" : ""}"><div class="in"><img data-img="${file}" src="${dataUri(file)}" alt=""></div></div>`;
}
export const numBadge = (no) => `<div class="badge num"><div class="in"><small data-t>TEAM</small><b data-t>${pad(no)}</b></div></div>`;
const MEDAL = { gold: ["#fff4c2", "#ffd166", "#d9931a", "#7a4b00"], silver: ["#ffffff", "#dfe7ef", "#9fb0c0", "#3a4d5e"],
  bronze: ["#ffe1c2", "#e8a56a", "#a8642f", "#4a2408"], honor: ["#c9fbe9", "#3fd6a6", "#0f8f8a", "#03433f"],
  blue: ["#d6f1ff", "#5fc3f5", "#0a7fc0", "#032f56"] };
// navy tile with a white line icon (talks)
const ICONS = {
  mic: `<g fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><rect x="47" y="18" width="34" height="58" rx="17"/><path d="M34 60a30 30 0 0 0 60 0M64 90v18M48 108h32"/></g>`,
  pin: `<g fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M64 112s-34-30-34-56a34 34 0 0 1 68 0c0 26-34 56-34 56z"/><circle cx="64" cy="56" r="12"/></g>`,
};
export const iconBadge = (k) => `<div class="badge num"><div class="in"><svg viewBox="0 0 128 128" width="112" height="112" aria-hidden="true">${ICONS[k]}<circle cx="100" cy="24" r="6" fill="#8ff0c7"/></svg></div></div>`;

export function medalBadge(tier) {
  const [a, b, c, d] = MEDAL[tier];
  return `<div class="badge medal"><div class="in"><svg viewBox="0 0 128 128" aria-hidden="true">
    <defs><radialGradient id="m" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="${a}"/><stop offset=".5" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient></defs>
    <circle cx="64" cy="64" r="58" fill="url(#m)"/><circle cx="64" cy="64" r="49" fill="none" stroke="${a}" stroke-opacity=".8" stroke-width="3" stroke-dasharray="2 5"/>
    <g fill="${d}" opacity=".88"><path d="M44 34h40v8h12c0 14-7 22-17 24-3 6-8 9-11 10v10h10v8H50v-8h10V76c-3-1-8-4-11-10-10-2-17-10-17-24h12zm0 14h-5c1 7 4 11 7 13-1-4-2-8-2-13zm40 0c0 5-1 9-2 13 3-2 6-6 7-13z"/></g>
  </svg></div></div>`;
}

// one bar: badge + card (tag line, big name, optional award row: gold pill + note, strip lines)
export function card({ badge, tag, award, name, lines }) {
  const tagHtml = tag.map((t, i) => `${i ? "<i></i>" : ""}<span data-t>${esc(t)}</span>`).join("");
  const awardHtml = award ? `<div class="award ${award.tier || ""}"><b data-t>${esc(award.pill)}</b>${award.note ? `<span data-t>${esc(award.note)}</span>` : ""}</div>` : "";
  return `<div class="lt">${badge}
  <div class="card"><div class="in">
    <div class="top"><div class="tag"><img src="${mark}" alt="">${tagHtml}</div>
      <div class="name" data-t data-color="#075a96">${esc(name)}</div>${awardHtml}</div>
    <div class="role"><span data-t>${lines.map(esc).join("<br>")}</span></div>
  </div><div class="wire"><b></b><i></i></div></div>
</div>`;
}

// long names shrink to fit the frame (Team 23 has a whole sentence)
const fit = `const n = document.querySelector(".name"), c = document.querySelector(".card");
  for (let fs = 62; c.getBoundingClientRect().right > 1920 - 96 - 40 && fs > 34; fs -= 2) n.style.fontSize = fs + "px";`;
const page = (body) => `<!doctype html><html lang="th"><head><meta charset="utf-8">${fontLink}<style>${css}</style></head>
<body><div class="stage">${body}</div><script>document.fonts.ready.then(() => { ${fit} setTimeout(() => (window.__ready = true), 300); })</script></body></html>`;

// items: [{ file: "team-01.png", label, html }] → dir (under poster/live/), pptx file name
export async function renderSet(items, dir, pptxName) {
  const out = live + (dir ? dir + "/" : "");
  mkdirSync(out + "cut", { recursive: true });
  mkdirSync(live + "canva", { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const tmp = live + ".tmp.html", slides = [];
  for (const [i, it] of items.entries()) {
    writeFileSync(tmp, page(it.html));
    const tab = await ctx.newPage();
    await tab.goto(pathToFileURL(tmp).href);
    await tab.waitForFunction(() => window.__ready, null, { timeout: 30000 });
    await tab.screenshot({ path: out + it.file, omitBackground: true });
    const r = await tab.evaluate(() => { const a = document.querySelector(".lt").getBoundingClientRect(), b = document.querySelector(".wire").getBoundingClientRect();
      return { x: a.left, y: a.top, w: Math.min(1920, Math.max(a.right, b.right)) - a.left, h: a.height }; });
    const m = 36, x = Math.max(0, Math.floor(r.x - m)), y = Math.max(0, Math.floor(r.y - m));
    await tab.screenshot({ path: out + "cut/" + it.file, omitBackground: true,
      clip: { x, y, width: Math.min(1920 - x, Math.ceil(r.w + 2 * m)), height: Math.min(1080 - y, Math.ceil(r.h + 2 * m)) } });
    const bg = live + `.bg-${i}.png`;
    slides.push({ name: it.label, ...(await layers(tab, bg, { transparent: true })) });
    await tab.close();
    console.log((dir ? dir + "/" : "") + it.file, "·", it.label);
  }
  // preview sheet: every bar over a sample frame
  const sample = `data:image/jpeg;base64,${readFileSync(root + "assets/og.jpg").toString("base64")}`;
  const tiles = items.map((it) => `<div class="t" style="background-image:url(data:image/png;base64,${readFileSync(out + it.file).toString("base64")}),linear-gradient(rgba(2,27,46,.45),rgba(2,27,46,.45)),url(${sample})"></div>`).join("");
  writeFileSync(tmp, `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box} body{background:#021b2e;padding:24px;display:grid;grid-template-columns:repeat(3,616px);gap:20px;width:${616 * 3 + 40 + 48}px}
.t{aspect-ratio:16/9;background-size:100% 100%,100% 100%,cover;background-position:center;border-radius:10px}</style></head><body>${tiles}</body></html>`);
  const tab = await ctx.newPage();
  await tab.setViewportSize({ width: 616 * 3 + 88, height: 400 });
  await tab.goto(pathToFileURL(tmp).href);
  await tab.screenshot({ path: out + "preview.png", fullPage: true });
  await browser.close();
  writePptx(slides, live + "canva/" + pptxName, live + ".spec.json");
  for (const f of [tmp, live + ".spec.json", ...slides.map((s) => s.bg)]) rmSync(f);
  console.log((dir ? dir + "/" : "") + "preview.png");
}
