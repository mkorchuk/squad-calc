export interface TargetMark {
  id: string;
  lat: number;
  lng: number;
}

export interface MortarMark {
  lat: number;
  lng: number;
}

/** Free-hand map annotations drawn via the right-click menu, separate from targets. */
export type ShapeType = "line" | "circle" | "rect";

interface ShapePoint {
  lat: number;
  lng: number;
}

/**
 * Hex stroke/fill colour, chosen from the draw menu's palette. Optional because
 * shapes drawn before colours existed (persisted sessions, older session files)
 * have none — those render as DEFAULT_SHAPE_COLOR.
 */
type ShapeColor = string | undefined;

export interface LineShape {
  id: string;
  type: "line";
  a: ShapePoint;
  b: ShapePoint;
  color?: ShapeColor;
}

export interface RectShape {
  id: string;
  type: "rect";
  a: ShapePoint;
  b: ShapePoint;
  color?: ShapeColor;
}

export interface CircleShape {
  id: string;
  type: "circle";
  center: ShapePoint;
  radius: number;
  color?: ShapeColor;
}

export type Shape = LineShape | RectShape | CircleShape;

/** A shape without its id — the store assigns one on add, like targets. */
export type ShapeInput =
  | Omit<LineShape, "id">
  | Omit<RectShape, "id">
  | Omit<CircleShape, "id">;

export interface Session {
  id: string;
  name: string;
  mapId: string;
  /**
   * Which weapon the `mortar` mark is (see data/weapons.ts). Optional because
   * sessions persisted before weapons were selectable have none — read it
   * through getWeapon(), which treats a missing id as the mortar.
   */
  weaponId?: string;
  mortar: MortarMark | null;
  targets: TargetMark[];
  shapes: Shape[];
}

export type PlacementMode = "mortar" | "target";

/** How map clicks turn into targets: one per click, along a line, or filling an area. */
export type TargetTool = "single" | "line" | "space";
