// Regenerates the favicon / app-icon set in public/ from the source art in icons/.
// One-off: only needed when the source icon changes. Run: npm run gen-icons
//
// The source is a single 480x480 PNG with rounded, transparent corners. Browser-tab
// favicons and manifest icons keep that transparency; the Apple touch icon is flattened
// onto the app background (#1b2029) because iOS composites transparent corners over black.

import sharp from "sharp";
import pngToIco from "png-to-ico";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(root, "icons", "SquadCalc Icons-selection.png");
const OUT = path.join(root, "public");
const APP_BG = "#1b2029"; // --bg in src/styles/theme.css

// Transparent PNGs for the browser tab and web manifest.
const pngIcons = [
  { file: "favicon-16.png", size: 16 },
  { file: "favicon-32.png", size: 32 },
  { file: "favicon-48.png", size: 48 },
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
];

async function run() {
  for (const { file, size } of pngIcons) {
    await sharp(SRC).resize(size, size).png().toFile(path.join(OUT, file));
    console.log(`wrote public/${file} (${size}x${size})`);
  }

  // Apple touch icon: opaque background so iOS doesn't render black corners.
  await sharp(SRC)
    .resize(180, 180)
    .flatten({ background: APP_BG })
    .png()
    .toFile(path.join(OUT, "apple-touch-icon.png"));
  console.log("wrote public/apple-touch-icon.png (180x180)");

  // Multi-resolution .ico for legacy browsers and the default /favicon.ico probe.
  const ico = await pngToIco([16, 32, 48].map((s) => path.join(OUT, `favicon-${s}.png`)));
  await writeFile(path.join(OUT, "favicon.ico"), ico);
  console.log("wrote public/favicon.ico (16/32/48)");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
