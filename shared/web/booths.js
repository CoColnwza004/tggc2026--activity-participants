// Booth details edited on the admin site: fetched from /api/booths and laid over shared/event.js at runtime.
// Cached in localStorage so a reload (or no signal) still shows the latest names and logos.
import { EVENT } from "../event.js";

const KEY = "tggc-booths-v1";
const DEFAULTS = new Map(EVENT.booths.map((b) => [b.id, { ...b }]));

/** cfg = { booths: { b1: { th, en, place, icon, desc, logo } } } (only changed fields) */
export function applyBooths(cfg) {
  for (const b of EVENT.booths) {
    const o = (cfg && cfg.booths && cfg.booths[b.id]) || {};
    Object.assign(b, DEFAULTS.get(b.id), o, { logo: o.logo || null });
    b.name = b.en;
  }
}

export const logoUrl = (b) => (b && b.logo ? `/api/logo/${b.id}?v=${b.logo}` : "");

/** apply the cached copy now, then refresh from the server; onChange runs when something changed */
export async function loadBooths(onChange) {
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { /* private mode */ }
  if (cached) applyBooths(cached);
  try {
    const r = await fetch("/api/booths", { cache: "no-store" });
    const j = await r.json();
    if (!j || !j.ok) return;
    const fresh = JSON.stringify({ booths: j.booths });
    if (fresh === JSON.stringify(cached ? { booths: cached.booths } : { booths: {} })) return;
    try { localStorage.setItem(KEY, fresh); } catch { /* ignore */ }
    applyBooths(j);
    if (onChange) onChange();
  } catch { /* offline: keep what we have */ }
}
