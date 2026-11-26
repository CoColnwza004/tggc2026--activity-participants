// Usage: node posters/source/guide.js  → posters/วิธีลงทะเบียน.png + .pdf
// One-page participant guide: real screenshots of the registration flow (against a stub backend) in 6 steps + tips.
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..'), PUB = ROOT + '/public', OUT = process.env.OUT || path.resolve(__dirname, '..');
const b64 = f => fs.readFileSync(f).toString('base64');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const URL_REG = 'https://tggc2569-register.pages.dev/?openExternalBrowser=1';
const app = fs.readFileSync(PUB + '/app.js', 'utf8');
const TOPO = app.slice(app.indexOf('  function makeNoise('), app.indexOf('  function paintCanvas('));

// static site + a stub /exec that answers like the real Apps Script
const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/exec')) { let b = ''; q.on('data', d => b += d); q.on('end', () => {
    const j = JSON.parse(b || '{}'); r.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
    r.end(JSON.stringify({ ok: true, id: j.id, no: 128 })); }); return; }
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  if (p === '/config.js') { r.writeHead(200, { 'content-type': 'text/javascript' });
    return r.end(fs.readFileSync(PUB + '/config.js', 'utf8').replace(/ENDPOINT:\s*"[^"]*"/, 'ENDPOINT: "http://localhost:8742/exec"')); }
  const f = path.join(PUB, p); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f));
}).listen(8742);

async function screens(br) {
  const c = await br.newContext({ ...devices['iPhone 13'] });
  const p = await c.newPage(), S = {};
  await p.addInitScript(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } } catch (e) {} });
  await p.goto('http://localhost:8742/#home'); await p.waitForTimeout(2600);
  S.home = await p.screenshot();
  await p.click('#dockHome a.btn'); await p.waitForTimeout(600);
  await p.check('input[value="นางสาว"]', { force: true });
  await p.fill('#first', 'กมลวรรณ'); await p.fill('#last', 'แผนที่ดี');
  await p.click('[data-fill="position"] >> text=ครู'); await p.fill('#phone', '0812345678');
  await p.evaluate(() => { document.activeElement && document.activeElement.blur(); scrollTo(0, 0); }); await p.waitForTimeout(400);
  S.s1 = await p.screenshot();
  await p.click('#nextBtn'); await p.waitForTimeout(600);
  await p.fill('#school', 'ชลประทานวิทยา'); await p.selectOption('#province', 'นนทบุรี'); await p.click('#affSuggest');
  await p.evaluate(() => { document.activeElement && document.activeElement.blur(); scrollTo(0, 0); }); await p.waitForTimeout(400);
  S.s2 = await p.screenshot();
  await p.click('#nextBtn'); await p.waitForTimeout(600);
  await p.evaluate(() => document.querySelector('#consentBox').scrollIntoView({ block: 'center' })); await p.click('#consentBox span'); await p.waitForTimeout(400);
  S.s3 = await p.screenshot();
  await p.click('#nextBtn'); await p.waitForTimeout(4200);
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
  S.ticket = await p.screenshot();
  S.pass = await p.getAttribute('#ticketImg', 'src');
  await c.close();
  for (const k in S) if (Buffer.isBuffer(S[k])) S[k] = 'data:image/png;base64,' + S[k].toString('base64');
  return S;
}

const I = {
  img: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 9"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/></svg>',
  browser: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/></svg>',
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  no: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg>',
};

