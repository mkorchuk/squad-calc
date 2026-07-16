/**
 * Downloads each map's basemap image and heightmap into public/maps/.
 * Run once: `npm run fetch-maps`.
 *
 *   <id>.webp         — basemap tile image (shown on the map)
 *   <id>.height.json  — 500x500 grid of terrain heights in meters, used to
 *                       compute an accurate firing elevation (heightDiff).
 *
 * Data is © OWI / SquadCalc and is bundled locally for personal use.
 */
import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "maps");
const BASE = "https://squadcalc.app/api/img/maps";

const MAP_IDS = [
  "albasrah", "anvil", "blackcoast", "chora", "fallujah", "foolsroad",
  "goosebay", "gorodok", "harju", "jensen", "kamdesh", "kohat", "kokan",
  "lashkar", "logar", "manicouagan", "mestia", "mutaha", "narva", "pacific",
  "sanxian", "skorpo", "sumari", "tallil", "yehorivka",
];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function downloadBasemap(id) {
  const out = join(OUT_DIR, `${id}.webp`);
  if (await exists(out)) {
    console.log(`= ${id}.webp (present)`);
    return;
  }
  const url = `${BASE}/${id}/basemap.webp`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`✗ ${id}.webp: HTTP ${res.status}`);
    return;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(out, buf);
  console.log(`✓ ${id}.webp (${(buf.length / 1024).toFixed(0)} KB)`);
}

async function downloadHeightmap(id) {
  const out = join(OUT_DIR, `${id}.height.json`);
  if (await exists(out)) {
    console.log(`= ${id}.height.json (present)`);
    return;
  }
  const url = `${BASE}/${id}/heightmap.json`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`✗ ${id}.height.json: HTTP ${res.status} (no heightmap for this map)`);
    return;
  }
  const grid = await res.json();
  // Round to 0.1m to roughly halve the file size; sub-decimeter terrain
  // precision has no meaningful effect on the firing elevation.
  const rounded = grid.map((row) => row.map((v) => Math.round(v * 10) / 10));
  const text = JSON.stringify(rounded);
  await writeFile(out, text);
  console.log(`✓ ${id}.height.json (${(text.length / 1024).toFixed(0)} KB)`);
}

await mkdir(OUT_DIR, { recursive: true });
console.log(`Downloading ${MAP_IDS.length} maps into ${OUT_DIR}\n`);
for (const id of MAP_IDS) {
  await downloadBasemap(id);
  await downloadHeightmap(id);
}
console.log("\nDone.");
