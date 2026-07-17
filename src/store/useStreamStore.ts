import { create } from "zustand";

/** Streaming state, deliberately NOT persisted — a reload ends the stream rather
 *  than resurrecting a dead room id. */
interface StreamStore {
  roomId: string | null;
  start: () => void;
  stop: () => void;
}

function makeRoomId(): string {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
}

export const useStreamStore = create<StreamStore>((set) => ({
  roomId: null,
  start: () => set({ roomId: makeRoomId() }),
  stop: () => set({ roomId: null }),
}));