function html(S) {
  const step = (n, img, title, text, cls) => `<li class="${cls || ''}"><div class="phone"><img src="${img}" alt=""></div><div class="cap"><i>${n}</i><b>${title}</b><small>${text}</small></div></li>`;
  return `<!doctype html><html lang="th"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&family=Chakra+Petch:wght@600;700&family=Kanit:wght@500;600;700;800&display=block" rel="stylesheet">
<style>
@page { margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
:root { --navy:#075f98; --sea:#0a98c7; --teal:#15a8a0; --mint:#2cc394; --green:#148e64; --mist:#a7d5db; --ink:#0a2b42; --deep:#04324f; --muted:#3f6577; --red:#c7343f;
  --fd:"Kanit",sans-serif; --fb:"IBM Plex Sans Thai",sans-serif; --ft:"Chakra Petch",monospace; }
html, body { width: 794px; height: 1123px; }
body { font-family: var(--fb); color: var(--ink); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.p { position: relative; width: 794px; height: 1123px; overflow: hidden; isolation: isolate; }
.layer { position: absolute; inset: 0; z-index: -1; }
canvas.layer { width: 794px; height: 1123px; }
.bg { background: radial-gradient(55% 28% at 92% 2%, #fff 0%, rgba(255,255,255,0) 70%), radial-gradient(70% 40% at 0% 50%, rgba(44,195,148,.13), transparent 70%),
  radial-gradient(70% 40% at 100% 80%, rgba(10,152,199,.12), transparent 70%), linear-gradient(180deg, #cdeaf2 0%, #e6f5f8 26%, #f3fbfa 60%, #e3f4ee 100%); }
.grid { background:
  url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='132' height='132'%3E%3Cpath d='M0 -6V6M-6 0H6M132 -6V6M126 0H138M0 126V138M-6 132H6M132 126V138M126 132H138' stroke='%23075f98' stroke-opacity='.26' stroke-width='1.3'/%3E%3C/svg%3E") 30px 24px / 132px 132px,
  repeating-linear-gradient(0deg, rgba(7,95,152,.05) 0 1px, transparent 1px 66px) 30px 24px, repeating-linear-gradient(90deg, rgba(7,95,152,.05) 0 1px, transparent 1px 66px) 30px 24px; }
.head { display: grid; grid-template-columns: 1fr auto; gap: 18px; align-items: center; padding: 26px 40px 0; }
.head .logo { height: 46px; display: block; }
.kick { display: inline-block; margin-top: 10px; padding: 4px 12px; border-radius: 999px; background: rgba(44,195,148,.16); border: 1px solid rgba(44,195,148,.45); color: var(--green); font-weight: 700; font-size: 12.5px; }
h1 { margin-top: 6px; font-family: var(--fd); font-weight: 800; font-size: 42px; line-height: 1.12; color: var(--navy); white-space: nowrap; }
h1 span { display: inline; }
h1 span { background: linear-gradient(100deg, var(--sea), var(--teal) 50%, var(--mint)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.sub { margin-top: 6px; font-size: 14px; color: var(--muted); }
.qr { background: #fff; border-radius: 20px; padding: 10px; text-align: center; box-shadow: 0 14px 34px rgba(7,95,152,.2); position: relative; }
.qr canvas { display: block; width: 124px; height: 124px; }
.qr b { display: block; margin-top: 5px; font-size: 11.5px; color: var(--navy); font-weight: 700; line-height: 1.25; }
.who { display: grid; grid-template-columns: 1fr 1.15fr; gap: 10px; margin: 20px 40px 0; }
.who > div { display: flex; gap: 9px; align-items: flex-start; padding: 10px 13px; border-radius: 14px; font-size: 12.3px; line-height: 1.5; }
.who .y { background: rgba(44,195,148,.12); border: 1px solid rgba(44,195,148,.35); }
.who .n { background: rgba(199,52,63,.06); border: 1px solid rgba(199,52,63,.22); }
.who span { flex: none; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; color: #fff; margin-top: 1px; }
.who .y span { background: var(--green); } .who .n span { background: var(--red); }
.who svg { width: 13px; height: 13px; }
.who b { display: block; font-size: 13.5px; }
.who strong { color: var(--red); }
.only { display: inline-block; margin: 10px 0 0 8px; padding: 4px 12px; border-radius: 999px; background: var(--red); color: #fff; font-weight: 700; font-size: 12.5px; vertical-align: top; } .who .y b { color: var(--green); } .who .n b { color: var(--red); }
.steps { list-style: none; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 30px 14px; margin: 26px 40px 0; }
.steps li { position: relative; display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 11px; align-items: center; }
.cap { min-width: 0; }
.phone { width: 112px; aspect-ratio: 390 / 664; padding: 5px; border-radius: 20px; background: linear-gradient(160deg, #0b3a5e, #021e30); box-shadow: 0 12px 26px rgba(4,50,79,.26); }
.phone img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; border-radius: 15px; }
li.pass .phone { background: linear-gradient(160deg, #1d2b35, #0b1419); }
li.pass .phone img { object-fit: contain; object-position: center; background: #0b1419; }
.cap i { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; font-style: normal; font-family: var(--ft); font-weight: 700; font-size: 14px; color: #fff; background: linear-gradient(135deg, var(--sea), var(--navy)); }
.steps li:nth-child(n+5) .cap i { background: linear-gradient(135deg, var(--mint), var(--green)); }
.cap > b { display: block; margin-top: 8px; font-family: var(--fd); font-weight: 700; font-size: 17px; white-space: nowrap; line-height: 1.2; color: var(--ink); }
.cap small { display: block; margin-top: 4px; font-size: 12.3px; line-height: 1.5; color: var(--muted); }
.cap small b { display: inline; margin: 0; font-family: var(--fb); font-size: inherit; color: var(--ink); font-weight: 700; }
h2 { margin: 34px 40px 12px; font-family: var(--fd); font-weight: 700; font-size: 19px; color: var(--navy); display: flex; align-items: center; gap: 10px; }
h2::after { content: ""; flex: 1; height: 1px; background: rgba(7,95,152,.18); }
.tips { list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 0 40px; }
.tips li { display: flex; gap: 10px; align-items: center; padding: 11px 14px; border-radius: 16px; background: rgba(255,255,255,.88); border: 1px solid #dcecef; }
.tips span { flex: none; width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; color: #fff; background: linear-gradient(135deg, var(--sea), var(--navy)); }
.tips li:nth-child(2) span { background: linear-gradient(135deg, #f0a43a, #c9801a); }
.tips li:nth-child(3) span { background: linear-gradient(135deg, var(--mint), var(--green)); }
.tips li:nth-child(4) span { background: linear-gradient(135deg, var(--teal), var(--navy)); }
.tips svg { width: 18px; height: 18px; }
.tips b { display: block; font-size: 14.5px; font-weight: 700; line-height: 1.3; }
.tips small { display: block; font-size: 12.5px; color: var(--muted); line-height: 1.4; }
.foot { position: absolute; left: 40px; right: 40px; bottom: 20px; display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid rgba(7,95,152,.16); font-size: 12px; color: var(--muted); font-weight: 600; }
.foot b { font-family: var(--fd); color: var(--navy); font-size: 14px; }
</style></head><body><div class="p">
  <div class="layer bg"></div><canvas class="layer" id="topo" width="4764" height="6738"></canvas><div class="layer grid"></div>
  <header class="head">
    <div>
      <img class="logo" src="data:image/png;base64,${b64(PUB + '/assets/logo-full.png')}" alt="">
      <span class="kick">คู่มือลงทะเบียน · TGGC2026</span><span class="only">สำหรับครูเท่านั้น</span>
      <h1>วิธีลงทะเบียน <span>รับบัตรเข้าร่วมงาน</span></h1>
      <p class="sub">ใช้เวลาไม่ถึง 1 นาที · ใช้มือถือเครื่องเดียว ไม่ต้องติดตั้งแอป</p>
    </div>
    <div class="qr"><canvas id="qr" width="1200" height="1200"></canvas><b>สแกนเพื่อ<br>เริ่มลงทะเบียน</b></div>
  </header>

  <div class="who">
    <div class="y"><span>${I.ok}</span><p><b>ผู้ที่ต้องลงทะเบียนล่วงหน้า</b>ครูผู้ฝึกสอนนักเรียนที่เข้าร่วมการแข่งขันตอบปัญหาทางด้านภูมิศาสตร์และภูมิสารสนเทศ</p></div>
    <div class="n"><span>${I.no}</span><p><b>ไม่ต้องลงทะเบียนผ่านระบบนี้</b><strong>นักเรียน</strong> ลงทะเบียนในวันงานที่ชั้น 3 อาคารหอประชุมชูชาติ กำภู 60 ปี (หน้าห้องประชุม) · ครูและนักเรียน TGGC : MapMatters 2026 ลงทะเบียนหน้างาน</p></div>
  </div>

  <ol class="steps">
    ${step(1, S.home, 'เปิดเว็บไซต์', 'สแกน QR มุมขวาบน แล้วกด <b>“ลงทะเบียนรับบัตร”</b>')}
    ${step(2, S.s1, 'ข้อมูลผู้เข้าร่วม', 'เลือกคำนำหน้า กรอก<b>ชื่อ-นามสกุล ตำแหน่ง</b> และ<b>เบอร์โทร</b> แล้วกด “ถัดไป”')}
    ${step(3, S.s2, 'หน่วยงาน', 'กรอก<b>ชื่อโรงเรียน</b> เลือก<b>จังหวัด</b> และ<b>สังกัด</b> แล้วกด “ถัดไป”')}
    ${step(4, S.s3, 'ตรวจสอบและยืนยัน', 'ตรวจข้อมูลที่จะพิมพ์บนบัตร ติ๊กยินยอม แล้วกด <b>“ยืนยันและออกบัตร”</b>')}
    ${step(5, S.ticket, 'บันทึกบัตร', 'กด <b>“บันทึกบัตรเป็นรูปภาพ”</b> หรือกดค้างที่บัตร เก็บไว้ในมือถือ')}
    ${step(6, S.pass, 'แสดงบัตรในวันงาน', 'แสดง QR บนบัตร ที่จุดรับของที่ระลึก <b>ชั้น 1 อาคาร 100 ปี ชูชาติอนุสรณ์</b>', 'pass')}
  </ol>

  <h2>รู้ไว้ช่วยได้</h2>
  <ul class="tips">
    <li><span>${I.img}</span><div><b>ลบรูปบัตรไปแล้ว?</b><small>เปิดเว็บเดิมบนมือถือเครื่องเดิม กดปุ่ม “บัตรของฉัน” ได้บัตรใบเดิมคืน</small></div></li>
    <li><span>${I.edit}</span><div><b>กรอกข้อมูลผิด?</b><small>ในหน้าบัตร กด “แก้ไขข้อมูลบัตร” แก้แล้วบัตรอัปเดตทันที (รหัสบัตรเดิม)</small></div></li>
    <li><span>${I.users}</span><div><b>ลงทะเบียนให้คนอื่น?</b><small>กด “ลงทะเบียนให้ผู้อื่น” ในหน้าบัตร · 1 คน ต่อ 1 บัตร</small></div></li>
    <li><span>${I.browser}</span><div><b>เปิดจาก LINE / Facebook?</b><small>ให้เปิดด้วย Safari หรือ Chrome เพื่อบันทึกรูปบัตรได้</small></div></li>
  </ul>

  <div class="foot"><span>TGGC2026 · โรงเรียนชลประทานวิทยา จังหวัดนนทบุรี</span><b>วันเสาร์ที่ 28 พฤศจิกายน 2569</b></div>
</div>
<script>${fs.readFileSync(PUB + '/vendor/qrcode.js', 'utf8')}</script>
<script>${fs.readFileSync(PUB + '/vendor/jsqr.min.js', 'utf8')}</script>
<script>
(function () {
${TOPO}
  var cv = document.getElementById('topo'), cx = cv.getContext('2d'); cx.scale(6, 6);
  drawTopo(cx, 794, 1123, { seed: 77, levels: 16, scale: 0.0019, cell: 12, minorAlpha: .55, lineWidth: 1.4, color: function (p) { return p < .5 ? "rgba(10,152,199,0.15)" : "rgba(20,142,100,0.16)"; } });
  var q = qrcode(0, 'M'); q.addData(${JSON.stringify(URL_REG)}); q.make();
  var n = q.getModuleCount(), c = document.getElementById('qr'), S = c.width, g = c.getContext('2d'), m = S / n;
  g.fillStyle = '#fff'; g.fillRect(0, 0, S, S); g.fillStyle = '#04324f';
  for (var r = 0; r < n; r++) for (var k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect(Math.floor(k * m), Math.floor(r * m), Math.ceil(m), Math.ceil(m));
  var h = jsQR(g.getImageData(0, 0, S, S).data, S, S); window.__qr = h ? h.data : 'FAIL';
})();
</script></body></html>`;
}

