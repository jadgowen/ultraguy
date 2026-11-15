/**
 * Weapons. The arm cannon is always available and never runs out; boss
 * weapons are earned by beating bosses and use ammo (MAX_AMMO units, like HP).
 * Each weapon recolors the hero (`colors`), the classic way to show what's equipped.
 */
export type WeaponId = 'buster' | 'quake' | 'thorn' | 'frost' | 'cyclone';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  /** Hero recolor: armor ramp (light/main/dark) and undersuit (suit/suitLight). */
  colors: HeroColors;
  /** Ammo units used per shot (0 = unlimited). */
  cost: number;
  /** Max shots of this weapon on screen at once. */
  maxOnScreen: number;
  /** Damage per hit to regular enemies. */
  power: number;
  /** One-line description for the pause menu. */
  blurb: string;
}

export interface HeroColors {
  light: number;
  main: number;
  dark: number;
  suit: number;
  suitLight: number;
}

/**
 * The colors public/assets/hero.png is drawn in (must match art/hero.mjs).
 * Weapons recolor the sheet by swapping these exact values.
 */
export const HERO_BASE_COLORS: HeroColors = {
  light: 0xffc070,
  main: 0xf28c28,
  dark: 0xb85a1a,
  suit: 0x2b2540,
  suitLight: 0x4a4068,
};

export const MAX_AMMO = 28;

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  buster: {
    id: 'buster',
    name: 'ULTRA GUN',
    colors: HERO_BASE_COLORS,
    cost: 0,
    maxOnScreen: 3,
    power: 1,
    blurb: 'hold fire to charge',
  },
  // From Anvil: a shockwave that runs along the floor, pierces enemies
  // and ignores shields. Fired in the air, it drops to the ground first.
  quake: {
    id: 'quake',
    name: 'QUAKE WAVE',
    colors: { light: 0xf4f6fb, main: 0xc8ccd8, dark: 0x8a8fa8, suit: 0x9c2f3f, suitLight: 0xc8505f },
    cost: 2,
    maxOnScreen: 1,
    power: 2,
    blurb: 'ground wave, ignores shields',
  },
  // From Mantis: a spinning thorn that flies out and returns to you.
  thorn: {
    id: 'thorn',
    name: 'THORN RANG',
    colors: { light: 0xc8f080, main: 0x6cc04a, dark: 0x3a7a2a, suit: 0x3a2a1a, suitLight: 0x6a4a2a },
    cost: 1,
    maxOnScreen: 2,
    power: 1,
    blurb: 'boomerang, pierces',
  },
  // From Frostline: a fast shard that freezes whatever it doesn't destroy.
  frost: {
    id: 'frost',
    name: 'FROST SPIKE',
    colors: { light: 0xe8fbff, main: 0x8ad8f8, dark: 0x3a8ac8, suit: 0x1a2a5a, suitLight: 0x3a4a8a },
    cost: 2,
    maxOnScreen: 2,
    power: 1,
    blurb: 'freezes enemies',
  },
  // From Gale: a slow, wide tornado that plows through everything.
  cyclone: {
    id: 'cyclone',
    name: 'CYCLONE',
    colors: { light: 0xfff8c8, main: 0xf0d860, dark: 0xb89a28, suit: 0x2a6a8a, suitLight: 0x4a9aba },
    cost: 3,
    maxOnScreen: 1,
    power: 3,
    blurb: 'big tornado, pierces',
  },
};

/** Display order in the pause menu. */
export const WEAPON_ORDER: WeaponId[] = ['buster', 'quake', 'thorn', 'frost', 'cyclone'];

/** Texture key of the hero sheet recolored for this weapon. */
export function heroTexture(id: WeaponId): string {
  return `hero_${id}`;
}
