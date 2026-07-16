import SessionList from "./sidebar/SessionList";
import ToolPanel from "./sidebar/ToolPanel";
import MapSelector from "./MapSelector";
import MapView from "./map/MapView";
import PlacementToolbar from "./map/PlacementToolbar";

export default function Layout() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar__header">
          <h1 className="sidebar__title">SquadCalc</h1>
          <p className="sidebar__subtitle">by absolute</p>
        </div>
        <div className="sidebar__pane">
          <SessionList />
        </div>
        <div className="sidebar__pane sidebar__pane--tools">
          <ToolPanel />
        </div>
      </aside>

      <main className="map-area">
        <PlacementToolbar />
        <MapSelector />
        <MapView />
      </main>
    </div>
  );
}
