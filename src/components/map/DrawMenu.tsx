import { SHAPE_COLORS } from "../../data/shapeColors";
import { useAppStore } from "../../store/useAppStore";
import type { ShapeType } from "../../store/types";

interface Props {
  x: number;
  y: number;
  onPick: (type: ShapeType) => void;
  onClose: () => void;
}

const ICON = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 };

const ITEMS: { type: ShapeType; label: string; icon: JSX.Element }[] = [
  {
    type: "line",
    label: "Line",
    icon: (
      <svg {...ICON} strokeLinecap="round">
        <path d="M5 19L19 5" />
      </svg>
    ),
  },
  {
    type: "circle",
    label: "Circle",
    icon: (
      <svg {...ICON}>
        <circle cx="12" cy="12" r="8" />
      </svg>
    ),
  },
  {
    type: "rect",
    label: "Square",
    icon: (
      <svg {...ICON}>
        <rect x="5" y="5" width="14" height="14" rx="1" />
      </svg>
    ),
  },
];

/** Menu width/height estimates, used only to keep it inside the viewport. */
const W = 142;
const H = 158;

export default function DrawMenu({ x, y, onPick, onClose }: Props) {
  const shapeColor = useAppStore((s) => s.shapeColor);
  const setShapeColor = useAppStore((s) => s.setShapeColor);

  const left = Math.min(x, window.innerWidth - W - 8);
  const top = Math.min(y, window.innerHeight - H - 8);

  return (
    <>
      <div
        className="draw-menu__backdrop"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div className="draw-menu" style={{ left, top }}>
        {/* Colour first: it applies to the shape you're about to pick, and it
            sticks for later shapes too, so the menu doesn't close on a swatch. */}
        <div className="draw-menu__label">Colour</div>
        <div className="draw-menu__colors">
          {SHAPE_COLORS.map((c) => (
            <button
              key={c.value}
              className={`draw-menu__color ${
                c.value === shapeColor ? "draw-menu__color--active" : ""
              }`}
              style={{ background: c.value }}
              onClick={() => setShapeColor(c.value)}
              title={c.name}
              aria-label={c.name}
              aria-pressed={c.value === shapeColor}
            />
          ))}
        </div>

        <div className="draw-menu__label">Draw</div>
        {ITEMS.map((it) => (
          <button key={it.type} className="draw-menu__item" onClick={() => onPick(it.type)}>
            {/* Icon takes the selected colour, so the menu previews what you'll get. */}
            <span className="draw-menu__item-icon" style={{ color: shapeColor }}>
              {it.icon}
            </span>
            {it.label}
          </button>
        ))}
      </div>
    </>
  );
}
