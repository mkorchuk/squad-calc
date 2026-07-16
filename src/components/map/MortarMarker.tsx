import { useMemo, useRef } from "react";
import { Circle, Marker, Popup } from "react-leaflet";
import L, { type Marker as LeafletMarker } from "leaflet";
import { useAppStore } from "../../store/useAppStore";
import type { MortarMark } from "../../store/types";
import type { MapDefinition } from "../../data/maps";
import { STANDARD_MORTAR } from "../../data/weapons";
import { getMaxRange } from "../../lib/ballistics";
import { sampleHeight, type HeightGrid } from "../../lib/heightmap";
import { mortarIcon } from "./markerIcons";

interface Props {
  mortar: MortarMark;
  map: MapDefinition;
  heightmap: HeightGrid | null;
}

const MAX_RANGE = getMaxRange(STANDARD_MORTAR);

export default function MortarMarker({ mortar, map, heightmap }: Props) {
  const moveMortar = useAppStore((s) => s.moveMortar);
  const clearMortar = useAppStore((s) => s.clearMortar);
  const ref = useRef<LeafletMarker>(null);

  const handlers = useMemo(
    () => ({
      dragend() {
        const m = ref.current;
        if (!m) return;
        const { lat, lng } = m.getLatLng();
        moveMortar(lat, lng);
      },
      contextmenu(e: L.LeafletMouseEvent) {
        L.DomEvent.preventDefault(e.originalEvent);
        clearMortar();
      },
    }),
    [moveMortar, clearMortar]
  );

  return (
    <>
      <Circle
        center={[mortar.lat, mortar.lng]}
        radius={MAX_RANGE}
        pathOptions={{
          color: "#5f86b3",
          weight: 1.5,
          opacity: 0.8,
          fillColor: "#3d7bff",
          fillOpacity: 0.08,
          interactive: false,
        }}
      />
      <Marker
        ref={ref}
        position={[mortar.lat, mortar.lng]}
        icon={mortarIcon}
        draggable
        eventHandlers={handlers}
        zIndexOffset={1000}
      >
        <Popup>
          <div className="readout__title" style={{ color: "var(--mortar)" }}>
            Mortar
          </div>
          <div className="readout__row">
            <span className="readout__label">Position</span>
            <span className="readout__value">
              {Math.round(mortar.lng)}, {Math.round(-mortar.lat)} m
            </span>
          </div>
          <div className="readout__row">
            <span className="readout__label">Altitude</span>
            <span className="readout__value">
              {sampleHeight(heightmap, map, mortar.lat, mortar.lng).toFixed(0)} m
            </span>
          </div>
          <div className="readout__row">
            <span className="readout__label">Max range</span>
            <span className="readout__value">{Math.round(MAX_RANGE)} m</span>
          </div>
        </Popup>
      </Marker>
    </>
  );
}
