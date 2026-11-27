// MapMatters lower thirds for the livestream: one bar per team (Grand Showcase).
//   poster/live/teams/team-XX.png      1920×1080 transparent (+ cut/ trimmed, preview.png)
//   poster/live/canva/TGGC2026-teams.pptx   editable in Canva (Create a design → Import file)
// Teams are from the organisers' "ขึ้นจอการแข่งขันทำแผนที่" slides.
// Usage: node scripts/make-live-teams.mjs
import { card, numBadge, renderSet, pad } from "./live-bars.mjs";

const TEAMS = [
  ["สามพี่น้องตระกูลข้าว", "โรงเรียนโยธินบูรณะ"],
  ["GIS ซิลเวอร์เนรมิต", "โรงเรียนบุรีรัมย์พิทยาคม"],
  ["หลงทางยังหาเจอหลงเธอต้องมาจภ.ปทุม", "โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย ปทุมธานี"],
  ["DUST HUNTERS นักล่าฝุ่น", "โรงเรียนเทศบาล 3 วัดชัยมงคล"],
  ["GeoRoots Local", "โรงเรียนบุรีรัมย์พิทยาคม"],
  ["UHI PRC", "โรงเรียนปรินส์รอยแยลส์วิทยาลัย"],
  ["Triple Minds", "โรงเรียนธรรมศาสตร์คลองหลวงวิทยาคม"],
  ["นกกระเรียนไทยจ๊าบ", "โรงเรียนบุรีรัมย์พิทยาคม"],
  ["แผนที่จะเสร็จแล้วครับ", "โรงเรียนพระปฐมวิทยาลัย"],
  ["สมาชิกอย่างสาด ไม่ได้สมัครสมาชิก", "โรงเรียนมหาวชิราวุธ จังหวัดสงขลา"],
  ["Qgis.healthy", "โรงเรียนบุรีรัมย์พิทยาคม"],
  ["4Every1", "โรงเรียนวัดเขมาภิรตาราม"],
  ["ญ.ว.เอาอยู่", "โรงเรียนหาดใหญ่วิทยาลัย"],
  ["สมองใส", "โรงเรียนบุรีรัมย์พิทยาคม"],
  ["ihatemonday (reunion)", "โรงเรียนโยธินบูรณะ"],
  ["Ayutthaya Muang Moradok Lok", "โรงเรียนธรรมศาสตร์คลองหลวงวิทยาคม"],
  ["ชัชเฟิร์สเอก", "โรงเรียนบุรีรัมย์พิทยาคม"],
  ["ลิงลพตบไก่", "โรงเรียนราชวินิต บางแก้ว"],
  ["EV", "โรงเรียนบุรีรัมย์พิทยาคม"],
  ["sixseven", "โรงเรียนบุรีรัมย์พิทยาคม"],
  ["HIVจ๋าพี่ไม่อยากเป็น", "โรงเรียนธรรมศาสตร์คลองหลวงวิทยาคม"],
  ["Summit", "โรงเรียนบุรีรัมย์พิทยาคม"],
  ["ไม่ได้ขี่ pcx ที่มาพร้อมตังค์ แต่ขี่เวฟพัง ๆ ที่มาพร้อมใจ", "โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย นครศรีธรรมราช"],
  ["ข้าวมันไก่", "โรงเรียนบุรีรัมย์พิทยาคม"],
  ["สุดหล่อเข้ารอบแน่นอน", "โรงเรียนบุรีรัมย์พิทยาคม"],
];

await renderSet(TEAMS.map(([name, school], i) => ({
  file: `team-${pad(i + 1)}.png`, label: `Team ${pad(i + 1)} ${name}`,
  html: card({ badge: numBadge(i + 1), tag: ["TGGC : MapMatters 2026", "รอบที่ 2 MapMatters Grand Showcase"], name, lines: [school] }),
})), "teams", "TGGC2026-teams.pptx");
