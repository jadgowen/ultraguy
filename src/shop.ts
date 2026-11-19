/**
 * RIVET'S PARTS & PROVISIONS: what bolts buy. Enemies drop bolts, and caches
 * of them hide in secret spots. The shop is opened from the stage select.
 */
export type ShopItemId = 'etank' | 'wtank' | 'oneup' | 'guard' | 'magnet';

export interface ShopItem {
  id: ShopItemId;
  name: string;
  price: number;
  /** Most you can hold (1 for a one-time upgrade). */
  max: number;
  blurb: string;
  /** Bosses you need to have beaten before Rivet stocks it. */
  unlock: number;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'oneup', name: '1-UP', price: 30, max: 3, blurb: 'an extra life, added when you enter a stage', unlock: 0 },
  { id: 'etank', name: 'E-TANK', price: 40, max: 4, blurb: 'refills your life from the pause menu', unlock: 0 },
  { id: 'wtank', name: 'W-TANK', price: 50, max: 2, blurb: 'refills every weapon from the pause menu', unlock: 2 },
  { id: 'guard', name: 'SPIKE GUARD', price: 60, max: 3, blurb: 'survive one spike or lava fall (used up)', unlock: 3 },
  { id: 'magnet', name: 'BOLT MAGNET', price: 120, max: 1, blurb: 'pickups fly to you (yours to keep)', unlock: 4 },
];

export const MAX_BOLTS = 999;
/** Bolts per small / big drop, and in a hidden cache. */
export const BOLT_SMALL = 2;
export const BOLT_BIG = 8;
export const BOLT_CACHE = 25;
