import { WEAPONS, getWeapon } from "../data/weapons";
import { useAppStore } from "../store/useAppStore";

/**
 * The weapon `<select>`, rendered next to the map one in MapSelector's topbar.
 * No confirmation, unlike the map: switching weapon keeps every mark and only
 * changes the firing solutions computed for them.
 */
export default function WeaponSelector() {
  const weaponId = useAppStore((s) => getWeapon(s.getActiveSession()?.weaponId).id);
  const setWeaponId = useAppStore((s) => s.setWeaponId);

  return (
    <select
      className="map-select map-select--weapon"
      value={weaponId}
      onChange={(e) => setWeaponId(e.target.value)}
      aria-label="Select weapon"
    >
      {WEAPONS.map((w) => (
        <option key={w.id} value={w.id}>
          {w.name}
        </option>
      ))}
    </select>
  );
}
