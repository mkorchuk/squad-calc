import { useEffect } from "react";
import { CRS } from "leaflet";
import { ImageOverlay, MapContainer, useMap, useMapEvents } from "react-leaflet";
import { getMap } from "../../data/maps";
import { boundsFor, latLngBoundsFor } from "../../lib/mapBounds";
import { useHeightmap } from "../../hooks/useHeightmap";
import { useAppStore } from "../../store/useAppStore";
import MapGrid from "./MapGrid";
import MortarMarker from "./MortarMarker";
import TargetMarker from "./TargetMarker";

/** Handles map click placement and re-fitting bounds when the map changes. */
function MapController({ mapId }: { mapId: string }) {
  const map = useMap();
  const placementMode = useAppStore((s) => s.placementMode);
  const setMortar = useAppStore((s) => s.setMortar);
  const addTarget = useAppStore((s) => s.addTarget);

  useEffect(() => {
    const bounds = latLngBoundsFor(getMap(mapId));
    map.setMaxBounds(bounds.pad(0.25));
    map.fitBounds(bounds);
  }, [map, mapId]);

  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      if (placementMode === "mortar") setMortar(lat, lng);
      else addTarget(lat, lng);
    },
  });

  return null;
}

export default function MapView() {
  const session = useAppStore((s) => s.getActiveSession());
  const map = getMap(session?.mapId ?? "");
  const heightmap = useHeightmap(map.id);

  return (
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
      <ImageOverlay key={map.id} url={map.image} bounds={boundsFor(map)} />
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
  );
}
