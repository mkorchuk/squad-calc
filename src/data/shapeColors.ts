/**
 * The palette offered at the top of the right-click draw menu. Deliberately
 * short — these are map annotations, not a paint program — and picked to stay
 * legible over both the dark and the sandy basemaps.
 */
export interface ShapeColor {
  /** Hex value, stored on the shape itself and used directly as the stroke/fill. */
  value: string;
  name: string;
}

export const SHAPE_COLORS: ShapeColor[] = [
  { value: "#f0c040", name: "Amber" },
  { value: "#e0533a", name: "Red" },
  { value: "#4aa3f0", name: "Blue" },
  { value: "#54c268", name: "Green" },
  { value: "#b07ae0", name: "Purple" },
  { value: "#eef2f7", name: "White" },
];

/** Amber — what every shape drawn before colours existed is rendered as. */
export const DEFAULT_SHAPE_COLOR = SHAPE_COLORS[0].value;

/**
 * Shape colours end up in an SVG stroke/fill attribute and can arrive from an
 * imported file or a persisted store, so anything that isn't a plain hex colour
 * is rejected rather than passed through.
 */
export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}
