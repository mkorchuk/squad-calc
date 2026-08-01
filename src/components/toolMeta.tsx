import type { ReactNode } from "react";
import type { TargetTool } from "../store/types";
import { TOOL_KEYS } from "../hooks/useToolHotkeys";
import { LineIcon, SingleIcon, SpaceIcon } from "./icons";

/**
 * How each target tool presents itself. Shared by the sidebar's picker and the
 * hidden-sidebar indicator so the two can't describe the same tool differently.
 * Hotkeys come from TOOL_KEYS, which is what's actually bound.
 */
export interface ToolMeta {
  tool: TargetTool;
  label: string;
  icon: ReactNode;
  hint: string;
}

export const TOOL_META: ToolMeta[] = [
  {
    tool: "single",
    label: "Single",
    icon: <SingleIcon />,
    hint: "Each click places one target",
  },
  {
    tool: "line",
    label: "Line",
    icon: <LineIcon />,
    hint: "Click to start, click again to end — targets fill the line",
  },
  {
    tool: "space",
    label: "Space",
    icon: <SpaceIcon />,
    hint: "Click each corner, click the first one again to close — targets fill the area",
  },
];

export function metaFor(tool: TargetTool): ToolMeta {
  return TOOL_META.find((t) => t.tool === tool) ?? TOOL_META[0];
}

export function hotkeyFor(tool: TargetTool): string {
  return TOOL_KEYS.find((t) => t.tool === tool)?.key ?? "";
}
