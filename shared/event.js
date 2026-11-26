/*
 * ข้อมูลงานทั้งหมดอยู่ในไฟล์นี้ไฟล์เดียว (ใช้ร่วมกันทั้งเว็บผู้เข้าร่วม เว็บเจ้าหน้าที่ และเซิร์ฟเวอร์)
 * แก้แล้ว deploy ใหม่ (ดู README)
 *
 * - บูธ 23 บูธตาม "ผังบูธกิจกรรม" · อย่าเปลี่ยน id หลังเปิดให้สะสมตราแล้ว
 * - th = ชื่อเต็มตามผัง · en = ชื่อสั้นภาษาอังกฤษที่พิมพ์บนขอบตราประทับ
 * - icon: map, satellite, compass, drone, globe, leaf, mountain, pin, star, book, uni, plane, drop
 * - ตำแหน่งหมุดบูธบนผัง: BOOTH_XY ใน participant/src/maps.js
 * - required = ต้องสะสมกี่ตราจึงรับตั๋วลุ้นรางวัลได้ (ค่าเริ่มต้น = ครบทุกบูธ)
 */
const C = ["#075f98", "#0a98c7", "#15a8a0", "#148e64", "#5ba1a5", "#2cc394"];
const HALL_SIDE = "ข้างหอประชุมชูชาติ กำภู 60 ปี (ฝั่งอาคาร 8)";
const HALL_IN = "หอประชุมชูชาติ กำภู 60 ปี ชั้น 1";
const B8 = "ข้างอาคาร 8";
const booth = (no, th, en, icon, place) => ({ id: "b" + no, no, th, en, name: en, icon, place, color: C[(no - 1) % C.length], desc: "" });

