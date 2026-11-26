// Geography-themed background patterns, drawn as one inline SVG (no images, no transparency layers).
// Used by the booth QR posters (one pattern per booth), the staff booth screen and the passport covers.
//   patternSvg(kind, { w, h, u, seed, sw, cls }) → "<svg …>" sized w×h user units, stroke = currentColor
// Every pattern is deterministic: the same kind + seed always draws the same picture.

export const PATTERNS = {
  contour: { th: "เส้นชั้นความสูง", en: "CONTOUR" },
  graticule: { th: "เส้นรุ้ง เส้นแวง", en: "GRATICULE" },
  grid: { th: "กริดแผนที่", en: "MAP GRID" },
  hex: { th: "รังผึ้ง", en: "HEX GRID" },
  halftone: { th: "จุดเงาภูมิประเทศ", en: "HALFTONE" },
  waves: { th: "คลื่นทะเล", en: "WAVES" },
  tin: { th: "โครงข่ายสามเหลี่ยม", en: "TIN MESH" },
  scales: { th: "เกล็ดคลื่น", en: "SCALES" },
  compass: { th: "เข็มทิศ", en: "COMPASS" },
  constellation: { th: "กลุ่มดาว", en: "CONSTELLATION" },
  orbits: { th: "วงโคจรดาวเทียม", en: "ORBITS" },
  raster: { th: "ภาพจากดาวเทียม", en: "RASTER" },
  leaves: { th: "ใบไม้", en: "LEAVES" },
  peaks: { th: "ทิวเขา", en: "PEAKS" },
  routes: { th: "เส้นทางบิน", en: "FLIGHT ROUTES" },
  drops: { th: "หยดน้ำ", en: "DROPS" },
  ripples: { th: "วงคลื่นน้ำ", en: "RIPPLES" },
  chevron: { th: "ฟันปลา", en: "CHEVRON" },
  plus: { th: "หมุดพิกัด", en: "TICKS" },
  voronoi: { th: "เซลล์โวโรนอย", en: "VORONOI" },
  dunes: { th: "เนินทราย", en: "DUNES" },
  city: { th: "ผังเมือง", en: "CITY BLOCKS" },
  rivers: { th: "ลุ่มน้ำ", en: "RIVERS" },
  hachure: { th: "ลายเส้นแรเงา", en: "HACHURE" },
};

// one distinct pattern for every booth (index = booth no − 1), loosely matched to what the booth is about
export const BOOTH_PATTERN = [
  "scales", "raster", "graticule", "leaves", "routes", "drops", "waves", "city", "hex", "tin", "plus", "halftone",
  "chevron", "ripples", "orbits", "contour", "voronoi", "dunes", "compass", "grid", "rivers", "peaks", "constellation",
];
export const boothPattern = (no) => BOOTH_PATTERN[(no - 1) % BOOTH_PATTERN.length];

