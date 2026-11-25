// QR → crisp inline SVG. The generator (Kazuhiko Arase, MIT) is loaded only when first needed.
let lib = null;

export async function qrSvg(text, { ecc = "M", margin = 2, color = "#0a2b42", bg = "#ffffff" } = {}) {
  if (!lib) lib = (await import("../../vendor/qrcode.js")).default;
  const q = lib(0, ecc);
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  const size = n + margin * 2;
  let d = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!q.isDark(r, c)) continue;
      let run = 1;
      while (c + run < n && q.isDark(r, c + run)) run++;
      d += `M${c + margin} ${r + margin}h${run}v1h-${run}z`;
      c += run - 1;
    }
  }
  return `<svg class="qr-svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${size}" height="${size}" fill="${bg}"/><path d="${d}" fill="${color}"/></svg>`;
}
