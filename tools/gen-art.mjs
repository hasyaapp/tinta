// Generates all original art assets for Tinta: UI glyphs, tray tool
// illustrations, journal covers, page templates, brush textures and the app
// icon. Deterministic: rerunning produces identical files.
//
//   node tools/gen-art.mjs
import { mkdirSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { fileURLToPath } from "node:url";
import { svg } from "./gen-art/util.mjs";
import { buildIcons } from "./gen-art/icons.mjs";
import { buildTray } from "./gen-art/tray.mjs";
import { buildCovers } from "./gen-art/covers.mjs";
import { buildTemplates } from "./gen-art/templates.mjs";
import { textures } from "./gen-art/textures.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ART = join(ROOT, "public/art");
const TEX = join(ROOT, "public/assets/textures");
mkdirSync(ART, { recursive: true });
mkdirSync(TEX, { recursive: true });

const written = [];
const save = (abs, data) => {
  writeFileSync(abs, data);
  written.push(abs);
};
const emitArt = (name, content) => save(join(ART, name), content);

buildIcons(emitArt);
buildTray(emitArt);
buildCovers(emitArt);
buildTemplates(emitArt);

for (const [name, make] of Object.entries(textures))
  save(join(TEX, name), make());

// App icon: paper-toned rounded square, abstract brush-stroke "T" with an ink
// drop. Glyph stays inside the central 80% safe zone for maskable icons.
const INK = "#1d3557";
const iconSvg = svg(
  "0 0 512 512",
  `<rect width="512" height="512" rx="118" fill="#f0e7d8"/>` +
    // horizontal brush stroke (top bar of the T), uneven painterly edges
    `<path d="M112 142c58-14 230-20 288-6 10 3 12 14 4 20-16 12-52 16-74 15-78-4-160 4-212 10-14 2-22-6-22-16 0-11 6-20 16-23Z" fill="${INK}"/>` +
    // vertical stroke (stem), tapering with a flick at the tail
    `<path d="M232 176c10-8 36-10 46-2 6 5 6 22 4 44-4 48-6 104-2 150 2 22-4 38-18 42-12 3-24-4-26-20-6-52-10-120-10-176 0-18 0-32 6-38Z" fill="${INK}"/>` +
    // dry-brush gaps in the stem
    `<path d="M248 214c3 0 5 2 5 6l-2 36c0 4-3 6-6 6s-5-3-5-7l2-35c0-4 3-6 6-6Z" fill="#f0e7d8" opacity="0.55"/>` +
    // ink drop accent
    `<path d="M338 318c14 20 26 40 26 56 0 17-12 28-26 28s-26-11-26-28c0-16 12-36 26-56Z" fill="#ed5340"/>` +
    `<circle cx="347" cy="383" r="5" fill="#f8b0a5"/>`,
);
save(join(ART, "icon.svg"), iconSvg);

for (const [file, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["icon-180.png", 180],
]) {
  const r = new Resvg(iconSvg, { fitTo: { mode: "width", value: size } });
  save(join(ART, file), r.render().asPng());
}

// Verify everything landed on disk and is non-empty.
const missing = written.filter((p) => {
  try {
    return statSync(p).size === 0;
  } catch {
    return true;
  }
});
const rel = (p) => p.slice(ROOT.length);
for (const p of written) console.log(rel(p));
console.log(`\n${written.length} files generated.`);
if (missing.length) {
  console.error(`MISSING/EMPTY: ${missing.map(rel).join(", ")}`);
  process.exit(1);
}
