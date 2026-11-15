/**
 * Armor parts: permanent upgrades hidden in boss stages (in upgrade capsules,
 * behind fake walls, frozen blocks and high ledges).
 */
export type PartId = 'blaster' | 'boots' | 'armor' | 'helmet';

export const PART_ORDER: PartId[] = ['blaster', 'boots', 'armor', 'helmet'];

export interface PartDef {
  id: PartId;
  name: string;
  /** Shown on the pickup screen and the pause menu. */
  blurb: string;
}

export const PARTS: Record<PartId, PartDef> = {
  blaster: { id: 'blaster', name: 'ULTRABLASTER', blurb: 'charge shots reach full power' },
  boots: { id: 'boots', name: 'JUMP BOOTS', blurb: 'press JUMP in the air to jump again' },
  armor: { id: 'armor', name: 'ARMOR', blurb: 'take a quarter less damage' },
  helmet: { id: 'helmet', name: 'HELMET', blurb: 'more life and weapon energy' },
};

/** Life and weapon energy, without and with the helmet. */
export const BASE_MAX = 28;
export const HELMET_MAX = 36;

/** Damage after armor: a quarter less, at least 1. */
export function armoredDamage(dmg: number): number {
  return Math.max(1, Math.round(dmg * 0.75));
}
