import { describe, expect, it } from "vitest";
import {
  getBearing,
  getDistance,
  getElevation,
  getMaxRange,
  getSpread,
  spreadEllipse,
} from "./ballistics";
import { STANDARD_MORTAR } from "../data/weapons";
import type { Weapon } from "../data/weapons";

const W = STANDARD_MORTAR;
const MAX_RANGE = getMaxRange(W);

/**
 * Independent check of a firing solution: fires a shell at `deg` and returns
 * where it actually lands, from the projectile equations rather than from
 * ballistics.ts. Anything getElevation returns should land on its own target.
 */
function landingDistance(deg: number, weapon: Weapon, heightDiff: number): number {
  const { velocity: v, gravity: g, heightOffset, angleOffset } = weapon;
  const theta = (deg * Math.PI) / 180 + angleOffset;
  const vx = v * Math.cos(theta);
  const vy = v * Math.sin(theta);
  // Target height relative to the muzzle, which is heightOffset above the gun.
  const y = heightDiff - heightOffset;
  // vy·t − ½g·t² = y, descending root.
  const t = (vy + Math.sqrt(vy ** 2 - 2 * g * y)) / g;
  return vx * t;
}

describe("getDistance", () => {
  it("measures plain euclidean metres", () => {
    expect(getDistance({ lat: 0, lng: 0 }, { lat: 30, lng: 40 })).toBeCloseTo(50, 10);
  });

  it("is symmetric and zero for a point on itself", () => {
    const a = { lat: -120.5, lng: 880.25 };
    const b = { lat: -400, lng: 1000 };
    expect(getDistance(a, b)).toBeCloseTo(getDistance(b, a), 10);
    expect(getDistance(a, a)).toBe(0);
  });
});

describe("getBearing", () => {
  const origin = { lat: 0, lng: 0 };

  // lat grows north, lng grows east (see mapBounds.ts).
  it.each([
    ["north", { lat: 100, lng: 0 }, 0],
    ["east", { lat: 0, lng: 100 }, 90],
    ["south", { lat: -100, lng: 0 }, 180],
    ["west", { lat: 0, lng: -100 }, 270],
    ["north-east", { lat: 100, lng: 100 }, 45],
    ["south-west", { lat: -100, lng: -100 }, 225],
  ])("reads %s as %s°", (_name, to, expected) => {
    expect(getBearing(origin, to)).toBeCloseTo(expected, 9);
  });

  it("always lands in [0, 360)", () => {
    for (let deg = 0; deg < 360; deg += 7) {
      const rad = (deg * Math.PI) / 180;
      const to = { lat: Math.cos(rad) * 500, lng: Math.sin(rad) * 500 };
      const bearing = getBearing(origin, to);
      expect(bearing).toBeGreaterThanOrEqual(0);
      expect(bearing).toBeLessThan(360);
      expect(bearing).toBeCloseTo(deg, 9);
    }
  });

  it("reverses by 180° when the endpoints swap", () => {
    const a = { lat: -200, lng: 300 };
    const b = { lat: 600, lng: -100 };
    const forward = getBearing(a, b);
    const back = getBearing(b, a);
    expect((forward + 180) % 360).toBeCloseTo(back, 9);
  });
});

describe("getElevation", () => {
  it("produces an angle that actually lands on the target", () => {
    for (const distance of [60, 100, 250, 600, 900, 1200]) {
      const elevation = getElevation(distance, W);
      expect(elevation.inRange).toBe(true);
      expect(landingDistance(elevation.deg, W, 0)).toBeCloseTo(distance, 6);
    }
  });

  it("still lands on the target over sloped ground", () => {
    for (const heightDiff of [-120, -40, 40, 120]) {
      const elevation = getElevation(500, W, heightDiff);
      expect(elevation.inRange).toBe(true);
      expect(landingDistance(elevation.deg, W, heightDiff)).toBeCloseTo(500, 6);
    }
  });

  it("converts degrees to mils at 6400 mil per turn", () => {
    const elevation = getElevation(400, W);
    expect(elevation.mil).toBeCloseTo(elevation.deg * (6400 / 360), 9);
  });

  it("returns the high-angle solution, so elevation falls as range grows", () => {
    let previous = Infinity;
    for (let distance = 100; distance < MAX_RANGE * 0.98; distance += 50) {
      const { deg, inRange } = getElevation(distance, W);
      expect(inRange).toBe(true);
      expect(deg).toBeLessThan(previous);
      previous = deg;
    }
    // Always the steep arc, never the flat one.
    expect(getElevation(300, W).deg).toBeGreaterThan(45);
  });

  it("needs less elevation for a target uphill at the same range", () => {
    // Above 45° the range shrinks as the barrel rises, so a target that is
    // higher up is reached by flattening out, not by aiming steeper.
    const flat = getElevation(600, W, 0);
    const uphill = getElevation(600, W, 80);
    const downhill = getElevation(600, W, -80);
    expect(uphill.deg).toBeLessThan(flat.deg);
    expect(downhill.deg).toBeGreaterThan(flat.deg);
  });

  it("refuses anything closer than the weapon minimum", () => {
    expect(getElevation(W.minDistance - 1, W).inRange).toBe(false);
    expect(getElevation(0, W).inRange).toBe(false);
    expect(getElevation(-10, W).inRange).toBe(false);
    expect(getElevation(W.minDistance, W).inRange).toBe(true);
  });

  it("refuses anything past max range", () => {
    expect(getElevation(MAX_RANGE * 0.98, W).inRange).toBe(true);
    expect(getElevation(MAX_RANGE * 1.01, W).inRange).toBe(false);
    expect(getElevation(MAX_RANGE * 5, W).inRange).toBe(false);
  });

  it("refuses a target too high to reach even in range", () => {
    expect(getElevation(600, W, 5000).inRange).toBe(false);
  });

  it("reports NaN, not a stale number, when there is no solution", () => {
    const none = getElevation(1, W);
    expect(none.inRange).toBe(false);
    expect(Number.isNaN(none.deg)).toBe(true);
    expect(Number.isNaN(none.mil)).toBe(true);
  });

  it("keeps the returned angle inside the weapon's firing arc", () => {
    const [minDeg, maxDeg] = W.minElevation;
    for (let distance = W.minDistance; distance < MAX_RANGE; distance += 25) {
      const { deg, inRange } = getElevation(distance, W);
      if (!inRange) continue;
      expect(deg).toBeGreaterThanOrEqual(minDeg);
      expect(deg).toBeLessThanOrEqual(maxDeg);
    }
  });
});

