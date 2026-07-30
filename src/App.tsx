import Layout from "./components/Layout";
import LiveDisplayView from "./components/live/LiveDisplayView";
import WatchView from "./components/watch/WatchView";

export default function App() {
  // A `?watch=<roomId>` link opens the read-only spectator view instead of the app.
  // Checked first so `/live?watch=…` still spectates a specific room.
  const roomId = new URLSearchParams(window.location.search).get("watch");
  if (roomId) return <WatchView roomId={roomId} />;

  // `/live` is the fixed display URL — it pairs with a host rather than taking a
  // room id. Works in dev and in production because Vite's SPA mode and the
  // Firebase hosting rewrite both serve index.html for unknown paths.
  if (window.location.pathname.replace(/\/+$/, "") === "/live") return <LiveDisplayView />;

  return <Layout />;
}
