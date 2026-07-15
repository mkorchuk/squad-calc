import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_MAP_ID } from "../data/maps";
import type { PlacementMode, Session, TargetMark } from "./types";

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function makeSession(name: string, mapId = DEFAULT_MAP_ID): Session {
  return { id: uid(), name, mapId, mortar: null, targets: [] };
}

interface AppState {
  sessions: Session[];
  activeSessionId: string | null;
  placementMode: PlacementMode;

  getActiveSession: () => Session | undefined;

  addSession: () => void;
  renameSession: (id: string, name: string) => void;
  deleteSession: (id: string) => void;
  selectSession: (id: string) => void;

  setMapId: (mapId: string) => void;
  setPlacementMode: (mode: PlacementMode) => void;

  setMortar: (lat: number, lng: number) => void;
  addTarget: (lat: number, lng: number) => void;
  moveTarget: (id: string, lat: number, lng: number) => void;
  moveMortar: (lat: number, lng: number) => void;
  clearMortar: () => void;
  removeTarget: (id: string) => void;
  clearMarks: () => void;
}

/** Mutate the active session immutably and return the new sessions array. */
function updateActive(state: AppState, fn: (s: Session) => Session): Session[] {
  return state.sessions.map((s) => (s.id === state.activeSessionId ? fn(s) : s));
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
      const first = makeSession("Session 1");
      return {
        sessions: [first],
        activeSessionId: first.id,
        placementMode: "target",

        getActiveSession: () =>
          get().sessions.find((s) => s.id === get().activeSessionId),

        addSession: () =>
          set((state) => {
            const session = makeSession(`Session ${state.sessions.length + 1}`);
            return { sessions: [...state.sessions, session], activeSessionId: session.id };
          }),

        renameSession: (id, name) =>
          set((state) => ({
            sessions: state.sessions.map((s) => (s.id === id ? { ...s, name } : s)),
          })),

        deleteSession: (id) =>
          set((state) => {
            const sessions = state.sessions.filter((s) => s.id !== id);
            const ensured = sessions.length ? sessions : [makeSession("Session 1")];
            const activeSessionId =
              state.activeSessionId === id
                ? ensured[0].id
                : state.activeSessionId;
            return { sessions: ensured, activeSessionId };
          }),

        selectSession: (id) => set({ activeSessionId: id }),

        setMapId: (mapId) =>
          set((state) => ({
            sessions: updateActive(state, (s) => ({
              ...s,
              mapId,
              mortar: null,
              targets: [],
            })),
          })),

        setPlacementMode: (mode) => set({ placementMode: mode }),

        setMortar: (lat, lng) =>
          set((state) => ({
            sessions: updateActive(state, (s) => ({ ...s, mortar: { lat, lng } })),
          })),

        moveMortar: (lat, lng) =>
          set((state) => ({
            sessions: updateActive(state, (s) => ({ ...s, mortar: { lat, lng } })),
          })),

        clearMortar: () =>
          set((state) => ({
            sessions: updateActive(state, (s) => ({ ...s, mortar: null })),
          })),

        addTarget: (lat, lng) =>
          set((state) => ({
            sessions: updateActive(state, (s) => {
              const target: TargetMark = { id: uid(), lat, lng };
              return { ...s, targets: [...s.targets, target] };
            }),
          })),

        moveTarget: (id, lat, lng) =>
          set((state) => ({
            sessions: updateActive(state, (s) => ({
              ...s,
              targets: s.targets.map((t) => (t.id === id ? { ...t, lat, lng } : t)),
            })),
          })),

        removeTarget: (id) =>
          set((state) => ({
            sessions: updateActive(state, (s) => ({
              ...s,
              targets: s.targets.filter((t) => t.id !== id),
            })),
          })),

        clearMarks: () =>
          set((state) => ({
            sessions: updateActive(state, (s) => ({ ...s, mortar: null, targets: [] })),
          })),
      };
    },
    { name: "squadcalc-lite" }
  )
);
