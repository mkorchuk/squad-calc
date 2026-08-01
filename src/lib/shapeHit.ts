import type { Map as LeafletMap } from "leaflet";
import type { Shape } from "../store/types";

/**
 * How close (screen px) a right-click has to land to a shape's outline to count
 * as hitting it. Generous, because the drawn stroke is only 2px wide.
 */
export const SHAPE_HIT_PX = 10;

/** Screen-space point; Leaflet's own Point satisfies it. */
interface Px {
  x: number;
  y: number;
}

/** Distance from `p` to segment `a`-`b`, all in container pixels. */
function distanceToSegment(p: Px, a: Px, b: Px): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Distance in container pixels from `point` to a shape's outline — the fill is
 * deliberately not counted, so right-clicking *inside* a rect or circle still
 * opens the draw menu rather than deleting the shape you're drawing over.
 */
function distanceToShape(map: LeafletMap, shape: Shape, point: Px): number {
  if (shape.type === "circle") {
    const center = map.latLngToContainerPoint([shape.center.lat, shape.center.lng]);
    // CRS.Simple: 1 map unit = 1 metre, so a point `radius` east sits on the rim.
    const rim = map.latLngToContainerPoint([shape.center.lat, shape.center.lng + shape.radius]);
    const radiusPx = Math.hypot(rim.x - center.x, rim.y - center.y);
    return Math.abs(Math.hypot(point.x - center.x, point.y - center.y) - radiusPx);
  }

  const a = map.latLngToContainerPoint([shape.a.lat, shape.a.lng]);
  const b = map.latLngToContainerPoint([shape.b.lat, shape.b.lng]);
  if (shape.type === "line") return distanceToSegment(point, a, b);

  // rect: the four edges of the axis-aligned box spanned by a and b.
  const tl = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) };
  const br = { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) };
  const tr = { x: br.x, y: tl.y };
  const bl = { x: tl.x, y: br.y };
  return Math.min(
    distanceToSegment(point, tl, tr),
    distanceToSegment(point, tr, br),
    distanceToSegment(point, br, bl),
    distanceToSegment(point, bl, tl)
  );
}

/**
 * The shape whose outline is under `point`, or null. Searched newest-first so
 * the most recently drawn shape wins where several overlap — the same order
 * they're stacked on screen.
 */
export function shapeAtPoint(
  map: LeafletMap,
  shapes: Shape[],
  point: Px,
  tolerance = SHAPE_HIT_PX
): Shape | null {
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (distanceToShape(map, shapes[i], point) <= tolerance) return shapes[i];
  }
  return null;
}
