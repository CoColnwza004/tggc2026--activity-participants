// Exclusive Talk lower thirds for the livestream: the speaker, and the talk title.
//   poster/live/talk/talk-*.png   1920×1080 transparent (+ cut/ trimmed, preview.png)
//   poster/live/canva/TGGC2026-talk.pptx   editable in Canva (Create a design → Import file)
// Text from the organisers' Exclusive Talk poster.
// Usage: node scripts/make-live-talk.mjs
import { card, iconBadge, renderSet } from "./live-bars.mjs";

const TAG = ["Exclusive Talk", "TGGC 2026"];
await renderSet([
  { file: "talk-1-speaker.png", label: "คุณทราย สมุทร",
    html: card({ badge: iconBadge("mic"), tag: TAG, name: "คุณทราย สมุทร", lines: ["อควาแมนเมืองไทย"] }) },
  { file: "talk-2-title.png", label: "Nature Has Coordinates",
    html: card({ badge: iconBadge("pin"), tag: TAG, name: "“Nature Has Coordinates”",
      lines: ["ทุกชีวิตมีพิกัด ทุกการอนุรักษ์มีเหตุผล", "แรงบันดาลใจจากประสบการณ์จริง · โดย คุณทราย สมุทร"] }) },
], "talk", "TGGC2026-talk.pptx");
