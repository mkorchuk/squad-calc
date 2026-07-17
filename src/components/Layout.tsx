import SessionList from "./sidebar/SessionList";
import ToolPanel from "./sidebar/ToolPanel";
import MapSelector from "./MapSelector";
import MapView from "./map/MapView";
import PlacementToolbar from "./map/PlacementToolbar";
import { ChevronIcon } from "./icons";
import { useAppStore } from "../store/useAppStore";
import { useStreamPublisher } from "../hooks/useStreamPublisher";
import { APP_VERSION } from "../version";

export default function Layout() {
  const sidebarVisible = useAppStore((s) => s.sidebarVisible);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  useStreamPublisher();

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
        </aside>
      )}

      <main className="map-area">
        <PlacementToolbar />
        <MapSelector />
        <MapView />
        {!sidebarVisible && (
          <button className="sidebar-show-btn" onClick={toggleSidebar} title="Show sidebar">
            <ChevronIcon />
          </button>
        )}
      </main>
    </div>
  );
}
