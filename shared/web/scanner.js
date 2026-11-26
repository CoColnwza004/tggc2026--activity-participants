// Camera QR scanner. Uses the browser's BarcodeDetector when it reads QR (Android Chrome),
// otherwise jsQR (Apache-2.0), which is downloaded only the first time the camera opens.
let jsQR = null;

export async function startScanner(video, onResult, { onError } = {}) {
  let stream, stopped = false, timer = 0, detector = null, last = "", lastAt = 0, frame = 0;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
  } catch (e) {
    onError && onError(e);
    return () => {};
  }
  video.setAttribute("playsinline", "");
  video.muted = true;
  video.srcObject = stream;
  try { await video.play(); } catch { /* autoplay quirks: frames still arrive */ }

  try {
    if ("BarcodeDetector" in window) {
      const f = await window.BarcodeDetector.getSupportedFormats();
      if (f.includes("qr_code")) detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    }
  } catch { detector = null; }
  if (!detector && !jsQR) {
    try { jsQR = (await import("../../vendor/jsqr.min.js")).default; } catch (e) { onError && onError(e); }
  }

  async function tick() {
    if (stopped) return;
    let text = null;
    try {
      if (video.readyState >= 2) {
        if (detector) {
          const codes = await detector.detect(video);
          if (codes.length) text = codes[0].rawValue;
        } else if (jsQR) {
          const w = video.videoWidth, h = video.videoHeight;
          if (w && h) {
            // iPhone/iPad (no BarcodeDetector): read the middle of the picture, where the on-screen frame is.
            // Alternate a tight and a wide crop: quicker per frame and finds both near and far QR codes.
            const side = Math.min(w, h) * (++frame % 2 ? 0.72 : 1), sx = (w - side) / 2, sy = (h - side) / 2;
            const out = Math.min(640, Math.round(side));
            canvas.width = out; canvas.height = out;
            ctx.drawImage(video, sx, sy, side, side, 0, 0, out, out);
            const img = ctx.getImageData(0, 0, out, out);
            const r = jsQR(img.data, out, out, { inversionAttempts: "dontInvert" });
            if (r) text = r.data;
          }
        }
      }
    } catch { /* keep scanning */ }
    if (text && !stopped) {
      const now = Date.now();
      if (text !== last || now - lastAt > 2500) {
        last = text; lastAt = now;
        if ((await onResult(text)) === true) return stop();
      }
    }
    if (!stopped) timer = setTimeout(tick, detector ? 90 : 60);
  }
  function stop() {
    stopped = true;
    clearTimeout(timer);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  }
  tick();
  return stop;
}

export const hasCamera = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
