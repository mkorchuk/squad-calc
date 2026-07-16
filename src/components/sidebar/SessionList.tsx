import { useRef } from "react";
import { useAppStore } from "../../store/useAppStore";
import { readSessionFile } from "../../lib/sessionFile";
import { ImportIcon } from "../icons";
import SessionItem from "./SessionItem";

export default function SessionList() {
  const sessions = useAppStore((s) => s.sessions);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const addSession = useAppStore((s) => s.addSession);
  const importSession = useAppStore((s) => s.importSession);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    try {
      const data = await readSessionFile(file);
      importSession(data);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to import session.");
    }
  }

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
      <div className="sidebar__footer sidebar__footer--row">
        <button
          className="btn btn--import"
          onClick={() => fileInputRef.current?.click()}
          title="Import a session from file"
        >
          <ImportIcon /> Import
        </button>
        <button className="btn" onClick={addSession}>
          + Add session
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </div>
    </>
  );
}
