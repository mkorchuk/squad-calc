/**
 * Generates target positions for the line/space placement tools.
 * Coordinates are in game meters (lng = east, lat = -south), so plain
 * euclidean math applies — see mapBounds.ts.
 */

export interface Point {
  lat: number;
  lng: number;
}

/** Refuse to place more than this in one go; each target renders a live firing solution. */
export const MAX_FILL_POINTS = 400;

/**
 * Points spread along a→b, including both endpoints. The step is rounded to the
 * nearest whole number of segments so the ends stay exact and the spacing stays
 * within half a step of `spacing`.
 */
export function pointsAlongLine(a: Point, b: Point, spacing: number): Point[] {
  // A non-positive spacing would make `segments` Infinity and hang the tab, so
  // it degenerates to a single point instead. The manual spacing is clamped in
  // the store, but the Space tool derives its own from the spread radius.
  if (!(spacing > 0)) return [{ lat: a.lat, lng: a.lng }];

  const length = Math.hypot(b.lng - a.lng, b.lat - a.lat);
  if (length < spacing / 2) return [{ lat: a.lat, lng: a.lng }];

  const segments = Math.max(1, Math.round(length / spacing));
  const points: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    points.push({
      lat: a.lat + (b.lat - a.lat) * t,
      lng: a.lng + (b.lng - a.lng) * t,
    });
  }
  return points;
}

/**
 * Points filling the polygon on an offset (hexagonal) grid: rows are
 * spacing·√3/2 apart and every other row shifts half a step east, so each point
 * sits `spacing` from its nearest neighbours in every direction.
 */
export function pointsInPolygon(vertices: Point[], spacing: number): Point[] {
  // Same reason as pointsAlongLine: a zero/negative step never advances the
  // column loop, which would freeze the tab rather than fail.
  if (vertices.length < 3 || !(spacing > 0)) return [];

  const lats = vertices.map((v) => v.lat);
  const lngs = vertices.map((v) => v.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const rowStep = (spacing * Math.sqrt(3)) / 2;
  const points: Point[] = [];

  for (let row = 0; ; row++) {
    const lat = minLat + row * rowStep;
    if (lat > maxLat) break;
    const startLng = minLng + (row % 2 ? spacing / 2 : 0);
    for (let lng = startLng; lng <= maxLng; lng += spacing) {
      if (isInside({ lat, lng }, vertices)) points.push({ lat, lng });
    }
    if (points.length > MAX_FILL_POINTS) break;
  }

  return points;
}

/** Ray casting: counts edge crossings directly east of the point. */
function isInside(p: Point, vertices: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[i];
    const b = vertices[j];
    const straddles = a.lat > p.lat !== b.lat > p.lat;
    if (!straddles) continue;
    const crossLng = a.lng + ((p.lat - a.lat) / (b.lat - a.lat)) * (b.lng - a.lng);
    if (p.lng < crossLng) inside = !inside;
  }
  return inside;
}
