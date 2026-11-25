// Celebration effects: confetti/firework canvas, synthesized sounds (no audio files), haptics.
const COLORS = ["#075f98", "#0a98c7", "#15a8a0", "#2cc394", "#148e64", "#a7d5db", "#ffd166", "#ffffff"];
const reduce = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

let cv, cx, parts = [], raf = 0, last = 0;
function ensure() {
  if (cv) return;
  cv = document.createElement("canvas");
  cv.className = "fx-canvas";
  cv.setAttribute("aria-hidden", "true");
  document.body.appendChild(cv);
  cx = cv.getContext("2d");
  const fit = () => {
    const d = Math.min(2, devicePixelRatio || 1);
    cv.width = innerWidth * d; cv.height = innerHeight * d;
    cx.setTransform(d, 0, 0, d, 0, 0);
  };
  fit();
  addEventListener("resize", fit);
}

function star(c, r) {
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4, rr = i % 2 ? r * 0.32 : r;
    c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
}

function loop(t) {
  const dt = Math.min(0.033, (t - (last || t)) / 1000);
  last = t;
  cx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter((p) => (p.life -= dt) > 0 && p.y < innerHeight + 40);
  for (const p of parts) {
    p.vy += p.g * dt; p.vx *= p.drag; p.vy *= p.drag;
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    cx.save();
    cx.globalAlpha = Math.min(1, p.life / 0.6);
    cx.translate(p.x, p.y); cx.rotate(p.rot);
    cx.fillStyle = p.c;
    if (p.s === 0) { cx.scale(1, Math.cos(p.rot * 3)); cx.fillRect(-p.r, -p.r * 0.45, p.r * 2, p.r * 0.9); }
    else if (p.s === 1) star(cx, p.r);
    else { cx.beginPath(); cx.arc(0, 0, p.r * 0.5, 0, 7); cx.fill(); }
    cx.restore();
  }
  if (parts.length) raf = requestAnimationFrame(loop);
  else { raf = 0; last = 0; cx.clearRect(0, 0, innerWidth, innerHeight); }
}
const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

/** burst from (x, y): an explosion of confetti and star sparkles */
export function burst(x, y, n = 90, power = 1) {
  if (reduce()) return;
  ensure();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = (220 + Math.random() * 520) * power;
    parts.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 260 * power, g: 900, drag: 0.985,
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, r: 4 + Math.random() * 6,
      c: COLORS[(Math.random() * COLORS.length) | 0], s: Math.random() < 0.22 ? 1 : Math.random() < 0.85 ? 0 : 2,
      life: 2.2 + Math.random() * 1.6,
    });
  }
  kick();
}

/** fireworks: several bursts high on the screen over `ms` */
export function fireworks(ms = 2600) {
  if (reduce()) return;
  const end = Date.now() + ms;
  (function shot() {
    burst(innerWidth * (0.15 + Math.random() * 0.7), innerHeight * (0.12 + Math.random() * 0.3), 60, 0.75);
    if (Date.now() < end) setTimeout(shot, 280 + Math.random() * 260);
  })();
}

/** gentle rain from the top (used for the "next year" screen, in leaf greens) */
export function drift(n = 26, colors = ["#2cc394", "#15a8a0", "#a7d5db", "#148e64"]) {
  if (reduce()) return;
  ensure();
  for (let i = 0; i < n; i++) {
    parts.push({
      x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * 0.5, vx: (Math.random() - 0.5) * 40, vy: 60 + Math.random() * 60,
      g: 10, drag: 1, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 3, r: 5 + Math.random() * 5,
      c: colors[(Math.random() * colors.length) | 0], s: 2, life: 7,
    });
  }
  kick();
}

// ---------- sound (WebAudio synth) ----------
let ac = null;
export const sound = { on: true };
function ctx() {
  if (!sound.on) return null;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume();
    return ac;
  } catch { return null; }
}
function tone(f, t0, dur, type = "sine", vol = 0.2, f2 = 0) {
  const a = ctx(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, a.currentTime + t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, a.currentTime + t0 + dur);
  g.gain.setValueAtTime(0.0001, a.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(vol, a.currentTime + t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + t0); o.stop(a.currentTime + t0 + dur + 0.05);
}
function thud(t0 = 0) {
  const a = ctx(); if (!a) return;
  const len = 0.18, buf = a.createBuffer(1, a.sampleRate * len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = buf; f.type = "lowpass"; f.frequency.value = 700; g.gain.value = 0.9;
  s.connect(f).connect(g).connect(a.destination);
  s.start(a.currentTime + t0);
  tone(150, t0, 0.22, "sine", 0.55, 48);
}
export const sfx = {
  unlock() { ctx(); },
  stamp() { thud(0); tone(1318, 0.16, 0.35, "triangle", 0.09); tone(1976, 0.24, 0.5, "triangle", 0.07); },
  tick() { tone(880, 0, 0.05, "square", 0.025); },
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.11, 0.5, "triangle", 0.12)); tone(1568, 0.6, 1.2, "sine", 0.08); },
  lose() { tone(392, 0, 0.35, "sine", 0.1, 330); tone(330, 0.3, 0.6, "sine", 0.08, 262); },
  whoosh() { tone(220, 0, 1.6, "sawtooth", 0.025, 1200); },
  pop() { tone(660, 0, 0.12, "sine", 0.12, 990); },
};

export const buzz = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch { /* not supported */ } };
