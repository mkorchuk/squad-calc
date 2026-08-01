import { getMap } from "../../data/maps";
import { useAppStore } from "../../store/useAppStore";
import type { Session } from "../../store/types";
import { downloadSession } from "../../lib/sessionFile";
import { SaveIcon } from "../icons";

interface Props {
  session: Session;
  active: boolean;
}

export default function SessionItem({ session, active }: Props) {
  const selectSession = useAppStore((s) => s.selectSession);
  const renameSession = useAppStore((s) => s.renameSession);
  const deleteSession = useAppStore((s) => s.deleteSession);

  const mapName = getMap(session.mapId).name;

  /** Deleting is irreversible and the ✕ sits next to Save, so a session with
   *  work in it asks first. An empty one deletes straight away. */
  function handleDelete() {
    const marks =
      (session.mortar ? 1 : 0) + session.targets.length + (session.shapes?.length ?? 0);
    if (marks > 0 && !window.confirm(`Delete "${session.name}" and its ${marks} mark(s)?`)) {
      return;
    }
    deleteSession(session.id);
  }

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
        title="Save session to file"
        onClick={(e) => {
          e.stopPropagation();
          downloadSession(session);
        }}
      >
        <SaveIcon />
      </button>
      <button
        className="icon-btn"
        title="Delete session"
        onClick={(e) => {
          e.stopPropagation();
          handleDelete();
        }}
      >
        ✕
      </button>
    </div>
  );
}
