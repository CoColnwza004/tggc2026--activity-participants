// Usage: node posters/source/promo-long.js  → posters/ประชาสัมพันธ์การลงทะเบียน-แบบยาว.png + .pdf (earlier long-text version)
// A4 announcement poster (text supplied by the organisers), same look as the registration site.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..'), PUB = ROOT + '/public', OUT = process.env.OUT || path.resolve(__dirname, '..');
const b64 = f => fs.readFileSync(f).toString('base64');
const URL_REG = 'https://tggc2569-register.pages.dev/?openExternalBrowser=1';
const app = fs.readFileSync(PUB + '/app.js', 'utf8');
const TOPO = app.slice(app.indexOf('  function makeNoise('), app.indexOf('  function paintCanvas('));
const LAND = fs.readFileSync(__dirname + '/landscape.svg', 'utf8').replace('class="landscape"', 'class="land" preserveAspectRatio="xMidYMax slice"');
const LOGO_FULL = 'data:image/png;base64,' + b64(PUB + '/assets/logo-full.png');
const LOGO_MARK = 'data:image/png;base64,' + b64(PUB + '/assets/logo-mark.png');
const TICKET = 'data:image/jpeg;base64,' + b64(__dirname + '/t0.jpg');

const I = {
  mega: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v3M8 20h8M9 17h6"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.6"/></svg>',
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  no: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18"/></svg>',
};

