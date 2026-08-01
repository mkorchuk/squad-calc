import { useCallback, useEffect, useRef, useState } from "react";
import L, { CRS } from "leaflet";
import {
  Circle,
  CircleMarker,
  ImageOverlay,
  MapContainer,
  Pane,
  Polygon,
  Polyline,
  Rectangle,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { getMap } from "../../data/maps";
import type { MapDefinition } from "../../data/maps";
import { STANDARD_MORTAR } from "../../data/weapons";
import { getDistance, getSpread } from "../../lib/ballistics";
import { boundsFor, latLngBoundsFor } from "../../lib/mapBounds";
import { loadHeightmap, sampleHeight, type HeightGrid } from "../../lib/heightmap";
import { shapeAtPoint } from "../../lib/shapeHit";
import { MAX_FILL_POINTS, pointsAlongLine, pointsInPolygon } from "../../lib/targetFill";
import type { Point } from "../../lib/targetFill";
import { useHeightmap } from "../../hooks/useHeightmap";
import { useAppStore } from "../../store/useAppStore";
import type { ShapeInput, ShapeType } from "../../store/types";
import MapGrid from "./MapGrid";
import MapLoadingOverlay from "./MapLoadingOverlay";
import MortarMarker from "./MortarMarker";
import TargetMarker from "./TargetMarker";
import ShapeLayer from "./ShapeLayer";
import DrawMenu from "./DrawMenu";

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

/** A drag shorter than this (screen px) is treated as a mis-click, not a shape. */
const MIN_DRAW_PX = 6;

/** Swaps the map's crosshair for a pointer while the cursor is over a shape. */
const OVER_SHAPE_CLASS = "map--over-shape";

const DRAFT_STYLE = { color: "#e0603a", weight: 2, dashArray: "5 5" };

/** Dashed preview of the shape being dragged out, in the colour it'll be drawn in. */
function shapePreviewStyle(color: string) {
  return {
    color,
    weight: 2,
    dashArray: "5 5",
    fillColor: color,
    fillOpacity: 0.05,
    interactive: false,
  };
}

function radiusBetween(a: Point, b: Point): number {
  return Math.hypot(b.lat - a.lat, b.lng - a.lng);
}

function buildShape(type: ShapeType, start: Point, end: Point, color: string): ShapeInput {
  if (type === "circle")
    return { type: "circle", center: start, radius: radiusBetween(start, end), color };
  return { type, a: start, b: end, color };
}

/**
 * Handles map click placement and re-fitting bounds when the map changes.
 *
 * The in-progress line/area for the Line and Space tools lives here rather than
 * in MapView: it follows the cursor on every mousemove, and re-rendering the
 * target markers at that rate is far too expensive.
 */
interface MapControllerProps {
  mapId: string;
  /** The active map's definition and heightmap, needed to size the Space tool's
   * spread-radius-based spacing (see `spaceSpacing` below). */
  mapDef: MapDefinition;
  heightmap: HeightGrid | null;
  /** The shape tool armed from the right-click menu, or null when placing targets. */
  armed: ShapeType | null;
  onOpenMenu: (clientX: number, clientY: number) => void;
  onFinishArmed: () => void;
}

function MapController({
  mapId,
  mapDef,
  heightmap,
  armed,
  onOpenMenu,
  onFinishArmed,
}: MapControllerProps) {
  const map = useMap();
  const placementMode = useAppStore((s) => s.placementMode);
  const tool = useAppStore((s) => s.targetTool);
  const spacing = useAppStore((s) => s.spacing);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const mortar = useAppStore((s) => s.getActiveSession()?.mortar ?? null);
  const shapes = useAppStore((s) => s.getActiveSession()?.shapes);
  const shapeColor = useAppStore((s) => s.shapeColor);
  const setMortar = useAppStore((s) => s.setMortar);
  const addTarget = useAppStore((s) => s.addTarget);
  const addTargets = useAppStore((s) => s.addTargets);
  const addShape = useAppStore((s) => s.addShape);
  const removeShape = useAppStore((s) => s.removeShape);

  const [draft, setDraft] = useState<Point[]>([]);
  const [cursor, setCursor] = useState<Point | null>(null);

  // The shape currently being dragged out (start = mousedown, end = current cursor).
  const [drawStart, setDrawStart] = useState<Point | null>(null);
  const [drawEnd, setDrawEnd] = useState<Point | null>(null);
  // mouseup fires a trailing click; this suppresses it so a draw doesn't also place a target.
  const suppressClick = useRef(false);
  // Whether the cursor is currently over a shape outline, so the class is only
  // touched on a change rather than on every mousemove.
  const overShape = useRef(false);

  /** Shows the pointer ("hand") cursor while over a shape, where right-click deletes it. */
  const setOverShape = useCallback(
    (over: boolean) => {
      if (overShape.current === over) return;
      overShape.current = over;
      map.getContainer().classList.toggle(OVER_SHAPE_CLASS, over);
    },
    [map]
  );

  // A hidden/removed shape must not leave the cursor stuck as a hand.
  useEffect(
    () => () => {
      map.getContainer().classList.remove(OVER_SHAPE_CLASS);
    },
    [map]
  );

  const resetDraft = useCallback(() => {
    setDraft([]);
    setCursor(null);
  }, []);

  // While a shape tool is armed, left-drag must draw, not pan the map.
  useEffect(() => {
    if (armed) {
      map.dragging.disable();
      resetDraft();
      setOverShape(false);
    } else {
      map.dragging.enable();
      setDrawStart(null);
      setDrawEnd(null);
    }
    return () => {
      map.dragging.enable();
    };
  }, [armed, map, resetDraft, setOverShape]);

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

  /**
   * Spacing for the Space tool: sized from the mortar's spread (dispersion)
   * radius at the drawn area's centroid, rather than the manual spacing value,
   * so placed targets' footprints tile to cover the area with no gaps. Uses the
   * standard hexagonal-covering spacing (radius * sqrt(3)) between centers.
   * Falls back to the manual spacing when there's no mortar or the centroid is
   * out of firing range.
   */
  const spaceSpacing = useCallback(
    (vertices: Point[]): number => {
      if (!mortar || !vertices.length) return spacing;
      const centroid = {
        lat: vertices.reduce((sum, v) => sum + v.lat, 0) / vertices.length,
        lng: vertices.reduce((sum, v) => sum + v.lng, 0) / vertices.length,
      };
      const distance = getDistance(mortar, centroid);
      const heightDiff =
        sampleHeight(heightmap, mapDef, centroid.lat, centroid.lng) -
        sampleHeight(heightmap, mapDef, mortar.lat, mortar.lng);
      const spread = getSpread(distance, STANDARD_MORTAR, heightDiff);
      return spread ? spread.radius * Math.sqrt(3) : spacing;
    },
    [mortar, mapDef, heightmap, spacing]
  );

  useMapEvents({
    contextmenu(e) {
      const oe = e.originalEvent;
      L.DomEvent.preventDefault(oe);
      // Right-clicking a marker keeps its own remove behavior; don't open the menu there.
      const el = oe.target as HTMLElement | null;
      if (el && el.closest(".leaflet-marker-icon")) return;

      // Shapes are non-interactive layers (so they never swallow a placement
      // click), so the hit test happens here rather than on the layer itself.
      const hit = shapeAtPoint(map, shapes ?? [], e.containerPoint);
      if (hit) {
        removeShape(hit.id);
        setOverShape(false); // it's gone; don't leave the cursor as a hand
        return;
      }

      onOpenMenu(oe.clientX, oe.clientY);
    },
    mousedown(e) {
      if (!armed) return;
      L.DomEvent.preventDefault(e.originalEvent);
      const p: Point = { lat: e.latlng.lat, lng: e.latlng.lng };
      setDrawStart(p);
      setDrawEnd(p);
    },
    mouseup(e) {
      if (!armed || !drawStart) return;
      const end: Point = { lat: e.latlng.lat, lng: e.latlng.lng };
      const startPx = map.latLngToContainerPoint([drawStart.lat, drawStart.lng]);
      const endPx = map.latLngToContainerPoint([end.lat, end.lng]);
      if (startPx.distanceTo(endPx) >= MIN_DRAW_PX)
        addShape(buildShape(armed, drawStart, end, shapeColor));
      suppressClick.current = true;
      onFinishArmed();
    },
    click(e) {
      if (suppressClick.current) {
        suppressClick.current = false;
        return;
      }
      if (armed) return;

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
        commit(pointsInPolygon(draft, spaceSpacing(draft)));
      } else {
        setDraft([...draft, p]);
      }
    },
    mousemove(e) {
      const p: Point = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (armed && drawStart) setDrawEnd(p);
      else if (draft.length) setCursor(p);
      // While a shape tool is armed the cursor belongs to drawing, not deleting.
      setOverShape(!armed && !!shapeAtPoint(map, shapes ?? [], e.containerPoint));
    },
    mouseout() {
      setOverShape(false);
    },
  });

  const previewStyle = shapePreviewStyle(shapeColor);

  const drawingPreview =
    armed && drawStart && drawEnd ? (
      <Pane name="shape-preview" style={{ zIndex: 461, pointerEvents: "none" }}>
        {armed === "line" && (
          <Polyline
            positions={[
              [drawStart.lat, drawStart.lng],
              [drawEnd.lat, drawEnd.lng],
            ]}
            pathOptions={previewStyle}
          />
        )}
        {armed === "rect" && (
          <Rectangle
            bounds={[
              [drawStart.lat, drawStart.lng],
              [drawEnd.lat, drawEnd.lng],
            ]}
            pathOptions={previewStyle}
          />
        )}
        {armed === "circle" && (
          <Circle
            center={[drawStart.lat, drawStart.lng]}
            radius={radiusBetween(drawStart, drawEnd)}
            pathOptions={previewStyle}
          />
        )}
      </Pane>
    ) : null;


  if (!draft.length) return drawingPreview;

  const path = cursor ? [...draft, cursor] : draft;
  const latLngs = path.map((p) => [p.lat, p.lng] as [number, number]);

  // pointerEvents: none is load-bearing — the draft sits under the cursor, and
  // clicks (including the one closing a polygon on its first vertex) must reach
  // the map's own click handler.
  return (
    <>
      {drawingPreview}
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
    </>
  );
}

