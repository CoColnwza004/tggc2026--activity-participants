// Rasterises world land (world-atlas land-110m.json, TopoJSON, ISC licence) into a small
// equirectangular bitmask for the dotted globe on the home page. Prints JSON {W,H,b64}.
// Usage: node scripts/land-mask.mjs <land-110m.json> [width=200]
import { readFileSync } from "node:fs";

const topo = JSON.parse(readFileSync(process.argv[2], "utf8"));
const W = +process.argv[3] || 200, H = W / 2;
const { scale, translate } = topo.transform;

// decode quantised, delta-encoded arcs
const arcs = topo.arcs.map((arc) => {
  let x = 0, y = 0;
  return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * scale[0] + translate[0], y * scale[1] + translate[1]]; });
});
const ring = (ids) => {
  const pts = [];
  for (const id of ids) {
    const a = id < 0 ? arcs[~id].slice().reverse() : arcs[id];
    pts.push(...(pts.length ? a.slice(1) : a));
  }
  return pts;
};
const polys = [];
for (const g of topo.objects.land.geometries) {
  const list = g.type === "Polygon" ? [g.arcs] : g.type === "MultiPolygon" ? g.arcs : [];
  for (const p of list) polys.push(p.map(ring));
}
function inRing(x, y, r) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const inLand = (lon, lat) => polys.some((p) => inRing(lon, lat, p[0]) && !p.slice(1).some((h) => inRing(lon, lat, h)));

const bits = new Uint8Array(Math.ceil((W * H) / 8));
let n = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const lon = -180 + (x + 0.5) * (360 / W), lat = 90 - (y + 0.5) * (180 / H);
  if (inLand(lon, lat)) { const i = y * W + x; bits[i >> 3] |= 1 << (i & 7); n++; }
}
console.log(JSON.stringify({ W, H, land: n, b64: Buffer.from(bits).toString("base64") }));
