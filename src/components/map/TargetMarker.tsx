import { memo, useMemo, useRef } from "react";
import { Marker, Polygon, Popup } from "react-leaflet";
import L, { type Marker as LeafletMarker } from "leaflet";
import { useAppStore } from "../../store/useAppStore";
import type { MortarMark, TargetMark } from "../../store/types";
import type { MapDefinition } from "../../data/maps";
import type { Weapon } from "../../data/weapons";
import {
  formatElevation,
  getBearing,
  getDistance,
  getElevation,
  getSpread,
  spreadEllipse,
} from "../../lib/ballistics";
import { sampleHeight, type HeightGrid } from "../../lib/heightmap";
import { NO_SOLUTION_TEXT, targetIcon } from "./markerIcons";

/** Dispersion ellipse styling — a translucent red area. Shared with the stream
 *  viewer so its spread circles match the planner's exactly. */
export const SPREAD_STYLE = {
  color: "#ff3b3b",
  weight: 1.3,
  fillColor: "#ff3b3b",
  fillOpacity: 0.15,
  interactive: false,
};

interface Props {
  target: TargetMark;
  index: number;
  mortar: MortarMark | null;
  /** The session's weapon. Always one of the WEAPONS entries, so the reference
   *  is stable and doesn't defeat the memo below. */
  weapon: Weapon;
  map: MapDefinition;
  heightmap: HeightGrid | null;
}

function TargetMarker({ target, index, mortar, weapon, map, heightmap }: Props) {
  const moveTarget = useAppStore((s) => s.moveTarget);
  const removeTarget = useAppStore((s) => s.removeTarget);
  const showSpread = useAppStore((s) => s.showSpread);
  const ref = useRef<LeafletMarker>(null);
  const spreadRef = useRef<L.Polygon>(null);

  const solution = useMemo(() => {
    if (!mortar) return null;
    const distance = getDistance(mortar, target);
    const bearing = getBearing(mortar, target);
    const mortarAlt = sampleHeight(heightmap, map, mortar.lat, mortar.lng);
    const targetAlt = sampleHeight(heightmap, map, target.lat, target.lng);
    const heightDiff = targetAlt - mortarAlt;
    const elevation = getElevation(distance, weapon, heightDiff);
    const spread = getSpread(distance, weapon, heightDiff);
    return { distance, bearing, elevation, spread, mortarAlt, targetAlt, heightDiff };
  }, [mortar, target, weapon, heightmap, map]);

  // 48 points per target; memoised so react-leaflet doesn't setLatLngs on every
  // render, and so a screen full of spread circles isn't rebuilt needlessly.
  const spreadRing = useMemo(
    () =>
      solution?.spread ? spreadEllipse(target, solution.spread, solution.bearing) : null,
    [solution, target]
  );

  const icon = useMemo(
    () =>
      targetIcon({
        bearing: solution ? solution.bearing : null,
        elevation:
          solution && solution.elevation.inRange
            ? formatElevation(solution.elevation, weapon)
            : null,
      }),
    [solution, weapon]
  );

  const handlers = useMemo(
    () => ({
      drag() {
        const m = ref.current;
        if (!m || !mortar) return;
        const pos = m.getLatLng();
        const distance = getDistance(mortar, pos);
        const bearing = getBearing(mortar, pos);
        const heightDiff =
          sampleHeight(heightmap, map, pos.lat, pos.lng) -
          sampleHeight(heightmap, map, mortar.lat, mortar.lng);
        const elevation = getElevation(distance, weapon, heightDiff);
        const el = m.getElement();
        if (el) {
          const milEl = el.querySelector(".target-marker__mil");
          const brgEl = el.querySelector(".target-marker__bearing");
          if (milEl) {
            milEl.textContent = elevation.inRange
              ? formatElevation(elevation, weapon)
              : NO_SOLUTION_TEXT;
          }
          if (brgEl) brgEl.textContent = `${bearing.toFixed(1)}°`;
        }

        const spreadLayer = spreadRef.current;
        if (spreadLayer) {
          const spread = getSpread(distance, weapon, heightDiff);
          if (spread) {
            spreadLayer.setLatLngs(spreadEllipse(pos, spread, bearing));
            spreadLayer.setStyle(SPREAD_STYLE);
          } else {
            spreadLayer.setStyle({ opacity: 0, fillOpacity: 0 });
          }
        }
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
    [moveTarget, removeTarget, target.id, mortar, weapon, heightmap, map]
  );

  return (
    <>
      {showSpread && spreadRing && (
        <Polygon
          ref={spreadRef}
          positions={spreadRing}
          pane="spread"
          pathOptions={SPREAD_STYLE}
        />
      )}
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
          <div className="readout__warn">
            Place the {weapon.name.toLowerCase()} to compute a solution.
          </div>
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
                  {solution.elevation.deg.toFixed(1)}°
                  {/* A mil-sighted weapon also gets the number its sight reads. */}
                  {weapon.unit === "mil" && ` / ${formatElevation(solution.elevation, weapon)} mil`}
                </span>
              </div>
            ) : (
              <div className="readout__warn">
                Out of range for the {weapon.name.toLowerCase()}.
              </div>
            )}
            <div className="readout__row">
              <span className="readout__label">Altitude</span>
              <span className="readout__value">
                {solution.targetAlt.toFixed(0)} m ({solution.heightDiff >= 0 ? "+" : ""}
                {solution.heightDiff.toFixed(0)} m)
              </span>
            </div>
            {solution.spread && (
              <div className="readout__row">
                <span className="readout__label">Spread</span>
                <span className="readout__value">
                  {Math.round(solution.spread.semiMinor / 2)} m down-range ·{" "}
                  {Math.round(solution.spread.semiMajor / 2)} m lateral
                </span>
              </div>
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
    </>
  );
}

/**
 * Memoised because the Space tool can place hundreds of these: `updateActive`
 * replaces only the target it touched, so moving or removing one leaves every
 * other marker's props identical and skips its re-render entirely.
 */
export default memo(TargetMarker);
