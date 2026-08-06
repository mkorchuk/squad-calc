import { useEffect, useRef } from "react";
import { useAppStore } from "../store/useAppStore";
import { useStreamStore } from "../store/useStreamStore";
import { publishStream, removeRoomOnDisconnect, type StreamState } from "../lib/stream";

/**
 * Dragging a marker mutates the session on every mousemove, and each publish is a
 * full overwrite of the room. Coalesce to ~5 writes/second; the trailing write
 * guarantees the drag's final position still lands.
 */
const PUBLISH_INTERVAL_MS = 200;

/**
 * Host side: while a stream is live, mirror the active session's map, mortar,
 * targets and shapes — plus the host's display settings (label font size, grid
 * opacity, spread circles) so viewers match the host's screen — to its RTDB room
 * on every change. Viewers are read-only.
 */
export function useStreamPublisher(): void {
  const phase = useStreamStore((s) => s.phase);
  const roomId = useStreamStore((s) => s.roomId);
  const session = useAppStore((s) => s.getActiveSession());
  // Display settings live outside the session; a change to one must still
  // republish, so they're subscribed to and listed in the effect's deps below.
  const labelScale = useAppStore((s) => s.labelScale);
  const gridOpacity = useAppStore((s) => s.gridOpacity);
  const showSpread = useAppStore((s) => s.showSpread);

  const live = phase === "live" && roomId !== null;

  const pendingRef = useRef<StreamState | null>(null);
  const lastAtRef = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);

  // Register server-side cleanup once per room, so a closed/reloaded host tab
  // doesn't leave the display staring at a frozen map.
  useEffect(() => {
    if (live && roomId) removeRoomOnDisconnect(roomId);
  }, [live, roomId]);

  useEffect(() => {
    if (!live || !roomId || !session) return;

    pendingRef.current = {
      mapId: session.mapId,
      mortar: session.mortar,
      targets: session.targets,
      shapes: session.shapes ?? [],
      sessionName: session.name,
      labelScale,
      gridOpacity,
      showSpread,
    };

    const flush = () => {
      const state = pendingRef.current;
      if (!state) return;
      pendingRef.current = null;
      lastAtRef.current = Date.now();
      publishStream(roomId, state).catch((err) => console.error("Stream publish failed:", err));
    };

    const since = Date.now() - lastAtRef.current;
    if (since >= PUBLISH_INTERVAL_MS) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
      flush();
    } else if (timerRef.current === undefined) {
      timerRef.current = window.setTimeout(() => {
        timerRef.current = undefined;
        flush();
      }, PUBLISH_INTERVAL_MS - since);
    }
  }, [live, roomId, session, labelScale, gridOpacity, showSpread]);

  // Drop any queued write when the stream ends, so it can't resurrect the room
  // after removeStream().
  useEffect(() => {
    if (live) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = undefined;
    pendingRef.current = null;
  }, [live]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);
}
