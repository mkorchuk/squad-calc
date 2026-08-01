import { describe, expect, it } from "vitest";
import { MAX_FILL_POINTS, pointsAlongLine, pointsInPolygon } from "./targetFill";
import type { Point } from "./targetFill";

/** Ray casting, written independently of the implementation's own copy. */
function contains(polygon: Point[], p: Point): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (a.lat > p.lat === b.lat > p.lat) continue;
    const crossLng = a.lng + ((p.lat - a.lat) / (b.lat - a.lat)) * (b.lng - a.lng);
    if (p.lng < crossLng) inside = !inside;
  }
  return inside;
}

const SQUARE: Point[] = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 300 },
  { lat: 300, lng: 300 },
  { lat: 300, lng: 0 },
];

describe("pointsAlongLine", () => {
  const a: Point = { lat: 0, lng: 0 };
  const b: Point = { lat: 0, lng: 100 };

  it("keeps both endpoints exact", () => {
    const points = pointsAlongLine(a, b, 25);
    expect(points[0]).toEqual(a);
    expect(points[points.length - 1]).toEqual(b);
  });

  it("spaces points evenly at the requested step when it divides the line", () => {
    const points = pointsAlongLine(a, b, 25);
    expect(points).toHaveLength(5);
    expect(points.map((p) => p.lng)).toEqual([0, 25, 50, 75, 100]);
  });

  it("rounds to whole segments, staying within half a step of the request", () => {
    // 100m at 30m: 3.33 segments -> 3, i.e. 33.3m apart.
    const points = pointsAlongLine(a, b, 30);
    expect(points).toHaveLength(4);
    for (let i = 1; i < points.length; i++) {
      const step = points[i].lng - points[i - 1].lng;
      expect(Math.abs(step - 30)).toBeLessThanOrEqual(15);
    }
  });

  it("works on a diagonal, not just an axis", () => {
    const end: Point = { lat: -300, lng: 400 }; // 500m long
    const points = pointsAlongLine(a, end, 100);
    expect(points).toHaveLength(6);
    for (let i = 1; i < points.length; i++) {
      const step = Math.hypot(
        points[i].lat - points[i - 1].lat,
        points[i].lng - points[i - 1].lng
      );
      expect(step).toBeCloseTo(100, 9);
    }
  });

  it("degenerates to a single point on a line shorter than half a step", () => {
    expect(pointsAlongLine(a, { lat: 0, lng: 4 }, 50)).toEqual([a]);
    expect(pointsAlongLine(a, a, 50)).toEqual([a]);
  });

  it("refuses a non-positive spacing instead of hanging", () => {
    // Infinity segments would spin forever building the array.
    expect(pointsAlongLine(a, b, 0)).toEqual([a]);
    expect(pointsAlongLine(a, b, -10)).toEqual([a]);
    expect(pointsAlongLine(a, b, Number.NaN)).toEqual([a]);
  });
});

describe("pointsInPolygon", () => {
  it("places every point inside the polygon", () => {
    const points = pointsInPolygon(SQUARE, 40);
    expect(points.length).toBeGreaterThan(10);
    for (const p of points) expect(contains(SQUARE, p)).toBe(true);
  });

  it("fills a concave polygon without spilling into the notch", () => {
    // An L: the top-right quadrant is cut away.
    const L: Point[] = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 300 },
      { lat: 150, lng: 300 },
      { lat: 150, lng: 150 },
      { lat: 300, lng: 150 },
      { lat: 300, lng: 0 },
    ];
    const points = pointsInPolygon(L, 25);
    expect(points.length).toBeGreaterThan(10);
    for (const p of points) {
      expect(contains(L, p)).toBe(true);
      expect(p.lat > 150 && p.lng > 150).toBe(false);
    }
  });

  it("lays rows out on an offset (hexagonal) grid", () => {
    const spacing = 50;
    const points = pointsInPolygon(SQUARE, spacing);
    // Group by a rounded key but keep the exact latitude, so the row-spacing
    // assertion below isn't measuring the rounding.
    const byRow = new Map<number, number>();
    for (const p of points) byRow.set(Math.round(p.lat * 1e6), p.lat);
    const rows = [...byRow.values()].sort((x, y) => x - y);
    expect(rows.length).toBeGreaterThan(2);

    // Rows sit spacing·√3/2 apart, and alternate rows shift half a step east.
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i] - rows[i - 1]).toBeCloseTo((spacing * Math.sqrt(3)) / 2, 6);
    }
    const firstOfRow = (lat: number) =>
      Math.min(...points.filter((p) => Math.abs(p.lat - lat) < 1e-6).map((p) => p.lng));
    expect(firstOfRow(rows[1]) - firstOfRow(rows[0])).toBeCloseTo(spacing / 2, 6);
  });

  it("spaces neighbours about `spacing` apart", () => {
    const spacing = 60;
    const points = pointsInPolygon(SQUARE, spacing);
    for (const p of points) {
      const nearest = Math.min(
        ...points
          .filter((q) => q !== p)
          .map((q) => Math.hypot(q.lat - p.lat, q.lng - p.lng))
      );
      expect(nearest).toBeGreaterThan(spacing * 0.8);
      expect(nearest).toBeLessThan(spacing * 1.2);
    }
  });

  it("returns nothing for a degenerate polygon", () => {
    expect(pointsInPolygon([], 20)).toEqual([]);
    expect(pointsInPolygon([{ lat: 0, lng: 0 }], 20)).toEqual([]);
    expect(pointsInPolygon(SQUARE.slice(0, 2), 20)).toEqual([]);
  });

  it("refuses a non-positive spacing instead of hanging", () => {
    // The column loop would never advance, freezing the tab.
    expect(pointsInPolygon(SQUARE, 0)).toEqual([]);
    expect(pointsInPolygon(SQUARE, -5)).toEqual([]);
    expect(pointsInPolygon(SQUARE, Number.NaN)).toEqual([]);
  });

  it("stops shortly past the fill limit rather than running away", () => {
    const huge: Point[] = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 4000 },
      { lat: 4000, lng: 4000 },
      { lat: 4000, lng: 0 },
    ];
    const points = pointsInPolygon(huge, 5);
    // Over the limit, so MapView rejects the fill — but it must terminate, and
    // it must not build a million points before it does.
    expect(points.length).toBeGreaterThan(MAX_FILL_POINTS);
    expect(points.length).toBeLessThan(MAX_FILL_POINTS * 4);
  });
});