export default function MapView() {
  const session = useAppStore((s) => s.getActiveSession());
  const map = getMap(session?.mapId ?? "");
  const heightmap = useHeightmap(map.id);

  // Target label font sizes are `calc(... * var(--label-scale))`. It's set on the
  // document root rather than on MapContainer, whose props react-leaflet only
  // reads once at mount — a later change to its `style` would never take effect.
  const labelScale = useAppStore((s) => s.labelScale);
  useEffect(() => {
    document.documentElement.style.setProperty("--label-scale", String(labelScale));
  }, [labelScale]);

  // Right-click draw menu position (viewport coords) and the armed shape tool.
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [armed, setArmed] = useState<ShapeType | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenu(null);
        setArmed(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
        <MapController
          mapId={map.id}
          mapDef={map}
          heightmap={heightmap}
          armed={armed}
          onOpenMenu={(x, y) => setMenu({ x, y })}
          onFinishArmed={() => setArmed(null)}
        />
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

        <Pane name="shapes" style={{ zIndex: 455, pointerEvents: "none" }}>
          {(session?.shapes ?? []).map((shape) => (
            <ShapeLayer key={shape.id} shape={shape} />
          ))}
        </Pane>

        {/* Spread circles sit above the map/grid but below markers, and never
            intercept clicks meant for target placement. */}
        <Pane name="spread" style={{ zIndex: 452, pointerEvents: "none" }} />

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
      {menu && (
        <DrawMenu
          x={menu.x}
          y={menu.y}
          onPick={(type) => {
            setArmed(type);
            setMenu(null);
          }}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}
