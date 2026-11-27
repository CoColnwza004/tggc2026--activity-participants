// MapMatters lower thirds for the livestream: one bar per team (Grand Showcase) and the award bars.
//   poster/live/teams/team-XX.png      1920×1080 transparent (+ cut/ trimmed, preview.png)
//   poster/live/awards/award-*.png     same, for the prize-giving
//   poster/live/canva/TGGC2026-teams.pptx, TGGC2026-awards.pptx   editable in Canva (Create a design → Import file)
// Teams are from the organisers' "ขึ้นจอการแข่งขันทำแผนที่" slides. AWARDS: fill `team` with the team number once
// the results are out (null = a blank template: "ชื่อทีม" / "โรงเรียน" to type over in Canva), then run again.
// Usage: node scripts/make-live-teams.mjs
import { card, numBadge, medalBadge, renderSet, pad } from "./live-bars.mjs";

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

const COMP = "การแข่งขันการออกแบบและสร้างสรรค์แผนที่เพื่อการพัฒนาประเทศ";
const AWARDS = [
  { file: "award-1-winner.png", title: "รางวัลชนะเลิศ", tier: "gold", team: null },
  { file: "award-2-first-runner-up.png", title: "รางวัลรองชนะเลิศอันดับ 1", tier: "silver", team: null },
  { file: "award-3-second-runner-up.png", title: "รางวัลรองชนะเลิศอันดับ 2", tier: "bronze", team: null },
  { file: "award-4-honorable-mention.png", title: "รางวัลชมเชย", tier: "honor", team: null },
];

await renderSet(TEAMS.map(([name, school], i) => ({
  file: `team-${pad(i + 1)}.png`, label: `Team ${pad(i + 1)} ${name}`,
  html: card({ badge: numBadge(i + 1), tag: ["TGGC : MapMatters 2026", "รอบที่ 2 MapMatters Grand Showcase"], name, lines: [school] }),
})), "teams", "TGGC2026-teams.pptx");

await renderSet(AWARDS.map((a) => {
  const t = a.team ? TEAMS[a.team - 1] : ["ชื่อทีม", "โรงเรียน"];
  return { file: a.file, label: a.title,
    html: card({ badge: medalBadge(a.tier), tag: ["ประกาศผลรางวัล", "TGGC : MapMatters 2026"],
      award: { title: a.title, tier: a.tier, note: a.team ? `Team ${pad(a.team)}` : "" }, name: t[0], lines: [t[1], COMP] }) };
}), "awards", "TGGC2026-awards.pptx");
