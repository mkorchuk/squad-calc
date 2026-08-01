import { describe, expect, it } from "vitest";
import type { Map as LeafletMap } from "leaflet";
import { SHAPE_HIT_PX, shapeAtPoint } from "./shapeHit";
import type { CircleShape, LineShape, RectShape, Shape } from "../store/types";

/**
 * Stand-in for a Leaflet map at a fixed zoom. CRS.Simple projects lng → x and
 * lat → −y (see mapBounds.ts), so `scale` is pixels per in-game metre — which is
 * exactly what changes when the user zooms.
 */
function mapAtScale(scale: number): LeafletMap {
  return {
    latLngToContainerPoint([lat, lng]: [number, number]) {
      return { x: lng * scale, y: -lat * scale };
    },
  } as unknown as LeafletMap;
}

/** 1px per metre keeps SHAPE_HIT_PX and metres interchangeable in the assertions. */
const map = mapAtScale(1);

const px = (lng: number, lat: number) => ({ x: lng, y: -lat });

const line: LineShape = {
  id: "line",
  type: "line",
  a: { lat: 0, lng: 0 },
  b: { lat: 0, lng: 100 },
};

const rect: RectShape = {
  id: "rect",
  type: "rect",
  a: { lat: 0, lng: 0 },
  b: { lat: -200, lng: 200 },
};

const circle: CircleShape = {
  id: "circle",
  type: "circle",
  center: { lat: -500, lng: 500 },
  radius: 100,
};

