import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import { useStreamStore } from "../store/useStreamStore";
import { publishStream, removeRoomOnDisconnect } from "../lib/stream";

/**
 * Host side: while a stream is active, mirror the active session's map, mortar,
 * targets and shapes to its RTDB room on every change. Spectators read-only.
 */
export function useStreamPublisher(): void {
  const roomId = useStreamStore((s) => s.roomId);
  const session = useAppStore((s) => s.getActiveSession());

  // Register server-side cleanup once per room, so a closed/reloaded host tab
  // doesn't leave spectators staring at a frozen map.
  useEffect(() => {
    if (roomId) removeRoomOnDisconnect(roomId);
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !session) return;
    publishStream(roomId, {
      mapId: session.mapId,
      mortar: session.mortar,
      targets: session.targets,
      shapes: session.shapes ?? [],
    }).catch((err) => console.error("Stream publish failed:", err));
  }, [roomId, session]);
}
