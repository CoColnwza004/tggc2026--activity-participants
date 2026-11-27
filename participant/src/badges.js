// Milestone medals: unlocked at 5 / 10 / 15 / 20 stamps and at the full set. Purely on the phone (derived from the
// stamp count), so they need no server and work offline.
import { iconPath } from "../../shared/web/icons.js";

const TIERS = [
  { n: 5, th: "นักสำรวจฝึกหัด", en: "ROOKIE EXPLORER", icon: "compass", c1: "#e0a46a", c2: "#9a5a26" },
  { n: 10, th: "นักอ่านแผนที่", en: "MAP READER", icon: "map", c1: "#b9cdd6", c2: "#5f7d8b" },
  { n: 15, th: "นักภูมิสารสนเทศ", en: "GEO-INFO PRO", icon: "satellite", c1: "#f4d36b", c2: "#b07f0e" },
  { n: 20, th: "ผู้พิชิตแผนที่", en: "PATHFINDER", icon: "mountain", c1: "#6fd3f2", c2: "#0a6e9e" },
];

/** medals for an event with `all` booths (tiers at or above the full set are dropped; the full set is the last one) */
export function medals(all) {
  return [...TIERS.filter((t) => t.n < all), { n: all, th: "Geo Genius", en: "GEO GENIUS", icon: "star", c1: "#7ff5cc", c2: "#0b8f6e", top: true }];
}
/** the highest medal reached with `n` stamps, or null */
export const medalFor = (n, all) => medals(all).filter((m) => n >= m.n).pop() || null;

let uid = 0;
/** medal artwork as an SVG string (self-contained: also used as an image on the share card) */
export function medalSVG(m, { locked = false, size = 100 } = {}) {
  const id = "md" + ++uid;
  const c1 = locked ? "#dfe8eb" : m.c1, c2 = locked ? "#a9bcc4" : m.c2;
  const ribbon = locked ? "#c9d6db" : m.top ? "#c9971c" : "#075f98", ribbon2 = locked ? "#b5c5cb" : m.top ? "#9a6c00" : "#0a98c7";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width="${size}" height="${size * 1.2}" aria-hidden="true">
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
  <path d="M30 4h16l10 34H40z" fill="${ribbon}"/><path d="M54 4h16L60 38H44z" fill="${ribbon2}"/>
  <circle cx="50" cy="72" r="40" fill="url(#${id})"/>
  <circle cx="50" cy="72" r="33" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="2" stroke-dasharray="3 3"/>
  <g transform="translate(32 54) scale(1.5)" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${iconPath(m.icon)}</g>
  <path d="M22 50a34 34 0 0 1 20-18" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="4" stroke-linecap="round"/>
</svg>`;
}
