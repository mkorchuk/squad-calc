import { useAppStore } from "../../store/useAppStore";

export default function PlacementToolbar() {
  const mode = useAppStore((s) => s.placementMode);
  const setMode = useAppStore((s) => s.setPlacementMode);
  const clearMarks = useAppStore((s) => s.clearMarks);

  return (
    <div className="toolbar">
      <button
        className={`toolbar__btn toolbar__btn--mortar ${
          mode === "mortar" ? "toolbar__btn--active" : ""
        }`}
        onClick={() => setMode("mortar")}
        title="Click the map to place the mortar"
      >
        <span className="toolbar__dot toolbar__dot--mortar" />
        Mortar
      </button>
      <button
        className={`toolbar__btn toolbar__btn--target ${
          mode === "target" ? "toolbar__btn--active" : ""
        }`}
        onClick={() => setMode("target")}
        title="Click the map to add a target"
      >
        <span className="toolbar__dot toolbar__dot--target" />
        Target
      </button>
      <button
        className="toolbar__btn toolbar__clear"
        onClick={clearMarks}
        title="Remove all marks in this session"
      >
        Clear
      </button>
    </div>
  );
}
