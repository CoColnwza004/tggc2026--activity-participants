// The two event maps, redrawn as SVG in the site's own style (same content as the printed programme:
// "ผังบูธกิจกรรม" and "แผนผังการจัดงาน"). Vector → sharp at any zoom, ~10 KB, and booth pins are live:
// collected stamps turn green, tapping a pin opens the booth.
import { EVENT } from "../../shared/event.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ------------------------------------------------------------------ shared bits
const DEFS = `<defs>
  <linearGradient id="mgHall" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b6aa6"/><stop offset="1" stop-color="#05406a"/></linearGradient>
  <linearGradient id="mgBlock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14699d"/><stop offset="1" stop-color="#0a4c78"/></linearGradient>
  <linearGradient id="mgZone" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff4d6"/><stop offset="1" stop-color="#ffe7a8"/></linearGradient>
  <linearGradient id="mgGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".5" stop-color="#f2cf6b"/><stop offset="1" stop-color="#e9b949"/></linearGradient>
  <pattern id="mgGrid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0v24" fill="none" stroke="#cfe6ea" stroke-width="1"/></pattern>
  <pattern id="mgHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0v8" stroke="#2cc394" stroke-width="3" stroke-opacity=".35"/></pattern>
  <filter id="mgShadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#06395d" flood-opacity=".22"/></filter>
  <marker id="mgArrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0l10 5-10 5z" fill="#0a2b42"/></marker>
  <marker id="mgArrowR" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0l10 5-10 5z" fill="#d93d4a"/></marker>
</defs>`;

const PEOPLE = (x, y) => `<g class="m-ppl" transform="translate(${x} ${y})" aria-hidden="true">${[0, 11, 22, 33].map((dx, i) =>
  `<g transform="translate(${dx} ${i % 2 ? 2 : 0})"><circle cx="0" cy="-12" r="4" fill="${["#075f98", "#15a8a0", "#148e64", "#0a98c7"][i]}"/><path d="M-5 6v-10a5 5 0 0110 0v10z" fill="${["#075f98", "#15a8a0", "#148e64", "#0a98c7"][i]}" opacity=".85"/></g>`).join("")}</g>`;

// a block: rounded rect + centred label lines (first line bold)
function block(x, y, w, h, lines, cls = "", r = 14) {
  const ls = [].concat(lines).filter(Boolean);
  const lh = 17, y0 = y + h / 2 - ((ls.length - 1) * lh) / 2;
  return `<g class="m-b ${cls}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>${ls.map((l, i) =>
    `<text x="${x + w / 2}" y="${y0 + i * lh}" class="${i ? "s" : ""}">${esc(l)}</text>`).join("")}</g>`;
}

// ------------------------------------------------------------------ 1. booth layout (ผังบูธกิจกรรม)
// North is to the left on this plan, exactly like the printed one.
// Pin positions per booth number, in this SVG's coordinates.
export const BOOTH_XY = {
  1: [218, 478], 2: [218, 449], 3: [218, 420], 4: [218, 390], 5: [218, 361], 6: [218, 332], 7: [218, 303],
  8: [218, 274], 9: [218, 245], 10: [218, 215], 11: [218, 186], 12: [218, 157], 13: [218, 128], 14: [218, 99],
  15: [351, 352], 16: [532, 352],
  17: [130, 422], 18: [130, 394], 19: [130, 364], 20: [130, 283], 21: [130, 253], 22: [130, 225],
  23: [876, 462],
};

// prize counter: beside booth 22
export const PRIZE_XY = [130, 186];
function prizePin() {
  const [x, y] = PRIZE_XY;
  return `<g class="m-pin m-prize" data-booth="${EVENT.prizePoint.id}" data-dot="${EVENT.prizePoint.id}" role="button" tabindex="0" aria-label="${esc(EVENT.prizePoint.th)} (${esc(EVENT.prizePoint.place)})" transform="translate(${x} ${y})">
    <circle class="halo" r="22"/><circle class="ring" r="15"/><path d="M0-8.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L0 4.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill="#5a3d00"/></g>`;
}

