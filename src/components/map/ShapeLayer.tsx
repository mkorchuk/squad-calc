import { useMemo } from "react";
import { Circle, Polyline, Rectangle } from "react-leaflet";
import { DEFAULT_SHAPE_COLOR } from "../../data/shapeColors";
import type { Shape } from "../../store/types";

/**
 * Non-interactive so clicks fall through to the map for target placement —
 * deleting a shape goes through MapController's contextmenu hit test instead.
 * Colour comes from the shape; pre-colour shapes fall back to amber.
 */
export function shapeStyle(color: string | undefined) {
  const stroke = color ?? DEFAULT_SHAPE_COLOR;
  return {
    color: stroke,
    weight: 2,
    fillColor: stroke,
    fillOpacity: 0.08,
    interactive: false,
  };
}

export default function ShapeLayer({ shape }: { shape: Shape }) {
  // Memoised because react-leaflet re-applies pathOptions whenever the object
  // identity changes, which would otherwise be every render.
  const style = useMemo(() => shapeStyle(shape.color), [shape.color]);

  if (shape.type === "line") {
    return (
      <Polyline
        positions={[
          [shape.a.lat, shape.a.lng],
          [shape.b.lat, shape.b.lng],
        ]}
        pathOptions={style}
      />
    );
  }
  if (shape.type === "rect") {
    return (
      <Rectangle
        bounds={[
          [shape.a.lat, shape.a.lng],
          [shape.b.lat, shape.b.lng],
        ]}
        pathOptions={style}
      />
    );
  }
  return (
    <Circle center={[shape.center.lat, shape.center.lng]} radius={shape.radius} pathOptions={style} />
  );
}
