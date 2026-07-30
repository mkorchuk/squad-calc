/**
 * Shared plumbing for the map-asset scripts (fetch-maps, verify-maps).
 *
 * Map assets are mirrored on our OWN Firebase Hosting deploy — the same files
 * this repo ships in dist/maps. There is no third-party upstream any more.
 * The bootstrap is circular but self-sustaining:
 *
 *   public/maps  →  dist/maps (vite copies public/ verbatim)
 *                →  https://squadcalc.web.app/maps/  (firebase deploy)
 *                →  public/maps  (npm run fetch-maps on a fresh clone)
 *
 * So at least one successful deploy must exist before a fresh clone can
 * bootstrap. fetch-maps never deletes or overwrites a file that is already
 * present locally, so a stale mirror can't destroy a good local copy.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Importing a .ts module from a .mjs script relies on Node's native type
// stripping (Node >= 22.18). maps.ts is types-only TypeScript, so it strips
// cleanly. If this ever breaks, the fallback is to hardcode the id list again.
import { MAPS } from "../src/data/maps.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Where fetch-maps writes, and where vite picks the assets up from. */
export const OUT_DIR = join(__dirname, "..", "public", "maps");

/**
 * The mirror. Override with MAPS_MIRROR to point at a preview channel, a
 * custom domain, or a future Firebase Storage bucket — nothing else needs to
 * change. The layout is flat: <base>/<id>.webp and <base>/<id>.height.json.
 */
export const BASE = process.env.MAPS_MIRROR ?? "https://squadcalc.web.app/maps";

/** Single source of truth for which maps exist: the app's own map table. */
export const MAP_IDS = MAPS.map((m) => m.id);

/** The two asset kinds, keyed by the suffix used both remotely and on disk. */
export const KINDS = {
  basemap: { suffix: ".webp", type: "image/webp", minBytes: 50 * 1024 },
  heightmap: { suffix: ".height.json", type: "application/json", minBytes: 10 * 1024 },
};

export function assetName(id, kind) {
  return `${id}${KINDS[kind].suffix}`;
}

export function assetUrl(id, kind) {
  return `${BASE}/${assetName(id, kind)}`;
}

/**
 * Returns { buf } on success or { error } on failure.
 *
 * The content-type check is load-bearing, not belt-and-braces: firebase.json
 * rewrites "**" to /index.html, so a file that is MISSING from the mirror comes
 * back as HTTP 200 text/html (a ~400 byte HTML page), not a 404. Checking only
 * res.ok would silently write that page over a map. Don't "simplify" this.
 */
export async function fetchAsset(url, expectedType) {
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    return { error: `network error (${err.message})` };
  }
  if (!res.ok) return { error: `HTTP ${res.status}` };
  const type = res.headers.get("content-type") ?? "";
  if (!type.startsWith(expectedType)) {
    return { error: `not on mirror (served ${type || "no content-type"})` };
  }
  return { buf: Buffer.from(await res.arrayBuffer()) };
}

/**
 * Probe an asset without downloading it. Returns { ok } | { error } | { size }.
 * Firebase Hosting honours HEAD, but fall back to a 1-byte ranged GET if some
 * other origin (a custom CDN, a future bucket) doesn't.
 */
export async function headAsset(url, expectedType) {
  let res;
  try {
    res = await fetch(url, { method: "HEAD" });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { headers: { Range: "bytes=0-0" } });
    }
  } catch (err) {
    return { error: `network error (${err.message})` };
  }
  if (!res.ok) return { error: `HTTP ${res.status}` };
  const type = res.headers.get("content-type") ?? "";
  if (!type.startsWith(expectedType)) {
    return { error: `not on mirror (served ${type || "no content-type"})` };
  }
  // content-range wins for the ranged fallback, where content-length is 1.
  const range = res.headers.get("content-range");
  const total = range?.match(/\/(\d+)$/)?.[1];
  const size = Number(total ?? res.headers.get("content-length") ?? 0);
  return { size };
}

/** Run async jobs with bounded concurrency, preserving nothing but the work. */
export async function runPool(jobs, concurrency = 6) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
    while (cursor < jobs.length) await jobs[cursor++]();
  });
  await Promise.all(workers);
}
