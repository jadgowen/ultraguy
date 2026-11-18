import Phaser from 'phaser';

/**
 * The minigame scenes load on demand, each in its own chunk, so the first
 * load only carries the core game. Fetching starts when an encounter's
 * dialogue begins, so the code is usually in by the time the talking's done.
 */
const LOADERS: Record<string, () => Promise<new () => Phaser.Scene>> = {
  race: () => import('./RaceScene').then((m) => m.RaceScene),
  boxing: () => import('./BoxingScene').then((m) => m.BoxingScene),
  rpg: () => import('./RpgScene').then((m) => m.RpgScene),
  hop: () => import('./HopScene').then((m) => m.HopScene),
  bomb: () => import('./BombScene').then((m) => m.BombScene),
  shooter: () => import('./ShooterScene').then((m) => m.ShooterScene),
  breaker: () => import('./BreakerScene').then((m) => m.BreakerScene),
  hockey: () => import('./HockeyScene').then((m) => m.HockeyScene),
  skies: () => import('./SkiesScene').then((m) => m.SkiesScene),
  pinball: () => import('./PinballScene').then((m) => m.PinballScene),
  dungeon: () => import('./DungeonScene').then((m) => m.DungeonScene),
};

const pending = new Map<string, Promise<void>>();

/** Make sure a scene is registered (loading its code first if it's a lazy one). */
export function ensureScene(game: Phaser.Game, key: string): Promise<void> {
  if (game.scene.keys[key] || !LOADERS[key]) return Promise.resolve();
  let p = pending.get(key);
  if (!p) {
    p = LOADERS[key]().then((Cls) => {
      if (!game.scene.keys[key]) game.scene.add(key, Cls, false);
    });
    pending.set(key, p);
  }
  return p;
}

/** Start a scene, loading it first if need be. */
export function startScene(from: Phaser.Scene, key: string, data?: object): void {
  const game = from.game;
  ensureScene(game, key).then(() => {
    // Same as from.scene.start: the calling scene stops, the new one starts.
    if (from.sys.isActive()) from.scene.start(key, data);
    else game.scene.start(key, data);
  });
}
