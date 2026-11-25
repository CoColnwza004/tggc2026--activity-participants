"""Cut น้องจีออส (GeoS) out of its white background.

The mascot is mostly white fur on a white background, so a plain "remove white" would
erase the fur. Instead the background is flood-filled from the image border over pixels
that are near-white AND flat (low local contrast); the mascot's grey/teal outline stops
the fill. The result is eroded by 1px and feathered so edges sit cleanly on any colour.

Usage: python3 scripts/cut-mascot.py <in.png> <out.png> [crop x0 y0 x1 y1] [--thr 238] [--sat 14] [--seam X]
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

args = sys.argv[1:]
thr = 238
sat = 14
seam = None
if "--seam" in args:
    i = args.index("--seam"); seam = int(args[i + 1]); del args[i:i + 2]
if "--sat" in args:
    i = args.index("--sat"); sat = int(args[i + 1]); del args[i:i + 2]
if "--thr" in args:
    i = args.index("--thr"); thr = int(args[i + 1]); del args[i:i + 2]
src, out = args[0], args[1]
img = Image.open(src).convert("RGB")
if seam is not None:
    # the source art has a faint 1-3px vertical line; blend it away with the columns beside it
    a = np.asarray(img).astype(np.float32).copy()
    L, R = a[:, seam - 3], a[:, seam + 3]
    for k, x in enumerate(range(seam - 2, seam + 3)):
        t = (k + 1) / 6
        a[:, x] = L * (1 - t) + R * t
    img = Image.fromarray(a.astype(np.uint8))
if len(args) >= 6:
    img = img.crop(tuple(int(v) for v in args[2:6]))
im = np.asarray(img).astype(np.float32)
h, w, _ = im.shape
mn = im.min(axis=2)
mx = im.max(axis=2)

# local contrast: max abs difference to 4-neighbours on luminance
lum = im.mean(axis=2)
g = np.zeros_like(lum)
g[1:, :] = np.maximum(g[1:, :], abs(lum[1:, :] - lum[:-1, :]))
g[:-1, :] = np.maximum(g[:-1, :], abs(lum[:-1, :] - lum[1:, :]))
g[:, 1:] = np.maximum(g[:, 1:], abs(lum[:, 1:] - lum[:, :-1]))
g[:, :-1] = np.maximum(g[:, :-1], abs(lum[:, :-1] - lum[:, 1:]))

bg_like = (mn > thr) & ((mx - mn) < sat) & (g < 6)

reached = np.zeros((h, w), bool)
reached[0, :] = bg_like[0, :]; reached[-1, :] = bg_like[-1, :]
reached[:, 0] = bg_like[:, 0]; reached[:, -1] = bg_like[:, -1]


def dilate(m):
    d = m.copy()
    d[1:, :] |= m[:-1, :]; d[:-1, :] |= m[1:, :]
    d[:, 1:] |= m[:, :-1]; d[:, :-1] |= m[:, 1:]
    return d


while True:
    nxt = dilate(reached) & bg_like
    if (nxt == reached).all():
        break
    reached = nxt

# grow background 1px into the anti-aliased white halo, then feather
halo = dilate(reached) & (mn > thr - 18)
bgm = reached | halo
alpha = np.where(bgm, 0, 255).astype(np.uint8)
a = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.8))
alpha = np.asarray(a).astype(np.float32) / 255.0
alpha = np.minimum(alpha, np.where(reached, 0.0, 1.0) + 0.0)

# de-matte: remove white fringe on semi-transparent pixels
rgb = im.copy()
m = (alpha > 0.02) & (alpha < 0.98)
for c in range(3):
    ch = rgb[..., c]
    ch[m] = np.clip((ch[m] - 255 * (1 - alpha[m])) / alpha[m], 0, 255)

outa = np.dstack([rgb, alpha * 255]).astype(np.uint8)
res = Image.fromarray(outa, "RGBA")
bbox = res.getbbox()
res = res.crop(bbox)
res.save(out)
print(out, res.size, "bg removed %.1f%%" % (100 * reached.mean()))
