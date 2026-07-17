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

export interface LineShape {
  id: string;
  type: "line";
  a: ShapePoint;
  b: ShapePoint;
}

export interface RectShape {
  id: string;
  type: "rect";
  a: ShapePoint;
  b: ShapePoint;
}

export interface CircleShape {
  id: string;
  type: "circle";
  center: ShapePoint;
  radius: number;
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
  mortar: MortarMark | null;
  targets: TargetMark[];
  shapes: Shape[];
}

export type PlacementMode = "mortar" | "target";

/** How map clicks turn into targets: one per click, along a line, or filling an area. */
export type TargetTool = "single" | "line" | "space";