export const EVENT = {
  short: "TGGC 2026",
  title: "การแข่งขันอัจฉริยภาพทางด้านภูมิศาสตร์และภูมิสารสนเทศแห่งประเทศไทย ระดับมัธยมศึกษา ครั้งที่ 3 พ.ศ. 2569",
  en: "The 3rd Thailand Geography Genius Challenge 2026",
  dateText: "เสาร์ 28 พฤศจิกายน 2569",
  dateShort: "28.11.69",
  start: "2026-11-28T07:00:00+07:00",
  end: "2026-11-28T16:30:00+07:00",
  venue: "โรงเรียนชลประทานวิทยา",
  venueSub: "อ.ปากเกร็ด จ.นนทบุรี",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=%E0%B9%82%E0%B8%A3%E0%B8%87%E0%B9%80%E0%B8%A3%E0%B8%B5%E0%B8%A2%E0%B8%99%E0%B8%8A%E0%B8%A5%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%97%E0%B8%B2%E0%B8%99%E0%B8%A7%E0%B8%B4%E0%B8%97%E0%B8%A2%E0%B8%B2",

  // URL ของเว็บผู้เข้าร่วม — QR ที่บูธจะชี้มาที่นี่ (สแกนด้วยกล้องมือถือปกติก็เปิดเว็บและรับตราได้ทันที)
  participantUrl: "https://tggc2569-activity.ktxcdd.workers.dev/",
  // เว็บแอดมิน (แก้ชื่อ/โลโก้บูธ, แดชบอร์ด, รายชื่อผู้ยื่นตั๋ว) — เข้าด้วย ADMIN_PIN
  adminUrl: "https://tggc2569-activity-admin.ktxcdd.workers.dev/",

  booths: [
    booth(1, "มหาวิทยาลัยศิลปากร", "SILPAKORN UNIVERSITY", "uni", HALL_SIDE),
    booth(2, "มหาวิทยาลัยเกษตรศาสตร์", "KASETSART UNIVERSITY", "uni", HALL_SIDE),
    booth(3, "จุฬาลงกรณ์มหาวิทยาลัย และสมาคมภูมิศาสตร์แห่งประเทศไทย", "CHULALONGKORN × TGA", "globe", HALL_SIDE),
    booth(4, "กรมป่าไม้", "ROYAL FOREST DEPT.", "leaf", HALL_SIDE),
    booth(5, "สถาบันการบินพลเรือน", "CIVIL AVIATION TRAINING", "plane", HALL_SIDE),
    booth(6, "วิทยาลัยชลประทาน กรมชลประทาน", "IRRIGATION COLLEGE", "drop", HALL_SIDE),
    booth(7, "หลักสูตรชลศึกษา ชปว.", "CHONLASUKSA · CPW", "drop", HALL_SIDE),
    booth(8, "มหาวิทยาลัยกรุงเทพ", "BANGKOK UNIVERSITY", "uni", HALL_SIDE),
    booth(9, "มหาวิทยาลัยธุรกิจบัณฑิตย์", "DHURAKIJ PUNDIT UNIV.", "uni", HALL_SIDE),
    booth(10, "มหาวิทยาลัยศรีปทุม", "SRIPATUM UNIVERSITY", "uni", HALL_SIDE),
    booth(11, "สถาบันเทคโนโลยีไทย-ญี่ปุ่น", "THAI-NICHI INSTITUTE", "uni", HALL_SIDE),
    booth(12, "มหาวิทยาลัยเกริก", "KRIRK UNIVERSITY", "uni", HALL_SIDE),
    booth(13, "มหาวิทยาลัยเซาธ์อีสท์บางกอก", "SOUTHEAST BANGKOK UNIV.", "uni", HALL_SIDE),
    booth(14, "มหาวิทยาลัยคริสเตียน", "CHRISTIAN UNIVERSITY", "uni", HALL_SIDE),
    booth(15, "สำนักงานพัฒนาเทคโนโลยีอวกาศและภูมิสารสนเทศ", "GISTDA", "satellite", HALL_IN),
    booth(16, "บริษัท อีเอสอาร์ไอ (ประเทศไทย)", "ESRI THAILAND", "map", HALL_IN),
    booth(17, "มหาวิทยาลัยศรีนครินทรวิโรฒ", "SRINAKHARINWIROT UNIV.", "uni", B8),
    booth(18, "มหาวิทยาลัยราชภัฏสวนสุนันทา", "SUAN SUNANDHA RAJABHAT", "uni", B8),
    booth(19, "มหาวิทยาลัยราชภัฏนครปฐม", "NAKHON PATHOM RAJABHAT", "uni", B8),
    booth(20, "โรงเรียนแผนที่ทหาร", "MILITARY MAPPING SCHOOL", "compass", B8),
    booth(21, "มูลนิธิสถาบันสิ่งแวดล้อมไทย", "THAILAND ENVIRONMENT INST.", "leaf", B8),
    booth(22, "สำนักนโยบายและแผนทรัพยากรธรรมชาติและสิ่งแวดล้อม", "ONEP", "mountain", B8),
    booth(23, "ศูนย์ดาราศาสตร์และท้องฟ้าจำลอง ชปว.", "CPW PLANETARIUM", "star",
      "ศูนย์ดาราศาสตร์และท้องฟ้าจำลอง ชั้น 3 อาคารสันทนาการและกีฬา อาจารย์วิทยา สมาหาร"),
  ],

  // ต้องสะสมกี่ตราจึงรับตั๋วลุ้นรางวัลได้ (ใส่ตัวเลขน้อยกว่าจำนวนบูธได้ เช่น 10)
  required: 23,

  // เคาน์เตอร์แลกรางวัล: สะสมครบแล้วนำตั๋ว (QR ในเว็บ) มาให้เจ้าหน้าที่สแกน → เขียนชื่อลงใบจับฉลาก หย่อนกล่อง
  // 1 คน ยื่นตั๋วได้ 1 ครั้ง (ระบบกันสแกนซ้ำ) ⚠️ ยังไม่ได้ยืนยันตำแหน่งจริง
  prizePoint: { id: "prize", th: "เคาน์เตอร์แลกรางวัล", name: "เคาน์เตอร์แลกรางวัล", place: "หอประชุมชูชาติ กำภู 60 ปี ชั้น 1 (โซนบูธกิจกรรม)" },
  raffle: {
    slip: "เขียนชื่อ-นามสกุลลงใบจับฉลาก แล้วหย่อนลงกล่อง",
    announce: "ประกาศรายชื่อผู้โชคดีภายในงาน",
  },

  // ตัวอย่างของรางวัล (ใช้โปรโมทในเว็บ/โปสเตอร์เท่านั้น ไม่ได้ใช้สุ่ม) · art: fan | airfryer | kettle | hairdryer | pillow | gift
  prizes: [
    { id: "fan", name: "พัดลม", art: "fan" },
    { id: "airfryer", name: "หม้อทอดไร้น้ำมัน", art: "airfryer" },
    { id: "kettle", name: "กาต้มน้ำไฟฟ้า", art: "kettle" },
    { id: "hairdryer", name: "ไดร์เป่าผม", art: "hairdryer" },
    { id: "pillow", name: "หมอนรองคอ", art: "pillow" },
    { id: "more", name: "และของรางวัลอื่น ๆ อีกมากมาย", art: "gift" },
  ],
  prizeHeadline: "ลุ้นรับเครื่องใช้ไฟฟ้า และของรางวัลอีกมากมาย",
  prizeNote: "ภาพประกอบเท่านั้น · ของรางวัลจริงและจำนวนอาจแตกต่างจากภาพ",

  // กำหนดการ (เวลาไทย) ⚠️ เวลายังเป็นตัวอย่าง — tag: reg | main | booth | break | stage
  schedule: [
    { t: "07:00", e: "08:30", title: "ลงทะเบียน · ตรวจสอบรายชื่อห้องสอบ", tag: "reg", place: "อาคาร 100 ปี ชูชาติอนุสรณ์ ชั้น 1" },
    { t: "08:30", e: "09:00", title: "พิธีเปิดการแข่งขัน", tag: "stage", place: "หอประชุมชูชาติ กำภู 60 ปี" },
    { t: "09:00", e: "12:00", title: "การแข่งขันรอบคัดเลือก", tag: "main", place: "อาคาร 100 ปี ชูชาติอนุสรณ์ ชั้น 2–6" },
    { t: "09:00", e: "15:00", title: "บูธกิจกรรมภูมิศาสตร์และภูมิสารสนเทศ · สะสมตรา แลกสิทธิ์ลุ้นรางวัล", tag: "booth", place: "หอประชุมชูชาติ กำภู 60 ปี ชั้น 1 · ข้างหอประชุม · ข้างอาคาร 8" },
    { t: "12:00", e: "13:00", title: "พักรับประทานอาหารกลางวัน", tag: "break", place: "อาคาร 3 (ซุ้มจำหน่ายอาหารและเครื่องดื่ม)" },
    { t: "13:00", e: "15:00", title: "การแข่งขันรอบชิงชนะเลิศ", tag: "main", place: "หอประชุมชูชาติ กำภู 60 ปี ชั้น 2" },
    { t: "15:30", e: "16:30", title: "ประกาศผลและพิธีมอบรางวัล", tag: "stage", place: "หอประชุมชูชาติ กำภู 60 ปี" },
  ],

  // ผังงาน (รูปจริงจากสูจิบัตร)
  maps: {
    // วาดเป็น SVG ใน participant/src/maps.js (ตำแหน่งหมุดบูธ: BOOTH_XY ในไฟล์นั้น)
    booths: { title: "ผังบูธกิจกรรม" },
    school: { title: "แผนผังการจัดงาน โรงเรียนชลประทานวิทยา" },
  },
  // จุดสำคัญตามแผนผังการจัดงาน
  places: [
    { no: 1, name: "อาคาร 100 ปี ชูชาติอนุสรณ์", lines: ["ชั้น 1 : จุดตรวจสอบรายชื่อห้องสอบ", "ชั้น 2 – 6 ห้องสอบรอบคัดเลือก"] },
    { no: 2, name: "หอประชุมชูชาติ กำภู 60 ปี ชลประทานวิทยา", lines: ["ชั้น 1 : บูธกิจกรรม", "ชั้น 2 : สถานที่แข่งขันรอบชิงชนะเลิศ"] },
    { no: 3, name: "สถานที่จำหน่ายอาหารและเครื่องดื่ม", lines: [] },
    { no: 4, name: "จุดจอดรถส่งผู้เข้าแข่งขันและครูผู้ประสานงาน", lines: [] },
    { no: 5, name: "ลานจอดรถสำหรับผู้เข้าแข่งขัน จำนวน 300 คัน", lines: [] },
    { no: 6, name: "บูธกิจกรรมภูมิศาสตร์และภูมิสารสนเทศ", lines: [] },
    { no: 7, name: "อาคารสันทนาการและกีฬา อาจารย์วิทยา สมาหาร เพื่อการเรียนรู้แบบองค์รวม (จากน้ำสู่ฟ้า)", lines: ["ศูนย์ดาราศาสตร์และท้องฟ้าจำลอง ชั้น 3"] },
  ],
};

// helpers shared by every side
export const BOOTH_IDS = EVENT.booths.map((b) => b.id);
export const REQUIRED = Math.min(BOOTH_IDS.length, Math.max(1, EVENT.required || BOOTH_IDS.length));
export const boothById = (id) => EVENT.booths.find((b) => b.id === id) || (id === EVENT.prizePoint.id ? EVENT.prizePoint : null);
