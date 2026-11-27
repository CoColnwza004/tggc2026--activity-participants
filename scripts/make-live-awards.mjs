// Award lower thirds for the prize-giving on the livestream: award name + prize money + sponsor
// (no team names: the bar names the award while the winners come up on stage).
//   poster/live/awards/award-X-*.png   1920×1080 transparent (+ cut/ trimmed, preview.png)
//   poster/live/canva/TGGC2026-awards.pptx   editable in Canva (Create a design → Import file)
// Awards, money and sponsors are from the organisers' award slides.
// Usage: node scripts/make-live-awards.mjs
import { card, medalBadge, renderSet } from "./live-bars.mjs";

const IRRIGATION_ALUMNI = "สนับสนุนโดย สมาคมศิษย์เก่าวิศวกรรมชลประทาน ในพระบรมราชูปถัมภ์";
const AWARDS = [
  { file: "award-1-winner.png", tier: "gold", name: "รางวัลชนะเลิศ", money: "10,000", note: "พร้อมถ้วยพระราชทาน",
    lines: ["สมเด็จพระกนิษฐาธิราชเจ้า กรมสมเด็จพระเทพรัตนราชสุดาฯ สยามบรมราชกุมารี"] },
  { file: "award-2-runner-up-1.png", tier: "silver", name: "รางวัลรองชนะเลิศอันดับ 1", money: "5,000", lines: [IRRIGATION_ALUMNI] },
  { file: "award-3-runner-up-2.png", tier: "bronze", name: "รางวัลรองชนะเลิศอันดับ 2", money: "3,000", lines: [IRRIGATION_ALUMNI] },
  { file: "award-4-honorable-mention.png", tier: "honor", name: "รางวัลชมเชย", money: "1,500", lines: ["สนับสนุนโดย สมาคมภูมิศาสตร์แห่งประเทศไทย"] },
  { file: "award-5-top-score-individual.png", tier: "blue", name: "รางวัลคะแนนรวมสูงสุด", money: "1,000",
    note: "รอบคัดเลือก (Multiple Choice) ประเภทเดี่ยว", lines: [IRRIGATION_ALUMNI] },
  { file: "award-6-top-score-team.png", tier: "blue", name: "รางวัลคะแนนรวมสูงสุด", money: "1,000",
    note: "รอบคัดเลือก (Multiple Choice) ประเภททีม", lines: [IRRIGATION_ALUMNI] },
];

await renderSet(AWARDS.map((a) => ({
  file: a.file, label: a.name + (a.note ? " " + a.note : ""),
  html: card({ badge: medalBadge(a.tier), tag: ["Award Ceremony", "TGGC 2026"], name: a.name,
    award: { pill: `เงินรางวัล ${a.money} บาท`, note: a.note }, lines: a.lines }),
})), "awards", "TGGC2026-awards.pptx");
