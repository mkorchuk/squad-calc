import Layout from "./components/Layout";
import WatchView from "./components/watch/WatchView";

export default function App() {
  // A `?watch=<roomId>` link opens the read-only spectator view instead of the app.
  const roomId = new URLSearchParams(window.location.search).get("watch");
  if (roomId) return <WatchView roomId={roomId} />;
  return <Layout />;
}
