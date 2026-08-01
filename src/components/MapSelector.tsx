import { MAPS } from "../data/maps";
import { useAppStore } from "../store/useAppStore";

export default function MapSelector() {
  const session = useAppStore((s) => s.getActiveSession());
  const setMapId = useAppStore((s) => s.setMapId);

  const mapId = session?.mapId ?? MAPS[0].id;
  // Shapes count as marks: setMapId clears them too, so a session holding only
  // shapes must still get the warning.
  const hasMarks =
    !!session &&
    (session.mortar !== null ||
      session.targets.length > 0 ||
      (session.shapes?.length ?? 0) > 0);

  function handleChange(nextId: string) {
    if (nextId === mapId) return;
    if (hasMarks) {
      const ok = window.confirm(
        "Switching maps will clear the mortar, targets and shapes in this session. Continue?"
      );
      if (!ok) return;
    }
    setMapId(nextId);
  }

  return (
    <div className="topbar">
      <select
        className="map-select"
        value={mapId}
        onChange={(e) => handleChange(e.target.value)}
        aria-label="Select map"
      >
        {MAPS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </div>
  );
}
