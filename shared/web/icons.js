// Inline SVG icons (24×24, stroke = currentColor). Booth icons double as the badge on each stamp.
const P = {
  map: '<path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
  satellite: '<path d="m13 7 4 4-6 6-4-4z"/><path d="m4.5 9.5 3-3 3 3-3 3zM13.5 18.5l3-3 3 3-3 3z" transform="translate(-1.5 -1.5)"/><path d="M16 4a4 4 0 0 1 4 4M16 1.5A6.5 6.5 0 0 1 22.5 8"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  drone: '<rect x="9" y="10" width="6" height="4" rx="1.5"/><path d="M9 11 6 8M15 11l3-3M9 13l-3 3M15 13l3 3"/><path d="M3 7h6M15 7h6M3 17h6M15 17h6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  leaf: '<path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15"/><path d="M5 19c3-4 6-7 10-9"/>',
  mountain: '<path d="m2 20 7-12 4 6 2-3 7 9z"/><path d="m7.5 10.5 1.5 1.5 1.5-1.5"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  star: '<path d="M12 2c.6 4.8 2.2 8.4 8 10-5.8 1.6-7.4 5.2-8 10-.6-4.8-2.2-8.4-8-10 5.8-1.6 7.4-5.2 8-10z"/>',
  uni: '<path d="M2 9.5 12 5l10 4.5-10 4.5z"/><path d="M6 11.5V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.5M22 9.5v5"/>',
  plane: '<path d="M10.5 21 12 17l1.5 4M12 3c1 0 1.5 1 1.5 2v4.5L21 14v2l-7.5-2.5V17L12 18l-1.5-1v-3.5L3 16v-2l7.5-4.5V5c0-1 .5-2 1.5-2z"/>',
  drop: '<path d="M12 3s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10 12 3 12 3z"/><path d="M9 15a3 3 0 0 0 3 3"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21a2 2 0 0 1 2-2h13v2H6"/><path d="M9 7h6"/>',
  // ui
  home: '<path d="m3 11 9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  passport: '<rect x="5" y="2.5" width="14" height="19" rx="2"/><circle cx="12" cy="10" r="3.5"/><path d="M9 16.5h6"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M4 12h16"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M17 20h4v-3M14 20v.01"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  gift: '<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13"/><path d="M12 8C10.5 4.5 6.5 4 6.5 6.5S12 8 12 8zm0 0c1.5-3.5 5.5-4 5.5-1.5S12 8 12 8z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  place: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  keypad: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M7 9h.01M11 9h.01M15 9h.01M7 13h.01M11 13h.01M15 13h.01M8 16h8"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="m17 9 5 6M22 9l-5 6"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  sparkle: '<path d="M12 3c.5 4 2 5.5 6 6-4 .5-5.5 2-6 6-.5-4-2-5.5-6-6 4-.5 5.5-2 6-6zM19 15c.2 1.6.8 2.2 2.4 2.4-1.6.2-2.2.8-2.4 2.4-.2-1.6-.8-2.2-2.4-2.4 1.6-.2 2.2-.8 2.4-2.4z"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  cloud: '<path d="M7 18a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.5 1.5A4 4 0 0 1 17.5 18z"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
};

export const icon = (name, cls = "") =>
  `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.star}</svg>`;

export const iconPath = (name) => P[name] || P.star;

