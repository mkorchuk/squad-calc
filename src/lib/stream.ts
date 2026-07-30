import { onDisconnect, onValue, ref, remove, set } from "firebase/database";
import { db } from "./firebase";
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

export function roomPath(roomId: string): string {
  return `rooms/${roomId}`;
}

/** Host: overwrite the room with the current state. */
export function publishStream(roomId: string, state: StreamState): Promise<void> {
  return set(ref(db, roomPath(roomId)), {
    mapId: state.mapId,
    mortar: state.mortar,
    targets: state.targets,
    shapes: state.shapes,
    sessionName: state.sessionName,
    updatedAt: Date.now(),
  });
}

/** Host: have the server auto-delete the room if this client disconnects (tab
 *  close, reload, network loss), so spectators see "stream ended" not stale marks. */
export function removeRoomOnDisconnect(roomId: string): void {
  onDisconnect(ref(db, roomPath(roomId))).remove();
}

/** Host: explicitly end the stream now (Stop button). */
export function removeStream(roomId: string): Promise<void> {
  return remove(ref(db, roomPath(roomId)));
}

/** Viewer: subscribe to a room. Calls back with null if the room is empty/gone.
 *  Returns an unsubscribe function. Empty arrays come back absent from RTDB, so
 *  targets/shapes default to []. */
export function subscribeStream(
  roomId: string,
  onState: (state: StreamState | null) => void
): () => void {
  const r = ref(db, roomPath(roomId));
  return onValue(r, (snap) => {
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
}
