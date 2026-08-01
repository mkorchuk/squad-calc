import type { StateStorage } from "zustand/middleware";

/**
 * localStorage for zustand's `persist`, with writes coalesced.
 *
 * `persist` serialises the whole store on every single state change, and the
 * store holds every session's targets and shapes. Dragging the grid-opacity or
 * label-size slider, or typing in a session name, fires a change per frame /
 * per keystroke — each one a full JSON.stringify plus a synchronous, main-
 * thread localStorage write. Coalescing them bounds that to one write per
 * WRITE_INTERVAL_MS while keeping the latest value.
 *
 * Reads still see pending writes, and anything queued is flushed when the page
 * is hidden or unloaded, so nothing is lost on tab close.
 */
const WRITE_INTERVAL_MS = 300;

const pending = new Map<string, string>();
let timer: number | undefined;

function flush(): void {
  if (timer !== undefined) {
    window.clearTimeout(timer);
    timer = undefined;
  }
  if (!pending.size) return;
  for (const [key, value] of pending) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Quota exceeded or storage disabled — dropping the write is the only
      // option left, and it must not take the app down with it.
    }
  }
  pending.clear();
}

// Bounded latency rather than a true debounce: the first change schedules the
// write, later ones within the window just replace the payload.
function schedule(): void {
  if (timer === undefined) {
    timer = window.setTimeout(flush, WRITE_INTERVAL_MS);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

export const throttledLocalStorage: StateStorage = {
  getItem(name) {
    const queued = pending.get(name);
    if (queued !== undefined) return queued;
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem(name, value) {
    pending.set(name, value);
    schedule();
  },
  removeItem(name) {
    pending.delete(name);
    try {
      window.localStorage.removeItem(name);
    } catch {
      // Same as above — nothing useful to do.
    }
  },
};
