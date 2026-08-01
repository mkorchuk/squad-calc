import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import type { TargetTool } from "../store/types";

/** Number keys 1/2/3 select a target tool. */
export const TOOL_KEYS: { tool: TargetTool; key: string }[] = [
  { tool: "single", key: "1" },
  { tool: "line", key: "2" },
  { tool: "space", key: "3" },
];

/** True while the user is typing, so tool hotkeys don't hijack the keystroke. */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  );
}

/**
 * Binds the 1/2/3 tool hotkeys. Lives in `Layout` rather than `ToolPanel`
 * because the panel unmounts with a hidden sidebar, which used to take the
 * hotkeys with it.
 */
export function useToolHotkeys(): void {
  const setTool = useAppStore((s) => s.setTargetTool);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const match = TOOL_KEYS.find((t) => t.key === e.key);
      if (match) setTool(match.tool);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setTool]);
}