// prize art: generic small appliances (no brands) for the prize showcase in the app and on posters
export function prizeArt(art) {
  if (art === "airfryer")
    return `<svg class="prize-svg" viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="afA" x1="0" x2="1"><stop offset="0" stop-color="#14324a"/><stop offset=".45" stop-color="#31607f"/><stop offset="1" stop-color="#0f2739"/></linearGradient></defs>
      <ellipse cx="60" cy="109" rx="36" ry="5" fill="#062033" opacity=".16"/>
      <path d="M30 34c0-14 8-22 22-22h16c14 0 22 8 22 22v66a6 6 0 0 1-6 6H36a6 6 0 0 1-6-6z" fill="url(#afA)"/>
      <rect x="40" y="20" width="40" height="18" rx="6" fill="#0a1c2b"/><circle cx="50" cy="29" r="4" fill="#2cc394"/><rect x="58" y="24.5" width="15" height="3" rx="1.5" fill="#7fe0c8"/><rect x="58" y="30.5" width="9" height="3" rx="1.5" fill="#7fe0c8" opacity=".55"/>
      <path d="M31 45h58" stroke="#000" stroke-opacity=".28" stroke-width="2"/>
      <rect x="35" y="51" width="50" height="49" rx="7" fill="#0b2031"/><rect x="42" y="58" width="36" height="19" rx="5" fill="#0a98c7" opacity=".38"/><path d="M45 62h11" stroke="#fff" stroke-opacity=".55" stroke-width="2.5" stroke-linecap="round"/>
      <rect x="46" y="85" width="28" height="9" rx="4.5" fill="#2cc394"/><path d="M36 17c-3 7-4 15-4 25" stroke="#fff" stroke-opacity=".2" stroke-width="3" stroke-linecap="round" fill="none"/></svg>`;
  if (art === "kettle")
    return `<svg class="prize-svg" viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="ktA" x1="0" x2="1"><stop offset="0" stop-color="#d4eef1"/><stop offset=".45" stop-color="#fff"/><stop offset="1" stop-color="#b5dde3"/></linearGradient></defs>
      <ellipse cx="58" cy="109" rx="40" ry="5" fill="#062033" opacity=".16"/>
      <path d="M78 38c16 0 20 9 20 25s-4 25-16 27" fill="none" stroke="#0a98c7" stroke-width="9" stroke-linecap="round"/>
      <path d="M33 46 12 31l-3 5 22 22z" fill="#c6e6ea" stroke="#a7d5db" stroke-width="2" stroke-linejoin="round"/>
      <path d="M35 30h44l8 66H27z" fill="url(#ktA)" stroke="#a7d5db" stroke-width="2" stroke-linejoin="round"/>
      <rect x="37" y="22" width="40" height="10" rx="5" fill="#0a98c7"/><rect x="51" y="15" width="12" height="9" rx="4" fill="#075f98"/>
      <rect x="44" y="50" width="7" height="36" rx="3.5" fill="#0a98c7" opacity=".3"/><rect x="44" y="68" width="7" height="18" rx="3.5" fill="#0a98c7" opacity=".55"/>
      <rect x="22" y="95" width="70" height="11" rx="4" fill="#075f98"/><circle cx="80" cy="100.5" r="2.5" fill="#2cc394"/></svg>`;
  if (art === "hairdryer")
    return `<svg class="prize-svg" viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="hdA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3ad3a3"/><stop offset="1" stop-color="#128a63"/></linearGradient></defs>
      <ellipse cx="66" cy="111" rx="28" ry="4" fill="#062033" opacity=".16"/>
      <g stroke="#0a98c7" stroke-width="3" stroke-linecap="round" opacity=".55"><path d="M2 38h9M0 47h11M2 56h9"/></g>
      <path d="M64 56 78 103a6 6 0 0 1-5.6 7.6h-6.6a6 6 0 0 1-5.8-4.6L52 60z" fill="#075f98"/><rect x="66" y="74" width="6" height="13" rx="3" fill="#2cc394" transform="rotate(-16 69 80)"/>
      <rect x="24" y="31" width="72" height="32" rx="16" fill="url(#hdA)"/><path d="M34 37h40" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>
      <rect x="15" y="35" width="15" height="24" rx="4" fill="#0a2b42"/>
      <circle cx="94" cy="47" r="21" fill="#15a8a0"/><circle cx="94" cy="47" r="14" fill="#0d6f6a"/><g stroke="#3ad3a3" stroke-width="2"><path d="M84 47h20M94 37v20M87 40l14 14M101 40 87 54"/></g></svg>`;
  if (art === "pillow")
    return `<svg class="prize-svg" viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="npA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6fd0f2"/><stop offset="1" stop-color="#075f98"/></linearGradient></defs>
      <ellipse cx="60" cy="106" rx="42" ry="6" fill="#062033" opacity=".16"/>
      <path d="M34 90C19 82 13 66 15 52c3-21 22-34 45-34s42 13 45 34c2 14-4 30-19 38" fill="none" stroke="url(#npA)" stroke-width="27" stroke-linecap="round"/>
      <path d="M22 62c-1-16 9-30 28-34" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="5" stroke-linecap="round"/>
      <g fill="#fff" opacity=".45"><circle cx="60" cy="18" r="2"/><circle cx="84" cy="24" r="2"/><circle cx="36" cy="24" r="2"/><circle cx="100" cy="44" r="2"/><circle cx="20" cy="44" r="2"/></g></svg>`;
  if (art === "fan")
    return `<svg class="prize-svg spin-fan" viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="fg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a98c7"/><stop offset="1" stop-color="#15a8a0"/></linearGradient></defs>
      <rect x="54" y="66" width="12" height="42" rx="6" fill="#075f98"/><rect x="36" y="104" width="48" height="9" rx="4.5" fill="#075f98"/><circle cx="60" cy="48" r="38" fill="#e9f6f8" stroke="url(#fg1)" stroke-width="6"/>
      <g class="blades" fill="#2cc394"><path d="M60 48c-4-14 2-26 10-26 6 0 6 14-10 26z"/><path d="M60 48c14-4 26 2 26 10 0 6-14 6-26-10z"/><path d="M60 48c4 14-2 26-10 26-6 0-6-14 10-26z"/><path d="M60 48c-14 4-26-2-26-10 0-6 14-6 26 10z"/></g>
      <circle cx="60" cy="48" r="6" fill="#075f98"/><g stroke="#075f98" stroke-opacity=".25" stroke-width="1.5" fill="none"><circle cx="60" cy="48" r="20"/><circle cx="60" cy="48" r="30"/></g></svg>`;
  return `<svg class="prize-svg" viewBox="0 0 120 120" aria-hidden="true"><rect x="20" y="50" width="80" height="56" rx="8" fill="#2cc394"/><rect x="14" y="36" width="92" height="20" rx="6" fill="#148e64"/><rect x="54" y="36" width="12" height="70" fill="#fcfdfd"/><path d="M60 36c-8-18-30-18-30-4 0 8 18 6 30 4zm0 0c8-18 30-18 30-4 0 8-18 6-30 4z" fill="#0a98c7"/></svg>`;
}