describe("shapeAtPoint", () => {
  it("finds nothing when there are no shapes", () => {
    expect(shapeAtPoint(map, [], px(50, 0))).toBeNull();
  });

  describe("line", () => {
    it("hits along the segment, including its ends", () => {
      for (const at of [0, 1, 50, 99, 100]) {
        expect(shapeAtPoint(map, [line], px(at, 0))).toBe(line);
      }
    });

    it("hits just off the stroke, within tolerance", () => {
      expect(shapeAtPoint(map, [line], px(50, SHAPE_HIT_PX - 1))).toBe(line);
      expect(shapeAtPoint(map, [line], px(50, -(SHAPE_HIT_PX - 1)))).toBe(line);
    });

    it("misses beyond tolerance", () => {
      expect(shapeAtPoint(map, [line], px(50, SHAPE_HIT_PX + 1))).toBeNull();
    });

    it("treats it as a segment, not an infinite line", () => {
      // On the line's axis but well past its end.
      expect(shapeAtPoint(map, [line], px(400, 0))).toBeNull();
      // Just past the end is still within tolerance of the endpoint.
      expect(shapeAtPoint(map, [line], px(100 + SHAPE_HIT_PX - 1, 0))).toBe(line);
    });

    it("handles a zero-length line without dividing by zero", () => {
      const dot: LineShape = { ...line, a: { lat: 0, lng: 0 }, b: { lat: 0, lng: 0 } };
      expect(shapeAtPoint(map, [dot], px(2, 2))).toBe(dot);
      expect(shapeAtPoint(map, [dot], px(200, 200))).toBeNull();
    });
  });

  describe("rect", () => {
    it("hits each of the four edges", () => {
      expect(shapeAtPoint(map, [rect], px(100, 0))).toBe(rect); // top
      expect(shapeAtPoint(map, [rect], px(200, -100))).toBe(rect); // right
      expect(shapeAtPoint(map, [rect], px(100, -200))).toBe(rect); // bottom
      expect(shapeAtPoint(map, [rect], px(0, -100))).toBe(rect); // left
      expect(shapeAtPoint(map, [rect], px(0, 0))).toBe(rect); // corner
    });

    it("ignores the fill, so clicks inside still reach the map", () => {
      expect(shapeAtPoint(map, [rect], px(100, -100))).toBeNull();
    });

    it("misses outside the edges", () => {
      expect(shapeAtPoint(map, [rect], px(100, SHAPE_HIT_PX + 1))).toBeNull();
      expect(shapeAtPoint(map, [rect], px(-(SHAPE_HIT_PX + 1), -100))).toBeNull();
    });

    it("normalises corners given in any order", () => {
      const flipped: RectShape = { ...rect, a: rect.b, b: rect.a };
      expect(shapeAtPoint(map, [flipped], px(100, 0))).toBe(flipped);
      expect(shapeAtPoint(map, [flipped], px(100, -100))).toBeNull();
    });
  });

  describe("circle", () => {
    it("hits the rim all the way round", () => {
      for (const deg of [0, 45, 90, 180, 270, 315]) {
        const rad = (deg * Math.PI) / 180;
        const at = px(
          circle.center.lng + Math.cos(rad) * circle.radius,
          circle.center.lat + Math.sin(rad) * circle.radius
        );
        expect(shapeAtPoint(map, [circle], at)).toBe(circle);
      }
    });

    it("ignores the fill and the centre", () => {
      expect(shapeAtPoint(map, [circle], px(circle.center.lng, circle.center.lat))).toBeNull();
      expect(shapeAtPoint(map, [circle], px(circle.center.lng + 50, circle.center.lat))).toBeNull();
    });

    it("hits just inside and just outside the rim", () => {
      const inside = circle.radius - (SHAPE_HIT_PX - 1);
      const outside = circle.radius + (SHAPE_HIT_PX - 1);
      expect(shapeAtPoint(map, [circle], px(circle.center.lng + inside, circle.center.lat))).toBe(
        circle
      );
      expect(shapeAtPoint(map, [circle], px(circle.center.lng + outside, circle.center.lat))).toBe(
        circle
      );
      const beyond = circle.radius + SHAPE_HIT_PX + 1;
      expect(
        shapeAtPoint(map, [circle], px(circle.center.lng + beyond, circle.center.lat))
      ).toBeNull();
    });
  });

  describe("stacking and tolerance", () => {
    it("returns the newest shape where two overlap", () => {
      const older: LineShape = { ...line, id: "older" };
      const newer: LineShape = { ...line, id: "newer" };
      // Drawn order is array order, so the last one is on top.
      expect(shapeAtPoint(map, [older, newer], px(50, 0))).toBe(newer);
    });

    it("keeps looking past shapes that miss", () => {
      // Searched newest-first, so rect is tested and rejected before the circle
      // whose rim the point actually sits on.
      const shapes: Shape[] = [line, circle, rect];
      const onRim = px(circle.center.lng + circle.radius, circle.center.lat);
      expect(shapeAtPoint(map, shapes, onRim)).toBe(circle);
    });

    it("counts a point shared by two shapes as the topmost one", () => {
      // The line lies exactly along the rect's top edge, and the rect is newer.
      expect(shapeAtPoint(map, [line, rect], px(50, 0))).toBe(rect);
      expect(shapeAtPoint(map, [rect, line], px(50, 0))).toBe(line);
    });

    it("honours a custom tolerance", () => {
      expect(shapeAtPoint(map, [line], px(50, 40))).toBeNull();
      expect(shapeAtPoint(map, [line], px(50, 40), 50)).toBe(line);
      expect(shapeAtPoint(map, [line], px(50, 2), 1)).toBeNull();
    });

    it("measures tolerance in screen pixels, not metres", () => {
      const offsetMetres = SHAPE_HIT_PX - 2;

      // Zoomed out (1px/m) the click is inside the tolerance…
      expect(shapeAtPoint(mapAtScale(1), [line], px(50, offsetMetres))).toBe(line);

      // …and zoomed in 4x the same ground offset is four times as many pixels
      // away, so it correctly stops counting as a hit.
      const zoomed = mapAtScale(4);
      const at = { x: 50 * 4, y: -offsetMetres * 4 };
      expect(shapeAtPoint(zoomed, [line], at)).toBeNull();
      // The rim of the shape is still hit at that zoom, though.
      expect(shapeAtPoint(zoomed, [line], { x: 50 * 4, y: 0 })).toBe(line);
    });

    it("scales a circle's radius with the zoom", () => {
      const zoomed = mapAtScale(4);
      const onRim = {
        x: (circle.center.lng + circle.radius) * 4,
        y: -circle.center.lat * 4,
      };
      expect(shapeAtPoint(zoomed, [circle], onRim)).toBe(circle);
      // 50m inside the rim is 200px in at this zoom — well clear of the stroke.
      expect(
        shapeAtPoint(zoomed, [circle], { x: (circle.center.lng + 50) * 4, y: -circle.center.lat * 4 })
      ).toBeNull();
    });
  });
});
