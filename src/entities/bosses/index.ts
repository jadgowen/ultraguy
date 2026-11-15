import type { BossKind, Point } from '../../level/Level';
import type { GameScene } from '../../scenes/GameScene';
import { Anvil } from './Anvil';
import { Boss, Room } from './Boss';
import { Frostline } from './Frostline';
import { Gale } from './Gale';
import { Mantis } from './Mantis';

export { BOSS_MAX_HP, Boss } from './Boss';
export type { Room } from './Boss';

const BOSSES: Record<BossKind, new (g: GameScene, at: Point, room: Room) => Boss> = {
  anvil: Anvil,
  mantis: Mantis,
  frostline: Frostline,
  gale: Gale,
};

export function createBoss(kind: BossKind, g: GameScene, at: Point, room: Room): Boss {
  return new BOSSES[kind](g, at, room);
}
