import type { BossKind, GuardianKind, MiniKind, Point } from '../../level/Level';
import type { GameScene } from '../../scenes/GameScene';
import { Anvil } from './Anvil';
import { Boss, Room } from './Boss';
import { Frostline } from './Frostline';
import { Gale } from './Gale';
import { Jared } from './Jared';
import { Magma } from './Magma';
import { Mantis } from './Mantis';
import { GUARDIANS, MINIBOSSES, Miniboss } from './Miniboss';
import { Overlord } from './Overlord';
import { Shade } from './Shade';
import { Scrap } from './Scrap';
import { Tide } from './Tide';
import { Volt } from './Volt';

export { BOSS_MAX_HP, Boss } from './Boss';
export { GUARDIANS, MINIBOSSES, Miniboss } from './Miniboss';
export type { Room } from './Boss';

const BOSSES: Partial<Record<BossKind, new (g: GameScene, at: Point, room: Room) => Boss>> = {
  anvil: Anvil,
  mantis: Mantis,
  frostline: Frostline,
  gale: Gale,
  volt: Volt,
  magma: Magma,
  scrap: Scrap,
  tide: Tide,
  overlord: Overlord,
  shade: Shade,
  jared: Jared,
};

export function createBoss(kind: BossKind, g: GameScene, at: Point, room: Room): Boss {
  if (kind in MINIBOSSES || kind in GUARDIANS) return new Miniboss(g, kind as MiniKind | GuardianKind, at, room);
  const ctor = BOSSES[kind];
  if (!ctor) throw new Error(`No boss class for "${kind}"`);
  return new ctor(g, at, room);
}
