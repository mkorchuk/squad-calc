import { Circle, Polyline, Rectangle } from "react-leaflet";
import type { Shape } from "../../store/types";

/** Amber, non-interactive so clicks fall through to the map for target placement. */
export const SHAPE_STYLE = {
  color: "#f0c040",
  weight: 2,
  fillColor: "#f0c040",
  fillOpacity: 0.08,
  interactive: false,
};

export default function ShapeLayer({ shape }: { shape: Shape }) {
  if (shape.type === "line") {
    return (
      <Polyline
        positions={[
          [shape.a.lat, shape.a.lng],
          [shape.b.lat, shape.b.lng],
        ]}
        pathOptions={SHAPE_STYLE}
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
        pathOptions={SHAPE_STYLE}
      />
    );
  }
  return (
    <Circle center={[shape.center.lat, shape.center.lng]} radius={shape.radius} pathOptions={SHAPE_STYLE} />
  );
}
