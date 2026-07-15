import { getMap } from "../../data/maps";
import { useAppStore } from "../../store/useAppStore";
import type { Session } from "../../store/types";

interface Props {
  session: Session;
  active: boolean;
}

export default function SessionItem({ session, active }: Props) {
  const selectSession = useAppStore((s) => s.selectSession);
  const renameSession = useAppStore((s) => s.renameSession);
  const deleteSession = useAppStore((s) => s.deleteSession);

  const mapName = getMap(session.mapId).name;

  return (
    <div
      className={`session-item ${active ? "session-item--active" : ""}`}
      onClick={() => selectSession(session.id)}
    >
      <input
        className="session-item__name"
        value={session.name}
        onChange={(e) => renameSession(session.id, e.target.value)}
        onClick={(e) => e.stopPropagation()}
        aria-label="Session name"
      />
      <span className="session-item__meta">{mapName}</span>
      <button
        className="icon-btn"
        title="Delete session"
        onClick={(e) => {
          e.stopPropagation();
          deleteSession(session.id);
        }}
      >
        ✕
      </button>
    </div>
  );
}
