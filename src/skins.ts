import type { StageId } from './level/Level';
import type { HeroColors } from './weapons';

/**
 * Hero color schemes: one for each EX rematch won, the secret stage's gold,
 * and more to buy at Rivet's. A scheme replaces the hero's default (Ultra
 * Gun) colors; boss weapons still show their own.
 */
export type SkinId =
  | 'classic' | 'forge' | 'mantis' | 'glacier' | 'skyward' | 'voltage' | 'magma' | 'rust' | 'tide' | 'gold'
  | 'night' | 'sunset' | 'neon' | 'royal' | 'bubblegum' | 'camo' | 'stealth' | 'chrome';

export interface SkinDef {
  id: SkinId;
  name: string;
  /** The EX rematch that unlocks it (none: always yours). */
  stage: StageId | null;
  /** Unlocked by clearing `stage` itself (the secret stage), not an EX rematch. */
  secret?: boolean;
  colors: HeroColors | null;
  /** Visor (main, shade); default keeps the mint visor. */
  visor?: [number, number];
  /** Sold at Rivet's for this many bolts (instead of being earned). */
  price?: number;
}

export const SKINS: SkinDef[] = [
  { id: 'classic', name: 'CLASSIC', stage: null, colors: null },
  { id: 'forge', name: 'FORGE', stage: 'foundry', colors: { light: 0xb8c0d0, main: 0x6a7288, dark: 0x3a4052, suit: 0x241a1a, suitLight: 0x4a3030 }, visor: [0xff7a28, 0xb8401a] },
  { id: 'mantis', name: 'MANTIS', stage: 'canopy', colors: { light: 0x9af0a0, main: 0x34b05a, dark: 0x1a6a34, suit: 0x3a1a3a, suitLight: 0x6a3a6a }, visor: [0xff8ad8, 0xb84a98] },
  { id: 'glacier', name: 'GLACIER', stage: 'glacier', colors: { light: 0xffffff, main: 0xdceaf8, dark: 0x9ab4d8, suit: 0x2a4a7a, suitLight: 0x4a6aa8 }, visor: [0x8ad8ff, 0x3a8ac8] },
  { id: 'skyward', name: 'SKYWARD', stage: 'stratos', colors: { light: 0xb8dcff, main: 0x4a8ae8, dark: 0x2a54a8, suit: 0xd8dcec, suitLight: 0xf8f8ff }, visor: [0xffe14a, 0xb89a10] },
  { id: 'voltage', name: 'VOLTAGE', stage: 'powerplant', colors: { light: 0xfff4a0, main: 0xf8d020, dark: 0xb08a08, suit: 0x18181e, suitLight: 0x34343e }, visor: [0x5ad8ff, 0x2a88c8] },
  { id: 'magma', name: 'MAGMA', stage: 'caldera', colors: { light: 0xff8a7a, main: 0xd8283a, dark: 0x881424, suit: 0x1a1214, suitLight: 0x3a2428 }, visor: [0xffc040, 0xd87a10] },
  { id: 'rust', name: 'RUST', stage: 'scrapyard', colors: { light: 0xe8b07a, main: 0xb8703a, dark: 0x7a4220, suit: 0x2a3a2a, suitLight: 0x4a5a44 }, visor: [0xe8f0a0, 0xa8b060] },
  { id: 'gold', name: 'GOLD', stage: 'vault', secret: true, colors: { light: 0xfff4a0, main: 0xf0c020, dark: 0xa87808, suit: 0x3a2050, suitLight: 0x6a4088, shine: 0xffffff }, visor: [0xff5050, 0xa82030] },
  // Rivet's paint shop.
  { id: 'night', name: 'MIDNIGHT', stage: null, price: 50, colors: { light: 0x8a8ab8, main: 0x3a3a6a, dark: 0x1e1e3a, suit: 0x0e0e18, suitLight: 0x2a2a40 }, visor: [0xb070ff, 0x6a30b8] },
  { id: 'sunset', name: 'SUNSET', stage: null, price: 60, colors: { light: 0xffc08a, main: 0xff7a4a, dark: 0xc8402a, suit: 0x4a1a3a, suitLight: 0x7a2a5a }, visor: [0xffe14a, 0xc8a010] },
  { id: 'neon', name: 'NEON', stage: null, price: 60, colors: { light: 0xd8ff8a, main: 0x8ae02a, dark: 0x4a9a10, suit: 0x141418, suitLight: 0x2a2a34 }, visor: [0xff4ad8, 0xb01a98] },
  { id: 'royal', name: 'ROYAL', stage: null, price: 80, colors: { light: 0xc8a8f8, main: 0x7a4ad8, dark: 0x46249a, suit: 0xb8901a, suitLight: 0xf0c840 }, visor: [0xffffff, 0xb8c0d8] },
  { id: 'bubblegum', name: 'BUBBLEGUM', stage: null, price: 80, colors: { light: 0xffd0e8, main: 0xff8ac8, dark: 0xd04a90, suit: 0x2a7aa8, suitLight: 0x5ab0d8 }, visor: [0xfff4a0, 0xd8c060] },
  { id: 'camo', name: 'CAMO', stage: null, price: 100, colors: { light: 0xb8c88a, main: 0x6a7a3a, dark: 0x3a4a20, suit: 0x2a2418, suitLight: 0x4a4030 }, visor: [0xffa040, 0xc06a10] },
  { id: 'stealth', name: 'STEALTH', stage: null, price: 120, colors: { light: 0x8a8f9a, main: 0x4a4e58, dark: 0x26282e, suit: 0x101014, suitLight: 0x24242a }, visor: [0xff3030, 0xa01818] },
  { id: 'chrome', name: 'CHROME', stage: null, price: 200, colors: { light: 0xffffff, main: 0xc8ccd8, dark: 0x7a8090, suit: 0x2a3040, suitLight: 0x4a5470, shine: 0xffffff }, visor: [0x5ef0c8, 0x2aa088] },
  { id: 'tide', name: 'TIDE', stage: 'reef', colors: { light: 0x9af0e8, main: 0x2ab8b0, dark: 0x16747a, suit: 0x1a2250, suitLight: 0x34408a }, visor: [0xff8aa8, 0xc84a6a] },
];

export const SKIN_IDS = SKINS.map((s) => s.id);

/** Texture key of the hero sheet in a scheme's colors. */
export function skinTexture(id: SkinId): string {
  return id === 'classic' ? 'hero_buster' : `hero_skin_${id}`;
}

/** The schemes a save has (classic, one per EX stage won, the secret one, and any bought). */
export function unlockedSkins(exCleared: StageId[], cleared: StageId[] = [], bought: SkinId[] = []): SkinDef[] {
  return SKINS.filter((s) => (s.price ? bought.includes(s.id) : !s.stage || (s.secret ? cleared.includes(s.stage) : exCleared.includes(s.stage))));
}

/** The schemes Rivet sells. */
export const SHOP_SKINS = SKINS.filter((s) => s.price);

/** The scheme an EX win on this stage unlocks. */
export function skinForStage(stage: StageId): SkinDef | undefined {
  return SKINS.find((s) => s.stage === stage);
}

/** The scheme being worn right now (set from the save; read by heroTexture). */
let current: SkinId = 'classic';

export function setCurrentSkin(id: SkinId): void {
  current = id;
}

export function currentSkin(): SkinId {
  return current;
}
