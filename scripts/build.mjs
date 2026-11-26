// Builds the three sites into dist/participant, dist/staff and dist/admin.
// - JS: bundled + minified with esbuild (code-split: the QR libraries load only when needed)
// - CSS: minified and inlined into the HTML (no extra request before first paint)
// - every file in assets/ gets a content hash in its name → cached for a year (immutable)
// - service worker gets the list of files to pre-cache
// Usage: node scripts/build.mjs
import { build, transform } from "esbuild";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { icon } from "../shared/web/icons.js";
import { EVENT } from "../shared/event.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const hash = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 10);
const UNHASHED = new Set(["og.jpg"]); // social preview image keeps a stable URL

const HEADERS = `/assets/*
  Cache-Control: public, max-age=31536000, immutable
/js/*
  Cache-Control: public, max-age=31536000, immutable
/sw.js
  Cache-Control: no-cache
/
  Cache-Control: no-cache
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(self), microphone=(), geolocation=()
`;

async function site(name, { sw = true, extraHeaders = "" } = {}) {
  const src = join(root, name, "src");
  const out = join(root, "dist", name);
  mkdirSync(out, { recursive: true });
  for (const f of readdirSync(out)) rmSync(join(out, f), { recursive: true, force: true }); // keep the folder (dev server watches it)
  mkdirSync(join(out, "assets"), { recursive: true });

  // 1. hashed assets
  const map = {};
  for (const f of readdirSync(join(root, "assets"))) {
    const buf = readFileSync(join(root, "assets", f));
    const dest = UNHASHED.has(f) ? f : `${basename(f, extname(f))}.${hash(buf)}${extname(f)}`;
    writeFileSync(join(out, "assets", dest), buf);
    map["assets/" + f] = "assets/" + dest;
  }
  const rewrite = (s) => s.replace(/assets\/[A-Za-z0-9_-]+\.(?:webp|png|jpg|svg)/g, (m) => map[m] || m);

  // 2. JS bundle
  const res = await build({
    entryPoints: [join(src, "app.js")],
    bundle: true, splitting: true, format: "esm", minify: true, target: ["es2020", "safari14"],
    outdir: join(out, "js"), entryNames: "app-[hash]", chunkNames: "c-[hash]", metafile: true, write: false,
    legalComments: "none", logLevel: "warning",
  });
  mkdirSync(join(out, "js"), { recursive: true });
  let entry = "";
  const jsFiles = [];
  for (const f of res.outputFiles) {
    writeFileSync(f.path, rewrite(f.text));
    const rel = "/js/" + basename(f.path);
    jsFiles.push(rel);
    if (basename(f.path).startsWith("app-")) entry = rel;
  }

  // 3. CSS (minified, inlined)
  const css = (await transform(readFileSync(join(src, "app.css"), "utf8"), { loader: "css", minify: true, target: ["safari14", "chrome90"] })).code;

  // 4. HTML
  let html = readFileSync(join(src, "index.html"), "utf8");
  html = html.replace(/\$\{(\w+)\}/g, (_, n) => icon(n));
  html = html.replace("<!--CSS-->", `<style>${css.trim()}</style>`);
  html = html.replace("<!--JS-->", `<script type="module" src="${entry}"></script>`);
  html = html.replace("</title>", `</title>\n<link rel="modulepreload" href="${entry}">`);
  html = rewrite(html).replace(/>\s+</g, "><").replace(/\n\s*/g, "\n");
  html = html.replace('content="assets/og.jpg"', `content="${EVENT.participantUrl.replace(/\/?$/, "/")}assets/og.jpg"`);
  writeFileSync(join(out, "index.html"), html);

  // 5. manifest
  if (existsSync(join(src, "manifest.webmanifest"))) writeFileSync(join(out, "manifest.webmanifest"), rewrite(readFileSync(join(src, "manifest.webmanifest"), "utf8")));

  // 6. service worker
  if (sw) {
    const pre = ["/", ...jsFiles, ...Object.values(map).filter((p) => /geos|logo|ink-grunge|icon-192/.test(p)).map((p) => "/" + p)];
    if (existsSync(join(src, "manifest.webmanifest"))) pre.push("/manifest.webmanifest");
    const version = hash(html + jsFiles.join() + pre.join());
    const swSrc = readFileSync(join(root, "participant", "src", "sw.js"), "utf8").replace("__VERSION__", version).replace("__PRECACHE__", JSON.stringify(pre));
    writeFileSync(join(out, "sw.js"), (await transform(swSrc, { minify: true, target: "es2020" })).code);
  }

  writeFileSync(join(out, "_headers"), HEADERS + extraHeaders);
  writeFileSync(join(out, "robots.txt"), name !== "participant" ? "User-agent: *\nDisallow: /\n" : "User-agent: *\nAllow: /\n");
  const size = (p) => readFileSync(p).length;
  console.log(`${name}: index.html ${(size(join(out, "index.html")) / 1024).toFixed(1)} KB · ${jsFiles.length} js files (${(jsFiles.reduce((a, f) => a + size(join(out, f)), 0) / 1024).toFixed(1)} KB) · entry ${(size(join(out, entry)) / 1024).toFixed(1)} KB`);
}

await site("participant");
await site("staff", { extraHeaders: "/*\n  X-Robots-Tag: noindex, nofollow\n" });
await site("admin", { sw: false, extraHeaders: "/*\n  X-Robots-Tag: noindex, nofollow\n" });
