// Canva-editable export for the live graphics. On a rendered page:
//   [data-t]          → becomes a real text box (font, size, colour, letter spacing taken from the page;
//                       data-color overrides gradient text, which a text box can't carry)
//   [data-img="file"] → becomes its own picture (the source file, at its drawn size)
// Everything else is flattened into one background picture. scripts/canva-pptx.py turns the layers into a
// .pptx: Canva → Create a design → Import file keeps each text box editable.
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

export async function layers(page, bgPath, { transparent = false } = {}) {
  const L = await page.evaluate(() => {
    const px = (v) => parseFloat(v) || 0;
    const texts = [...document.querySelectorAll("[data-t]")].map((e) => {
      const s = getComputedStyle(e), rg = document.createRange();
      rg.selectNodeContents(e);
      const r = rg.getBoundingClientRect();
      let text = e.innerText.trim();
      if (s.textTransform === "uppercase") text = text.toUpperCase();
      const lines = text.split("\n").length, size = px(s.fontSize);
      const lh = s.lineHeight === "normal" ? size * 1.3 : px(s.lineHeight);
      // text range covers the glyph boxes; move up to the line box so the pptx line spacing lands the same
      const y = r.top - (lh - r.height / lines) / 2;
      return { x: r.left, y, w: r.width, h: lh * lines, text, size, lh,
        font: s.fontFamily.split(",")[0].replace(/["']/g, "").trim(), weight: +s.fontWeight,
        color: e.dataset.color || s.color, ls: s.letterSpacing === "normal" ? 0 : px(s.letterSpacing) };
    });
    const images = [...document.querySelectorAll("[data-img]")].map((e) => {
      const r = e.getBoundingClientRect(), k = Math.min(r.width / e.naturalWidth, r.height / e.naturalHeight);
      const w = e.naturalWidth * k, h = e.naturalHeight * k;
      return { x: r.left + (r.width - w) / 2, y: r.top + (r.height - h) / 2, w, h, file: e.dataset.img };
    });
    return { texts, images };
  });
  const hide = await page.addStyleTag({ content: `[data-t],[data-t] *{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;background:none!important}
    [data-img]{visibility:hidden!important}` });
  await page.screenshot({ path: bgPath, omitBackground: transparent });
  await hide.evaluate((n) => n.remove());
  return { bg: bgPath, ...L };
}

export function writePptx(slides, outFile, specFile) {
  writeFileSync(specFile, JSON.stringify({ root, slides }));
  execFileSync("python3", [root + "scripts/canva-pptx.py", specFile, outFile], { stdio: "inherit" });
}
