/**
 * Downloads each map's basemap image and heightmap into public/maps/.
 * Run once after a fresh clone: `npm run fetch-maps`.
 *
 *   <id>.webp         — basemap tile image (shown on the map)
 *   <id>.height.json  — 500x500 grid of terrain heights in meters, used to
 *                       compute an accurate firing elevation (heightDiff).
 *
 * Assets come from our own Firebase Hosting mirror (see scripts/mapAssets.mjs
 * for the bootstrap chain and the MAPS_MIRROR override). Heights on the mirror
 * are already rounded to 0.1m — sub-decimeter terrain precision has no
 * meaningful effect on the firing elevation, and it roughly halves file size —
 * so the bytes are written straight through with no re-processing.
 *
 * Files already present locally are never re-downloaded or overwritten, so a
 * broken mirror can't clobber a good local copy.
 *
 * Data is © OWI and is bundled locally for personal use.
 */
import { mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";

import {
  BASE,
  KINDS,
  MAP_IDS,
  OUT_DIR,
  assetName,
  assetUrl,
  fetchAsset,
  runPool,
} from "./mapAssets.mjs";

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** id → line, so interleaved parallel jobs still report in a stable order. */
const log = new Map();
const failures = [];

async function download(id, kind) {
  const name = assetName(id, kind);
  const out = join(OUT_DIR, name);
  if (await exists(out)) {
    log.set(name, `= ${name} (present)`);
    return;
  }
  const { buf, error } = await fetchAsset(assetUrl(id, kind), KINDS[kind].type);
  if (error) {
    log.set(name, `✗ ${name}: ${error}`);
    failures.push(name);
    return;
  }
  await writeFile(out, buf);
  log.set(name, `✓ ${name} (${(buf.length / 1024).toFixed(0)} KB)`);
}

await mkdir(OUT_DIR, { recursive: true });
console.log(`Fetching ${MAP_IDS.length} maps from ${BASE}\n  into ${OUT_DIR}\n`);

const kinds = Object.keys(KINDS);
await runPool(MAP_IDS.flatMap((id) => kinds.map((kind) => () => download(id, kind))));

for (const id of MAP_IDS) {
  for (const kind of kinds) console.log(log.get(assetName(id, kind)));
}

if (failures.length > 0) {
  console.error(`\n${failures.length} asset(s) missing locally and absent from the mirror:`);
  for (const name of failures) console.error(`  ${name}`);
  console.error(
    "\nThe mirror only holds maps it has already been deployed. For a NEW map, place\n" +
      "the files in public/maps/ by hand, then `npm run deploy` to publish them to the\n" +
      "mirror. See the \"Map imagery\" section of CLAUDE.md.",
  );
  // Set the code rather than process.exit() — a hard exit while fetch's
  // keep-alive sockets are still open trips a libuv assertion on Windows and
  // reports 127 instead of 1. Letting Node drain exits cleanly with the code.
  process.exitCode = 1;
}

console.log("\nDone.");