// ---------------------------------------------------------------- helpers
const rng = (seed) => {
  let a = (seed >>> 0) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const f = (n) => Math.round(n * 10) / 10;
const TAU = Math.PI * 2;
let uid = 0;

// smooth "terrain" height field: a few gaussian hills + long waves, normalised to 0…1 over the drawing
function terrain(R, w, h, u) {
  const hills = Array.from({ length: 5 + Math.round((w * h) / (u * u * 40)) }, () => ({
    x: R() * w, y: R() * h, s: u * (1.2 + R() * 3), a: (R() < 0.7 ? 1 : -0.8) * (0.5 + R()),
  }));
  const p1 = R() * TAU, p2 = R() * TAU, k = 1 / (u * 5);
  const raw = (x, y) => {
    let v = 0.5 * Math.sin(x * k + p1) * Math.cos(y * k * 0.8 + p2);
    for (const q of hills) { const dx = x - q.x, dy = y - q.y; v += q.a * Math.exp(-(dx * dx + dy * dy) / (2 * q.s * q.s)); }
    return v;
  };
  let lo = Infinity, hi = -Infinity;
  for (let y = 0; y <= h; y += h / 24) for (let x = 0; x <= w; x += w / 24) { const v = raw(x, y); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const span = hi - lo || 1;
  return (x, y) => (raw(x, y) - lo) / span;
}

// iso-lines of a field by marching squares → list of [x1,y1,x2,y2] segments per level
const SEG = [[], [[3, 2]], [[2, 1]], [[3, 1]], [[0, 1]], [[0, 1], [3, 2]], [[0, 2]], [[3, 0]], [[3, 0]], [[0, 2]], [[3, 0], [2, 1]], [[0, 1]], [[3, 1]], [[2, 1]], [[3, 2]], []];
function isolines(F, w, h, g, levels) {
  const nx = Math.ceil(w / g) + 1, ny = Math.ceil(h / g) + 1;
  const v = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) v[j * nx + i] = F(i * g, j * g);
  return levels.map((L) => {
    let d = "";
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = v[j * nx + i], b = v[j * nx + i + 1], c = v[(j + 1) * nx + i + 1], e = v[(j + 1) * nx + i];
      const idx = (a > L) << 3 | (b > L) << 2 | (c > L) << 1 | (e > L);
      if (!idx || idx === 15) continue;
      const x = i * g, y = j * g;
      const pt = (k) => k === 0 ? [x + g * (L - a) / (b - a), y] : k === 1 ? [x + g, y + g * (L - b) / (c - b)] : k === 2 ? [x + g * (L - e) / (c - e), y + g] : [x, y + g * (L - a) / (e - a)];
      for (const [p, q] of SEG[idx]) { const P = pt(p), Q = pt(q); d += `M${f(P[0])} ${f(P[1])}L${f(Q[0])} ${f(Q[1])}`; }
    }
    return d;
  });
}
// dots as zero-length round-capped strokes, grouped by size (keeps the SVG small)
function dotPaths(dots, buckets, c = "currentColor") {
  const by = new Map();
  for (const [x, y, r] of dots) {
    const k = Math.max(1, Math.round(r * buckets) / buckets);
    by.set(k, (by.get(k) || "") + `M${f(x)} ${f(y)}h0`);
  }
  return [...by].map(([r, d]) => `<path d="${d}" stroke="${c}" stroke-width="${f(r * 2)}"/>`).join("");
}
// half-plane clip (Sutherland–Hodgman) keeping points p with (p−m)·n ≤ 0
function clip(poly, mx, my, nx, ny) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const A = poly[i], B = poly[(i + 1) % poly.length];
    const da = (A[0] - mx) * nx + (A[1] - my) * ny, db = (B[0] - mx) * nx + (B[1] - my) * ny;
    if (da <= 0) out.push(A);
    if ((da <= 0) !== (db <= 0)) { const t = da / (da - db); out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]); }
  }
  return out;
}
const poly = (pts) => "M" + pts.map((p) => `${f(p[0])} ${f(p[1])}`).join("L") + "Z";

