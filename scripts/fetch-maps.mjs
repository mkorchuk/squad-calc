/**
 * Downloads each map's basemap image from squadcalc.app into public/maps/.
 * Run once: `npm run fetch-maps`.
 *
 * Imagery is © OWI / SquadCalc and is bundled locally for personal use.
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

async function download(id) {
  const out = join(OUT_DIR, `${id}.webp`);
  if (await exists(out)) {
    console.log(`= ${id}.webp (already present)`);
    return;
  }
  const url = `${BASE}/${id}/basemap.webp`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`✗ ${id}: HTTP ${res.status} (${url})`);
    return;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(out, buf);
  console.log(`✓ ${id}.webp (${(buf.length / 1024).toFixed(0)} KB)`);
}

await mkdir(OUT_DIR, { recursive: true });
console.log(`Downloading ${MAP_IDS.length} maps into ${OUT_DIR}\n`);
for (const id of MAP_IDS) {
  await download(id);
}
console.log("\nDone.");
