import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_MAP_ID } from "../data/maps";
import type { ImportedSession } from "../lib/sessionFile";
import type { PlacementMode, Session, ShapeInput, TargetMark, TargetTool } from "./types";

export const DEFAULT_SPACING = 15;
export const MIN_SPACING = 5;
export const MAX_SPACING = 200;

export const DEFAULT_GRID_OPACITY = 1;

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function makeSession(name: string, mapId = DEFAULT_MAP_ID): Session {
  return { id: uid(), name, mapId, mortar: null, targets: [], shapes: [] };
}

interface AppState {
  sessions: Session[];
  activeSessionId: string | null;
  placementMode: PlacementMode;
  /** Placement-time and display settings, not part of a session's saved data. */
  targetTool: TargetTool;
  spacing: number;
  gridOpacity: number;
  sidebarVisible: boolean;

  getActiveSession: () => Session | undefined;

  addSession: () => void;
  importSession: (data: ImportedSession) => void;
  renameSession: (id: string, name: string) => void;
  deleteSession: (id: string) => void;
  selectSession: (id: string) => void;

  setMapId: (mapId: string) => void;
  setPlacementMode: (mode: PlacementMode) => void;
  setTargetTool: (tool: TargetTool) => void;
  setSpacing: (spacing: number) => void;
  setGridOpacity: (opacity: number) => void;
  toggleSidebar: () => void;

  setMortar: (lat: number, lng: number) => void;
  addTarget: (lat: number, lng: number) => void;
  addTargets: (points: { lat: number; lng: number }[]) => void;
  moveTarget: (id: string, lat: number, lng: number) => void;
  moveMortar: (lat: number, lng: number) => void;
  clearMortar: () => void;
  removeTarget: (id: string) => void;
  addShape: (shape: ShapeInput) => void;
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
        targetTool: "single",
        spacing: DEFAULT_SPACING,
        gridOpacity: DEFAULT_GRID_OPACITY,
        sidebarVisible: true,

        getActiveSession: () =>
          get().sessions.find((s) => s.id === get().activeSessionId),

        addSession: () =>
          set((state) => {
            const session = makeSession(`Session ${state.sessions.length + 1}`);
            return { sessions: [...state.sessions, session], activeSessionId: session.id };
          }),

        importSession: (data) =>
          set((state) => {
            const session: Session = {
              id: uid(),
              name: data.name,
              mapId: data.mapId,
              mortar: data.mortar,
              targets: data.targets.map((t) => ({ id: uid(), lat: t.lat, lng: t.lng })),
              shapes: [],
            };
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

        // The tools only shape target placement, so picking one implies target mode.
        setTargetTool: (tool) => set({ targetTool: tool, placementMode: "target" }),

        setSpacing: (spacing) =>
          set({
            spacing: Math.min(MAX_SPACING, Math.max(MIN_SPACING, Math.round(spacing))),
          }),

        setGridOpacity: (opacity) =>
          set({ gridOpacity: Math.min(1, Math.max(0, opacity)) }),

        toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),

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

        addTargets: (points) =>
          set((state) => ({
            sessions: updateActive(state, (s) => ({
              ...s,
              targets: [
                ...s.targets,
                ...points.map((p) => ({ id: uid(), lat: p.lat, lng: p.lng })),
              ],
            })),
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

        addShape: (shape) =>
          set((state) => ({
            sessions: updateActive(state, (s) => ({
              ...s,
              shapes: [...(s.shapes ?? []), { ...shape, id: uid() } as Session["shapes"][number]],
            })),
          })),

        clearMarks: () =>
          set((state) => ({
            sessions: updateActive(state, (s) => ({
              ...s,
              mortar: null,
              targets: [],
              shapes: [],
            })),
          })),
      };
    },
    { name: "squadcalc-lite" }
  )
);
