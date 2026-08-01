import { firebase } from "./firebase";
import type { MortarMark, Shape, TargetMark } from "../store/types";

/** The slice of a session mirrored to spectators. Built explicitly so no field is
 *  ever `undefined` (RTDB rejects the whole write on undefined). */
export interface StreamState {
  mapId: string;
  mortar: MortarMark | null;
  targets: TargetMark[];
  shapes: Shape[];
  /** Active session's name, shown in the viewer banner. "" when unknown. */
  sessionName: string;
}

function roomPath(roomId: string): string {
  return `rooms/${roomId}`;
}

/**
 * Shapes carry an optional `color`, and an explicit `color: undefined` would
 * make RTDB reject the whole write — so the key is only included when set.
 */
function toWireShape(shape: Shape): Record<string, unknown> {
  const { color, ...rest } = shape;
  return color === undefined ? rest : { ...rest, color };
}

/** Host: overwrite the room with the current state. */
export async function publishStream(roomId: string, state: StreamState): Promise<void> {
  const { db, ref, set } = await firebase();
  return set(ref(db, roomPath(roomId)), {
    mapId: state.mapId,
    mortar: state.mortar,
    targets: state.targets,
    shapes: state.shapes.map(toWireShape),
    sessionName: state.sessionName,
    updatedAt: Date.now(),
  });
}

/** Host: have the server auto-delete the room if this client disconnects (tab
 *  close, reload, network loss), so spectators see "stream ended" not stale marks. */
export function removeRoomOnDisconnect(roomId: string): void {
  void firebase()
    .then(({ db, ref, onDisconnect }) => onDisconnect(ref(db, roomPath(roomId))).remove())
    .catch((err) => console.error("Arming room cleanup failed:", err));
}

/** Host: explicitly end the stream now (Stop button). */
export async function removeStream(roomId: string): Promise<void> {
  const { db, ref, remove } = await firebase();
  return remove(ref(db, roomPath(roomId)));
}

/** Viewer: subscribe to a room. Calls back with null if the room is empty/gone.
 *  Returns an unsubscribe function. Empty arrays come back absent from RTDB, so
 *  targets/shapes default to [].
 *
 *  Stays synchronous even though the SDK now loads lazily: callers unsubscribe
 *  in an effect cleanup, which can run before the SDK has finished loading. */
export function subscribeStream(
  roomId: string,
  onState: (state: StreamState | null) => void
): () => void {
  let unsubscribe: (() => void) | null = null;
  let cancelled = false;

  void firebase()
    .then(({ db, ref, onValue }) => {
      if (cancelled) return;
      unsubscribe = onValue(ref(db, roomPath(roomId)), (snap) => {
        const v = snap.val();
        if (!v || typeof v !== "object") {
          onState(null);
          return;
        }
        onState({
          mapId: typeof v.mapId === "string" ? v.mapId : "",
          mortar: v.mortar ?? null,
          targets: Array.isArray(v.targets) ? v.targets : [],
          shapes: Array.isArray(v.shapes) ? v.shapes : [],
          sessionName: typeof v.sessionName === "string" ? v.sessionName : "",
        });
      });
    })
    .catch((err) => {
      console.error("Connecting to the stream failed:", err);
      // Report "no room" rather than leaving the viewer on a silent spinner.
      if (!cancelled) onState(null);
    });

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}
