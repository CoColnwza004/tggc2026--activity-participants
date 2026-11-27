// Lower-third name bars for the livestream (speaker / guest names), same look as the speaker cards
// and the participant site: white glass card with the blue glow frame, Kanit, navy → sea → mint.
//   poster/live/lower-third-XX.png   1920×1080, transparent: drop on top of the video at 0,0 (OBS / vMix)
//   poster/live/cut/lower-third-XX.png  the bar alone, trimmed (to place by hand)
//   poster/live/canva/TGGC2026-lower-thirds.pptx  all 11 as slides, editable in Canva (Create a design → Import file)
//   poster/live/preview.png          every bar over a sample frame, for checking
// Logos in poster/live/logos/XX.png were cut out of the speaker cards. Look + renderer: scripts/live-bars.mjs
// Usage: node scripts/make-live-lowerthirds.mjs
import { card, logoBadge, pad, renderSet } from "./live-bars.mjs";

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

await renderSet(PEOPLE.map(([name, roles], i) => ({
  file: `lower-third-${pad(i + 1)}.png`, label: name,
  html: card({ badge: logoBadge(`poster/live/logos/${pad(i + 1)}.png`), tag: ["TGGC 2026", "The 3rd Thailand Geography Genius Challenge"], name, lines: roles }),
})), "", "TGGC2026-lower-thirds.pptx");
