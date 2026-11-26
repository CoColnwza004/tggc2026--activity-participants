// Dotted 3D globe on a canvas: land dots glow mint, Thailand gets a pulsing pin,
// two orbit rings (one carries the logo's guiding star, one a small satellite).
// Pauses when off-screen or the tab is hidden; draws one still frame for reduced motion.
import { LAND } from "../../shared/land.js";

const bits = Uint8Array.from(atob(LAND.b64), (c) => c.charCodeAt(0));
function isLand(lon, lat) {
  const x = Math.min(LAND.W - 1, Math.floor(((lon + 180) / 360) * LAND.W));
  const y = Math.min(LAND.H - 1, Math.floor(((90 - lat) / 180) * LAND.H));
  const i = y * LAND.W + x;
  return (bits[i >> 3] >> (i & 7)) & 1;
}

const D2R = Math.PI / 180;
let POINTS = null;
function points(n) {
  if (POINTS && POINTS.n === n) return POINTS;
  const lat = new Float32Array(n), lon = new Float32Array(n), land = new Uint8Array(n);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - ((i + 0.5) * 2) / n;
    const phi = i * golden;
    lat[i] = Math.asin(y);
    lon[i] = Math.atan2(Math.sin(phi), Math.cos(phi));
    land[i] = isLand(lon[i] / D2R, lat[i] / D2R);
  }
  return (POINTS = { n, lat, lon, land });
}

