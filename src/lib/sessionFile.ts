/**
 * Save/load a session as a standalone JSON file.
 *
 * JSON is used because a session is just structured data (map id, weapon id,
 * mortar, targets, shapes) with no binary content — it round-trips losslessly, stays
 * human-readable/diffable, and needs no extra parsing library in the browser.
 *
 * Shapes are written without their ids: the store mints fresh ones on import,
 * the same way it does for targets.
 */
import { MAPS, DEFAULT_MAP_ID } from "../data/maps";
import { isHexColor } from "../data/shapeColors";
import { DEFAULT_WEAPON_ID, getWeapon, isWeaponId } from "../data/weapons";
import type { Session, ShapeInput } from "../store/types";

const FILE_FORMAT = "squadcalc-session";
const FILE_VERSION = 1;

interface SessionFileV1 {
  format: typeof FILE_FORMAT;
  version: typeof FILE_VERSION;
  name: string;
  mapId: string;
  weaponId: string;
  mortar: { lat: number; lng: number } | null;
  targets: { lat: number; lng: number }[];
  shapes: ShapeInput[];
}

export interface ImportedSession {
  name: string;
  mapId: string;
  weaponId: string;
  mortar: { lat: number; lng: number } | null;
  targets: { lat: number; lng: number }[];
  shapes: ShapeInput[];
}

function sanitizeFileName(name: string): string {
  const trimmed = name.trim() || "session";
  return trimmed.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 60);
}

function isFinitePoint(v: unknown): v is { lat: number; lng: number } {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return typeof p.lat === "number" && typeof p.lng === "number" && Number.isFinite(p.lat) && Number.isFinite(p.lng);
}

/**
 * Drops anything that isn't a well-formed shape, mirroring the target handling.
 * A missing or non-hex `color` is dropped rather than rejecting the shape —
 * files written before colours existed have none, and the renderer defaults it.
 */
function toShapeInput(v: unknown): ShapeInput | null {
  if (!v || typeof v !== "object") return null;
  const s = v as Record<string, unknown>;
  const color = isHexColor(s.color) ? { color: s.color } : {};
  if (s.type === "circle") {
    if (!isFinitePoint(s.center) || typeof s.radius !== "number" || !Number.isFinite(s.radius)) return null;
    return { type: "circle", center: { lat: s.center.lat, lng: s.center.lng }, radius: s.radius, ...color };
  }
  if (s.type === "line" || s.type === "rect") {
    if (!isFinitePoint(s.a) || !isFinitePoint(s.b)) return null;
    return { type: s.type, a: { lat: s.a.lat, lng: s.a.lng }, b: { lat: s.b.lat, lng: s.b.lng }, ...color };
  }
  return null;
}

/** Triggers a browser download of the session as a `.json` file. */
export function downloadSession(session: Session): void {
  const file: SessionFileV1 = {
    format: FILE_FORMAT,
    version: FILE_VERSION,
    name: session.name,
    mapId: session.mapId,
    weaponId: getWeapon(session.weaponId).id,
    mortar: session.mortar ? { lat: session.mortar.lat, lng: session.mortar.lng } : null,
    targets: session.targets.map((t) => ({ lat: t.lat, lng: t.lng })),
    shapes: session.shapes.map(({ id: _id, ...rest }) => rest),
  };

  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFileName(session.name)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Parses and validates a session file's text content. Throws on invalid input. */
export function parseSessionFile(text: string): ImportedSession {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Not a valid JSON file.");
  }

  if (!data || typeof data !== "object" || (data as Record<string, unknown>).format !== FILE_FORMAT) {
    throw new Error("Not a SquadCalc session file.");
  }

  const d = data as Record<string, unknown>;
  const name = typeof d.name === "string" && d.name.trim() ? d.name.trim() : "Imported session";
  const mapId = typeof d.mapId === "string" && MAPS.some((m) => m.id === d.mapId) ? d.mapId : DEFAULT_MAP_ID;
  // Absent in files written before weapons were selectable (those were mortar
  // sessions); an id this build doesn't know falls back the same way.
  const weaponId = isWeaponId(d.weaponId) ? d.weaponId : DEFAULT_WEAPON_ID;
  const mortar = isFinitePoint(d.mortar) ? { lat: d.mortar.lat, lng: d.mortar.lng } : null;
  const targets = Array.isArray(d.targets) ? d.targets.filter(isFinitePoint).map((t) => ({ lat: t.lat, lng: t.lng })) : [];
  // Absent in files written before shapes were saved — treat as none, not an error.
  const shapes = Array.isArray(d.shapes)
    ? d.shapes.map(toShapeInput).filter((s): s is ShapeInput => s !== null)
    : [];

  return { name, mapId, weaponId, mortar, targets, shapes };
}

/** Reads a File (e.g. from a file input) and parses it as a session. */
export async function readSessionFile(file: File): Promise<ImportedSession> {
  const text = await file.text();
  return parseSessionFile(text);
}