const HTML = `<!doctype html><html lang="th"><head><meta charset="utf-8">
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
.bg { background:
  radial-gradient(55% 30% at 90% 3%, #fff 0%, rgba(255,255,255,0) 70%),
  radial-gradient(70% 40% at 0% 45%, rgba(44,195,148,.15), transparent 70%),
  radial-gradient(70% 40% at 100% 66%, rgba(10,152,199,.13), transparent 70%),
  linear-gradient(180deg, #cdeaf2 0%, #e4f4f7 30%, #f2faf9 62%, #e3f4ee 100%); }
.grid { background:
  url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='132' height='132'%3E%3Cpath d='M0 -6V6M-6 0H6M132 -6V6M126 0H138M0 126V138M-6 132H6M132 126V138M126 132H138' stroke='%23075f98' stroke-opacity='.28' stroke-width='1.3'/%3E%3C/svg%3E") 30px 24px / 132px 132px,
  repeating-linear-gradient(0deg, rgba(7,95,152,.055) 0 1px, transparent 1px 66px) 30px 24px,
  repeating-linear-gradient(90deg, rgba(7,95,152,.055) 0 1px, transparent 1px 66px) 30px 24px; }
.sun { position: absolute; right: 64px; top: 96px; width: 104px; height: 104px; border-radius: 50%; z-index: -1;
  background: radial-gradient(circle, #fff 0 44%, rgba(255,255,255,.6) 46%, rgba(44,195,148,.14) 70%, rgba(44,195,148,0) 72%); }
.coord { position: absolute; font-family: var(--ft); font-size: 8px; font-weight: 600; letter-spacing: .26em; white-space: nowrap; color: rgba(7,95,152,.36); }
.coord.l { left: 11px; top: 50%; transform-origin: 0 0; transform: rotate(-90deg) translate(-50%, 0); }
.coord.r { right: 11px; top: 50%; transform-origin: 100% 0; transform: rotate(90deg) translate(50%, 0); }
.wrap { padding: 0 40px; }
.top { display: flex; align-items: center; justify-content: space-between; padding: 26px 40px 0; }
.top img { height: 52px; }
.top .date { text-align: right; font-family: var(--ft); line-height: 1.05; }
.top .date b { display: block; font-size: 26px; color: var(--navy); }
.top .date span { font-size: 9.5px; font-weight: 700; letter-spacing: .24em; color: var(--green); }
.kicker { display: inline-flex; align-items: center; gap: 7px; margin-top: 12px; padding: 5px 13px 5px 6px; border-radius: 999px;
  background: rgba(44,195,148,.16); border: 1px solid rgba(44,195,148,.45); color: var(--green); font-weight: 700; font-size: 13px; }
.kicker span { width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; background: var(--green); color: #fff; }
.kicker svg { width: 15px; height: 15px; }
h1 { margin-top: 6px; font-family: var(--fd); font-weight: 800; line-height: 1.04; color: var(--navy); }
h1 .a { display: block; font-size: 52px; background: linear-gradient(100deg, var(--navy) 0%, var(--sea) 55%, var(--teal) 100%); -webkit-background-clip: text; background-clip: text; color: transparent; padding-bottom: 2px; }
h1 .b { display: block; font-size: 27px; font-weight: 700; color: var(--ink); }
h1 .b em { font-style: normal; background: linear-gradient(100deg, var(--teal), var(--mint)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.ev { margin-top: 10px; padding-left: 12px; border-left: 4px solid var(--mint); }
.ev p { font-size: 13.5px; line-height: 1.5; color: var(--muted); }
.ev b { display: block; margin-top: 1px; font-family: var(--ft); font-size: 15.5px; letter-spacing: .01em; color: var(--deep); }
.facts { display: grid; grid-template-columns: 1.35fr auto auto; gap: 8px; margin-top: 12px; }
.fact { display: flex; align-items: center; gap: 8px; padding: 8px 12px 8px 8px; border-radius: 14px; background: rgba(255,255,255,.86); border: 1px solid #d6ebef; box-shadow: 0 6px 16px rgba(7,95,152,.07); font-size: 12.5px; font-weight: 600; line-height: 1.35; }
.fact span { flex: none; width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center; color: #fff; background: linear-gradient(135deg, var(--sea), var(--navy)); }
.fact.tr span { background: linear-gradient(135deg, #e8b84a, #c48a12); }
.fact.pl span { background: linear-gradient(135deg, var(--mint), var(--green)); }
.fact svg { width: 17px; height: 17px; }
.intro { margin-top: 14px; font-size: 13.5px; line-height: 1.55; color: var(--ink); }
.cards { display: grid; grid-template-columns: 1.08fr 1fr; gap: 12px; margin-top: 11px; }
.card { position: relative; display: flex; flex-direction: column; padding: 14px 15px 15px; border-radius: 20px; background: rgba(255,255,255,.9); border: 1px solid #fff; box-shadow: 0 12px 30px rgba(7,95,152,.11); }
.card h2 { display: grid; grid-template-columns: 30px 1fr; gap: 9px; align-items: center; font-family: var(--fd); font-weight: 700; font-size: 15.5px; line-height: 1.3; color: var(--navy); }
.card h2 i { width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center; font-style: normal; font-family: var(--ft); font-size: 15px; color: #fff; background: linear-gradient(135deg, var(--sea), var(--navy)); }
.card.c2 h2 i { background: linear-gradient(135deg, var(--mint), var(--green)); }
.card h2 small { display: block; font-family: var(--ft); font-size: 11.5px; font-weight: 700; color: var(--green); letter-spacing: .02em; }
.yes { margin-top: 10px; }
.tag { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; font-size: 13px; }
.tag span { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; color: #fff; }
.tag svg { width: 12px; height: 12px; }
.yes .tag { color: var(--green); } .yes .tag span { background: var(--green); }
.yes ul { list-style: none; margin-top: 6px; display: grid; gap: 5px; }
.yes li { position: relative; padding-left: 15px; font-size: 12.5px; line-height: 1.45; }
.yes li::before { content: ""; position: absolute; left: 3px; top: 7px; width: 6px; height: 6px; border-radius: 50%; background: var(--mint); }
.notice { margin-top: 10px; padding: 9px 11px; border-radius: 14px; background: rgba(199,52,63,.07); border: 1px solid rgba(199,52,63,.22); font-size: 12.3px; line-height: 1.5; color: #4a2a2e; }
.notice .tag { color: var(--red); margin-bottom: 3px; } .notice .tag span { background: var(--red); }
.notice b { color: var(--red); }
.notice .nl { list-style: none; margin-top: 4px; display: grid; gap: 5px; }
.notice .nl li { position: relative; padding-left: 13px; }
.notice .nl li::before { content: ""; position: absolute; left: 2px; top: 8px; width: 5px; height: 5px; border-radius: 50%; background: var(--red); }
.notice .nl li > b:first-child { color: #4a2a2e; }
.only { display: inline-block; margin: 12px 0 0 8px; padding: 5px 13px; border-radius: 999px; background: var(--red); color: #fff; font-weight: 700; font-size: 13px; vertical-align: top; }
.card.c2 p { margin: 10px 0 12px; font-size: 13px; line-height: 1.6; }
.card.c2 p b { color: var(--red); }
.minimap { display: block; width: 88%; height: auto; margin: auto auto 10px; }
.minimap .fold { fill: rgba(44,195,148,.06); stroke: rgba(7,95,152,.22); stroke-width: 1.4; stroke-linejoin: round; }
.minimap .ct { fill: none; stroke: rgba(10,152,199,.22); stroke-width: 1.2; }
.minimap .route { fill: none; stroke: var(--green); stroke-width: 2.4; stroke-dasharray: 2 6; stroke-linecap: round; }
.minimap .dot { fill: #fff; stroke: var(--sea); stroke-width: 3; }
.minimap .mk path { fill: var(--green); } .minimap .mk circle { fill: #fff; }
.where { margin-top: 0; display: flex; gap: 9px; align-items: center; padding: 9px 11px; border-radius: 14px; background: linear-gradient(120deg, rgba(44,195,148,.14), rgba(10,152,199,.08)); border: 1px solid rgba(44,195,148,.35); }
.where span { flex: none; width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center; color: #fff; background: linear-gradient(135deg, var(--mint), var(--green)); }
.where svg { width: 17px; height: 17px; }
.where p { margin: 0 !important; font-size: 12px !important; line-height: 1.4 !important; color: var(--muted); }
.where p b { display: block; color: var(--green) !important; font-size: 13px; }
.cta { position: relative; z-index: 2; display: grid; grid-template-columns: auto 1fr; gap: 18px; align-items: center; margin-top: 13px; padding: 14px 120px 14px 14px; border-radius: 22px; color: #fff;
  background: radial-gradient(60% 120% at 100% 0%, rgba(44,195,148,.35), transparent 70%), linear-gradient(110deg, var(--deep), var(--navy) 60%, #0b7aa8); box-shadow: 0 18px 40px rgba(4,50,79,.3); }
.cta .qr { background: #fff; border-radius: 16px; padding: 8px; }
.cta canvas { display: block; width: 140px; height: 140px; }
.cta h3 { display: flex; align-items: center; gap: 8px; font-family: var(--fd); font-weight: 700; font-size: 19px; }
.cta h3 span { width: 28px; height: 28px; border-radius: 9px; display: grid; place-items: center; background: rgba(44,195,148,.25); color: var(--mint); }
.cta h3 svg { width: 17px; height: 17px; }
.cta .url { display: inline-block; margin-top: 6px; padding: 4px 10px; border-radius: 8px; background: rgba(252,253,253,.12); font-family: var(--ft); font-size: 12.5px; font-weight: 700; color: #b9f3de; letter-spacing: .01em; }
.cta p { margin-top: 7px; font-size: 12.3px; line-height: 1.5; color: rgba(252,253,253,.9); }
.cta p b { color: #fff; }
.cta .pass { position: absolute; right: 18px; top: -26px; width: 92px; border-radius: 10px; transform: rotate(7deg); box-shadow: 0 14px 30px rgba(0,0,0,.35); border: 2px solid rgba(255,255,255,.7); }
.cta .pass-lbl { position: absolute; right: 14px; bottom: 10px; font-family: var(--ft); font-size: 9px; font-weight: 700; letter-spacing: .16em; color: var(--mint); }
.close { position: relative; z-index: 2; margin-top: 10px; padding: 9px 14px; border-radius: 14px; background: rgba(255,255,255,.86); border: 1px solid #fff; font-size: 12.3px; line-height: 1.55; color: var(--muted); }
.foot { position: absolute; left: 0; right: 0; bottom: 0; z-index: 0; }
.land { display: block; width: 100%; height: 178px; }
.land g[stroke="#fcfdfd"] { filter: drop-shadow(0 0 1.2px rgba(7,95,152,.45)); }
.see { position: absolute; left: 0; right: 0; bottom: 14px; display: flex; justify-content: center; align-items: center; gap: 8px; color: #fff; font-family: var(--fd); font-weight: 700; font-size: 20px; text-shadow: 0 2px 6px rgba(4,50,79,.45); }
.see svg { width: 22px; height: 22px; }
</style></head><body><div class="p">
  <div class="layer bg"></div><canvas class="layer" id="topo" width="4764" height="6738"></canvas><div class="layer grid"></div><span class="sun"></span>
  <span class="coord l">LAT 13.9°N · LONG 100.5°E · NONTHABURI · THAILAND</span>
  <span class="coord r">TGGC 2026 · GEOGRAPHY GENIUS CHALLENGE · WGS 84</span>

  <header class="top"><img src="${LOGO_FULL}" alt=""><div class="date"><b>28.11.69</b><span>SAT · NOV 28 · 2026</span></div></header>

  <div class="wrap">
    <span class="kicker"><span>${I.mega}</span>ประชาสัมพันธ์</span><span class="only">สำหรับครูเท่านั้น</span>
    <h1><span class="a">การลงทะเบียนล่วงหน้า</span><span class="b">สำหรับครูผู้เข้าร่วมงาน <em>TGGC2026</em></span></h1>

    <div class="ev">
      <p>การจัดแข่งขันอัจฉริยภาพทางด้านภูมิศาสตร์และภูมิสารสนเทศแห่งประเทศไทย ระดับมัธยมศึกษา ครั้งที่ 3 พ.ศ. 2569</p>
      <b>The 3rd Thailand Geography Genius Challenge 2026 (TGGC2026)</b>
    </div>

    <div class="facts">
      <div class="fact tr"><span>${I.trophy}</span>ชิงถ้วยพระราชทานสมเด็จพระกนิษฐาธิราชเจ้า กรมสมเด็จพระเทพรัตนราชสุดาฯ สยามบรมราชกุมารี</div>
      <div class="fact"><span>${I.cal}</span>วันเสาร์ที่<br>28 พฤศจิกายน 2569</div>
      <div class="fact pl"><span>${I.pin}</span>ณ โรงเรียนชลประทานวิทยา<br>จังหวัดนนทบุรี</div>
    </div>

    <p class="intro">เพื่ออำนวยความสะดวกและลดระยะเวลาในการลงทะเบียนในวันจัดการแข่งขัน คณะกรรมการจัดการแข่งขันขอแจ้งแนวทางการลงทะเบียนเข้าร่วมงาน ดังนี้</p>

    <div class="cards">
      <section class="card c1">
        <h2><i>1</i><span>การแข่งขันตอบปัญหาทางด้านภูมิศาสตร์และภูมิสารสนเทศ</span></h2>
        <div class="yes"><span class="tag"><span>${I.ok}</span>ผู้ที่ต้องลงทะเบียนล่วงหน้า</span>
          <ul><li>ครูผู้ฝึกสอนนักเรียนที่เข้าร่วมการแข่งขันตอบปัญหาทางด้านภูมิศาสตร์และภูมิสารสนเทศ</li></ul></div>
        <div class="notice"><span class="tag"><span>${I.no}</span>นักเรียน <b>ไม่ต้องลงทะเบียนผ่านระบบนี้</b></span>
          <ul class="nl"><li><b>นักเรียนผู้เข้าแข่งขัน</b> ลงชื่อเข้าสอบ ณ ห้องสอบที่กำหนด โดยคณะกรรมการคุมสอบจะมอบของที่ระลึกให้ภายหลังเสร็จสิ้นการสอบ</li>
            <li><b>นักเรียนที่เข้าร่วมงานทั่วไป</b> ลงทะเบียนในวันงานที่ <b>ชั้น 3 อาคารหอประชุมชูชาติ กำภู 60 ปี</b> (หน้าห้องประชุม)</li></ul></div>
      </section>
      <section class="card c2">
        <h2><i>2</i><span>การแข่งขันออกแบบและสร้างสรรค์แผนที่เพื่อการพัฒนาประเทศ<small>TGGC : MapMatters 2026</small></span></h2>
        <p>ครูผู้ฝึกสอนและนักเรียนผู้เข้าแข่งขัน <b>ไม่ต้องลงทะเบียนล่วงหน้าผ่านระบบนี้</b> โดยให้ลงทะเบียนและรับของที่ระลึกหน้างาน ณ จุดลงทะเบียน ในวันจัดการแข่งขัน</p>
        <svg class="minimap" viewBox="0 0 300 92" aria-hidden="true">
          <path class="fold" d="M14 14l78-10 78 12 116-12v74l-116 12-78-12-78 10z"/><path class="fold" d="M92 4v76M170 16v76"/>
          <path class="ct" d="M30 60c18-22 40-30 62-22s40 4 52-10 38-18 60-6 40 10 70-6"/><path class="ct" d="M40 70c22-14 44-18 66-10s46 0 60-10 40-10 62 0 34 4 52-6"/>
          <path class="route" d="M38 66C70 40 110 70 150 46s70-10 98-26"/>
          <circle class="dot" cx="38" cy="66" r="5"/><g class="mk" transform="translate(248 38)"><path d="M0 0c-8-9-12-14-12-20a12 12 0 0 1 24 0c0 6-4 11-12 20z"/><circle cy="-20" r="4.2"/></g>
        </svg>
        <div class="where"><span>${I.pin}</span><p><b>ชั้น 3 หอประชุมชูชาติ กำภู 60 ปี</b>จุดลงทะเบียนและรับของที่ระลึกหน้างาน</p></div>
      </section>
    </div>

    <div class="cta">
      <div class="qr"><canvas id="qr" width="1320" height="1320"></canvas></div>
      <div>
        <h3><span>${I.link}</span>ลงทะเบียนล่วงหน้าได้ที่</h3>
        <span class="url">${URL_REG}</span>
        <p>เมื่อดำเนินการลงทะเบียนเรียบร้อยแล้ว กรุณา<b>บันทึกภาพบัตรเข้าร่วมงาน (Registration Pass)</b> เพื่อใช้แสดง ณ จุดรับของที่ระลึก บริเวณ<b>ชั้น 1 อาคาร 100 ปี ชูชาติอนุสรณ์</b></p>
      </div>
      <img class="pass" src="${TICKET}" alt=""><span class="pass-lbl">REGISTRATION PASS</span>
    </div>

    <p class="close">ทั้งนี้ ขอความร่วมมือผู้เข้าร่วมงานตรวจสอบประเภทการลงทะเบียนของตนเองให้ถูกต้อง เพื่อให้การดำเนินงานเป็นไปด้วยความเรียบร้อย รวดเร็ว และลดความซ้ำซ้อนในการลงทะเบียน</p>
  </div>

  <div class="foot">${LAND}<p class="see">แล้วพบกันที่ TGGC2026 ${I.globe}</p></div>
</div>
<script>${fs.readFileSync(PUB + '/vendor/qrcode.js', 'utf8')}</script>
<script>${fs.readFileSync(PUB + '/vendor/jsqr.min.js', 'utf8')}</script>
<script>
(function () {
${TOPO}
  var cv = document.getElementById('topo'), cx = cv.getContext('2d'); cx.scale(6, 6);
  drawTopo(cx, 794, 1123, { seed: 2026, levels: 18, scale: 0.0019, cell: 12, minorAlpha: .55, lineWidth: 1.5, color: function (p) { return p < .5 ? "rgba(10,152,199,0.18)" : "rgba(20,142,100,0.2)"; } });
  var q = qrcode(0, 'H'); q.addData(${JSON.stringify(URL_REG)}); q.make();
  var n = q.getModuleCount(), c = document.getElementById('qr'), S = c.width, g = c.getContext('2d'), m = S / n;
  function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function eye(r, k) { return (r < 7 && k < 7) || (r < 7 && k >= n - 7) || (r >= n - 7 && k < 7); }
  g.fillStyle = '#fff'; g.fillRect(0, 0, S, S); g.fillStyle = '#04324f';
  for (var r = 0; r < n; r++) for (var k = 0; k < n; k++) if (!eye(r, k) && q.isDark(r, k)) g.fillRect(Math.floor(k * m), Math.floor(r * m), Math.ceil(m), Math.ceil(m));
  [[0, 0], [0, n - 7], [n - 7, 0]].forEach(function (p) { var x = p[1] * m, y = p[0] * m;
    g.fillStyle = '#04324f'; rr(x, y, 7 * m, 7 * m, 2.2 * m); g.fill(); g.fillStyle = '#fff'; rr(x + m, y + m, 5 * m, 5 * m, 1.5 * m); g.fill();
    g.fillStyle = '#0a98c7'; rr(x + 2 * m, y + 2 * m, 3 * m, 3 * m, m); g.fill(); });
  var logo = new Image(); logo.onload = function () { var L = S * 0.22, x = (S - L) / 2;
    g.fillStyle = '#fff'; rr(x - m * .6, x - m * .6, L + m * 1.2, L + m * 1.2, m * 1.6); g.fill(); g.drawImage(logo, x + L * .06, x + L * .06, L * .88, L * .88);
    var h = jsQR(g.getImageData(0, 0, S, S).data, S, S); window.__qr = h ? h.data : 'FAIL'; };
  logo.src = ${JSON.stringify(LOGO_MARK)};
})();
</script></body></html>`;

