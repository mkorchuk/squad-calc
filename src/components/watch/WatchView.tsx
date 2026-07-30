import { useEffect, useState } from "react";
import { getMap } from "../../data/maps";
import { subscribeStream, type StreamState } from "../../lib/stream";
import StreamMap, { LiveBanner } from "./StreamMap";

/** The read-only spectator view behind a `?watch=<roomId>` share link. */
export default function WatchView({ roomId }: { roomId: string }) {
  const [stream, setStream] = useState<StreamState | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const unsub = subscribeStream(roomId, (s) => {
      setStream(s);
      setConnected(true);
    });
    return unsub;
  }, [roomId]);

  if (!connected) {
    return <div className="watch-status">Connecting to live view…</div>;
  }
  if (!stream) {
    return (
      <div className="watch-status">
        This stream isn’t live.<br />
        <span className="watch-status__dim">It may have ended or the link is wrong.</span>
      </div>
    );
  }

  return (
    <StreamMap
      stream={stream}
      banner={<LiveBanner text={`Live view · ${getMap(stream.mapId).name}`} />}
    />
  );
}
