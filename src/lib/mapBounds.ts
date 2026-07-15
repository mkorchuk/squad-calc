import { LatLngBounds, type LatLngBoundsExpression } from "leaflet";
import type { MapDefinition } from "../data/maps";

/**
 * Places a map image in a meter-based coordinate system for CRS.Simple.
 *
 * The image spans from top-left (0, 0) to bottom-right (-sizeY, sizeX), so a
 * Leaflet {lat, lng} pair equals game meters: lng = east meters (0..sizeX),
 * lat = -(south meters) (0..-sizeY). This lets ballistics.ts treat 1 unit = 1 m.
 */
export function boundsFor(map: MapDefinition): LatLngBoundsExpression {
  return [
    [0, 0],
    [-map.sizeY, map.sizeX],
  ];
}

export function latLngBoundsFor(map: MapDefinition): LatLngBounds {
  return new LatLngBounds([0, 0], [-map.sizeY, map.sizeX]);
}
