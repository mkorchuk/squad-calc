/**
 * Pure firing-solution math for the in-game mortar.
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
 * High-angle firing elevation for a given distance.
 * `heightDiff` = targetAltitude - weaponAltitude (meters); pass 0 for flat
 * terrain. Returns { deg, mil, inRange }. `inRange` is false when the target is
 * closer than the weapon minimum, beyond max ballistic range, or the required
 * angle falls outside the weapon's firing-angle range.
 */
export function getElevation(
  distance: number,
  weapon: Weapon,
  heightDiff = 0
): Elevation {
  const { velocity: v, gravity: g, minDistance, heightOffset, angleOffset } = weapon;

  const discriminant =
    v ** 4 - g * (g * distance ** 2 + 2 * (heightDiff - heightOffset) * v ** 2);

  if (distance < minDistance || distance <= 0 || discriminant < 0) {
    return { deg: NaN, mil: NaN, inRange: false };
  }

  const p1 = Math.sqrt(discriminant);
  // High-angle solution (+p1), matching the mortar's arcing trajectory.
  const elevRad = Math.atan((v ** 2 + p1) / (g * distance)) - angleOffset;
  const deg = (elevRad * 180) / Math.PI;

  const [minDeg, maxDeg] = weapon.minElevation;
  if (deg < minDeg || deg > maxDeg) {
    return { deg: NaN, mil: NaN, inRange: false };
  }

  return { deg, mil: deg * MIL_PER_DEGREE, inRange: true };
}

export interface Spread {
  /** Lateral dispersion length, in meters (the ellipse's major axis / horizontal spread). */
  semiMajor: number;
  /** Down-range dispersion length, in meters (the ellipse's minor axis / vertical spread). */
  semiMinor: number;
  /** Radius of a circle bounding the whole footprint = max(semiMajor, semiMinor) / 2. */
  radius: number;
}

/**
 * Time of flight (seconds) for the high-angle shot. Falls back to a flat-terrain
 * approximation when the height term makes the root imaginary.
 */
function getTimeOfFlight(v: number, g: number, angleRad: number, heightDiff: number): number {
  const vy = v * Math.sin(angleRad);
  let t = vy + Math.sqrt(vy ** 2 + 2 * g * -heightDiff);
  if (Number.isNaN(t)) t = vy + Math.sqrt(vy ** 2);
  return t / g;
}

/**
 * Dispersion ellipse axes for the high-angle firing solution. The in-game
 * scatter forms an ellipse tilted to the firing line, with both axes depending
 * on the firing angle (and thus distance):
 *
 *  - Lateral (semiMajor): the MOA cone's horizontal velocity component carried
 *    over the whole time of flight, `sin(moaRad) · v · tof`. Large and nearly
 *    flat across range (~32–36 m for the mortar).
 *  - Down-range (semiMinor): difference in flat range between the cone's upper
 *    and lower edges (θ ± moa/2), via the range equation `v²·sin(2θ)/g`. Large
 *    for near/steep shots and collapses toward max range as θ → 45°.
 *
 * Returns both axes plus a bounding-circle `radius`, or null when there is no
 * valid firing solution (same gating as getElevation).
 */
export function getSpread(distance: number, weapon: Weapon, heightDiff = 0): Spread | null {
  const elevation = getElevation(distance, weapon, heightDiff);
  if (!elevation.inRange) return null;

  const { velocity: v, gravity: g, moa } = weapon;
  const angleRad = (elevation.deg * Math.PI) / 180;
  const moaRad = ((moa / 60) * Math.PI) / 180; // MOA -> degrees -> radians (full cone)

  // Lateral spread: horizontal velocity from the cone half-angle, over the flight.
  const tof = getTimeOfFlight(v, g, angleRad, heightDiff);
  const semiMajor = Math.max(0, Math.sin(moaRad) * v * tof);

  // Down-range spread: difference in flat range between the cone's upper and
  // lower edges (angle ± moa/2).
  const upper = (v ** 2 * Math.sin(2 * (angleRad + moaRad / 2))) / g;
  const lower = (v ** 2 * Math.sin(2 * (angleRad - moaRad / 2))) / g;
  const semiMinor = Math.max(0, Math.abs(lower - upper));

  return { semiMajor, semiMinor, radius: Math.max(semiMajor, semiMinor) / 2 };
}

/**
 * Polygon approximation of the dispersion ellipse for drawing on the map, as an
 * array of [lat, lng] pairs. The ellipse is centred on the target and oriented to
 * the firing line: its down-range half-axis (`semiMinor / 2`) points along the
 * bearing, its lateral half-axis (`semiMajor / 2`) across it, so the ellipse is
 * tilted by the firing bearing. Coordinates are in meters
 * (1 Leaflet unit = 1 meter), with lng = east and lat increasing north.
 */
export function spreadEllipse(
  center: Point,
  spread: Spread,
  bearingDeg: number,
  segments = 48
): [number, number][] {
  const brg = (bearingDeg * Math.PI) / 180;
  const sinB = Math.sin(brg);
  const cosB = Math.cos(brg);
  const alongHalf = spread.semiMinor / 2; // down-range extent (along the bearing)
  const acrossHalf = spread.semiMajor / 2; // lateral extent (perpendicular)

  const ring: [number, number][] = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * 2 * Math.PI;
    const along = alongHalf * Math.cos(t);
    const across = acrossHalf * Math.sin(t);
    // Down-range unit vector is (sinB, cosB) in (lng, lat); lateral is (cosB, -sinB).
    const lng = center.lng + along * sinB + across * cosB;
    const lat = center.lat + along * cosB - across * sinB;
    ring.push([lat, lng]);
  }
  return ring;
}
