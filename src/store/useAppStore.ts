import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { throttledLocalStorage } from "./persistStorage";
import { DEFAULT_MAP_ID } from "../data/maps";
import { DEFAULT_SHAPE_COLOR, isHexColor } from "../data/shapeColors";
import { DEFAULT_WEAPON_ID, isWeaponId } from "../data/weapons";
import type { ImportedSession } from "../lib/sessionFile";
import type { PlacementMode, Session, ShapeInput, TargetMark, TargetTool } from "./types";

export const DEFAULT_SPACING = 15;
export const MIN_SPACING = 5;
export const MAX_SPACING = 200;

export const DEFAULT_GRID_OPACITY = 1;

/**
 * Multiplier on the target label's font size; 1 = the base sizes in theme.css,
 * which is both the default and the largest the labels go.
 */
export const DEFAULT_LABEL_SCALE = 1;
export const MIN_LABEL_SCALE = 0.5;
export const MAX_LABEL_SCALE = 1;

function clampLabelScale(scale: number): number {
  if (!Number.isFinite(scale)) return DEFAULT_LABEL_SCALE;
  return Math.min(MAX_LABEL_SCALE, Math.max(MIN_LABEL_SCALE, scale));
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function makeSession(name: string, mapId = DEFAULT_MAP_ID): Session {
  return {
    id: uid(),
    name,
    mapId,
    weaponId: DEFAULT_WEAPON_ID,
    mortar: null,
    targets: [],
    shapes: [],
  };
}

interface AppState {
  sessions: Session[];
  activeSessionId: string | null;
  placementMode: PlacementMode;
  /** Placement-time and display settings, not part of a session's saved data. */
  targetTool: TargetTool;
  spacing: number;
  gridOpacity: number;
  labelScale: number;
  /** Whether to draw the mortar spread (dispersion) circle around each target. */
  showSpread: boolean;
  sidebarVisible: boolean;
  /** Colour the next drawn shape gets, picked in the draw menu's palette. */
  shapeColor: string;

  getActiveSession: () => Session | undefined;

  addSession: () => void;
  importSession: (data: ImportedSession) => void;
  renameSession: (id: string, name: string) => void;
  deleteSession: (id: string) => void;
  selectSession: (id: string) => void;

  setMapId: (mapId: string) => void;
  setWeaponId: (weaponId: string) => void;
  setPlacementMode: (mode: PlacementMode) => void;
  setTargetTool: (tool: TargetTool) => void;
  setSpacing: (spacing: number) => void;
  setGridOpacity: (opacity: number) => void;
  setLabelScale: (scale: number) => void;
  setShapeColor: (color: string) => void;
  toggleSpread: () => void;
  toggleSidebar: () => void;

  setMortar: (lat: number, lng: number) => void;
  addTarget: (lat: number, lng: number) => void;
  addTargets: (points: { lat: number; lng: number }[]) => void;
  moveTarget: (id: string, lat: number, lng: number) => void;
  moveMortar: (lat: number, lng: number) => void;
  clearMortar: () => void;
  removeTarget: (id: string) => void;
  addShape: (shape: ShapeInput) => void;
  removeShape: (id: string) => void;
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
        labelScale: DEFAULT_LABEL_SCALE,
        showSpread: false,
        sidebarVisible: true,
        shapeColor: DEFAULT_SHAPE_COLOR,

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
              weaponId: data.weaponId,
              mortar: data.mortar,
              targets: data.targets.map((t) => ({ id: uid(), lat: t.lat, lng: t.lng })),
              shapes: data.shapes.map((s) => ({ ...s, id: uid() })),
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
              // Shapes are map-relative too, so they'd land somewhere meaningless
              // on the new map — clear them with everything else.
              shapes: [],
            })),
          })),

        // Unlike the map, the weapon isn't something marks are relative to:
        // the same positions just get a different firing solution, so nothing
        // is cleared.
        setWeaponId: (weaponId) =>
          set((state) =>
            isWeaponId(weaponId)
              ? { sessions: updateActive(state, (s) => ({ ...s, weaponId })) }
              : state
          ),

        setPlacementMode: (mode) => set({ placementMode: mode }),

        // The tools only shape target placement, so picking one implies target mode.
        setTargetTool: (tool) => set({ targetTool: tool, placementMode: "target" }),

        setSpacing: (spacing) =>
          set({
            spacing: Math.min(MAX_SPACING, Math.max(MIN_SPACING, Math.round(spacing))),
          }),

        setGridOpacity: (opacity) =>
          set({ gridOpacity: Math.min(1, Math.max(0, opacity)) }),

        setLabelScale: (scale) => set({ labelScale: clampLabelScale(scale) }),

        // Guarded rather than trusted: this value is written straight into an
        // SVG stroke/fill attribute.
        setShapeColor: (color) =>
          set({ shapeColor: isHexColor(color) ? color : DEFAULT_SHAPE_COLOR }),

        toggleSpread: () => set((state) => ({ showSpread: !state.showSpread })),

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

        removeShape: (id) =>
          set((state) => ({
            sessions: updateActive(state, (s) => ({
              ...s,
              shapes: (s.shapes ?? []).filter((shape) => shape.id !== id),
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
    {
      name: "squadcalc-lite",
      // Writes are coalesced: persist re-serialises every session on every
      // change, including each frame of a slider drag.
      storage: createJSONStorage(() => throttledLocalStorage),
      // A build before the 100% cap could have persisted a larger scale, and a
      // build before colours existed persisted no shapeColor at all.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.labelScale = clampLabelScale(state.labelScale);
        if (!isHexColor(state.shapeColor)) state.shapeColor = DEFAULT_SHAPE_COLOR;
      },
    }
  )
);
