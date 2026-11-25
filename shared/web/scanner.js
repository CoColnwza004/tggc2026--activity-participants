// Camera QR scanner. Uses the browser's BarcodeDetector when it reads QR (Android Chrome),
// otherwise jsQR (Apache-2.0), which is downloaded only the first time the camera opens.
let jsQR = null;

export async function startScanner(video, onResult, { onError } = {}) {
  let stream, stopped = false, timer = 0, detector = null, last = "", lastAt = 0;
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
            const s = Math.min(1, 720 / Math.max(w, h));
            canvas.width = Math.round(w * s); canvas.height = Math.round(h * s);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const r = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
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
    if (!stopped) timer = setTimeout(tick, detector ? 90 : 140);
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
