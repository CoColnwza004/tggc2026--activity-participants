// Passport cover designs. Each passport gets one at random, fixed by its id (same look on every phone,
// and after recovering the passport): a colour scheme + a geography pattern from shared/web/patterns.js.
import { patternSvg, PATTERNS } from "../../shared/web/patterns.js";

// g = gradient (light → mid → dark), acc = accent text colour on the cover
export const COVERS = [
  { pat: "contour", g: ["#0a4f7f", "#075f98", "#06395e"], acc: "#9ff3d4" },
  { pat: "waves", g: ["#0b77ad", "#0a6b9e", "#053f63"], acc: "#bdf3ff" },
  { pat: "leaves", g: ["#1f7a4f", "#14704f", "#0b4532"], acc: "#c8f7a6" },
  { pat: "constellation", g: ["#3a3190", "#2a2466", "#120d36"], acc: "#ffd166" },
  { pat: "dunes", g: ["#d2643a", "#b8452e", "#6e1f3a"], acc: "#ffe0a3" },
  { pat: "scales", g: ["#13958f", "#0f7c77", "#08494a"], acc: "#b6fff2" },
  { pat: "orbits", g: ["#2b4c7e", "#1e3a5f", "#0d1b2e"], acc: "#8fd3ff" },
  { pat: "hex", g: ["#c2305a", "#9b1d42", "#561029"], acc: "#ffc2d4" },
  { pat: "graticule", g: ["#6a3fb5", "#4b2a85", "#26144a"], acc: "#e3ccff" },
  { pat: "voronoi", g: ["#11917b", "#0e6b5c", "#073d35"], acc: "#a8ffe6" },
  { pat: "city", g: ["#4a5a68", "#33414d", "#161e25"], acc: "#ffd166" },
  { pat: "peaks", g: ["#a0662a", "#7a4b1e", "#3f250d"], acc: "#ffdca8" },
  { pat: "rivers", g: ["#2a5bd7", "#1d3f8f", "#0f2152"], acc: "#c4d7ff" },
  { pat: "raster", g: ["#6e8f2a", "#4d6b1f", "#26360c"], acc: "#e6ffa3" },
];

const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

/** the cover design for a passport id: { no, pat, th, en, g, acc } */
export function coverFor(id) {
  const n = hash("cover:" + String(id || "")) % COVERS.length;
  const c = COVERS[n];
  return { no: n + 1, ...c, ...PATTERNS[c.pat] };
}

const cache = new Map();
/** inline style + pattern layer for the cover element */
export function coverArt(id) {
  const c = coverFor(id);
  if (!cache.has(id)) cache.set(id, patternSvg(c.pat, { w: 420, h: 300, u: 30, sw: 1.1, seed: hash(String(id)) % 9973, cls: "pp-pat" }));
  return { c, style: `--g1:${c.g[0]};--g2:${c.g[1]};--g3:${c.g[2]};--acc:${c.acc}`, svg: cache.get(id) };
}
