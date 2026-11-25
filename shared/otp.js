// Rotating booth codes (TOTP-style). Runs in browsers and in Workers (WebCrypto only).
// A booth device holds the booth secret and shows a new 6-digit code + QR every STEP seconds;
// the server recomputes the code to verify. A photo of the QR stops working within ~1–2 minutes.

export const STEP = 30; // seconds per code
export const windowAt = (ms) => Math.floor(ms / 1000 / STEP);

const enc = new TextEncoder();

export const b64u = {
  enc(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  dec(str) {
    const s = atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4));
    const u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u;
  },
};

const keyCache = new Map();
async function key(raw) {
  const id = typeof raw === "string" ? raw : b64u.enc(raw);
  let k = keyCache.get(id);
  if (!k) {
    k = crypto.subtle.importKey("raw", typeof raw === "string" ? b64u.dec(raw) : raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    keyCache.set(id, k);
  }
  return k;
}

/** HMAC-SHA256(key, msg) → Uint8Array. key: Uint8Array or base64url string */
export async function hmac(rawKey, msg) {
  return new Uint8Array(await crypto.subtle.sign("HMAC", await key(rawKey), enc.encode(msg)));
}

/** 6-digit code of `booth` for time window `win` */
export async function codeFor(secret, booth, win) {
  const h = await hmac(secret, `${booth}:${win}`);
  const n = ((h[0] << 24) | (h[1] << 16) | (h[2] << 8) | h[3]) >>> 0;
  return String(n % 1000000).padStart(6, "0");
}

/** QR text: <booth>.<window base36>.<code> */
export const makePayload = (booth, win, code) => `${booth}.${win.toString(36)}.${code}`;

/** Accepts a raw payload, a site URL with #s=<payload>, or "<booth>..<code>" (typed code) */
export function parsePayload(text) {
  if (!text) return null;
  let t = String(text).trim();
  const m = t.match(/[#&?]s=([A-Za-z0-9._-]+)/);
  if (m) t = m[1];
  const p = t.match(/^([a-z0-9_-]{1,24})\.([0-9a-z]*)\.(\d{6})$/i);
  if (!p) return null;
  return { booth: p[1], win: p[2] ? parseInt(p[2], 36) : null, code: p[3], raw: t };
}