function pin(b, got) {
  const [x, y] = BOOTH_XY[b.no] || [0, 0];
  return `<g class="m-pin${got ? " got" : ""}" data-booth="${b.id}" data-dot="${b.id}" role="button" tabindex="0" aria-label="บูธ ${b.no} ${esc(b.th)}${got ? " (ได้ตราแล้ว)" : ""}" style="--c:${b.color}" transform="translate(${x} ${y})">
    <circle class="halo" r="20"/><circle class="ring" r="12.5"/><text y="4.6">${b.no}</text>
    <g class="tick" transform="translate(9 -10)"><circle r="6.5"/><path d="M-3 0l2 2 4-4.2"/></g></g>`;
}

export function boothMapSVG(stamps = {}) {
  const B = EVENT.booths;
  const got = (no) => { const b = B.find((x) => x.no === no); return b && stamps[b.id]; };
  return `<svg class="emap emap-booths" viewBox="0 0 1000 790" role="img" aria-label="ผังบูธกิจกรรม">${DEFS}
  <rect width="1000" height="790" fill="#f3fafb"/><rect width="1000" height="790" fill="url(#mgGrid)"/>

  <!-- walkways -->
  <path d="M168 40V512H850" fill="none" stroke="#dbeaee" stroke-width="30" stroke-linejoin="round"/>
  <rect x="168" y="512" width="682" height="22" rx="11" fill="#9fb3bd" opacity=".55"/>

  <!-- left column -->
  ${block(20, 40, 82, 450, "อาคาร 8", "dark")}
  <rect class="m-zone" x="106" y="40" width="58" height="450" rx="12"/>
  <text class="m-zl" transform="translate(160 330) rotate(-90)">ข้างอาคาร 8</text>
  ${block(20, 530, 130, 92, "อาคารปฐมวัย", "dark")}
  ${block(20, 640, 130, 132, ["อาคาร 3", "ซุ้มจำหน่ายอาหาร", "และเครื่องดื่ม"], "dark food")}

  <!-- booth strip beside the hall -->
  <rect class="m-zone" x="200" y="70" width="36" height="430" rx="12"/>
  <text class="m-zl" transform="translate(194 300) rotate(-90)">ข้างหอประชุม</text>

  <!-- hall -->
  <g filter="url(#mgShadow)"><path d="M262 58h378a16 16 0 0116 16v402a16 16 0 01-16 16H505v24h-76v-24H262a16 16 0 01-16-16V74a16 16 0 0116-16z" fill="url(#mgHall)"/></g>
  <text class="m-t big" x="451" y="134">หอประชุมชูชาติ กำภู 60 ปี</text>
  <text class="m-t gold" x="451" y="166">สถานที่แข่งขันรอบชิงชนะเลิศ</text>
  <g transform="translate(451 214)" aria-hidden="true"><path d="M-14-16h28v8a14 14 0 01-28 0z" fill="#ffd166"/><path d="M-14-12h-7a7 7 0 007 9M14-12h7a7 7 0 01-7 9" fill="none" stroke="#ffd166" stroke-width="3"/><rect x="-4" y="5" width="8" height="8" fill="#ffd166"/><rect x="-11" y="13" width="22" height="5" rx="2" fill="#ffd166"/></g>
  <rect x="290" y="300" width="322" height="128" rx="14" fill="#fff" fill-opacity=".08" stroke="#a7d5db" stroke-opacity=".45" stroke-dasharray="6 6"/>
  <text class="m-t sm" x="451" y="452">ชั้น 1 · บูธกิจกรรม</text>
  ${[[351, "GISTDA"], [532, "ESRI THAILAND"]].map(([x, n]) => `<g transform="translate(${x} 352)"><rect x="-62" y="-34" width="124" height="68" rx="12" fill="#fff" fill-opacity=".14"/><text class="m-t xs" y="30">${n}</text>
    ${[-40, 40].map((dx) => `<path d="M${dx - 9} 12v-10a9 9 0 0118 0v10" fill="none" stroke="#e9f6f8" stroke-width="3" opacity=".7"/>`).join("")}</g>`).join("")}

  <!-- right side -->
  ${block(670, 58, 160, 434, "อาคารจอดรถ", "dark")}
  <g transform="translate(750 312)" aria-hidden="true" fill="none" stroke="#a7d5db" stroke-width="3" stroke-linejoin="round"><circle r="26"/><path d="M-14 6v-6l4-9h20l4 9v6zM-14 6v5M14 6v5"/></g>
  ${block(850, 58, 130, 320, ["อาคาร", "โครงการ EP"], "dark plain")}
  <g class="m-gate" transform="translate(915 404)"><rect x="-52" y="-17" width="104" height="34" rx="17"/><text y="6">ประตู 5</text></g>
  <g transform="translate(812 462)"><path d="M0 0h20" stroke="#f2b200" stroke-width="10" stroke-linecap="round"/><path d="M18-12l14 12-14 12z" fill="#f2b200"/></g>
  <rect x="852" y="436" width="140" height="52" rx="14" fill="url(#mgGold)" filter="url(#mgShadow)"/>
  <text class="m-t dk xs" x="938" y="458">ท้องฟ้าจำลอง</text><text class="m-t dk xxs" x="938" y="476">อาคาร 18 ชั้น 3</text>
  ${block(850, 530, 130, 118, "อาคาร 6", "dark")}
  <g class="m-gate" transform="translate(915 678)"><rect x="-52" y="-17" width="104" height="34" rx="17"/><text y="6">ประตู 7</text></g>
  <g transform="translate(980 736)"><path d="M0 0h-70" stroke="#f2b200" stroke-width="14" stroke-linecap="round"/><path d="M-66-20l-28 20 28 20z" fill="#f2b200"/></g>
  <text class="m-zl" x="915" y="768" text-anchor="middle">ทางเข้า</text>

  <!-- 100-year building -->
  <g filter="url(#mgShadow)"><rect x="180" y="550" width="650" height="76" rx="16" fill="url(#mgBlock)"/></g>
  <text class="m-t" x="505" y="582">อาคาร 100 ปี ชูชาติอนุสรณ์</text>
  <text class="m-t gold sm" x="505" y="608">สถานที่สอบแข่งขันรอบคัดเลือก</text>

  ${PEOPLE(175, 512)}${PEOPLE(430, 512)}${PEOPLE(790, 512)}

  <!-- key -->
  <g transform="translate(180 650)">
    <rect width="650" height="122" rx="18" fill="#fff" stroke="#dcecef"/>
    <text class="m-k h" x="22" y="34">ผังบูธกิจกรรม · ${esc(EVENT.short)}</text>
    <g transform="translate(36 72)"><circle r="11" fill="#075f98"/><text class="m-k w" y="4" text-anchor="middle">1</text></g><text class="m-k" x="56" y="77">บูธ (แตะเพื่อดูรายละเอียด)</text>
    <g transform="translate(36 102)"><circle r="11" fill="#2cc394"/><path d="M-5 0l3.5 3.5 6.5-7" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></g><text class="m-k" x="56" y="107">ได้ตราแล้ว</text>
    <rect x="330" y="60" width="34" height="22" rx="7" fill="url(#mgZone)" stroke="#f2cf6b"/><text class="m-k" x="374" y="77">โซนบูธ</text>
    <g transform="translate(460 72)"><circle r="11" fill="#ffd166" stroke="#c9971c" stroke-width="2"/><path d="M0-6l1.8 3.7 4.1.6-3 2.9.7 4.1L0 3.4l-3.7 1.9.7-4.1-3-2.9 4.1-.6z" fill="#5a3d00"/></g><text class="m-k" x="478" y="77">แลกรางวัล</text>
    <path d="M330 102h34" stroke="#f2b200" stroke-width="8" stroke-linecap="round"/><text class="m-k" x="374" y="107">ทางเข้า / ทางไปท้องฟ้าจำลอง</text>
    <g transform="translate(600 62)" aria-hidden="true"><circle r="22" fill="#e9f6f8"/><path d="M0-17l6 17H-6z" fill="#d93d4a" transform="rotate(-90)"/><path d="M0 17l6-17H-6z" fill="#86a4b1" transform="rotate(-90)"/><text class="m-k b" x="-38" y="5" text-anchor="middle">N</text></g>
  </g>

  ${B.map((b) => pin(b, got(b.no))).join("")}${prizePin()}
</svg>`;
}

