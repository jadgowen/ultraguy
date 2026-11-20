import type { BossKind, MiniKind, Point } from '../../level/Level';
import type { GameScene } from '../../scenes/GameScene';
import { Anvil } from './Anvil';
import { Baron } from './Baron';
import { Boss, Room } from './Boss';
import { Frostline } from './Frostline';
import { Gale } from './Gale';
import { Jared } from './Jared';
import { Magma } from './Magma';
import { Mantis } from './Mantis';
import { Abyss } from './Abyss';
import { Gatekeeper } from './Gatekeeper';
import { MINIBOSSES, Miniboss } from './Miniboss';
import { Overlord } from './Overlord';
import { Shade } from './Shade';
import { Scrap } from './Scrap';
import { Tide } from './Tide';
import { Volt } from './Volt';
import { Warden } from './Warden';

export { BOSS_MAX_HP, Boss } from './Boss';
export { MINIBOSSES, Miniboss } from './Miniboss';
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
  baron: Baron,
  gatekeeper: Gatekeeper,
  abyss: Abyss,
  warden: Warden,
};

export function createBoss(kind: BossKind, g: GameScene, at: Point, room: Room): Boss {
  if (kind in MINIBOSSES) return new Miniboss(g, kind as MiniKind, at, room);
  const ctor = BOSSES[kind];
  if (!ctor) throw new Error(`No boss class for "${kind}"`);
  return new ctor(g, at, room);
}
