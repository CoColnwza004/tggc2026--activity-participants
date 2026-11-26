// Phone screenshots for the how-to signs (scripts/make-guide.mjs).
// Participant screens come from the local build in demo mode (no real data touched);
// staff screens come from the staff site with the live QR blurred. Nothing is written unless TICKET_ID is set:
// then that passport's ticket is opened at the prize counter and redeemed — use a local `wrangler dev` staff URL for that.
// Usage: npm run build && STAFF_PIN=… node scripts/guide-shots.mjs [staffUrl] [staffPin]
//        TICKET_ID=G…… STAFF_PIN=… node scripts/guide-shots.mjs http://localhost:8802/
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { EVENT } from "../shared/event.js";

let pw;
try { pw = await import("playwright"); } catch { pw = await import(process.env.PLAYWRIGHT_PATH || "playwright"); }
const chromium = pw.chromium || pw.default.chromium;

const root = fileURLToPath(new URL("../", import.meta.url));
const out = root + "poster/shots/";
mkdirSync(out, { recursive: true });
const staffUrl = process.argv[2] || "https://tggc2569-activity-staff.ktxcdd.workers.dev/";
const staffPin = process.argv[3] || process.env.STAFF_PIN;

// tiny static server for dist/participant
const dist = root + "dist/participant";
const types = { ".html": "text/html", ".js": "text/javascript", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml" };
const srv = createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, "http://x").pathname);
  if (p === "/") p = "/index.html";
  const f = join(dist, p);
  if (!f.startsWith(dist) || !existsSync(f)) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { "content-type": types[extname(f)] || "application/octet-stream" }); r.end(readFileSync(f));
}).listen(0);
const base = `http://localhost:${srv.address().port}/`;

let b = await chromium.launch();
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: "reduce" };
const wait = (p, ms) => p.waitForTimeout(ms);
// ---------------- staff (live site, read-only)
if (staffPin) {
  const s = await (await b.newContext(phone)).newPage();
  await s.goto(staffUrl, { waitUntil: "networkidle" });
  await s.fill("#lgName", "ครูสมชาย"); await s.fill("#lgPin", staffPin);
  await s.screenshot({ path: out + "s-login.png" });
  await s.click("#lgBtn"); await wait(s, 2000);
  await s.screenshot({ path: out + "s-home.png" });
  await s.goto(staffUrl + "#/s/b7"); await wait(s, 2500);
  // never print a live booth code: blur the QR and code before the screenshot
  await s.addStyleTag({ content: "#qrBox,#codeTxt{filter:blur(9px)!important} #countNum{visibility:hidden}" });
  await wait(s, 400);
  await s.screenshot({ path: out + "s-station.png" });
  await s.goto(staffUrl + "#/s/prize"); await wait(s, 2000);
  await s.addStyleTag({ content: "#countNum{visibility:hidden}" });
  await s.screenshot({ path: out + "s-prize.png" });
  if (process.env.TICKET_ID) {
    await s.fill("#tkId", process.env.TICKET_ID); await s.click("#tkForm button"); await wait(s, 1500);
    await s.screenshot({ path: out + "s-ticket.png" });
    await s.click("[data-redeem]"); await wait(s, 1800);
    await s.screenshot({ path: out + "s-slip.png" });
  }
  console.log("staff shots ok");
} else console.log("no STAFF_PIN: staff shots skipped");


