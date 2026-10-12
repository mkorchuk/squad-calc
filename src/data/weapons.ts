/**
 * Ballistics constants for the selectable weapons, matching the in-game values
 * (taken from sh4rkman/SquadCalc's weapons table).
 *
 * Extensibility: add more Weapon entries to WEAPONS (UB-32, etc.); the selector
 * and the ballistics functions pick them up from there.
 */
export interface Weapon {
  id: string;
  name: string;
  velocity: number; // muzzle velocity (m/s)
  gravity: number; // m/s^2
  minDistance: number; // meters
  heightOffset: number; // meters, muzzle height above ground
  angleOffset: number; // radians, sight/trajectory offset (0 for mortar)
  minElevation: [number, number]; // valid firing-angle range in degrees
  moa: number; // dispersion in minutes of angle (spread cone); see getSpread. moaRad = (moa / 60) * π/180
  unit: "mil" | "deg"; // what the in-game sight reads, and so what the label shows
  elevationPrecision: number; // decimals shown in that unit; see formatElevation
}

/**
 * Gravity is 9.8 here but 9.78 on the Hell Cannon (the upstream value for every
 * weapon). The mortar is left at 9.8 on purpose so its readouts don't shift —
 * moving it to 9.78 changes them by up to ~4 mil at the edge of range.
 */
export const STANDARD_MORTAR: Weapon = {
  id: "mortar",
  name: "Mortar",
  velocity: 110,
  gravity: 9.8,
  minDistance: 51,
  heightOffset: 1,
  angleOffset: 0,
  minElevation: [45, 88.875],
  moa: 50,
  unit: "mil",
  elevationPrecision: 0,
};

/**
 * The barrel goes down to 10°, but only the high-angle solution is computed
 * (see getElevation), so in practice the readout stays above 45°.
 */
export const HELL_CANNON: Weapon = {
  id: "hellcannon",
  name: "Hell Cannon",
  velocity: 95,
  gravity: 9.78,
  minDistance: 0,
  heightOffset: 1.5,
  angleOffset: 0,
  minElevation: [10, 90],
  moa: 100,
  unit: "deg",
  elevationPrecision: 1,
};

export const WEAPONS: Weapon[] = [STANDARD_MORTAR, HELL_CANNON];

export const DEFAULT_WEAPON_ID = STANDARD_MORTAR.id;

/** True for the id of a weapon this build knows. Guards ids arriving from
 *  outside the app: persisted sessions, session files, the stream. */
export function isWeaponId(v: unknown): v is string {
  return typeof v === "string" && WEAPONS.some((w) => w.id === v);
}

/**
 * Looks a weapon up by id, falling back to the mortar. The fallback is what
 * lets `Session.weaponId` stay optional: a session saved before weapons were
 * selectable has none, and it was a mortar session.
 */
export function getWeapon(id?: string | null): Weapon {
  return WEAPONS.find((w) => w.id === id) ?? STANDARD_MORTAR;
}
