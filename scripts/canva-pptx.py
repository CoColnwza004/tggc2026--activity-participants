"""Build a Canva-importable .pptx from the layers written by scripts/canva-layers.mjs.
Slide = 1920×1080 px (13.333 × 7.5 in, so 1 px = 0.5 pt): background picture, then pictures, then text boxes.
Usage: python3 scripts/canva-pptx.py spec.json out.pptx   (needs: pip install python-pptx)"""
import json, os, re, sys
from pptx import Presentation
from pptx.util import Emu, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import MSO_ANCHOR, MSO_AUTO_SIZE, PP_ALIGN

spec = json.load(open(sys.argv[1]))
root = spec["root"]
PX = 914400 * 13.3333333 / 1920  # EMU per px
E = lambda v: Emu(int(round(v * PX)))

def rgb(c):
    c = c.strip()
    if c.startswith("#"):
        c = c[1:]
        if len(c) == 3: c = "".join(ch * 2 for ch in c)
        return RGBColor.from_string(c[:6].upper())
    n = [float(v) for v in re.findall(r"[\d.]+", c)[:3]]
    return RGBColor(*[int(v) for v in n])

prs = Presentation()
prs.slide_width, prs.slide_height = E(1920), E(1080)
blank = prs.slide_layouts[6]

for s in spec["slides"]:
    sl = prs.slides.add_slide(blank)
    if s.get("name"):
        sl.name = s["name"]
    sl.shapes.add_picture(s["bg"], 0, 0, E(1920), E(1080)).name = "background"
    for im in s["images"]:
        f = im["file"] if os.path.isabs(im["file"]) else os.path.join(root, im["file"])
        sl.shapes.add_picture(f, E(im["x"]), E(im["y"]), E(im["w"]), E(im["h"])).name = os.path.basename(f)
    for t in s["texts"]:
        # a little slack on the right: Canva's text metrics are not the browser's
        tb = sl.shapes.add_textbox(E(t["x"]), E(t["y"]), E(t["w"] * 1.06 + 8), E(t["h"]))
        tb.name = t["text"].split("\n")[0][:40]
        tf = tb.text_frame
        tf.word_wrap = False
        tf.auto_size = MSO_AUTO_SIZE.NONE
        tf.vertical_anchor = MSO_ANCHOR.TOP
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        for i, line in enumerate(t["text"].split("\n")):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.alignment = PP_ALIGN.LEFT
            p.line_spacing = Pt(t["lh"] * 0.5)
            r = p.add_run()
            r.text = line
            f = r.font
            f.name = t["font"]
            f.size = Pt(t["size"] * 0.5)
            f.bold = t["weight"] >= 600
            f.color.rgb = rgb(t["color"])
            rPr = r._r.get_or_add_rPr()
            rPr.set("lang", "th-TH")
            if t["ls"]:
                rPr.set("spc", str(int(round(t["ls"] * 0.5 * 100))))
            # complex-script (Thai) font too, or PowerPoint/Canva fall back to a default Thai face
            for tag in ("a:latin", "a:ea", "a:cs"):
                el = rPr.find("{http://schemas.openxmlformats.org/drawingml/2006/main}" + tag.split(":")[1])
                if el is None:
                    el = rPr.makeelement("{http://schemas.openxmlformats.org/drawingml/2006/main}" + tag.split(":")[1], {})
                    rPr.append(el)
                el.set("typeface", t["font"])

prs.save(sys.argv[2])
print(sys.argv[2])
