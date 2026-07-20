import { useEffect, useState, type ReactNode } from "react";
import { MAX_SPACING, MIN_SPACING, useAppStore } from "../../store/useAppStore";
import type { TargetTool } from "../../store/types";
import { LineIcon, SingleIcon, SpaceIcon } from "../icons";

const TOOLS: { tool: TargetTool; key: string; label: string; icon: ReactNode; hint: string }[] = [
  {
    tool: "single",
    key: "1",
    label: "Single",
    icon: <SingleIcon />,
    hint: "Each click places one target",
  },
  {
    tool: "line",
    key: "2",
    label: "Line",
    icon: <LineIcon />,
    hint: "Click to start, click again to end — targets fill the line",
  },
  {
    tool: "space",
    key: "3",
    label: "Space",
    icon: <SpaceIcon />,
    hint: "Click each corner, click the first one again to close — targets fill the area",
  },
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

export default function ToolPanel() {
  const tool = useAppStore((s) => s.targetTool);
  const setTool = useAppStore((s) => s.setTargetTool);
  const spacing = useAppStore((s) => s.spacing);
  const setSpacing = useAppStore((s) => s.setSpacing);
  const gridOpacity = useAppStore((s) => s.gridOpacity);
  const setGridOpacity = useAppStore((s) => s.setGridOpacity);
  const showSpread = useAppStore((s) => s.showSpread);
  const toggleSpread = useAppStore((s) => s.toggleSpread);

  // The field holds raw text while typing: clamping every keystroke would rewrite
  // the first digit of anything under the minimum ("2" of "20" -> "5").
  const [draftSpacing, setDraftSpacing] = useState(String(spacing));
  useEffect(() => setDraftSpacing(String(spacing)), [spacing]);

  function commitSpacing() {
    const next = Number(draftSpacing);
    if (draftSpacing.trim() && Number.isFinite(next)) setSpacing(next);
    else setDraftSpacing(String(spacing));
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const match = TOOLS.find((t) => t.key === e.key);
      if (match) setTool(match.tool);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setTool]);

  return (
    <>
      <div className="sidebar__section-label">Target tool</div>
      <div className="tool-row">
        {TOOLS.map((t) => (
          <button
            key={t.tool}
            className={`tool-btn ${tool === t.tool ? "tool-btn--active" : ""}`}
            onClick={() => setTool(t.tool)}
            title={`${t.hint} (${t.key})`}
          >
            {t.icon}
            <span className="tool-btn__label">{t.label}</span>
            <span className="tool-btn__key">{t.key}</span>
          </button>
        ))}
      </div>

      <label className="tool-spacing">
        <span className="tool-spacing__label">Spacing</span>
        <input
          className="tool-spacing__input"
          type="number"
          min={MIN_SPACING}
          max={MAX_SPACING}
          step={1}
          value={draftSpacing}
          onChange={(e) => setDraftSpacing(e.target.value)}
          onBlur={commitSpacing}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          disabled={tool === "single" || tool === "space"}
        />
        <span className="tool-spacing__unit">m</span>
      </label>

      <p className="tool-hint">
        {TOOLS.find((t) => t.tool === tool)?.hint}
        {tool === "space" &&
          " Spacing is sized automatically from the mortar's spread radius, so targets tile to cover the area."}
      </p>

      <div className="tool-divider" />

      <button
        className={`tool-toggle ${showSpread ? "tool-toggle--active" : ""}`}
        onClick={toggleSpread}
        title="Draw the mortar spread (dispersion) circle around each target"
        aria-pressed={showSpread}
      >
        <span className="tool-toggle__dot" />
        <span className="tool-toggle__label">Spread radius</span>
        <span className="tool-toggle__state">{showSpread ? "On" : "Off"}</span>
      </button>

      <div className="sidebar__section-label">Map grid</div>
      <label className="tool-slider">
        <span className="tool-slider__label">Opacity</span>
        <input
          className="tool-slider__input"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={gridOpacity}
          onChange={(e) => setGridOpacity(Number(e.target.value))}
        />
        <span className="tool-slider__value">{Math.round(gridOpacity * 100)}%</span>
      </label>
    </>
  );
}