// ---------------------------------------------------------------- patterns
// each returns inner SVG markup; s = base stroke width
const DRAW = {
  contour(R, w, h, u, s) {
    const F = terrain(R, w, h, u);
    const levels = Array.from({ length: 25 }, (_, i) => 0.02 + i * 0.04);
    const d = isolines(F, w, h, u / 5, levels);
    const thin = d.filter((_, i) => i % 5).join(""), bold = d.filter((_, i) => !(i % 5)).join("");
    return `<path d="${thin}"/><path d="${bold}" stroke-width="${s * 2.2}"/>`;
  },
  graticule(R, w, h, u, s) {
    const r = Math.max(w, h) * (0.75 + R() * 0.2), cx = w * (0.3 + R() * 0.5), cy = h * (0.35 + R() * 0.3);
    const tilt = 0.35 + R() * 0.3, spin = R() * 10;
    // orthographic globe, tilted: meridians every 10°, parallels every 10°
    const P = (lat, lon) => {
      const cl = Math.cos(lat), x = cl * Math.sin(lon), y = Math.sin(lat), z = cl * Math.cos(lon);
      const y2 = y * Math.cos(tilt) - z * Math.sin(tilt), z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
      return z2 >= -0.02 ? [cx + r * x, cy - r * y2] : null;
    };
    let d = "";
    const line = (fn, n) => { let pen = false; for (let i = 0; i <= n; i++) { const p = fn(i / n); if (!p) { pen = false; continue; } d += (pen ? "L" : "M") + f(p[0]) + " " + f(p[1]); pen = true; } };
    const D = Math.PI / 180;
    for (let lon = 0; lon < 360; lon += 10) line((t) => P((-90 + 180 * t) * D, (lon + spin) * D), 72);
    for (let lat = -80; lat <= 80; lat += 10) line((t) => P(lat * D, t * TAU), 144);
    return `<path d="${d}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" stroke-width="${s * 2.4}"/>`;
  },
  grid(R, w, h, u, s) {
    const g = u * 2.2, ox = -R() * g, oy = -R() * g;
    let maj = "", min = "", txt = "";
    const e0 = 40 + Math.floor(R() * 50), n0 = 10 + Math.floor(R() * 70);
    for (let x = ox, i = 0; x < w + g; x += g, i++) { maj += `M${f(x)} 0V${h}`; for (let k = 1; k < 10; k++) min += `M${f(x + (g * k) / 10)} 0V${h}`; }
    for (let y = oy, j = 0; y < h + g; y += g, j++) { maj += `M0 ${f(y)}H${w}`; for (let k = 1; k < 10; k++) min += `M0 ${f(y + (g * k) / 10)}H${w}`; }
    for (let x = ox, i = 0; x < w; x += g, i++) for (let y = oy, j = 0; y < h; y += g, j++)
      if (x > 0 && y > 0 && (i + j) % 2 === 0) txt += `<text x="${f(x + u * 0.12)}" y="${f(y + u * 0.42)}">${String((e0 + i) % 100).padStart(2, "0")}${String((n0 + j) % 100).padStart(2, "0")}</text>`;
    return `<path d="${min}" stroke-width="${s * 0.45}" stroke-opacity=".55"/><path d="${maj}" stroke-width="${s * 1.6}"/>
      <g fill="currentColor" stroke="none" font-family="Chakra Petch,monospace" font-weight="700" font-size="${f(u * 0.3)}" letter-spacing="1">${txt}</g>`;
  },
  hex(R, w, h, u, s) {
    const r = u * 0.55, dx = Math.sqrt(3) * r, dy = 1.5 * r;
    let d = "", fill = "";
    for (let j = -1; j * dy < h + r; j++) for (let i = -1; i * dx < w + dx; i++) {
      const cx = i * dx + (j % 2 ? dx / 2 : 0), cy = j * dy;
      const pts = Array.from({ length: 6 }, (_, k) => [cx + r * Math.cos(Math.PI / 6 + (k * Math.PI) / 3), cy + r * Math.sin(Math.PI / 6 + (k * Math.PI) / 3)]);
      d += poly(pts);
      if (R() < 0.09) fill += poly(pts.map(([x, y]) => [cx + (x - cx) * 0.72, cy + (y - cy) * 0.72]));
    }
    return `<path d="${d}"/><path d="${fill}" fill="currentColor" stroke="none" fill-opacity=".55"/>`;
  },
  halftone(R, w, h, u) {
    const F = terrain(R, w, h, u), g = u * 0.42, dots = [];
    for (let y = 0, j = 0; y < h + g; y += g * 0.866, j++) for (let x = j % 2 ? g / 2 : 0; x < w + g; x += g) {
      const v = Math.max(0, Math.min(1, F(x, y) * 1.15 - 0.1)) ** 1.3;
      if (v > 0.06) dots.push([x, y, g * 0.44 * v]);
    }
    return dotPaths(dots, 3, "currentColor");
  },
  waves(R, w, h, u, s) {
    let d = "";
    const L = u * (1.4 + R() * 0.6);
    for (let y = 0, i = 0; y < h + u; y += u * 0.34, i++) {
      const A = u * (0.12 + 0.1 * Math.sin(i * 0.45 + R() * 0.3)), x0 = -L + ((i * L * 0.18) % L);
      d += `M${f(x0)} ${f(y)}q${f(L / 4)} ${f(-A * 2)} ${f(L / 2)} 0`;
      for (let x = x0 + L / 2; x < w + L; x += L / 2) d += `t${f(L / 2)} 0`;
    }
    return `<path d="${d}"/>`;
  },
  tin(R, w, h, u, s) {
    const g = u * 1.1, nx = Math.ceil(w / g) + 2, ny = Math.ceil(h / g) + 2, P = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) P.push([(i - 0.5 + (R() - 0.5) * 0.8) * g, (j - 0.5 + (R() - 0.5) * 0.8) * g]);
    const at = (i, j) => P[j * nx + i];
    let d = "";
    const seg = (a, b) => (d += `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      if (i < nx - 1) seg(at(i, j), at(i + 1, j));
      if (j < ny - 1) seg(at(i, j), at(i, j + 1));
      if (i < nx - 1 && j < ny - 1) R() < 0.5 ? seg(at(i, j), at(i + 1, j + 1)) : seg(at(i + 1, j), at(i, j + 1));
    }
    return `<path d="${d}"/>${dotPaths(P.filter(() => R() < 0.5).map(([x, y]) => [x, y, s * 2.2]), 2)}`;
  },
  scales(R, w, h, u, s) {
    const r = u * 0.6;
    let d = "";
    for (let j = 0, y = -r; y < h + r; j++, y += r) for (let x = (j % 2 ? -r : 0) - 2 * r; x < w + 2 * r; x += 2 * r) {
      const cx = x + r;
      d += `M${f(x)} ${f(y)}A${f(r)} ${f(r)} 0 0 0 ${f(x + 2 * r)} ${f(y)}`;
      for (const k of [0.66, 0.34]) d += `M${f(cx - r * k)} ${f(y)}A${f(r * k)} ${f(r * k)} 0 0 0 ${f(cx + r * k)} ${f(y)}`;
    }
    return `<path d="${d}"/>`;
  },
  compass(R, w, h, u, s, id) {
    const r = u * 0.62, k = r * 0.2;
    const star = `M0 ${-r}L${k} ${-k}L${r} 0L${k} ${k}L0 ${r}L${-k} ${k}L${-r} 0L${-k} ${-k}Z`;
    const small = [45, 135, 225, 315].map((a) => { const c = Math.cos((a * Math.PI) / 180), sn = Math.sin((a * Math.PI) / 180); return `M0 0L${f(c * r * 0.62)} ${f(sn * r * 0.62)}`; }).join("");
    let use = "";
    const g = u * 2.3;
    for (let j = -1, y = 0; y < h + g; j++, y += g * 0.75) for (let x = j % 2 ? g / 2 : 0; x < w + g; x += g)
      use += `<use href="#${id}" transform="translate(${f(x)} ${f(y)}) rotate(${Math.round((R() - 0.5) * 30)}) scale(${f(0.7 + R() * 0.5)})"/>`;
    return `<defs><g id="${id}"><circle r="${f(r * 0.78)}"/><circle r="${f(r * 0.86)}" stroke-dasharray="1 ${f(r * 0.12)}" stroke-width="${s * 2}"/><path d="${star}"/><path d="${small}"/><path d="M0 ${-r}L${k} ${-k}L0 0Z" fill="currentColor"/></g></defs>${use}`;
  },
  constellation(R, w, h, u, s) {
    const n = Math.round((w * h) / (u * u * 2.2)), P = [];
    for (let i = 0; i < n; i++) P.push([R() * w, R() * h, R()]);
    let d = "";
    for (let i = 0; i < P.length; i++) {
      if (P[i][2] < 0.55) continue;
      const near = P.map((q, j) => [j, (q[0] - P[i][0]) ** 2 + (q[1] - P[i][1]) ** 2]).filter(([j, dd]) => j !== i && dd < (u * 2.2) ** 2).sort((a, b) => a[1] - b[1]).slice(0, 2);
      for (const [j] of near) d += `M${f(P[i][0])} ${f(P[i][1])}L${f(P[j][0])} ${f(P[j][1])}`;
    }
    const sp = (x, y, r) => `M${f(x)} ${f(y - r)}Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)}Q${f(x)} ${f(y)} ${f(x)} ${f(y + r)}Q${f(x)} ${f(y)} ${f(x - r)} ${f(y)}Q${f(x)} ${f(y)} ${f(x)} ${f(y - r)}Z`;
    const big = P.filter((p) => p[2] > 0.93).map(([x, y, v]) => sp(x, y, u * (0.18 + (v - 0.93) * 4))).join("");
    const dust = Array.from({ length: n * 2 }, () => [R() * w, R() * h, s * (0.5 + R())]);
    return `<path d="${d}" stroke-width="${s * 0.8}" stroke-dasharray="${f(s * 3)} ${f(s * 2.5)}"/>${dotPaths(P.map(([x, y, v]) => [x, y, s * (1 + v * 2.4)]), 2)}${dotPaths(dust, 2)}<path d="${big}" fill="currentColor" stroke="none"/>`;
  },
  orbits(R, w, h, u, s) {
    let d = "", dash = "";
    const sats = [];
    const centers = [[w * (0.2 + R() * 0.2), h * (0.25 + R() * 0.2)], [w * (0.6 + R() * 0.25), h * (0.65 + R() * 0.2)]];
    for (const [cx, cy] of centers) {
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a = u * (2 + i * 1.6), b = a * (0.28 + R() * 0.25), rot = R() * Math.PI;
        const path = `M${f(cx + a * Math.cos(rot))} ${f(cy + a * Math.sin(rot))}` +
          `A${f(a)} ${f(b)} ${f((rot * 180) / Math.PI)} 1 1 ${f(cx - a * Math.cos(rot))} ${f(cy - a * Math.sin(rot))}` +
          `A${f(a)} ${f(b)} ${f((rot * 180) / Math.PI)} 1 1 ${f(cx + a * Math.cos(rot))} ${f(cy + a * Math.sin(rot))}`;
        if (i % 3 === 2) dash += path; else d += path;
        const t = R() * TAU, x = a * Math.cos(t), y = b * Math.sin(t);
        sats.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot), s * 3.2]);
      }
      sats.push([cx, cy, u * 0.7]);
    }
    return `<path d="${d}"/><path d="${dash}" stroke-dasharray="${f(s * 4)} ${f(s * 4)}"/>${dotPaths(sats, 1)}`;
  },
  raster(R, w, h, u) {
    const F = terrain(R, w, h, u), c = u * 0.42, gap = c * 0.16, by = ["", "", "", "", ""];
    for (let y = 0; y < h; y += c) for (let x = 0; x < w; x += c) {
      const v = F(x, y) * 1.05 + (R() - 0.5) * 0.18;
      const k = Math.max(0, Math.min(4, Math.floor(v * 5)));
      if (k) by[k] += `M${f(x + gap)} ${f(y + gap)}h${f(c - 2 * gap)}v${f(c - 2 * gap)}h${f(-(c - 2 * gap))}Z`;
    }
    return by.map((d, k) => (k && d ? `<path d="${d}" fill="currentColor" stroke="none" fill-opacity="${[0, 0.18, 0.4, 0.68, 1][k]}"/>` : "")).join("");
  },
  leaves(R, w, h, u, s, id) {
    const L = u * 0.55;
    const leaf = `M0 ${-L}C${f(L * 0.62)} ${f(-L * 0.45)} ${f(L * 0.5)} ${f(L * 0.5)} 0 ${L}C${f(-L * 0.5)} ${f(L * 0.5)} ${f(-L * 0.62)} ${f(-L * 0.45)} 0 ${-L}Z`;
    const veins = `M0 ${f(-L * 0.8)}V${f(L * 1.25)}` + [-0.4, -0.05, 0.3].map((y) => `M0 ${f(L * y)}l${f(L * 0.3)} ${f(-L * 0.25)}M0 ${f(L * y)}l${f(-L * 0.3)} ${f(-L * 0.25)}`).join("");
    let use = "";
    const g = u * 1.25;
    for (let j = 0, y = 0; y < h + g; j++, y += g * 0.8) for (let x = (j % 2 ? g / 2 : 0) + (R() - 0.5) * g * 0.3; x < w + g; x += g)
      use += `<use href="#${id}" transform="translate(${f(x + (R() - 0.5) * g * 0.3)} ${f(y + (R() - 0.5) * g * 0.3)}) rotate(${Math.round(R() * 360)}) scale(${f(0.65 + R() * 0.55)})"/>`;
    return `<defs><g id="${id}"><path d="${leaf}"/><path d="${veins}" stroke-width="${s * 0.8}"/></g></defs>${use}`;
  },
  peaks(R, w, h, u, s) {
    let d = "", snow = "";
    for (let y = u * 0.8; y < h + u * 1.4; y += u * 0.95) {
      let x = -u * R();
      d += `M${f(x)} ${f(y)}`;
      while (x < w + u) {
        const hw = u * (0.35 + R() * 0.65), ph = u * (0.35 + R() * 0.9);
        d += `L${f(x + hw)} ${f(y - ph)}L${f(x + hw * 2)} ${f(y)}`;
        if (ph > u * 0.85) snow += `M${f(x + hw * 0.62)} ${f(y - ph * 0.62)}L${f(x + hw * 0.85)} ${f(y - ph * 0.72)}L${f(x + hw * 1.05)} ${f(y - ph * 0.6)}L${f(x + hw * 1.38)} ${f(y - ph * 0.62)}`;
        x += hw * 2;
      }
    }
    return `<path d="${d}"/><path d="${snow}" stroke-width="${s * 0.8}"/>`;
  },
  routes(R, w, h, u, s) {
    const ports = Array.from({ length: Math.round((w * h) / (u * u * 7)) + 4 }, () => [R() * w, R() * h]);
    let d = "";
    for (let i = 0; i < ports.length; i++) {
      const a = ports[i];
      const near = ports.map((q, j) => [j, (q[0] - a[0]) ** 2 + (q[1] - a[1]) ** 2]).sort((x, y) => x[1] - y[1]);
      for (const [j] of [near[1 + Math.floor(R() * 3)], near[2 + Math.floor(R() * 6)]]) {
      const b = ports[j];
      if (!b || a === b) continue;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], bend = 0.25 + R() * 0.2;
      d += `M${f(a[0])} ${f(a[1])}Q${f(mx - dy * bend)} ${f(my + dx * bend)} ${f(b[0])} ${f(b[1])}`;
    } }
    const rings = ports.map(([x, y]) => `M${f(x - u * 0.22)} ${f(y)}a${f(u * 0.22)} ${f(u * 0.22)} 0 1 0 ${f(u * 0.44)} 0a${f(u * 0.22)} ${f(u * 0.22)} 0 1 0 ${f(-u * 0.44)} 0`).join("");
    return `<path d="${d}" stroke-dasharray="${f(s * 5)} ${f(s * 4)}"/><path d="${rings}"/>${dotPaths(ports.map(([x, y]) => [x, y, s * 2.2]), 1)}`;
  },
  drops(R, w, h, u, s, id) {
    const r = u * 0.26;
    const drop = `M0 ${f(-r * 1.9)}C${f(r * 0.55)} ${f(-r * 0.9)} ${f(r)} ${f(-r * 0.35)} ${f(r)} ${f(r * 0.2)}A${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(r * 0.2)}C${f(-r)} ${f(-r * 0.35)} ${f(-r * 0.55)} ${f(-r * 0.9)} 0 ${f(-r * 1.9)}Z`;
    let use = "";
    const g = u * 1.05;
    for (let j = 0, y = 0; y < h + g; j++, y += g * 0.9) for (let x = j % 2 ? g / 2 : 0; x < w + g; x += g) {
      const k = R();
      use += `<use href="#${id}" transform="translate(${f(x)} ${f(y)}) scale(${f(0.55 + k * 0.7)})"${k > 0.8 ? ' fill="currentColor"' : ""}/>`;
    }
    return `<defs><g id="${id}"><path d="${drop}"/><path d="M${f(-r * 0.45)} ${f(r * 0.1)}a${f(r * 0.5)} ${f(r * 0.5)} 0 0 0 ${f(r * 0.35)} ${f(r * 0.5)}" stroke-width="${s * 0.9}"/></g></defs>${use}`;
  },
  ripples(R, w, h, u, s) {
    let d = "";
    const n = 3 + Math.round((w * h) / (u * u * 90));
    for (let i = 0; i < n; i++) {
      const cx = R() * w, cy = R() * h, max = u * (3 + R() * 5);
      for (let r = u * 0.3; r < max; r += u * 0.32) d += `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;
    }
    return `<path d="${d}"/>`;
  },
  chevron(R, w, h, u, s) {
    let d = "", dd = "";
    const p = u * 0.9, a = u * 0.32;
    for (let y = 0, i = 0; y < h + a; y += u * 0.3, i++) {
      let path = `M${f(-p)} ${f(y)}`;
      for (let x = -p, k = 0; x < w + p; x += p / 2, k++) path += `L${f(x + p / 2)} ${f(y + (k % 2 ? 0 : -a))}`;
      if (i % 4 === 3) dd += path; else d += path;
    }
    return `<path d="${d}"/><path d="${dd}" stroke-width="${s * 2.2}"/>`;
  },
  plus(R, w, h, u, s) {
    const g = u * 0.75, k = g * 0.18;
    let d = "", ring = "";
    for (let j = 0, y = g / 2; y < h + g; j++, y += g) for (let i = 0, x = g / 2; x < w + g; i++, x += g) {
      if (i % 5 === 2 && j % 5 === 2) ring += `M${f(x - g * 0.32)} ${f(y)}a${f(g * 0.32)} ${f(g * 0.32)} 0 1 0 ${f(g * 0.64)} 0a${f(g * 0.32)} ${f(g * 0.32)} 0 1 0 ${f(-g * 0.64)} 0`;
      const kk = i % 5 === 2 && j % 5 === 2 ? k * 2.4 : k;
      d += `M${f(x - kk)} ${f(y)}h${f(kk * 2)}M${f(x)} ${f(y - kk)}v${f(kk * 2)}`;
    }
    return `<path d="${d}"/><path d="${ring}" stroke-width="${s * 1.4}"/>`;
  },
  voronoi(R, w, h, u, s) {
    const g = u * 1.25, nx = Math.ceil(w / g) + 2, ny = Math.ceil(h / g) + 2, P = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) P.push([(i - 0.5 + R() * 0.9) * g, (j - 0.5 + R() * 0.9) * g]);
    let d = "", fill = "";
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const [sx, sy] = P[j * nx + i];
      let c = [[sx - 3 * g, sy - 3 * g], [sx + 3 * g, sy - 3 * g], [sx + 3 * g, sy + 3 * g], [sx - 3 * g, sy + 3 * g]];
      for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) {
        if ((!a && !b) || i + a < 0 || j + b < 0 || i + a >= nx || j + b >= ny) continue;
        const [qx, qy] = P[(j + b) * nx + i + a];
        c = clip(c, (sx + qx) / 2, (sy + qy) / 2, qx - sx, qy - sy);
      }
      if (c.length < 3) continue;
      const inset = c.map(([x, y]) => [sx + (x - sx) * 0.86, sy + (y - sy) * 0.86]);
      d += poly(inset);
      if (R() < 0.12) fill += poly(c.map(([x, y]) => [sx + (x - sx) * 0.6, sy + (y - sy) * 0.6]));
    }
    return `<path d="${d}"/><path d="${fill}" fill="currentColor" stroke="none" fill-opacity=".5"/>${dotPaths(P.map(([x, y]) => [x, y, s * 1.8]), 1)}`;
  },
  dunes(R, w, h, u, s) {
    const p = [R() * TAU, R() * TAU, R() * TAU];
    let d = "";
    for (let y0 = -u, i = 0; y0 < h + u; y0 += u * 0.24, i++) {
      for (let x = -20, k = 0; x <= w + 20; x += u * 0.3, k++) {
        const y = y0 + u * 0.55 * Math.sin(x / (u * 3.1) + y0 / (u * 2.3) + p[0]) + u * 0.3 * Math.sin(x / (u * 1.3) - y0 / (u * 4) + p[1]) + u * 0.18 * Math.sin((x + y0) / (u * 0.9) + p[2]);
        d += (k ? "L" : "M") + f(x) + " " + f(y);
      }
    }
    return `<path d="${d}"/>`;
  },
  city(R, w, h, u, s) {
    let d = "", park = "";
    const split = (x, y, bw, bh, depth) => {
      const gap = u * (depth < 2 ? 0.34 : depth < 4 ? 0.2 : 0.1);
      if ((bw < u * 1.3 && bh < u * 1.3) || depth > 7) {
        if (bw < 4 || bh < 4) return;
        const rect = `M${f(x)} ${f(y)}h${f(bw)}v${f(bh)}h${f(-bw)}Z`;
        if (R() < 0.08) park += rect; else d += rect;
        return;
      }
      const vert = bw > bh ? R() < 0.85 : R() < 0.15, t = 0.3 + R() * 0.4;
      if (vert) { const a = (bw - gap) * t; split(x, y, a, bh, depth + 1); split(x + a + gap, y, bw - a - gap, bh, depth + 1); }
      else { const a = (bh - gap) * t; split(x, y, bw, a, depth + 1); split(x, y + a + gap, bw, bh - a - gap, depth + 1); }
    };
    split(-u, -u, w + 2 * u, h + 2 * u, 0);
    return `<path d="${d}"/><path d="${park}" fill="currentColor" stroke="none" fill-opacity=".45"/>`;
  },
  rivers(R, w, h, u, s) {
    const by = new Map();
    const add = (k, seg) => by.set(k, (by.get(k) || "") + seg);
    const grow = (x, y, a, len, sw, depth) => {
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len, b = (R() - 0.5) * len * 0.5;
      add(f(Math.max(s * 0.6, sw)), `M${f(x)} ${f(y)}Q${f((x + x2) / 2 - Math.sin(a) * b)} ${f((y + y2) / 2 + Math.cos(a) * b)} ${f(x2)} ${f(y2)}`);
      if (depth >= 7) return;
      const n = R() < 0.25 ? 1 : 2;
      for (let i = 0; i < n; i++) grow(x2, y2, a + (n === 1 ? (R() - 0.5) * 0.5 : (i ? 1 : -1) * (0.25 + R() * 0.45)), len * (0.72 + R() * 0.14), sw * 0.72, depth + 1);
    };
    const n = Math.max(2, Math.round(w / (u * 6)));
    const len = u * (1.6 + R() * 0.6) * Math.max(1, h / (u * 22));
    for (let i = 0; i < n; i++) grow(((i + 0.2 + R() * 0.6) / n) * w, h + u * 0.5, -Math.PI / 2 + (R() - 0.5) * 0.6, len, s * 4.5, 0);
    for (let i = 0; i < n - 1; i++) grow(((i + 0.7 + R() * 0.6) / n) * w, -u * 0.5, Math.PI / 2 + (R() - 0.5) * 0.6, len * 0.8, s * 3.6, 1);
    return [...by].map(([k, d]) => `<path d="${d}" stroke-width="${k}"/>`).join("");
  },
  hachure(R, w, h, u, s) {
    const F = terrain(R, w, h, u);
    let d = "";
    const g = u * 0.32;
    for (let y = 0; y < h; y += g) for (let x = 0; x < w; x += g) {
      const e = 2, gx = (F(x + e, y) - F(x - e, y)) / (2 * e), gy = (F(x, y + e) - F(x, y - e)) / (2 * e), m = Math.hypot(gx, gy);
      if (m * u < 0.015) continue;
      const L = Math.min(g * 0.95, m * u * g * 10);
      const jx = x + (R() - 0.5) * g * 0.4, jy = y + (R() - 0.5) * g * 0.4;
      d += `M${f(jx - (gx / m) * L / 2)} ${f(jy - (gy / m) * L / 2)}l${f((gx / m) * L)} ${f((gy / m) * L)}`;
    }
    return `<path d="${d}"/>`;
  },
};

/** full <svg> for a pattern. w,h: drawing size (user units) · u: motif size · sw: stroke width · seed: variation */
export function patternSvg(kind, { w = 400, h = 300, u = 40, sw = 1.4, seed = 1, cls = "pat", fit = "xMidYMid slice" } = {}) {
  const draw = DRAW[kind] || DRAW.contour;
  const body = draw(rng(seed * 2654435761 + kind.length * 97), w, h, u, sw, `pt${++uid}`);
  return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="${fit}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
export const PATTERN_KINDS = Object.keys(DRAW);