export function createGlobe(canvas, opt = {}) {
  const o = { dots: 2600, speed: 0.16, tilt: 0.36, size: 0.36, ring: true, pin: [100.5, 13.9], ...opt };
  const ctx = canvas.getContext("2d");
  const P = points(o.dots);
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let w = 0, h = 0, dpr = 1, rot = -o.pin[0] * D2R + 0.5, raf = 0, prev = 0, visible = true, t0 = performance.now();
  let speed = o.speed;

  function fit() {
    dpr = Math.min(2, devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function ring(cx, cy, rx, ry, ang, front, color, lw) {
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(ang);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
    ctx.strokeStyle = color; ctx.lineWidth = lw;
    ctx.stroke();
    ctx.restore();
  }
  function sparkle(x, y, r, a) {
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.6);
    g.addColorStop(0, "rgba(44,195,148,.55)"); g.addColorStop(1, "rgba(44,195,148,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 2.6, 0, 7); ctx.fill();
    ctx.fillStyle = "#e9fff7";
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const q = (i * Math.PI) / 4, rr = i % 2 ? r * 0.28 : r; ctx.lineTo(Math.cos(q) * rr, Math.sin(q) * rr); }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - (prev || now)) / 1000);
    prev = now;
    rot += speed * dt;
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, w, h);
    const R = Math.min(w, h) * o.size, cx = w / 2, cy = h / 2;
    const ct = Math.cos(o.tilt), st = Math.sin(o.tilt);

    // atmosphere
    const atm = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.45);
    atm.addColorStop(0, "rgba(10,152,199,.35)"); atm.addColorStop(1, "rgba(10,152,199,0)");
    ctx.fillStyle = atm; ctx.beginPath(); ctx.arc(cx, cy, R * 1.45, 0, 7); ctx.fill();
    const body = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    body.addColorStop(0, "#0d6fae"); body.addColorStop(0.7, "#06446f"); body.addColorStop(1, "#042c4a");
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();

    const ringAng = -0.42, rx = R * 1.55, ry = R * 0.36;
    const starA = t * 0.55, satA = -t * 0.38 + 2;
    if (o.ring) {
      ring(cx, cy, rx, ry, ringAng, false, "rgba(167,213,219,.35)", 1.4);
      ring(cx, cy, rx * 0.82, ry * 1.5, 0.55, false, "rgba(44,195,148,.22)", 1);
      if (Math.sin(starA) < 0) drawOrbiter(starA, rx, ry, ringAng, "star");
      if (Math.sin(satA) < 0) drawOrbiter(satA, rx * 0.82, ry * 1.5, 0.55, "sat");
    }

    // dots
    const base = R / 95;
    for (let i = 0; i < P.n; i++) {
      const la = P.lat[i], lo = P.lon[i] + rot;
      const cl = Math.cos(la);
      const x = cl * Math.sin(lo), y0 = Math.sin(la), z0 = cl * Math.cos(lo);
      const y = y0 * ct - z0 * st, z = y0 * st + z0 * ct;
      if (z < 0) continue;
      const sx = cx + x * R, sy = cy - y * R;
      if (P.land[i]) {
        ctx.globalAlpha = 0.35 + 0.65 * z;
        ctx.fillStyle = z > 0.55 ? "#5ff0bf" : "#2cc394";
        const s = base * (1.5 + 1.1 * z);
        if (o.round) { ctx.beginPath(); ctx.arc(sx, sy, s / 2, 0, 7); ctx.fill(); } // print: round dots
        else ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
      } else {
        ctx.globalAlpha = 0.12 + 0.3 * z;
        ctx.fillStyle = "#a7d5db";
        const s = base * 0.9;
        if (o.round) { ctx.beginPath(); ctx.arc(sx, sy, s / 2, 0, 7); ctx.fill(); }
        else ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;

    // rim light
    const rim = ctx.createRadialGradient(cx + R * 0.2, cy + R * 0.25, R * 0.7, cx, cy, R * 1.02);
    rim.addColorStop(0, "rgba(255,255,255,0)"); rim.addColorStop(1, "rgba(167,240,220,.28)");
    ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();

    // Thailand pin
    if (o.pin) {
      const la = o.pin[1] * D2R, lo = o.pin[0] * D2R + rot, cl = Math.cos(la);
      const x = cl * Math.sin(lo), y0 = Math.sin(la), z0 = cl * Math.cos(lo);
      const y = y0 * ct - z0 * st, z = y0 * st + z0 * ct;
      if (z > 0.05) {
        const sx = cx + x * R, sy = cy - y * R, k = (t % 1.8) / 1.8;
        ctx.globalAlpha = (1 - k) * z;
        ctx.strokeStyle = "#ffd166"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx, sy, 4 + k * R * 0.22, 0, 7); ctx.stroke();
        ctx.globalAlpha = z;
        ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(sx, sy, Math.max(3, R * 0.03), 0, 7); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(sx, sy, Math.max(1.4, R * 0.012), 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    if (o.ring) {
      ring(cx, cy, rx, ry, ringAng, true, "rgba(167,213,219,.6)", 1.6);
      ring(cx, cy, rx * 0.82, ry * 1.5, 0.55, true, "rgba(44,195,148,.4)", 1.1);
      if (Math.sin(starA) >= 0) drawOrbiter(starA, rx, ry, ringAng, "star");
      if (Math.sin(satA) >= 0) drawOrbiter(satA, rx * 0.82, ry * 1.5, 0.55, "sat");
    }

    function drawOrbiter(a, rx, ry, ang, kind) {
      const ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
      const x = cx + ex * Math.cos(ang) - ey * Math.sin(ang), y = cy + ex * Math.sin(ang) + ey * Math.cos(ang);
      const front = Math.sin(a) >= 0;
      if (kind === "star") sparkle(x, y, R * 0.11, front ? 1 : 0.45);
      else {
        ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.globalAlpha = front ? 1 : 0.4;
        ctx.fillStyle = "#a7d5db"; ctx.fillRect(-R * 0.09, -R * 0.018, R * 0.06, R * 0.036); ctx.fillRect(R * 0.03, -R * 0.018, R * 0.06, R * 0.036);
        ctx.fillStyle = "#fcfdfd"; ctx.fillRect(-R * 0.025, -R * 0.025, R * 0.05, R * 0.05);
        ctx.restore();
      }
    }
  }

  function loop(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    frame(now);
    if (!still) raf = requestAnimationFrame(loop);
  }
  const start = () => { if (!raf) { prev = 0; raf = requestAnimationFrame(loop); } };

  fit();
  const ro = new ResizeObserver(() => { fit(); if (still || !raf) frame(performance.now()); });
  ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); });
  io.observe(canvas);
  const vis = () => { if (!document.hidden) start(); };
  document.addEventListener("visibilitychange", vis);
  start();

  return {
    setSpeed(s) { speed = s; },
    get speed() { return speed; },
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", vis); },
  };
}
