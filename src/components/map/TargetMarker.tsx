import { useMemo, useRef } from "react";
import { Marker, Popup } from "react-leaflet";
import L, { type Marker as LeafletMarker } from "leaflet";
import { useAppStore } from "../../store/useAppStore";
import type { MortarMark, TargetMark } from "../../store/types";
import { STANDARD_MORTAR } from "../../data/weapons";
import { getBearing, getDistance, getElevation } from "../../lib/ballistics";
import { targetIcon } from "./markerIcons";

interface Props {
  target: TargetMark;
  index: number;
  mortar: MortarMark | null;
}

export default function TargetMarker({ target, index, mortar }: Props) {
  const moveTarget = useAppStore((s) => s.moveTarget);
  const removeTarget = useAppStore((s) => s.removeTarget);
  const ref = useRef<LeafletMarker>(null);

  const solution = useMemo(() => {
    if (!mortar) return null;
    const distance = getDistance(mortar, target);
    const bearing = getBearing(mortar, target);
    const elevation = getElevation(distance, STANDARD_MORTAR);
    return { distance, bearing, elevation };
  }, [mortar, target]);

  const icon = useMemo(
    () =>
      targetIcon({
        bearing: solution ? solution.bearing : null,
        mil: solution && solution.elevation.inRange ? solution.elevation.mil : null,
      }),
    [solution]
  );

  const handlers = useMemo(
    () => ({
      drag() {
        const m = ref.current;
        if (!m || !mortar) return;
        const pos = m.getLatLng();
        const distance = getDistance(mortar, pos);
        const bearing = getBearing(mortar, pos);
        const elevation = getElevation(distance, STANDARD_MORTAR);
        const el = m.getElement();
        if (!el) return;
        const milEl = el.querySelector(".target-marker__mil");
        const brgEl = el.querySelector(".target-marker__bearing");
        if (milEl) milEl.textContent = elevation.inRange ? String(Math.round(elevation.mil)) : "∞";
        if (brgEl) brgEl.textContent = `${bearing.toFixed(1)}°`;
      },
      dragend() {
        const m = ref.current;
        if (!m) return;
        const { lat, lng } = m.getLatLng();
        moveTarget(target.id, lat, lng);
      },
      contextmenu(e: L.LeafletMouseEvent) {
        L.DomEvent.preventDefault(e.originalEvent);
        removeTarget(target.id);
      },
    }),
    [moveTarget, removeTarget, target.id, mortar]
  );

  return (
    <Marker
      ref={ref}
      position={[target.lat, target.lng]}
      icon={icon}
      draggable
      eventHandlers={handlers}
    >
      <Popup>
        <div className="readout__title">Target {index}</div>

        {!mortar && (
          <div className="readout__warn">Place a mortar to compute a solution.</div>
        )}

        {solution && (
          <>
            <div className="readout__row">
              <span className="readout__label">Distance</span>
              <span className="readout__value">{Math.round(solution.distance)} m</span>
            </div>
            <div className="readout__row">
              <span className="readout__label">Bearing</span>
              <span className="readout__value">{solution.bearing.toFixed(1)}°</span>
            </div>
            {solution.elevation.inRange ? (
              <div className="readout__row">
                <span className="readout__label">Elevation</span>
                <span className="readout__value">
                  {solution.elevation.deg.toFixed(1)}° / {Math.round(solution.elevation.mil)} mil
                </span>
              </div>
            ) : (
              <div className="readout__warn">Out of range for standard mortar.</div>
            )}
          </>
        )}

        <div className="readout__row" style={{ marginTop: 8 }}>
          <button className="btn" onClick={() => removeTarget(target.id)}>
            Remove target
          </button>
        </div>
      </Popup>
    </Marker>
  );
}
