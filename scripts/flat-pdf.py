#!/usr/bin/env python3
"""Wrap one big PNG in a single-page PDF as a JPEG image (a "flattened" print file).

Why: Chrome's vector PDFs keep CSS effects (gradient text, shadows, blur, translucency) as PDF
transparency groups / soft masks. Some viewers and print RIPs (e.g. Apple's PDF viewer) draw those wrong:
solid boxes over gradient text, dark blocks where shadows are. A flat image prints the same everywhere.

Usage: python3 scripts/flat-pdf.py in.png out.pdf WIDTH_MM HEIGHT_MM [jpeg_quality]
"""
import io
import sys

from PIL import Image

Image.MAX_IMAGE_PIXELS = None


def main():
    src, dst, w_mm, h_mm = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
    q = int(sys.argv[5]) if len(sys.argv) > 5 else 92
    im = Image.open(src).convert("RGB")
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=q, subsampling=0, optimize=True, dpi=(300, 300))
    jpg = buf.getvalue()
    W, H = w_mm / 25.4 * 72, h_mm / 25.4 * 72  # page size in points
    content = f"q {W:.2f} 0 0 {H:.2f} 0 0 cm /Im0 Do Q".encode()
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {W:.2f} {H:.2f}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>".encode(),
        f"<< /Type /XObject /Subtype /Image /Width {im.width} /Height {im.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length {len(jpg)} >>\nstream\n".encode() + jpg + b"\nendstream",
        f"<< /Length {len(content)} >>\nstream\n".encode() + content + b"\nendstream",
    ]
    out, offs = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"), []
    for i, o in enumerate(objs, 1):
        offs.append(len(out))
        out += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    out += b"".join(f"{o:010d} 00000 n \n".encode() for o in offs)
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    open(dst, "wb").write(out)
    dpi = im.width / (w_mm / 25.4)
    print(f"{dst}: {im.width}×{im.height}px on {w_mm:.0f}×{h_mm:.0f} mm = {dpi:.0f} dpi, {len(out) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
