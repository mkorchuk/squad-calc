/**
 * Ballistics constants for the standard Squad Mortar.
 * Values mirror the original SquadCalc weapon definition.
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
}

export const STANDARD_MORTAR: Weapon = {
  id: "mortar",
  name: "Mortar",
  velocity: 110,
  gravity: 9.8,
  minDistance: 51,
  heightOffset: 1,
  angleOffset: 0,
};