(async () => {
  const br = await chromium.launch();
  const S = await screens(br);
  const f = path.join(__dirname, 'guide.html'); fs.writeFileSync(f, html(S));
  const pg = await br.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: +(process.env.DSF || 3.125) });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + f); await pg.waitForFunction(() => window.__qr); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(500);
  // title on one line: shrink until it fits next to the QR card
  await pg.evaluate(() => { const h = document.querySelector('h1'), box = h.parentElement; let fs = 42; while (h.scrollWidth > box.clientWidth && fs > 26) h.style.fontSize = (fs -= 0.5) + 'px';
    for (const b of document.querySelectorAll('.cap > b')) { let z = 17; while (b.scrollWidth > b.clientWidth && z > 13) b.style.fontSize = (z -= 0.5) + 'px'; } });
  const over = await pg.evaluate(() => { const f = document.querySelector('.foot').getBoundingClientRect().top;
    return [...document.querySelectorAll('.tips, .steps, .who')].filter(e => e.getBoundingClientRect().bottom > f - 4).map(e => e.className + ':' + Math.round(e.getBoundingClientRect().bottom) + '>' + Math.round(f)); });
  const png = path.join(OUT, 'วิธีลงทะเบียน.png');
  await pg.screenshot({ path: png });
  if (!process.env.DSF) await pg.pdf({ path: path.join(OUT, 'วิธีลงทะเบียน-print.pdf'), width: (794 * 2 / 96) + 'in', height: (1123 * 2 / 96) + 'in', printBackground: true, scale: 2 });
  console.log('qr', await pg.evaluate(() => window.__qr), 'overlap', JSON.stringify(over), 'errors', JSON.stringify(errs), 'h1', await pg.evaluate(() => getComputedStyle(document.querySelector('h1')).fontSize));
  fs.unlinkSync(f); await br.close(); srv.close();
})();
