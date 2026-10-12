import { describe, expect, it } from "vitest";
import { parseSessionFile } from "./sessionFile";
import { DEFAULT_MAP_ID } from "../data/maps";
import { DEFAULT_WEAPON_ID, HELL_CANNON } from "../data/weapons";

/** A minimal valid session file, with `extra` merged over it. */
function fileWith(extra: Record<string, unknown>): string {
  return JSON.stringify({
    format: "squadcalc-session",
    version: 1,
    name: "Test",
    mapId: DEFAULT_MAP_ID,
    mortar: { lat: -100, lng: 200 },
    targets: [{ lat: -300, lng: 400 }],
    shapes: [],
    ...extra,
  });
}

describe("parseSessionFile weaponId", () => {
  it("keeps a weapon this build knows", () => {
    expect(parseSessionFile(fileWith({ weaponId: HELL_CANNON.id })).weaponId).toBe(HELL_CANNON.id);
  });

  // Files written before weapons were selectable have no weaponId at all, and
  // they were mortar sessions — that must import cleanly, not fail.
  it("treats a file with no weapon as a mortar session", () => {
    const parsed = parseSessionFile(fileWith({}));
    expect(parsed.weaponId).toBe(DEFAULT_WEAPON_ID);
    expect(parsed.mortar).toEqual({ lat: -100, lng: 200 });
    expect(parsed.targets).toHaveLength(1);
  });

  it("falls back to the mortar for an unknown or malformed weapon", () => {
    for (const weaponId of ["railgun", "", 42, null, { id: "hellcannon" }]) {
      expect(parseSessionFile(fileWith({ weaponId })).weaponId).toBe(DEFAULT_WEAPON_ID);
    }
  });
});
