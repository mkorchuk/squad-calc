import { create } from "zustand";
import { removeStream } from "../lib/stream";
import { claimStreamCode, releaseCodeOnDisconnect, releaseStreamCode } from "../lib/streamCode";

/**
 * Host-side streaming state. Deliberately NOT persisted — a reload ends the
 * stream rather than resurrecting a dead room.
 *
 * Starting a stream mints a 6-digit code for the room; you read it off this
 * screen and type it into `/live` on the other machine. There's no discovery and
 * no approval step: possession of the code is the whole handshake.
 */
export type StreamPhase = "off" | "starting" | "live" | "error";

function makeRoomId(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("");
}

interface StreamStore {
  phase: StreamPhase;
  roomId: string | null;
  /** The code viewers type into /live. Null until the claim lands. */
  code: string | null;
  error: string | null;

  start: () => Promise<void>;
  stop: () => Promise<void>;
}

const IDLE = {
  phase: "off" as StreamPhase,
  roomId: null,
  code: null,
  error: null,
};

export const useStreamStore = create<StreamStore>((set, get) => ({
  ...IDLE,

  start: async () => {
    const roomId = makeRoomId();
    set({ ...IDLE, phase: "starting", roomId });

    try {
      const code = await claimStreamCode(roomId);
      // A second click (or a Stop) while the claim was in flight wins; drop this one.
      if (get().roomId !== roomId) {
        void releaseStreamCode(code);
        return;
      }
      releaseCodeOnDisconnect(code);
      set({ phase: "live", code });
    } catch (err) {
      console.error("Starting the stream failed:", err);
      if (get().roomId === roomId) {
        set({ phase: "error", error: "Couldn't reach the streaming server." });
      }
    }
  },

  stop: async () => {
    const { roomId, code } = get();
    set({ ...IDLE });
    await Promise.allSettled([
      roomId ? removeStream(roomId) : Promise.resolve(),
      code ? releaseStreamCode(code) : Promise.resolve(),
    ]);
  },
}));