// ------------------------------------------------------------------ 2. school plan (แผนผังการจัดงาน)
// North is up. Numbered red pins = EVENT.places 1–7.
const PLACE_XY = { 1: [650, 186], 2: [826, 162], 3: [428, 124], 4: [548, 138], 5: [430, 472], 6: [704, 140], 7: [790, 420] };

function placePin(no) {
  const [x, y] = PLACE_XY[no];
  const p = EVENT.places.find((q) => q.no === no);
  return `<g class="m-place" data-place="${no}" transform="translate(${x} ${y})" role="img" aria-label="${no} ${esc(p ? p.name : "")}">
    <circle class="halo" r="22"/><path d="M0 14c-9-10-15-16-15-24a15 15 0 0130 0c0 8-6 14-15 24z" transform="translate(0 -12)"/><text y="-17">${no}</text></g>`;
}

export function schoolMapSVG() {
  const sb = (x, y, w, h, lines, cls = "") => block(x, y, w, h, lines, "lt " + cls, 10);
  const arrow = (d) => `<path d="${d}" fill="none" stroke="#0a2b42" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#mgArrow)"/>`;
  return `<svg class="emap emap-school" viewBox="0 0 1045 575" role="img" aria-label="แผนผังการจัดงาน โรงเรียนชลประทานวิทยา">${DEFS}
  <rect width="1045" height="575" fill="#f3fafb"/>

  <!-- road + pink line (west) -->
  <rect x="0" y="0" width="160" height="575" fill="#e4ecef"/>
  <path d="M40 0v575" stroke="#fff" stroke-width="4" stroke-dasharray="40 30"/>
  <rect x="104" y="0" width="16" height="575" fill="#e6489a"/>
  <text class="m-road" transform="translate(64 300) rotate(-90)">ถนนติวานนท์</text>
  <text class="m-pink" transform="translate(140 470) rotate(-90)">แนวรถไฟฟ้าสายสีชมพู</text>
  <g transform="translate(112 230)"><circle r="21" fill="#fff" stroke="#e6489a" stroke-width="4"/><text class="m-st" y="-2">PK</text><text class="m-st" y="11">05</text></g>

  <!-- temple (north) + campus ground -->
  <text class="m-north" x="560" y="18">วัดชลประทานรังสฤษดิ์ (พระอารามหลวง)</text>
  <rect x="165" y="26" width="840" height="388" rx="22" fill="#e6f1f3"/>
  <path d="M165 395H710V560" fill="none" stroke="#dbe7ea" stroke-width="34"/>

  <!-- NW cluster -->
  ${sb(182, 40, 76, 40, "อาคาร 9")}
  <g transform="translate(182 92)" aria-hidden="true"><rect width="34" height="44" rx="4" fill="#3d9be0"/><rect x="40" width="34" height="44" rx="4" fill="#3d9be0"/><path d="M0 22h34M17 0v44M40 22h34" stroke="#fff" stroke-width="1.5" opacity=".7"/></g>
  ${sb(276, 40, 122, 76, "อาคาร 1")}
  <rect x="172" y="196" width="64" height="96" rx="12" fill="#bfe3c6"/>${sb(180, 214, 48, 60, "อาคาร 7")}

  <!-- gate 1 -->
  <g class="m-gate sm" transform="translate(160 176)"><rect x="-38" y="-14" width="76" height="28" rx="14"/><text y="5">ประตู 1</text></g>

  <!-- north row -->
  ${sb(424, 34, 132, 92, ["อาคาร 3", "ครัวชลประทาน 1", "ลานอเนกประสงค์"], "hot")}
  ${sb(562, 52, 116, 74, ["อาคาร 5", "(ปฐมวัย)"])}
  ${sb(712, 34, 100, 18, "บ้านพักครู", "tiny")}
  ${sb(700, 60, 118, 66, "อาคาร 8")}
  <path d="M858 78c30-14 74-6 82 16s-8 40-44 40-62-8-52-30z" fill="#7fd3cf" stroke="#3fb6b0" stroke-width="2"/><text class="m-l" x="898" y="108">บ่อบำบัดน้ำเสีย</text>

  <!-- one-way loop around the football field -->
  <rect x="246" y="138" width="310" height="174" rx="8" fill="none" stroke="#d7e3e7" stroke-width="22"/>
  <rect x="263" y="150" width="276" height="150" rx="10" fill="#3faa6e"/>
  <g fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="2"><rect x="278" y="164" width="246" height="122" rx="2"/><path d="M401 164v122"/><circle cx="401" cy="225" r="22"/><rect x="278" y="194" width="34" height="62"/><rect x="490" y="194" width="34" height="62"/></g>
  <text class="m-l w" x="401" y="314">สนามฟุตบอล</text>
  ${arrow("M262 138h60")}${arrow("M360 138h60")}${arrow("M456 138h60")}${arrow("M556 140v50")}
  ${arrow("M540 312h-60")}${arrow("M440 312h-60")}${arrow("M340 312h-60")}${arrow("M246 300v-50")}${arrow("M246 210v-50")}
  ${arrow("M200 176h24v-30")}

  <!-- courts + 100-year building -->
  <rect x="568" y="160" width="72" height="140" rx="8" fill="#4aa6e6"/><g stroke="#fff" stroke-opacity=".7" stroke-width="1.5" fill="none"><path d="M568 206h72M568 254h72M604 160v140"/></g>
  <text class="m-l w tag" x="604" y="234">ลานกีฬา</text>
  ${sb(648, 160, 46, 140, "", "hot")}
  <text class="m-l b" transform="translate(667 246) rotate(-90)">อาคาร 10</text><text class="m-l" transform="translate(683 236) rotate(-90)">100 ปี ชูชาติอนุสรณ์</text>

  <!-- booth zone + hall + parking building -->
  <path class="m-zone2" d="M694 128h140v20H718v80h-24z"/>
  ${sb(720, 150, 108, 52, ["อาคาร 11", "หอประชุมชูชาติ กำภู"], "hot")}
  ${sb(720, 208, 108, 56, ["อาคาร 12", "(อาคารจอดรถ)"])}
  <path d="M770 264v38M760 126v24" stroke="#c4d3d8" stroke-width="12"/>
  ${sb(904, 150, 72, 42, "อาคาร 14")}${sb(904, 202, 72, 42, "โรงช่าง")}

  <!-- south row -->
  ${sb(176, 328, 80, 54, ["ครัว", "ชลประทาน 2"])}
  ${sb(262, 328, 104, 54, ["อาคาร 2", "(ชูชาติ อนุสรณ์)"])}
  ${sb(372, 328, 62, 54, ["อาคาร 13", "ห้องสมุด"])}
  ${sb(440, 328, 100, 54, ["อาคาร 4", "(ชลประทานสามัคคี)"])}
  ${sb(552, 328, 124, 24, "อาคาร 6")}${sb(552, 358, 124, 24, "อาคารเสื่อลำแพน")}
  ${sb(706, 302, 270, 84, ["อาคาร 20", "(English Program)"])}
  <g class="m-gate sm" transform="translate(546 400)"><rect x="-38" y="-14" width="76" height="28" rx="14"/><text y="5">ประตู 7</text></g>

  <!-- entry flow + parking -->
  <path d="M180 410h90M300 410h90" stroke="#d93d4a" stroke-width="7" stroke-linecap="round" marker-end="url(#mgArrowR)"/>
  <path d="M430 404v26" stroke="#d93d4a" stroke-width="7" stroke-linecap="round" marker-end="url(#mgArrowR)"/>
  <rect x="176" y="432" width="518" height="132" rx="14" fill="#c9d6db"/>
  <path d="M196 528h478" stroke="#fff" stroke-width="2" stroke-dasharray="14 10"/>
  <text class="m-park" x="436" y="512">ลานจอดรถ</text>

  <!-- sports & recreation building (planetarium) -->
  ${sb(712, 404, 156, 150, ["อาคาร 18", "สันทนาการและกีฬา", "(ท้องฟ้าจำลอง ชั้น 3)"], "hot b18")}

  <!-- compass + address -->
  <g transform="translate(948 452)"><circle r="30" fill="#fff" stroke="#dcecef"/><path d="M0-24l9 24H-9z" fill="#d93d4a"/><path d="M0 24l9-24H-9z" fill="#a7c0c8"/><text class="m-k b" y="-34" text-anchor="middle">N</text></g>
  <text class="m-addr" x="948" y="508">201 ม.1 ถ.ติวานนท์ ต.บางตลาด</text><text class="m-addr" x="948" y="524">อ.ปากเกร็ด จ.นนทบุรี 11120</text>

  ${[1, 2, 3, 4, 5, 6, 7].map(placePin).join("")}
</svg>`;
}
