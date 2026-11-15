/**
 * Weapons. The arm cannon is always available and never runs out; boss
 * weapons are earned by beating bosses and use ammo (MAX_AMMO units, like HP).
 * Each weapon recolors the hero (`colors`), the classic way to show what's equipped.
 */
export type WeaponId = 'buster' | 'quake';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  /** Hero recolor: armor ramp (light/main/dark) and undersuit (suit/suitLight). */
  colors: HeroColors;
  /** Ammo units used per shot (0 = unlimited). */
  cost: number;
  /** Max shots of this weapon on screen at once. */
  maxOnScreen: number;
  /** Damage per hit. */
  power: number;
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
    name: 'ARM CANNON',
    colors: HERO_BASE_COLORS,
    cost: 0,
    maxOnScreen: 3,
    power: 1,
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
  },
};

/** Display order in the pause menu. */
export const WEAPON_ORDER: WeaponId[] = ['buster', 'quake'];

/** Texture key of the hero sheet recolored for this weapon. */
export function heroTexture(id: WeaponId): string {
  return `hero_${id}`;
}
