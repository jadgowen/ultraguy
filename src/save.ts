import { ALL_STAGE_IDS, StageId } from './level/Level';
import { PART_ORDER, PartId } from './parts';
import { PIP_CATALOG, PIP_MODULES, PIP_PAINTS, PIP_SHELLS, PIP_TRAILS, PipKind, PipModule, PipPaint, PipShell, PipTrail, pipOwns } from './pip';
import { MAX_BOLTS, SHOP_ITEMS, ShopItemId } from './shop';
import { SKINS, SKIN_IDS, SkinId, setCurrentSkin, unlockedSkins } from './skins';
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
  /** Currency, spent at Rivet's shop. */
  bolts: number;
  /** Shop goods: W-tanks, 1-UPs waiting for the next stage, spike guards, and the bolt magnet. */
  wtanks: number;
  spareLives: number;
  guards: number;
  magnet: boolean;
  /** Hidden 1-UPs ever found ("stage:x:y"); finding them all opens the secret stage. */
  oneUpsFound: string[];
  /** Color schemes bought at Rivet's. */
  boughtSkins: SkinId[];
  /** Rivet's jukebox, and every music track heard so far (what it can play). */
  jukebox: boolean;
  heard: string[];
  /** Pip: upgrades and looks bought ("kind:id"), upgrades switched off, what it's wearing, and whether you've met. */
  pipOwned: string[];
  pipOff: PipModule[];
  pipShell: PipShell;
  pipPaint: PipPaint;
  pipTrail: PipTrail;
  pipMet: boolean;
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
  return { weapons: ['buster'], cleared: [], tanks: 0, parts: [], exCleared: [], skin: 'classic', bolts: 0, wtanks: 0, spareLives: 0, guards: 0, magnet: false, oneUpsFound: [], boughtSkins: [], jukebox: false, heard: [], pipOwned: [], pipOff: [], pipShell: 'round', pipPaint: 'teal', pipTrail: 'none', pipMet: false };
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
    const boughtSkins = (data.boughtSkins ?? []).filter((s): s is SkinId => SKIN_IDS.includes(s as SkinId));
    // A scheme only counts if it's still unlocked.
    const skin = SKIN_IDS.includes(data.skin as SkinId) && unlockedSkins(exCleared, cleared, boughtSkins).some((s) => s.id === data.skin) ? (data.skin as SkinId) : 'classic';
    const count = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
    const cap = (id: ShopItemId) => SHOP_ITEMS.find((i) => i.id === id)!.max;
    return {
      weapons: WEAPON_ORDER.filter((w) => weapons.includes(w)),
      cleared,
      tanks,
      parts,
      exCleared,
      skin,
      bolts: count(data.bolts, MAX_BOLTS),
      wtanks: count(data.wtanks, cap('wtank')),
      spareLives: count(data.spareLives, cap('oneup')),
      guards: count(data.guards, cap('guard')),
      magnet: data.magnet === true,
      oneUpsFound: Array.isArray(data.oneUpsFound) ? data.oneUpsFound.filter((k): k is string => typeof k === 'string') : [],
      boughtSkins,
      jukebox: data.jukebox === true,
      heard: Array.isArray(data.heard) ? data.heard.filter((k): k is string => typeof k === 'string') : [],
      pipOwned: Array.isArray(data.pipOwned) ? data.pipOwned.filter((k): k is string => typeof k === 'string') : [],
      pipOff: Array.isArray(data.pipOff) ? data.pipOff.filter((k): k is PipModule => PIP_MODULES.some((m) => m.id === k)) : [],
      pipShell: PIP_SHELLS.some((k) => k.id === data.pipShell) ? (data.pipShell as PipShell) : 'round',
      pipPaint: PIP_PAINTS.some((k) => k.id === data.pipPaint) ? (data.pipPaint as PipPaint) : 'teal',
      pipTrail: PIP_TRAILS.some((k) => k.id === data.pipTrail) ? (data.pipTrail as PipTrail) : 'none',
      pipMet: data.pipMet === true,
    };
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