describe("getMaxRange", () => {
  it("bounds where a firing solution exists", () => {
    expect(MAX_RANGE).toBeGreaterThan(1000);
    expect(getElevation(MAX_RANGE + 1, W).inRange).toBe(false);
  });

  it("grows with muzzle velocity", () => {
    expect(getMaxRange({ ...W, velocity: W.velocity * 2 })).toBeGreaterThan(MAX_RANGE);
  });
});

describe("getSpread", () => {
  it("is null exactly where there is no firing solution", () => {
    expect(getSpread(10, W)).toBeNull();
    expect(getSpread(MAX_RANGE * 2, W)).toBeNull();
    expect(getSpread(400, W)).not.toBeNull();
  });

  it("returns positive axes and a bounding radius", () => {
    const spread = getSpread(600, W);
    expect(spread).not.toBeNull();
    expect(spread!.semiMajor).toBeGreaterThan(0);
    expect(spread!.semiMinor).toBeGreaterThan(0);
    expect(spread!.radius).toBeCloseTo(Math.max(spread!.semiMajor, spread!.semiMinor) / 2, 10);
  });

  it("collapses down-range as the shot flattens toward max range", () => {
    const near = getSpread(200, W)!;
    const far = getSpread(MAX_RANGE * 0.97, W)!;
    expect(far.semiMinor).toBeLessThan(near.semiMinor);
  });

  it("keeps lateral spread roughly flat across the range band", () => {
    const near = getSpread(200, W)!;
    const far = getSpread(1000, W)!;
    expect(far.semiMajor / near.semiMajor).toBeGreaterThan(0.5);
    expect(far.semiMajor / near.semiMajor).toBeLessThan(2);
  });
});

describe("spreadEllipse", () => {
  const center = { lat: -500, lng: 700 };
  const spread = { semiMajor: 60, semiMinor: 200, radius: 100 };

  it("returns the requested number of points, centred on the target", () => {
    const ring = spreadEllipse(center, spread, 0, 32);
    expect(ring).toHaveLength(32);
    const meanLat = ring.reduce((sum, [lat]) => sum + lat, 0) / ring.length;
    const meanLng = ring.reduce((sum, [, lng]) => sum + lng, 0) / ring.length;
    expect(meanLat).toBeCloseTo(center.lat, 6);
    expect(meanLng).toBeCloseTo(center.lng, 6);
  });

  it("points its down-range axis along the firing bearing", () => {
    const along = spread.semiMinor / 2;

    // Firing north: the long axis runs north/south.
    const north = spreadEllipse(center, spread, 0, 4);
    expect(north[0][0]).toBeCloseTo(center.lat + along, 6);
    expect(north[0][1]).toBeCloseTo(center.lng, 6);

    // Firing east: the same axis now runs east/west.
    const east = spreadEllipse(center, spread, 90, 4);
    expect(east[0][0]).toBeCloseTo(center.lat, 6);
    expect(east[0][1]).toBeCloseTo(center.lng + along, 6);
  });

  it("never reaches further than the bounding radius", () => {
    for (const bearing of [0, 37, 90, 180, 300]) {
      for (const [lat, lng] of spreadEllipse(center, spread, bearing)) {
        const offset = Math.hypot(lat - center.lat, lng - center.lng);
        expect(offset).toBeLessThanOrEqual(spread.radius + 1e-9);
      }
    }
  });
});
