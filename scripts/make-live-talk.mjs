// Exclusive Talk lower third for the livestream: speaker + talk title in one bar.
//   poster/live/talk/talk-exclusive.png   1920×1080 transparent (+ cut/ trimmed, preview.png)
//   poster/live/canva/TGGC2026-talk.pptx   editable in Canva (Create a design → Import file)
// Text from the organisers' Exclusive Talk poster.
// Usage: node scripts/make-live-talk.mjs
import { card, iconBadge, renderSet } from "./live-bars.mjs";

await renderSet([
  { file: "talk-exclusive.png", label: "Exclusive Talk · คุณทราย สมุทร",
    html: card({ badge: iconBadge("mic"), tag: ["Exclusive Talk", "TGGC 2026"], name: "คุณทราย สมุทร",
      award: { pill: "“Nature Has Coordinates”", tier: "honor", note: "ทุกชีวิตมีพิกัด ทุกการอนุรักษ์มีเหตุผล" },
      lines: ["อควาแมนเมืองไทย · แรงบันดาลใจจากประสบการณ์จริง"] }) },
], "talk", "TGGC2026-talk.pptx");
