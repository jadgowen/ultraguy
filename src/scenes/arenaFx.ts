import Phaser from 'phaser';
import { TILE } from '../constants';
import type { Boss, Room } from '../entities/bosses/Boss';
import type { Player } from '../entities/Player';
import type { StageId } from '../level/Level';
import { sfx } from '../sfx';
import type { ShotOptions } from './GameScene';

export interface ArenaHost {
  scene: Phaser.Scene;
  stage: StageId;
  player: () => Player;
  /** The stage boss being fought right now (not a miniboss), or null. */
  boss: () => Boss | null;
  room: () => Room | null;
  spawnShot: (o: ShotOptions) => void;
  shake: (px: number) => void;
  burst: (x: number, y: number, tex: string, n: number) => void;
}

/** Caldera's surge: a cycle of calm, warning, rising, high, draining (steps). */
const SURGE = { calm: 420, warn: 100, rise: 24, high: 150, drain: 30 };
/** How far over the floor the surge comes (under the basalt ledges). */
const SURGE_H = 18;

/**
 * Things a stage's boss room does on its own during the fight:
 *  - Caldera: the lava surges up over the floor every so often (rumble and
 *    bubbles first); stand on a ledge until it drains. It burns, it doesn't kill.
 *  - Glacier: when Frostline slams into a wall, icicles shake loose from the
 *    ceiling (they wobble for a moment first, so you can see where).
 */
export class ArenaFx {
  private t = 0;
  private lava: Phaser.GameObjects.TileSprite | null = null;
  private level = 0;
  private icicles: { x: number; y: number; t: number; img: Phaser.GameObjects.Image }[] = [];

  constructor(private h: ArenaHost) {}

  step(): void {
    const boss = this.h.boss();
    const room = this.h.room();
    const fighting = !!boss && !!room && boss.state === 'fight';
    if (this.h.stage === 'caldera') this.stepSurge(fighting, room);
    this.stepIcicles(fighting);
  }

  /** A boss hit a wall hard (Frostline's slide). */
  slam(): void {
    const room = this.h.room();
    if (this.h.stage !== 'glacier' || !room) return;
    const p = this.h.player();
    const xs = [p.cx, room.left + 20 + Math.random() * (room.right - room.left - 40), room.left + 20 + Math.random() * (room.right - room.left - 40)];
    for (const x of xs) {
      const cx = Phaser.Math.Clamp(Math.round(x), room.left + 8, room.right - 8);
      const img = this.h.scene.add.image(cx, room.top, 'icicle').setOrigin(0.5, 0).setDepth(5);
      this.icicles.push({ x: cx, y: room.top, t: 0, img });
    }
  }

  private stepIcicles(fighting: boolean): void {
    for (const ic of this.icicles) {
      ic.t++;
      ic.img.x = ic.x + (ic.t % 4 < 2 ? 1 : -1); // wobbling loose
      if (ic.t >= 30 || !fighting) {
        ic.img.destroy();
        if (fighting) {
          this.h.spawnShot({ x: ic.x - 4, y: ic.y, w: 8, h: 14, vx: 0, vy: 0, tex: 'icicle', dmg: 3, gravity: true });
          sfx.crumble();
        }
      }
    }
    this.icicles = this.icicles.filter((ic) => ic.t < 30 && fighting);
  }

  private stepSurge(fighting: boolean, room: Room | null): void {
    if (!fighting || !room) {
      this.t = 0;
      this.level = 0;
      this.lava?.setVisible(false);
      return;
    }
    if (!this.lava) {
      const tex = this.h.scene.textures.exists('lava_volcano') ? 'lava_volcano' : 'lava_foundry';
      this.lava = this.h.scene.add.tileSprite(room.left - 8, room.floor, room.right - room.left + 16, TILE * 2, tex).setOrigin(0).setDepth(14).setAlpha(0.92);
    }
    const S = SURGE;
    const cycle = S.calm + S.warn + S.rise + S.high + S.drain;
    const u = this.t++ % cycle;
    const p = this.h.player();
    const warnAt = S.calm;
    const riseAt = warnAt + S.warn;
    const highAt = riseAt + S.rise;
    const drainAt = highAt + S.high;
    if (u >= warnAt && u < riseAt) {
      // The warning: rumbling, and the floor bubbling.
      if (u % 8 === 0) this.h.shake(1);
      if (u % 4 === 0) this.h.burst(room.left + Math.random() * (room.right - room.left), room.floor - 2, 'ember', 1);
      if (u === warnAt) sfx.lavaRise();
      this.level = 0;
    } else if (u >= riseAt && u < highAt) this.level = ((u - riseAt) / S.rise) * SURGE_H;
    else if (u >= highAt && u < drainAt) this.level = SURGE_H;
    else if (u >= drainAt) this.level = (1 - (u - drainAt) / S.drain) * SURGE_H;
    else this.level = 0;
    const surface = room.floor - this.level;
    this.lava.setVisible(this.level > 0.5).setY(Math.round(surface));
    this.lava.setSize(this.lava.width, Math.max(1, Math.round(this.level) + 2));
    this.lava.tilePositionX = (this.t * 0.4) % TILE;
    // It burns: a hit (with the usual knockback and invincibility), not a death.
    if (this.level > 4 && p.alive && p.bottom > surface + 2 && p.cx > room.left - 8 && p.cx < room.right + 8) p.hurt(4, p.cx + (p.facing > 0 ? 1 : -1));
  }

  reset(): void {
    this.t = 0;
    this.level = 0;
    this.lava?.setVisible(false);
    for (const ic of this.icicles) ic.img.destroy();
    this.icicles = [];
  }
}
