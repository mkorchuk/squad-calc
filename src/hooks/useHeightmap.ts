import { useEffect, useState } from "react";
import { loadHeightmap, type HeightGrid } from "../lib/heightmap";

/**
 * Loads the height grid for `mapId`, returning null until it resolves.
 * Stale loads are ignored when the map changes mid-flight.
 */
export function useHeightmap(mapId: string): HeightGrid | null {
  const [grid, setGrid] = useState<HeightGrid | null>(null);

  useEffect(() => {
    let active = true;
    setGrid(null);
    loadHeightmap(mapId).then((g) => {
      if (active) setGrid(g);
    });
    return () => {
      active = false;
    };
  }, [mapId]);

  return grid;
}
