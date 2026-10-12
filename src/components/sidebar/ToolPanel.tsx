import { useEffect, useState } from "react";
import {
  MAX_LABEL_SCALE,
  MAX_SPACING,
  MIN_LABEL_SCALE,
  MIN_SPACING,
  useAppStore,
} from "../../store/useAppStore";
import { TOOL_META, hotkeyFor } from "../toolMeta";

export default function ToolPanel() {
  const tool = useAppStore((s) => s.targetTool);
  const setTool = useAppStore((s) => s.setTargetTool);
  const spacing = useAppStore((s) => s.spacing);
  const setSpacing = useAppStore((s) => s.setSpacing);
  const gridOpacity = useAppStore((s) => s.gridOpacity);
  const setGridOpacity = useAppStore((s) => s.setGridOpacity);
  const labelScale = useAppStore((s) => s.labelScale);
  const setLabelScale = useAppStore((s) => s.setLabelScale);
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

  // The 1/2/3 hotkeys are bound in Layout (useToolHotkeys), not here — this
  // panel unmounts when the sidebar is hidden.

  return (
    <>
      <div className="sidebar__section-label">Target tool</div>
      <div className="tool-row">
        {TOOL_META.map((t) => (
          <button
            key={t.tool}
            className={`tool-btn ${tool === t.tool ? "tool-btn--active" : ""}`}
            onClick={() => setTool(t.tool)}
            title={`${t.hint} (${hotkeyFor(t.tool)})`}
          >
            {t.icon}
            <span className="tool-btn__label">{t.label}</span>
            <span className="tool-btn__key">{hotkeyFor(t.tool)}</span>
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
        {TOOL_META.find((t) => t.tool === tool)?.hint}
        {tool === "space" &&
          " Spacing is sized automatically from the weapon's spread radius, so targets tile to cover the area."}
      </p>

      <div className="tool-divider" />

      <button
        className={`tool-toggle ${showSpread ? "tool-toggle--active" : ""}`}
        onClick={toggleSpread}
        title="Draw the weapon's spread (dispersion) circle around each target"
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

      <div className="sidebar__section-label">Target labels</div>
      <label className="tool-slider">
        <span className="tool-slider__label">Font size</span>
        <input
          className="tool-slider__input"
          type="range"
          min={MIN_LABEL_SCALE}
          max={MAX_LABEL_SCALE}
          step={0.05}
          value={labelScale}
          onChange={(e) => setLabelScale(Number(e.target.value))}
        />
        <span className="tool-slider__value">{Math.round(labelScale * 100)}%</span>
      </label>
    </>
  );
}
