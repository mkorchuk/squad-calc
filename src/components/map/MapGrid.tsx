import { useMemo, useState } from "react";
import L from "leaflet";
import { Marker, Pane, Polyline, useMapEvents } from "react-leaflet";
import type { MapDefinition } from "../../data/maps";
import { useAppStore } from "../../store/useAppStore";

const KEYPAD = 300; // meters per keypad square (Squad standard)
const SUB = 100; // meters per sub-keypad (100m)
const FINE = SUB / 3; // ~33.33m sub-keypad, the finest in-game grid tier

// Fine grid only appears once zoomed in this far, so a ~33m cell reads as a
// legible square (~65px at zoom 1 in this CRS, where 1 unit = 1 meter) rather
// than a dense mess over the whole map at the default zoomed-out view.
const FINE_MIN_ZOOM = 1;

/** Column index (1-based) -> letter: 1=A, 2=B, ... matching the in-game grid. */
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
 * Three tiers, as in game: 300m keypad lines, 100m
 * sub-keypad lines, and a 33.33m fine tier shown only when zoomed in.
 */
export default function MapGrid({ map }: { map: MapDefinition }) {
  const gridOpacity = useAppStore((s) => s.gridOpacity);

  const mapInstance = useMapEvents({
    zoomend: () => setZoom(mapInstance.getZoom()),
  });
  const [zoom, setZoom] = useState(() => mapInstance.getZoom());
  const fineVisible = zoom >= FINE_MIN_ZOOM;

  const { keypadLines, subLines, fineLines, labels } = useMemo(() => {
    const W = map.sizeX;
    const H = map.sizeY;

    const keypadLines: [number, number][][] = [];
    const subLines: [number, number][][] = [];
    const fineLines: [number, number][][] = [];

    // Step by the finest tier and classify each line by index, so a line at
    // i=9 (kp), i=3/6 (sub) and everything else (fine) never gets drawn twice.
    const stepsX = Math.floor((W + 0.001) / FINE);
    for (let i = 0; i <= stepsX; i++) {
      const x = i * FINE;
      const line: [number, number][] = [
        [0, x],
        [-H, x],
      ];
      if (i % 9 === 0) keypadLines.push(line);
      else if (i % 3 === 0) subLines.push(line);
      else fineLines.push(line);
    }

    const stepsY = Math.floor((H + 0.001) / FINE);
    for (let i = 0; i <= stepsY; i++) {
      const y = i * FINE;
      const line: [number, number][] = [
        [-y, 0],
        [-y, W],
      ];
      if (i % 9 === 0) keypadLines.push(line);
      else if (i % 3 === 0) subLines.push(line);
      else fineLines.push(line);
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

    return { keypadLines, subLines, fineLines, labels };
  }, [map]);

  // zIndex 450 keeps the grid above the map image (overlayPane, 400) and
  // below the mortar/target markers (markerPane, 600).
  return (
    <Pane name="grid" style={{ zIndex: 450, pointerEvents: "none" }}>
      <Polyline
        positions={fineLines}
        pathOptions={{
          color: "#000",
          weight: 0.4,
          opacity: fineVisible ? 0.33 * gridOpacity : 0,
          interactive: false,
        }}
      />
      <Polyline
        positions={subLines}
        pathOptions={{
          color: "#000",
          weight: 0.6,
          opacity: 0.36 * gridOpacity,
          interactive: false,
        }}
      />
      <Polyline
        positions={keypadLines}
        pathOptions={{
          color: "#000",
          weight: 1,
          opacity: gridOpacity,
          interactive: false,
        }}
      />
      {labels}
    </Pane>
  );
}
