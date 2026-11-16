/**
 * Armor parts: permanent upgrades hidden in boss stages (in upgrade capsules,
 * behind fake walls, frozen blocks and high ledges).
 */
export type PartId = 'blaster' | 'boots' | 'armor' | 'helmet';

export const PART_ORDER: PartId[] = ['blaster', 'boots', 'armor', 'helmet'];

export interface PartDef {
  id: PartId;
  name: string;
  /** The name in a sentence ("THE JUMP BOOTS"). */
  title: string;
  /** Shown on the pickup screen. */
  blurb: string;
}

export const PARTS: Record<PartId, PartDef> = {
  blaster: { id: 'blaster', name: 'ULTRABLASTER', title: 'THE ULTRABLASTER', blurb: 'Your charge shots now reach full power.' },
  boots: { id: 'boots', name: 'JUMP BOOTS', title: 'THE JUMP BOOTS', blurb: 'Press JUMP in the air to jump again.' },
  armor: { id: 'armor', name: 'ARMOR', title: 'THE ARMOR', blurb: 'You take a quarter less damage.' },
  helmet: { id: 'helmet', name: 'HELMET', title: 'THE HELMET', blurb: 'You have more life and weapon energy.' },
};

/** Life and weapon energy, without and with the helmet. */
export const BASE_MAX = 28;
export const HELMET_MAX = 36;

/** Damage after armor: a quarter less, at least 1. */
export function armoredDamage(dmg: number): number {
  return Math.max(1, Math.round(dmg * 0.75));
}
