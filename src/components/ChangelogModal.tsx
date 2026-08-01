import { useEffect } from "react";
import { CHANGELOG } from "../data/changelog";
import { APP_VERSION } from "../version";

/**
 * Centred release-notes dialog over a blurred backdrop. Closes on Escape or a
 * click outside the panel.
 */
export default function ChangelogModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Changelog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <h2 className="modal__title">Changelog</h2>
          <button className="modal__close" onClick={onClose} title="Close" aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal__body">
          {CHANGELOG.map((entry) => (
            <section key={entry.version} className="changelog__entry">
              <div className="changelog__version-row">
                <span className="changelog__version">{entry.version}</span>
                {entry.version === APP_VERSION && (
                  <span className="changelog__badge">current</span>
                )}
                <span className="changelog__entry-title">{entry.title}</span>
              </div>
              <ul className="changelog__list">
                {entry.changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
