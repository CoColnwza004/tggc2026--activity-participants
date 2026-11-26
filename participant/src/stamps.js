// Rubber-stamp artwork: a ring seal with the booth name on the rim, น้องจีออส's face in ink at the centre
// and the booth icon as a small seal. The whole stamp is masked with a speckle texture (ink-grunge)
// so each one looks hand-pressed; rotation + texture offset come from a seed, so a stamp always
// looks the same for the same passport.
import { iconPath } from "../../shared/web/icons.js";

let uid = 0;
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function stampHTML(booth, seedStr = "", extra = "") {
  const id = "st" + ++uid;
  const h = hash(seedStr + booth.id);
  const rot = ((h % 23) - 11) + (booth.no % 2 ? -4 : 4);
  const mx = (h >> 5) % 100, my = (h >> 11) % 100;
  const no = String(booth.no || 0).padStart(2, "0");
  const label = String(booth.en || booth.name).toUpperCase();
  const fs = Math.min(16, Math.max(9.5, 200 / (label.length * 0.74))).toFixed(1); // long names shrink to fit the rim
  const star = (x, y, r) => `<path d="M${x} ${y - r}c${r * 0.16} ${r * 0.6} ${r * 0.4} ${r * 0.84} ${r} ${r}c-${r * 0.6} ${r * 0.16}-${r * 0.84} ${r * 0.4}-${r} ${r}c-${r * 0.16}-${r * 0.6}-${r * 0.4}-${r * 0.84}-${r}-${r}c${r * 0.6}-${r * 0.16} ${r * 0.84}-${r * 0.4} ${r}-${r}z"/>`;
  return `<div class="stamp ${extra}" style="--ink:${booth.color};--rot:${rot}deg;--mx:${mx}%;--my:${my}%">
  <svg viewBox="0 0 200 200" aria-hidden="true">
    <defs>
      <path id="${id}a" d="M 31 100 A 69 69 0 0 1 169 100"/>
      <path id="${id}b" d="M 19 100 A 81 81 0 0 0 181 100"/>
    </defs>
    <g fill="none" stroke="currentColor">
      <circle cx="100" cy="100" r="95" stroke-width="5"/>
      <circle cx="100" cy="100" r="88" stroke-width="1.4" stroke-dasharray="2 3.2"/>
      <circle cx="100" cy="100" r="61" stroke-width="2.6"/>
    </g>
    <g fill="currentColor">
      <text class="st-top" style="font-size:${fs}px"><textPath href="#${id}a" startOffset="50%" text-anchor="middle">${esc(label)}</textPath></text>
      <text class="st-bot"><textPath href="#${id}b" startOffset="50%" text-anchor="middle">${booth.no ? `TGGC 2026 · BOOTH ${no}` : "TGGC 2026 · 28.11.2026"}</textPath></text>
      ${star(25, 100, 6)}${star(175, 100, 6)}
    </g>
  </svg>
  <i class="st-face"></i>
  <span class="st-seal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${iconPath(booth.icon)}</svg></span>
</div>`;
}

/** the gold "complete" seal used when every booth is done */
export function finalSealHTML() {
  return stampHTML({ id: "all", no: 0, en: "Geo Genius · Complete", color: "#c9971c", icon: "star" }, "final", "stamp-final");
}
