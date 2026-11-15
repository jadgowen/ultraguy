import { ALL_STAGE_IDS, StageId } from './level/Level';
import { WEAPON_ORDER, WeaponId } from './weapons';

/** Progress saved in localStorage: earned weapons and cleared stages. */
export interface SaveData {
  weapons: WeaponId[];
  cleared: StageId[];
}

const KEY = 'ultraguy-save-v1';

function fresh(): SaveData {
  return { weapons: ['buster'], cleared: [] };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const data = JSON.parse(raw) as Partial<SaveData>;
    const weapons = (data.weapons ?? []).filter((w): w is WeaponId => WEAPON_ORDER.includes(w as WeaponId));
    if (!weapons.includes('buster')) weapons.unshift('buster');
    const cleared = (data.cleared ?? []).filter((s): s is StageId => ALL_STAGE_IDS.includes(s as StageId));
    return { weapons: WEAPON_ORDER.filter((w) => weapons.includes(w)), cleared };
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

/** Record a cleared stage (and the weapon it gave, if any). Returns true if the weapon is new. */
export function recordClear(stage: StageId, weapon?: WeaponId): boolean {
  const data = loadSave();
  const isNew = !!weapon && !data.weapons.includes(weapon);
  if (weapon && isNew) data.weapons.push(weapon);
  if (!data.cleared.includes(stage)) data.cleared.push(stage);
  write(data);
  return isNew;
}

export function clearSave(): void {
  write(fresh());
}
