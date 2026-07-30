/**
 * Terrain heightmaps — "Deducing Altitude".
 *
 * Each map has a 500x500 grid of terrain heights in meters (bundled at
 * /maps/<id>.height.json by `npm run fetch-maps`). Sampling mirrors the game so
 * the firing elevation matches: a game coordinate in meters maps to a grid cell
 * by `500 / mapSizeMeters`, and out-of-bounds lookups return 0 (not the nearest
 * edge).
 */
import type { MapDefinition } from "../data/maps";

export type HeightGrid = number[][];

const GRID = 500; // heightmap resolution (cells per axis)

const cache = new Map<string, HeightGrid | null>();
const inflight = new Map<string, Promise<HeightGrid | null>>();

/** Load (and cache) a map's height grid. Returns null if it has no heightmap. */
export function loadHeightmap(mapId: string): Promise<HeightGrid | null> {
  if (cache.has(mapId)) return Promise.resolve(cache.get(mapId) ?? null);
  const pending = inflight.get(mapId);
  if (pending) return pending;

  const req = fetch(`/maps/${mapId}.height.json`)
    .then((res) => (res.ok ? (res.json() as Promise<HeightGrid>) : null))
    .then((grid) => {
      cache.set(mapId, grid);
      inflight.delete(mapId);
      return grid;
    })
    .catch(() => {
      cache.set(mapId, null);
      inflight.delete(mapId);
      return null;
    });

  inflight.set(mapId, req);
  return req;
}

/**
 * Terrain height (meters) at a marker coordinate. `lng` is east meters (0..sizeX),
 * `lat` is -(south meters) (0..-sizeY). Returns 0 when out of bounds or no grid.
 */
export function sampleHeight(
  grid: HeightGrid | null,
  map: MapDefinition,
  lat: number,
  lng: number
): number {
  if (!grid) return 0;
  const col = Math.round(lng * (GRID / map.sizeX));
  const row = Math.round(-lat * (GRID / map.sizeY));
  const gridRow = grid[row];
  if (gridRow && typeof gridRow[col] === "number") return gridRow[col];
  return 0;
}