(async () => {
  const br = await chromium.launch();
  const f = path.join(__dirname, 'promo.html'); fs.writeFileSync(f, HTML);
  const pg = await br.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: +(process.env.DSF || 3.125) });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + f); await pg.waitForFunction(() => window.__qr); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(500);
  const fit = await pg.evaluate(() => { const land = document.querySelector('.foot').getBoundingClientRect().top + 60;
    return [...document.querySelectorAll('.wrap > *')].filter(e => e.getBoundingClientRect().bottom > land).map(e => e.className + ':' + Math.round(e.getBoundingClientRect().bottom) + '>' + Math.round(land)); });
  const png = path.join(OUT, 'ประชาสัมพันธ์การลงทะเบียน.png');
  await pg.screenshot({ path: png });
  const shot = 'data:image/png;base64,' + fs.readFileSync(png).toString('base64');
  const fromShot = await pg.evaluate(async (src) => { const im = new Image(); im.src = src; await im.decode();
    const b = document.querySelector('.cta .qr').getBoundingClientRect(), k = im.width / 794, pad = 30;
    const c = document.createElement('canvas'); c.width = (b.width + pad * 2) * k / 6; c.height = (b.height + pad * 2) * k / 6; const x = c.getContext('2d');
    x.drawImage(im, (b.left - pad) * k, (b.top - pad) * k, (b.width + pad * 2) * k, (b.height + pad * 2) * k, 0, 0, c.width, c.height);
    const r = jsQR(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height); return r ? r.data : 'FAIL'; }, shot);
  if (!process.env.DSF) await pg.pdf({ path: path.join(OUT, 'ประชาสัมพันธ์การลงทะเบียน-print.pdf'), width: (794 * 2 / 96) + 'in', height: (1123 * 2 / 96) + 'in', printBackground: true, scale: 2 });
  console.log('qr', await pg.evaluate(() => window.__qr), '| from image', fromShot, '| overlap', JSON.stringify(fit), '| errors', JSON.stringify(errs));
  fs.unlinkSync(f); await br.close();
})();
