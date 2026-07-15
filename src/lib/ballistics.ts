/**
 * Pure firing-solution math, replicated from the original SquadCalc.
 *
 * Coordinate convention: markers store Leaflet {lat, lng} where the map image is
 * placed in meters directly (see lib/mapBounds.ts), so 1 unit == 1 meter and
 * `lat` increases upward (north). Elevation assumes flat terrain (no heightmaps
 * are bundled), i.e. heightDiff = 0.
 */
import type { Weapon } from "../data/weapons";

export interface Point {
  lat: number;
  lng: number;
}

const MIL_PER_DEGREE = 6400 / 360;

/** Horizontal distance between two points, in meters. */
export function getDistance(from: Point, to: Point): number {
  const dLat = to.lat - from.lat;
  const dLng = to.lng - from.lng;
  return Math.hypot(dLat, dLng);
}

/**
 * Compass bearing from `from` to `to`, in degrees [0, 360).
 * North = 0/360, East = 90, South = 180, West = 270.
 */
export function getBearing(from: Point, to: Point): number {
  // lat is negated because Leaflet lat grows upward while screen-y grows down.
  const latDelta = -(to.lat - from.lat);
  const lngDelta = to.lng - from.lng;
  let bearing = (Math.atan2(latDelta, lngDelta) * 180) / Math.PI + 90;
  if (bearing < 0) bearing += 360;
  return bearing % 360;
}

/** Maximum ballistic range on flat terrain, in meters (where the solution exists). */
export function getMaxRange(weapon: Weapon): number {
  const { velocity: v, gravity: g, heightOffset } = weapon;
  const heightDiff = 0; // flat terrain
  return Math.sqrt(v ** 4 - 2 * g * (heightDiff - heightOffset) * v ** 2) / g;
}

export interface Elevation {
  deg: number;
  mil: number;
  inRange: boolean;
}

/**
 * High-angle firing elevation for a given distance (flat terrain).
 * Returns { deg, mil, inRange }. `inRange` is false when the target is closer
 * than the weapon minimum or beyond max ballistic range.
 */
export function getElevation(distance: number, weapon: Weapon): Elevation {
  const { velocity: v, gravity: g, minDistance, heightOffset, angleOffset } = weapon;

  const heightDiff = 0; // flat terrain
  const discriminant =
    v ** 4 - g * (g * distance ** 2 + 2 * (heightDiff - heightOffset) * v ** 2);

  const inRange = distance >= minDistance && discriminant >= 0 && distance > 0;
  if (!inRange) {
    return { deg: NaN, mil: NaN, inRange: false };
  }

  const p1 = Math.sqrt(discriminant);
  // High-angle solution (+p1), matching the mortar's arcing trajectory.
  const elevRad = Math.atan((v ** 2 + p1) / (g * distance)) - angleOffset;
  const deg = (elevRad * 180) / Math.PI;
  return { deg, mil: deg * MIL_PER_DEGREE, inRange: true };
}
