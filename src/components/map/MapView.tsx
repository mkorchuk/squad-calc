import { useCallback, useEffect, useState } from "react";
import { CRS } from "leaflet";
import {
  CircleMarker,
  ImageOverlay,
  MapContainer,
  Pane,
  Polygon,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { getMap } from "../../data/maps";
import { boundsFor, latLngBoundsFor } from "../../lib/mapBounds";
import { loadHeightmap } from "../../lib/heightmap";
import { MAX_FILL_POINTS, pointsAlongLine, pointsInPolygon } from "../../lib/targetFill";
import type { Point } from "../../lib/targetFill";
import { useHeightmap } from "../../hooks/useHeightmap";
import { useAppStore } from "../../store/useAppStore";
import MapGrid from "./MapGrid";
import MapLoadingOverlay from "./MapLoadingOverlay";
import MortarMarker from "./MortarMarker";
import TargetMarker from "./TargetMarker";

/**
 * True only once `active` has held for `delay` ms. Avoids flashing the loading
 * card for basemaps the browser already has cached (near-instant `load`).
 */
function useSettledActive(active: boolean, delay: number): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [active, delay]);

  return visible;
}

/** Click radius, in screen pixels, for closing a Space polygon on its first vertex. */
const CLOSE_PX = 12;

const DRAFT_STYLE = { color: "#e0603a", weight: 2, dashArray: "5 5" };

/**
 * Handles map click placement and re-fitting bounds when the map changes.
 *
 * The in-progress line/area for the Line and Space tools lives here rather than
 * in MapView: it follows the cursor on every mousemove, and re-rendering the
 * target markers at that rate is far too expensive.
 */
function MapController({ mapId }: { mapId: string }) {
  const map = useMap();
  const placementMode = useAppStore((s) => s.placementMode);
  const tool = useAppStore((s) => s.targetTool);
  const spacing = useAppStore((s) => s.spacing);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const setMortar = useAppStore((s) => s.setMortar);
  const addTarget = useAppStore((s) => s.addTarget);
  const addTargets = useAppStore((s) => s.addTargets);

  const [draft, setDraft] = useState<Point[]>([]);
  const [cursor, setCursor] = useState<Point | null>(null);

  const resetDraft = useCallback(() => {
    setDraft([]);
    setCursor(null);
  }, []);

  useEffect(() => {
    const bounds = latLngBoundsFor(getMap(mapId));
    map.setMaxBounds(bounds.pad(0.25));
    map.fitBounds(bounds);
  }, [map, mapId]);

  // A half-drawn shape is meaningless once the map, session, tool or mode changes
  // — its coordinates belong to the context it was started in.
  useEffect(resetDraft, [resetDraft, mapId, activeSessionId, tool, placementMode]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") resetDraft();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [resetDraft]);

  /** Places the points, unless the fill is big enough to bog the map down. */
  const commit = useCallback(
    (points: Point[]) => {
      resetDraft();
      if (!points.length) return;
      if (points.length > MAX_FILL_POINTS) {
        window.alert(
          `That would place ${points.length} targets (limit ${MAX_FILL_POINTS}). ` +
            `Use a smaller area or a wider spacing.`
        );
        return;
      }
      addTargets(points);
    },
    [addTargets, resetDraft]
  );

  const isNearFirstVertex = useCallback(
    (p: Point) => {
      if (!draft.length) return false;
      const first = map.latLngToContainerPoint([draft[0].lat, draft[0].lng]);
      return first.distanceTo(map.latLngToContainerPoint([p.lat, p.lng])) <= CLOSE_PX;
    },
    [draft, map]
  );

  useMapEvents({
    click(e) {
      const p: Point = { lat: e.latlng.lat, lng: e.latlng.lng };

      if (placementMode === "mortar") {
        setMortar(p.lat, p.lng);
        return;
      }

      if (tool === "single") {
        addTarget(p.lat, p.lng);
        return;
      }

      if (tool === "line") {
        if (!draft.length) setDraft([p]);
        else commit(pointsAlongLine(draft[0], p, spacing));
        return;
      }

      // Space: collect corners until the click lands back on the first one.
      if (draft.length >= 3 && isNearFirstVertex(p)) {
        commit(pointsInPolygon(draft, spacing));
      } else {
        setDraft([...draft, p]);
      }
    },
    mousemove(e) {
      if (draft.length) setCursor({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  if (!draft.length) return null;

  const path = cursor ? [...draft, cursor] : draft;
  const latLngs = path.map((p) => [p.lat, p.lng] as [number, number]);

  // pointerEvents: none is load-bearing — the draft sits under the cursor, and
  // clicks (including the one closing a polygon on its first vertex) must reach
  // the map's own click handler.
  return (
    <Pane name="draft" style={{ zIndex: 460, pointerEvents: "none" }}>
      {tool === "space" && draft.length >= 2 ? (
        <Polygon
          positions={latLngs}
          pathOptions={{ ...DRAFT_STYLE, fillOpacity: 0.1, interactive: false }}
        />
      ) : (
        <Polyline positions={latLngs} pathOptions={{ ...DRAFT_STYLE, interactive: false }} />
      )}
      {draft.map((v, i) => (
        <CircleMarker
          key={i}
          center={[v.lat, v.lng]}
          radius={4}
          pathOptions={{ color: DRAFT_STYLE.color, fillOpacity: 1, interactive: false }}
        />
      ))}
    </Pane>
  );
}

export default function MapView() {
  const session = useAppStore((s) => s.getActiveSession());
  const map = getMap(session?.mapId ?? "");
  const heightmap = useHeightmap(map.id);

  const [imageLoaded, setImageLoaded] = useState(false);
  useEffect(() => setImageLoaded(false), [map.id]);

  // Tracks when the heightmap fetch has settled, independent of whether it
  // found data — a map with no heightmap (404 -> null) still counts as "ready".
  // loadHeightmap shares useHeightmap's cache/inflight request, so this doesn't
  // trigger a second fetch.
  const [heightSettled, setHeightSettled] = useState(false);
  useEffect(() => {
    let active = true;
    setHeightSettled(false);
    loadHeightmap(map.id).then(() => {
      if (active) setHeightSettled(true);
    });
    return () => {
      active = false;
    };
  }, [map.id]);

  const loading = !imageLoaded || !heightSettled;
  const showLoading = useSettledActive(loading, 150);

  return (
    <>
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
        <MapController mapId={map.id} />
        <ImageOverlay
          key={map.id}
          url={map.image}
          bounds={boundsFor(map)}
          eventHandlers={{
            load: () => setImageLoaded(true),
            error: () => setImageLoaded(true),
          }}
        />
        <MapGrid map={map} />

        {session?.mortar && (
          <MortarMarker mortar={session.mortar} map={map} heightmap={heightmap} />
        )}
        {session?.targets.map((target, i) => (
          <TargetMarker
            key={target.id}
            target={target}
            index={i + 1}
            mortar={session.mortar}
            map={map}
            heightmap={heightmap}
          />
        ))}
      </MapContainer>
      <MapLoadingOverlay visible={showLoading} mapName={map.name} />
    </>
  );
}
