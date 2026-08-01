import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import { hotkeyFor, metaFor } from "../toolMeta";

/** How long the badge stays up after a tool change. */
const SHOW_MS = 1600;

/**
 * Briefly names the target tool after it changes. Rendered only while the
 * sidebar is hidden — that's when the tool picker isn't on screen, so a 1/2/3
 * press would otherwise have no visible effect.
 */
export default function ToolIndicator() {
  const tool = useAppStore((s) => s.targetTool);
  const [visible, setVisible] = useState(false);
  // Seeded with the tool at mount, so hiding the sidebar doesn't itself flash
  // the badge — only an actual change does.
  const shown = useRef(tool);

  useEffect(() => {
    if (shown.current === tool) return;
    shown.current = tool;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), SHOW_MS);
    return () => clearTimeout(timer);
  }, [tool]);

  if (!visible) return null;

  const meta = metaFor(tool);
  return (
    <div className="tool-indicator" role="status" aria-live="polite">
      {meta.icon}
      <span className="tool-indicator__label">{meta.label}</span>
      <span className="tool-indicator__key">{hotkeyFor(tool)}</span>
    </div>
  );
}
