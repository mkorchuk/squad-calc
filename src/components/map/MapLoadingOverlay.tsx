interface MapLoadingOverlayProps {
  visible: boolean;
  mapName: string;
}

/** Centered card shown while a map's basemap image and heightmap are downloading. */
export default function MapLoadingOverlay({ visible, mapName }: MapLoadingOverlayProps) {
  return (
    <div
      className={`map-loading ${visible ? "map-loading--visible" : ""}`}
      aria-hidden={!visible}
      aria-live="polite"
    >
      <span className="map-loading__spinner" />
      <span className="map-loading__text">Loading {mapName}…</span>
    </div>
  );
}
