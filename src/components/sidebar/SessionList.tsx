import { useAppStore } from "../../store/useAppStore";
import SessionItem from "./SessionItem";

export default function SessionList() {
  const sessions = useAppStore((s) => s.sessions);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const addSession = useAppStore((s) => s.addSession);

  return (
    <>
      <div className="sidebar__section-label">Sessions</div>
      <div className="session-list">
        {sessions.map((session) => (
          <SessionItem
            key={session.id}
            session={session}
            active={session.id === activeSessionId}
          />
        ))}
      </div>
      <div className="sidebar__footer">
        <button className="btn btn--block" onClick={addSession}>
          + Add session
        </button>
      </div>
    </>
  );
}
