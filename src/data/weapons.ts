/**
 * Ballistics constants for the standard Squad Mortar, matching the in-game values.
 *
 * Extensibility: add more Weapon entries here (UB-32, Hell Cannon, etc.) and a
 * selector in the UI; the ballistics functions already take a Weapon argument.
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
}

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
};
