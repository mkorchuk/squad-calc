import { useEffect, useState } from "react";
import { CRS } from "leaflet";
import { ImageOverlay, MapContainer, Marker, Pane, useMap } from "react-leaflet";
import { getMap } from "../../data/maps";
import { boundsFor, latLngBoundsFor } from "../../lib/mapBounds";
import { useHeightmap } from "../../hooks/useHeightmap";
import { sampleHeight } from "../../lib/heightmap";
import { STANDARD_MORTAR } from "../../data/weapons";
import { getBearing, getDistance, getElevation } from "../../lib/ballistics";
import { subscribeStream, type StreamState } from "../../lib/stream";
import { mortarIcon, targetIcon } from "../map/markerIcons";
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

export default function WatchView({ roomId }: { roomId: string }) {
  const [stream, setStream] = useState<StreamState | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const unsub = subscribeStream(roomId, (s) => {
      setStream(s);
      setConnected(true);
    });
    return unsub;
  }, [roomId]);

  const map = getMap(stream?.mapId ?? "");
  const heightmap = useHeightmap(map.id);

  if (!connected) {
    return <div className="watch-status">Connecting to live view…</div>;
  }
  if (!stream) {
    return (
      <div className="watch-status">
        This stream isn’t live.<br />
        <span className="watch-status__dim">It may have ended or the link is wrong.</span>
      </div>
    );
  }

  const targets = stream.targets ?? [];
  const shapes = stream.shapes ?? [];
  const mortar = stream.mortar;

  return (
    <div className="watch">
      <div className="watch__banner">
        <span className="watch__dot" /> Live view · {map.name}
      </div>
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
        <MapGrid map={map} />

        <Pane name="shapes" style={{ zIndex: 455, pointerEvents: "none" }}>
          {shapes.map((shape) => (
            <ShapeLayer key={shape.id} shape={shape} />
          ))}
        </Pane>

        {mortar && (
          <Marker position={[mortar.lat, mortar.lng]} icon={mortarIcon} interactive={false} />
        )}

        {targets.map((t) => {
          let label: { mil: number | null; bearing: number | null } = { mil: null, bearing: null };
          if (mortar) {
            const distance = getDistance(mortar, t);
            const bearing = getBearing(mortar, t);
            const heightDiff =
              sampleHeight(heightmap, map, t.lat, t.lng) -
              sampleHeight(heightmap, map, mortar.lat, mortar.lng);
            const elevation = getElevation(distance, STANDARD_MORTAR, heightDiff);
            label = { mil: elevation.inRange ? elevation.mil : null, bearing };
          }
          return (
            <Marker
              key={t.id}
              position={[t.lat, t.lng]}
              icon={targetIcon(label)}
              interactive={false}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
