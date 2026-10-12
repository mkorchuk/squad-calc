import { Fragment, useEffect, type ReactNode } from "react";
import { CRS } from "leaflet";
import { ImageOverlay, MapContainer, Marker, Pane, Polygon, useMap } from "react-leaflet";
import { getMap } from "../../data/maps";
import { boundsFor, latLngBoundsFor } from "../../lib/mapBounds";
import { useHeightmap } from "../../hooks/useHeightmap";
import { sampleHeight } from "../../lib/heightmap";
import { getWeapon } from "../../data/weapons";
import {
  formatElevation,
  getBearing,
  getDistance,
  getElevation,
  getSpread,
  spreadEllipse,
} from "../../lib/ballistics";
import type { StreamState } from "../../lib/stream";
import { mortarIcon, targetIcon, type TargetLabel } from "../map/markerIcons";
import { SPREAD_STYLE } from "../map/TargetMarker";
import MapGrid from "../map/MapGrid";
import ShapeLayer from "../map/ShapeLayer";

/** Re-fits the view whenever the streamed map changes. */
function FitBounds({ mapId }: { mapId: string }) {
  const map = useMap();
  useEffect(() => {
    const b = latLngBoundsFor(getMap(mapId));
    map.setMaxBounds(b.pad(0.25));
    map.fitBounds(b);
  }, [map, mapId]);
  return null;
}

/**
 * Read-only render of a streamed session. Shared by the `?watch=` spectator link
 * and the `/live` display page, so both stay pixel-identical.
 *
 * Callers own their own loading/empty states: this component always has a stream,
 * which keeps `useHeightmap` out of reach of any early return.
 */
export default function StreamMap({
  stream,
  banner,
}: {
  stream: StreamState;
  banner?: ReactNode;
}) {
  const map = getMap(stream.mapId);
  // The host's weapon: the solutions below are recomputed here, not streamed.
  const weapon = getWeapon(stream.weaponId);
  const heightmap = useHeightmap(map.id);

  const targets = stream.targets ?? [];
  const shapes = stream.shapes ?? [];
  const mortar = stream.mortar;

  // Mirror the host's target-label font size. Set on the document root (not on
  // MapContainer, whose style react-leaflet reads only once at mount) exactly as
  // the planner's MapView does; the label CSS reads var(--label-scale).
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--label-scale", String(stream.labelScale));
    return () => {
      root.style.removeProperty("--label-scale");
    };
  }, [stream.labelScale]);

  return (
    <div className="watch">
      {banner}
      <MapContainer
        crs={CRS.Simple}
        minZoom={-6}
        maxZoom={4}
        zoomSnap={0.25}
        zoomControl={false}
        attributionControl={false}
        bounds={boundsFor(map)}
        style={{ height: "100%", width: "100%" }}
      >
        <FitBounds mapId={map.id} />
        <ImageOverlay key={map.id} url={map.image} bounds={boundsFor(map)} />
        <MapGrid map={map} gridOpacity={stream.gridOpacity} />

        <Pane name="shapes" style={{ zIndex: 455, pointerEvents: "none" }}>
          {shapes.map((shape) => (
            <ShapeLayer key={shape.id} shape={shape} />
          ))}
        </Pane>

        {/* Spread ellipses (below) render into this pane when the host has them
            on. Same layering as the planner: above the map/grid, below markers.
            Kept always-mounted so a polygon never resolves its pane before it
            exists. */}
        <Pane name="spread" style={{ zIndex: 452, pointerEvents: "none" }} />

        {mortar && (
          <Marker position={[mortar.lat, mortar.lng]} icon={mortarIcon} interactive={false} />
        )}

        {targets.map((t) => {
          let label: TargetLabel = { elevation: null, bearing: null };
          let spreadRing: [number, number][] | null = null;
          if (mortar) {
            const distance = getDistance(mortar, t);
            const bearing = getBearing(mortar, t);
            const heightDiff =
              sampleHeight(heightmap, map, t.lat, t.lng) -
              sampleHeight(heightmap, map, mortar.lat, mortar.lng);
            const elevation = getElevation(distance, weapon, heightDiff);
            label = {
              elevation: elevation.inRange ? formatElevation(elevation, weapon) : null,
              bearing,
            };
            if (stream.showSpread) {
              const spread = getSpread(distance, weapon, heightDiff);
              if (spread) spreadRing = spreadEllipse(t, spread, bearing);
            }
          }
          return (
            <Fragment key={t.id}>
              {spreadRing && (
                <Polygon positions={spreadRing} pane="spread" pathOptions={SPREAD_STYLE} />
              )}
              <Marker
                position={[t.lat, t.lng]}
                icon={targetIcon(label)}
                interactive={false}
              />
            </Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}

/** The pulsing "live" chip both views float over the map. */
export function LiveBanner({ text }: { text: string }) {
  return (
    <div className="watch__banner">
      <span className="watch__dot" /> {text}
    </div>
  );
}
