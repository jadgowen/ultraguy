/**
 * Weapons. The arm cannon is always available and never runs out; boss
 * weapons are earned by beating bosses and use ammo (MAX_AMMO units, like HP).
 * Each weapon recolors the hero (`colors`), the classic way to show what's equipped.
 */
export type WeaponId = 'buster' | 'quake';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  colors: { main: number; dark: number };
  /** Ammo units used per shot (0 = unlimited). */
  cost: number;
  /** Max shots of this weapon on screen at once. */
  maxOnScreen: number;
  /** Damage per hit. */
  power: number;
}

export const MAX_AMMO = 28;

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  buster: {
    id: 'buster',
    name: 'ARM CANNON',
    colors: { main: 0xf28c28, dark: 0xb85a1a },
    cost: 0,
    maxOnScreen: 3,
    power: 1,
  },
  // From Anvil: a shockwave that runs along the floor, pierces enemies
  // and ignores shields. Fired in the air, it drops to the ground first.
  quake: {
    id: 'quake',
    name: 'QUAKE WAVE',
    colors: { main: 0xc8ccd8, dark: 0x9c2f3f },
    cost: 2,
    maxOnScreen: 1,
    power: 2,
  },
};

/** Display order in the pause menu. */
export const WEAPON_ORDER: WeaponId[] = ['buster', 'quake'];

/** Texture key prefix for the hero recolored for this weapon. */
export function heroPrefix(id: WeaponId): string {
  return id === 'buster' ? '' : `${id}_`;
}
