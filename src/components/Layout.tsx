import { useState } from "react";
import SessionList from "./sidebar/SessionList";
import ToolPanel from "./sidebar/ToolPanel";
import MapSelector from "./MapSelector";
import MapView from "./map/MapView";
import PlacementToolbar from "./map/PlacementToolbar";
import ToolIndicator from "./map/ToolIndicator";
import ChangelogModal from "./ChangelogModal";
import { ChangelogIcon, ChevronIcon } from "./icons";
import { useAppStore } from "../store/useAppStore";
import { useStreamPublisher } from "../hooks/useStreamPublisher";
import { useToolHotkeys } from "../hooks/useToolHotkeys";
import { APP_VERSION } from "../version";

export default function Layout() {
  const sidebarVisible = useAppStore((s) => s.sidebarVisible);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const [changelogOpen, setChangelogOpen] = useState(false);
  useStreamPublisher();
  // Bound here rather than in ToolPanel, which unmounts with a hidden sidebar.
  useToolHotkeys();

  return (
    <div className={`app ${sidebarVisible ? "" : "app--sidebar-hidden"}`}>
      {sidebarVisible && (
        <aside className="sidebar">
          <div className="sidebar__header">
            <div className="sidebar__header-row">
              <h1 className="sidebar__title">
                SquadCalc <span className="sidebar__version">{APP_VERSION}</span>
              </h1>
              <button
                className="sidebar__toggle-tools"
                onClick={toggleSidebar}
                title="Hide sidebar"
              >
                <ChevronIcon />
              </button>
            </div>
            <p className="sidebar__subtitle">by absolute</p>
          </div>
          <div className="sidebar__pane">
            <SessionList />
          </div>
          <div className="sidebar__pane sidebar__pane--tools">
            <ToolPanel />
          </div>
          <div className="sidebar__bottom">
            <button
              className="sidebar__changelog-btn"
              onClick={() => setChangelogOpen(true)}
              title="What's new"
            >
              <ChangelogIcon />
              <span>Changelog</span>
            </button>
          </div>
        </aside>
      )}

      <main className="map-area">
        <PlacementToolbar />
        <MapSelector />
        <MapView />
        {!sidebarVisible && (
          <>
            <button className="sidebar-show-btn" onClick={toggleSidebar} title="Show sidebar">
              <ChevronIcon />
            </button>
            <ToolIndicator />
          </>
        )}
      </main>

      {changelogOpen && <ChangelogModal onClose={() => setChangelogOpen(false)} />}
    </div>
  );
}