/** Change the save in place (for bolts and shop goods). */
export function updateSave(fn: (data: SaveData) => void): SaveData {
  const data = loadSave();
  fn(data);
  write(data);
  return data;
}

/** Bolts picked up. */
export function addBolts(n: number): number {
  return updateSave((d) => {
    d.bolts = Math.min(MAX_BOLTS, d.bolts + n);
  }).bolts;
}

/** How many of a shop item you hold now. */
export function owned(data: SaveData, id: ShopItemId): number {
  switch (id) {
    case 'etank':
      return data.tanks;
    case 'wtank':
      return data.wtanks;
    case 'oneup':
      return data.spareLives;
    case 'guard':
      return data.guards;
    case 'magnet':
      return data.magnet ? 1 : 0;
  }
}

/** Buy one: 'ok', 'broke' (not enough bolts) or 'full' (holding the most you can). */
export function buy(id: ShopItemId): 'ok' | 'broke' | 'full' {
  const item = SHOP_ITEMS.find((i) => i.id === id)!;
  const data = loadSave();
  if (owned(data, id) >= item.max) return 'full';
  if (data.bolts < item.price) return 'broke';
  data.bolts -= item.price;
  if (id === 'etank') data.tanks++;
  else if (id === 'wtank') data.wtanks++;
  else if (id === 'oneup') data.spareLives++;
  else if (id === 'guard') data.guards++;
  else data.magnet = true;
  write(data);
  return 'ok';
}

/** Buy a color scheme at Rivet's: 'ok', 'broke', or 'owned' (already yours). */
export function buySkin(id: SkinId): 'ok' | 'broke' | 'owned' {
  const def = SKINS.find((k) => k.id === id);
  const data = loadSave();
  if (!def?.price || data.boughtSkins.includes(id)) return 'owned';
  if (data.bolts < def.price) return 'broke';
  data.bolts -= def.price;
  data.boughtSkins.push(id);
  write(data);
  return 'ok';
}

/** Buy something for Pip: 'ok', 'broke', 'owned', or 'earned' (can't be bought). */
export function buyPip(kind: PipKind, id: string): 'ok' | 'broke' | 'owned' | 'earned' {
  const data = loadSave();
  const t = PIP_CATALOG[kind].find((k) => k.id === id);
  if (!t) return 'owned';
  if (pipOwns(data, kind, id)) return 'owned';
  if (t.price === undefined) return 'earned';
  if (data.bolts < t.price) return 'broke';
  data.bolts -= t.price;
  data.pipOwned.push(`${kind}:${id}`);
  write(data);
  return 'ok';
}

/** Put a shell, paint or trail on Pip (one it owns), or switch an upgrade on or off. */
export function setPip(kind: PipKind, id: string): void {
  const data = loadSave();
  if (!pipOwns(data, kind, id)) return;
  if (kind === 'module') {
    const m = id as PipModule;
    data.pipOff = data.pipOff.includes(m) ? data.pipOff.filter((k) => k !== m) : [...data.pipOff, m];
  } else if (kind === 'shell') data.pipShell = id as PipShell;
  else if (kind === 'paint') data.pipPaint = id as PipPaint;
  else data.pipTrail = id as PipTrail;
  write(data);
}

/** Pip has said hello (the first time it shows up). */
export function meetPip(): void {
  updateSave((d) => {
    d.pipMet = true;
  });
}

/** The price of Rivet's jukebox. */
export const JUKEBOX_PRICE = 100;

/** Buy the jukebox: 'ok', 'broke', or 'owned'. */
export function buyJukebox(): 'ok' | 'broke' | 'owned' {
  const data = loadSave();
  if (data.jukebox) return 'owned';
  if (data.bolts < JUKEBOX_PRICE) return 'broke';
  data.bolts -= JUKEBOX_PRICE;
  data.jukebox = true;
  write(data);
  return 'ok';
}

/** A music track played for the first time on this save: the jukebox can play it now. */
export function recordHeard(key: string): void {
  const data = loadSave();
  if (data.heard.includes(key)) return;
  data.heard.push(key);
  write(data);
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