// fake camera for the scanner screenshot: the (blurred) booth screen, as a looping y4m clip
async function makeFakeCam(png, dest) {
  const pg = await b.newPage();
  const data = "data:image/png;base64," + readFileSync(png).toString("base64");
  const b64 = await pg.evaluate(async (src) => {
    const W = 640, H = 480, img = new Image(); img.src = src; await img.decode();
    const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
    x.fillStyle = "#1b2a33"; x.fillRect(0, 0, W, H);
    const h = H * 0.98, w = (img.width / img.height) * h; // the tablet, upright, filling the frame
    x.fillStyle = "#0c0c0c"; x.beginPath(); x.roundRect((W - w) / 2 - 10, (H - h) / 2 - 2, w + 20, h + 4, 14); x.fill();
    x.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    const d = x.getImageData(0, 0, W, H).data, Y = new Uint8Array(W * H), U = new Uint8Array(W * H / 4), V = new Uint8Array(W * H / 4);
    for (let i = 0; i < W * H; i++) { const r = d[i * 4], g = d[i * 4 + 1], bb = d[i * 4 + 2]; Y[i] = 0.299 * r + 0.587 * g + 0.114 * bb; }
    for (let yy = 0; yy < H / 2; yy++) for (let xx = 0; xx < W / 2; xx++) {
      const i = (yy * 2 * W + xx * 2) * 4, r = d[i], g = d[i + 1], bb = d[i + 2];
      U[yy * W / 2 + xx] = 128 - 0.169 * r - 0.331 * g + 0.5 * bb; V[yy * W / 2 + xx] = 128 + 0.5 * r - 0.419 * g - 0.081 * bb;
    }
    const all = new Uint8Array(W * H * 1.5); all.set(Y); all.set(U, W * H); all.set(V, W * H * 1.25);
    let s = ""; for (let i = 0; i < all.length; i += 0x8000) s += String.fromCharCode(...all.subarray(i, i + 0x8000));
    return btoa(s);
  }, data);
  const frame = Buffer.concat([Buffer.from("FRAME\n"), Buffer.from(b64, "base64")]);
  writeFileSync(dest, Buffer.concat([Buffer.from("YUV4MPEG2 W640 H480 F15:1 Ip A1:1 C420jpeg\n"), ...Array(15).fill(frame)]));
  await pg.close();
}

const cam = root + "poster/shots/_cam.y4m";
if (existsSync(out + "s-station.png")) await makeFakeCam(out + "s-station.png", cam);
await b.close();
b = await chromium.launch(existsSync(cam) ? { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--use-file-for-fake-video-capture=" + cam] } : {});
const hideDemo = (p) => p.addStyleTag({ content: "#demoFlag{display:none!important}" });

// ---------------- participant (demo)
const ctx = await b.newContext({ ...phone, permissions: ["camera"] });
const p = await ctx.newPage();
await p.goto(base + "?demo=1#/join", { waitUntil: "networkidle" });
await hideDemo(p);
await p.fill("#jName", "ด.ญ.ภูมิ ใจดี");
await p.fill("#jSchool", "ชลประทานวิทยา");
await p.fill("#jPhone", "0812345678");
await wait(p, 300);
await p.screenshot({ path: out + "p-join.png" });
await p.click("#joinBtn");
await wait(p, 1500);

const setStamps = (n, redeem = null) => p.evaluate(([n, ids, redeem]) => {
  const D = JSON.parse(localStorage.getItem("tggc-demo-db"));
  D.stamps = {}; ids.slice(0, n).forEach((id, i) => (D.stamps[id] = Date.now() - (n - i) * 60e3));
  D.redeem = redeem; localStorage.setItem("tggc-demo-db", JSON.stringify(D));
}, [n, EVENT.booths.map((x) => x.id), redeem]);

// scanner → manual code → celebration
await setStamps(6);
await p.goto(base + "#/passport"); await p.reload({ waitUntil: "networkidle" }); await hideDemo(p); await wait(p, 1200);
await p.click("#scanFab"); await wait(p, 2500);
await p.screenshot({ path: out + "p-scan.png" });
await p.click("#scManualBtn"); await wait(p, 300);
await p.click('#scBooths [data-pick="b7"]'); await p.fill("#scCode", "482913"); await wait(p, 200);
await p.screenshot({ path: out + "p-code.png" });
await p.click("#scSubmit"); await wait(p, 1600);
await p.screenshot({ path: out + "p-stamp.png" });

// passport page with 7 stamps
await p.goto(base + "#/passport"); await p.reload({ waitUntil: "networkidle" }); await hideDemo(p); await wait(p, 1500);
await p.screenshot({ path: out + "p-passport.png" });

// all stamps → ticket
await setStamps(EVENT.booths.length);
await p.goto(base + "#/prize"); await p.reload({ waitUntil: "networkidle" }); await hideDemo(p); await wait(p, 1500);
await p.screenshot({ path: out + "p-ticket.png" });

// ticket scanned at the counter → next steps on the phone
await setStamps(EVENT.booths.length, { at: Date.now(), by: "ครูสมชาย" });
await p.reload({ waitUntil: "networkidle" }); await hideDemo(p); await wait(p, 3500);
await p.screenshot({ path: out + "p-result.png" });
await ctx.close();

await b.close();
srv.close();
if (existsSync(cam)) rmSync(cam);
console.log("poster/shots/");
