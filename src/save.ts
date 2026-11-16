import { ALL_STAGE_IDS, StageId } from './level/Level';
import { PART_ORDER, PartId } from './parts';
import { SKIN_IDS, SkinId, setCurrentSkin, unlockedSkins } from './skins';
import { SLOT_COUNT, loadSettings } from './settings';
import { WEAPON_ORDER, WeaponId } from './weapons';

/** Progress saved in localStorage: earned weapons and cleared stages. */
export interface SaveData {
  weapons: WeaponId[];
  cleared: StageId[];
  /** Energy tanks carried (0..MAX_TANKS). */
  tanks: number;
  /** Armor parts found. */
  parts: PartId[];
  /** Stages whose boss has been beaten in an EX rematch. */
  exCleared: StageId[];
  /** The hero color scheme worn (EX wins unlock them). */
  skin: SkinId;
}

export const MAX_TANKS = 4;

/**
 * Three save slots. Slot 1 uses the original key, so saves from before
 * slots existed show up there.
 */
export function slotKey(slot: number): string {
  return slot === 1 ? 'ultraguy-save-v1' : `ultraguy-save-v1-slot${slot}`;
}

/** The slot picked on the save select screen. */
export function activeSlot(): number {
  return loadSettings().slot;
}

function fresh(): SaveData {
  return { weapons: ['buster'], cleared: [], tanks: 0, parts: [], exCleared: [], skin: 'classic' };
}

/** Load the active slot (or `slot`). */
export function loadSave(slot = activeSlot()): SaveData {
  try {
    const raw = localStorage.getItem(slotKey(slot));
    if (!raw) return fresh();
    const data = JSON.parse(raw) as Partial<SaveData>;
    const weapons = (data.weapons ?? []).filter((w): w is WeaponId => WEAPON_ORDER.includes(w as WeaponId));
    if (!weapons.includes('buster')) weapons.unshift('buster');
    const cleared = (data.cleared ?? []).filter((s): s is StageId => ALL_STAGE_IDS.includes(s as StageId));
    const tanks = Math.max(0, Math.min(MAX_TANKS, Math.floor(Number(data.tanks) || 0)));
    // Saves from before armor parts existed: anyone who has beaten a boss
    // gets all four, so returning players aren't set back.
    const parts = Array.isArray(data.parts)
      ? PART_ORDER.filter((x) => (data.parts as string[]).includes(x))
      : cleared.some((id) => id !== 'intro') ? [...PART_ORDER] : [];
    const exCleared = (data.exCleared ?? []).filter((s): s is StageId => ALL_STAGE_IDS.includes(s as StageId));
    // A scheme only counts if it's still unlocked.
    const skin = SKIN_IDS.includes(data.skin as SkinId) && unlockedSkins(exCleared).some((s) => s.id === data.skin) ? (data.skin as SkinId) : 'classic';
    return { weapons: WEAPON_ORDER.filter((w) => weapons.includes(w)), cleared, tanks, parts, exCleared, skin };
  } catch {
    return fresh(); // corrupt or blocked storage: start fresh
  }
}

function write(data: SaveData, slot = activeSlot()): void {
  try {
    localStorage.setItem(slotKey(slot), JSON.stringify(data));
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

/** Record an EX rematch won. */
export function recordExClear(stage: StageId): void {
  const data = loadSave();
  if (!data.exCleared.includes(stage)) data.exCleared.push(stage);
  write(data);
}

/** Wear a color scheme (saved), and show it from now on. */
export function setSkin(skin: SkinId): void {
  const data = loadSave();
  data.skin = skin;
  write(data);
  setCurrentSkin(skin);
}

/** Put on the active slot's saved color scheme (when a scene starts). */
export function wearSavedSkin(): void {
  setCurrentSkin(loadSave().skin);
}

/** EX rematches open once the game has been beaten. */
export function exUnlocked(save = loadSave()): boolean {
  return save.cleared.includes('finale');
}

/** Set the number of energy tanks carried. */
export function setTanks(n: number): void {
  const data = loadSave();
  data.tanks = Math.max(0, Math.min(MAX_TANKS, n));
  write(data);
}

/** Record a found armor part. */
export function recordPart(part: PartId): void {
  const data = loadSave();
  if (!data.parts.includes(part)) data.parts.push(part);
  data.parts = PART_ORDER.filter((x) => data.parts.includes(x));
  write(data);
}

/** Erase a slot (default: the active one). */
export function clearSave(slot = activeSlot()): void {
  try {
    localStorage.removeItem(slotKey(slot));
  } catch {
    write(fresh(), slot);
  }
}

/** True if a slot has any progress. */
export function slotUsed(slot: number): boolean {
  try {
    return localStorage.getItem(slotKey(slot)) !== null;
  } catch {
    return false;
  }
}

export const SLOTS = Array.from({ length: SLOT_COUNT }, (_, i) => i + 1);
