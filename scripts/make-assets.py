"""Builds the web images in assets/ from assets-src/ (run once; outputs are committed).

  geos.webp          น้องจีออส (main pose, background removed, seam line fixed)
  geos-front.webp    small standing pose from the character sheet
  geos-ink.webp      GeoS head as an ink mask (alpha only) — the face on every stamp
  ink-grunge.webp    speckle mask that makes stamps look hand-pressed
  logo-*.webp        logo (from the registration site's cut-out PNGs)
  icon-*.png         PWA / home-screen icons

Usage: python3 scripts/make-assets.py
"""
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / "assets-src", ROOT / "assets"
TMP = OUT / "_tmp"
OUT.mkdir(exist_ok=True)
TMP.mkdir(exist_ok=True)
cut = [sys.executable, str(ROOT / "scripts" / "cut-mascot.py")]


def webp(im, name, q=86):
    im.save(OUT / name, "WEBP", quality=q, method=6)
    print(name, im.size, (OUT / name).stat().st_size // 1024, "KB")


# --- mascot ---
subprocess.run(cut + [str(SRC / "geos-original.png"), str(TMP / "geos.png"), "--seam", "160"], check=True)
subprocess.run(cut + [str(SRC / "geos-sheet.webp"), str(TMP / "front.png"), "396", "140", "514", "308"], check=True)
geos = Image.open(TMP / "geos.png")
webp(geos, "geos.webp", 88)
webp(Image.open(TMP / "front.png"), "geos-front.webp", 90)

# --- ink face for stamps: dark lines of the head become ink, white fur becomes paper ---
cx, cy, s = 172, 96, 212
head = Image.new("RGBA", (s, s), (0, 0, 0, 0))
head.paste(geos.crop((cx - s // 2, cy - s // 2, cx + s // 2, cy + s // 2)), (0, 0))
a = np.asarray(head).astype(np.float32)
lum = a[..., :3].mean(axis=2)
ink = np.clip((228 - lum) / 105, 0, 1) ** 0.85 * (a[..., 3] / 255)
yy, xx = np.mgrid[0:s, 0:s]
r = np.hypot(xx - s / 2, yy - s / 2) / (s / 2)
ink *= np.clip((1.0 - r) / 0.12, 0, 1)  # soft round edge
out = np.zeros((s, s, 4), np.uint8)
out[..., :3] = 255
out[..., 3] = (ink * 255).astype(np.uint8)
webp(Image.fromarray(out, "RGBA").resize((240, 240), Image.LANCZOS), "geos-ink.webp", 90)

# --- grunge mask: mostly solid, with speckles and worn patches like a real rubber stamp ---
rng = np.random.default_rng(2026)
n = 320


def noise(scale):
    g = rng.random((n // scale + 2, n // scale + 2))
    im = Image.fromarray((g * 255).astype(np.uint8)).resize((n, n), Image.BICUBIC)
    return np.asarray(im).astype(np.float32) / 255


f = noise(40) * 0.5 + noise(14) * 0.3 + noise(4) * 0.2
speck = rng.random((n, n))
m = np.ones((n, n), np.float32)
m[f > 0.66] = 0.35
m[f > 0.74] = 0.0
m[speck > 0.985] = 0.0
m[(speck > 0.94) & (f > 0.55)] = 0.2
mi = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
g = np.zeros((n, n, 4), np.uint8)
g[..., :3] = 255
g[..., 3] = np.asarray(mi)
webp(Image.fromarray(g, "RGBA").resize((256, 256), Image.LANCZOS), "ink-grunge.webp", 70)

# --- logo ---
full = Image.open(SRC / "logo-full.png").convert("RGBA")
webp(full.resize((480, round(480 * full.height / full.width)), Image.LANCZOS), "logo-full.webp", 84)
mark = Image.open(SRC / "logo-mark.png").convert("RGBA")
webp(mark.resize((192, 192), Image.LANCZOS), "logo-mark.webp", 92)


# --- icons ---
def icon(size, bg, pad, name, round_=True):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if round_:
        d.rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * 0.22), fill=bg)
    else:
        d.rectangle((0, 0, size, size), fill=bg)
    inner = int(size * (1 - 2 * pad))
    mk = mark.resize((inner, inner), Image.LANCZOS)
    im.alpha_composite(mk, ((size - inner) // 2, (size - inner) // 2))
    im.save(OUT / name, optimize=True)
    print(name, (OUT / name).stat().st_size // 1024, "KB")


icon(192, (252, 253, 253, 255), 0.12, "icon-192.png")
icon(512, (252, 253, 253, 255), 0.12, "icon-512.png")
icon(512, (252, 253, 253, 255), 0.2, "icon-maskable.png", round_=False)
icon(180, (252, 253, 253, 255), 0.1, "apple-touch-icon.png", round_=False)

for p in TMP.iterdir():
    p.unlink()
TMP.rmdir()
