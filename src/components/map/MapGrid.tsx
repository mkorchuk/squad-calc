import { useMemo } from "react";
import L from "leaflet";
import { Marker, Pane, Polyline } from "react-leaflet";
import type { MapDefinition } from "../../data/maps";

const KEYPAD = 300; // meters per keypad square (Squad standard)
const SUB = 100; // meters per sub-keypad (100m)

/** Column index (1-based) -> letter: 1=A, 2=B, ... matching SquadCalc. */
function colLabel(i: number): string {
  return (i + 9).toString(36).toUpperCase();
}

function gridLabelIcon(text: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div class="grid-label">${text}</div>`,
    iconSize: [22, 16],
    iconAnchor: [11, 8],
  });
}

/**
 * Squad keypad grid overlay, drawn from the map's top-left corner (0,0).
 * Solid black 300m keypad lines + faint 100m sub-lines, with letter columns
 * across the top and number rows down the left edge.
 */
export default function MapGrid({ map }: { map: MapDefinition }) {
  return useMemo(() => {
    const W = map.sizeX;
    const H = map.sizeY;

    const keypadLines: [number, number][][] = [];
    const subLines: [number, number][][] = [];

    // Vertical lines (constant x/lng), from top (lat 0) to bottom (lat -H).
    for (let x = 0; x <= W + 0.001; x += SUB) {
      const line: [number, number][] = [
        [0, x],
        [-H, x],
      ];
      if (Math.abs(x % KEYPAD) < 0.001) keypadLines.push(line);
      else subLines.push(line);
    }
    // Horizontal lines (constant y/lat), from left (lng 0) to right (lng W).
    for (let y = 0; y <= H + 0.001; y += SUB) {
      const line: [number, number][] = [
        [-y, 0],
        [-y, W],
      ];
      if (Math.abs(y % KEYPAD) < 0.001) keypadLines.push(line);
      else subLines.push(line);
    }

    // Column letters (top edge) and row numbers (left edge), centered per cell.
    const labels: JSX.Element[] = [];
    for (let i = 0, x = 0; x < W - 1; i++, x += KEYPAD) {
      const cx = Math.min(x + KEYPAD / 2, W);
      labels.push(
        <Marker
          key={`col-${i}`}
          position={[-70, cx]}
          icon={gridLabelIcon(colLabel(i + 1))}
          interactive={false}
          keyboard={false}
        />
      );
    }
    for (let i = 0, y = 0; y < H - 1; i++, y += KEYPAD) {
      const cy = Math.min(y + KEYPAD / 2, H);
      labels.push(
        <Marker
          key={`row-${i}`}
          position={[-cy, 70]}
          icon={gridLabelIcon(String(i + 1))}
          interactive={false}
          keyboard={false}
        />
      );
    }

    // zIndex 450 keeps the grid above the map image (overlayPane, 400) and
    // below the mortar/target markers (markerPane, 600).
    return (
      <Pane name="grid" style={{ zIndex: 450, pointerEvents: "none" }}>
        <Polyline
          positions={subLines}
          pathOptions={{
            color: "#000",
            weight: 0.6,
            opacity: 0.2,
            interactive: false,
          }}
        />
        <Polyline
          positions={keypadLines}
          pathOptions={{
            color: "#000",
            weight: 1,
            opacity: 0.55,
            interactive: false,
          }}
        />
        {labels}
      </Pane>
    );
  }, [map]);
}
