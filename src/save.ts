import { WEAPON_ORDER, WeaponId } from './weapons';

/** Progress saved in localStorage: which weapons have been earned. */
export interface SaveData {
  weapons: WeaponId[];
}

const KEY = 'ultraguy-save-v1';

function fresh(): SaveData {
  return { weapons: ['buster'] };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const data = JSON.parse(raw) as Partial<SaveData>;
    const weapons = (data.weapons ?? []).filter((w): w is WeaponId => WEAPON_ORDER.includes(w as WeaponId));
    if (!weapons.includes('buster')) weapons.unshift('buster');
    return { weapons };
  } catch {
    return fresh(); // corrupt or blocked storage: start fresh
  }
}

function write(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable (private mode etc.): progress just isn't kept.
  }
}

/** Returns true if the weapon was newly unlocked. */
export function unlockWeapon(id: WeaponId): boolean {
  const data = loadSave();
  if (data.weapons.includes(id)) return false;
  data.weapons.push(id);
  write(data);
  return true;
}

export function clearSave(): void {
  write(fresh());
}
