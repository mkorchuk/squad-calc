/**
 * Checks that every map this app knows about is actually present on the mirror:
 * `npm run verify-maps`.
 *
 * The mirror is what a fresh clone bootstraps from, so a gap here means the next
 * clone can't build — worth catching before a user does. Run it after a deploy,
 * especially after adding a new map.
 *
 * Reports per asset:
 *   ok       — correct content-type and a plausible size
 *   MISSING  — 404, or the SPA rewrite serving index.html in its place
 *   SUSPECT  — right content-type but implausibly small (a truncated upload)
 *
 * Sizes are over-the-wire, so the .height.json figures read far smaller than the
 * files on disk — Hosting gzips them. The SUSPECT thresholds in KINDS are set
 * against compressed sizes accordingly.
 *
 * Read-only: it never writes to public/maps. Exits non-zero if anything is off.
 */
import { BASE, KINDS, MAP_IDS, assetName, assetUrl, headAsset, runPool } from "./mapAssets.mjs";

const results = new Map();

async function check(id, kind) {
  const name = assetName(id, kind);
  const { type, minBytes } = KINDS[kind];
  const { size, error } = await headAsset(assetUrl(id, kind), type);
  if (error) {
    results.set(name, { status: "MISSING", detail: error });
  } else if (size < minBytes) {
    results.set(name, { status: "SUSPECT", detail: `only ${(size / 1024).toFixed(0)} KB` });
  } else {
    results.set(name, { status: "ok", detail: `${(size / 1024).toFixed(0)} KB` });
  }
}

const kinds = Object.keys(KINDS);
console.log(`Verifying ${MAP_IDS.length * kinds.length} assets on ${BASE}\n`);

await runPool(MAP_IDS.flatMap((id) => kinds.map((kind) => () => check(id, kind))));

const bad = [];
for (const id of MAP_IDS) {
  for (const kind of kinds) {
    const name = assetName(id, kind);
    const { status, detail } = results.get(name);
    if (status === "ok") {
      console.log(`✓ ${name} (${detail})`);
    } else {
      console.log(`✗ ${name}: ${status} — ${detail}`);
      bad.push(name);
    }
  }
}

const total = MAP_IDS.length * kinds.length;
console.log(`\n${total - bad.length}/${total} ok.`);

if (bad.length > 0) {
  console.error(
    `\n${bad.length} asset(s) not usable from the mirror. A fresh clone will fail to\n` +
      "bootstrap these. Confirm they exist in public/maps/ locally, then `npm run deploy`.",
  );
  // See the note in fetch-maps.mjs: process.exit() during in-flight fetches
  // trips a libuv assertion on Windows.
  process.exitCode = 1;
}
