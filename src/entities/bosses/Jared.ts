import Phaser from 'phaser';
import type { Point } from '../../level/Level';
import { sfx } from '../../sfx';
import type { GameScene } from '../../scenes/GameScene';
import { Boss, Room } from './Boss';

/**
 * BLACK JARED (intro boss). The clerk behind the QUIK MART counter. He never
 * moves; he just throws hot dogs, in a slow, readable rotation:
 *  - lob: one hot dog arcing at you
 *  - spread: three hot dogs in a fan
 *  - fastball: one hot dog thrown flat and fast
 * An easy first boss; no weapon.
 */
export class Jared extends Boss {
  private timer = 40;
  private throwPose = 0;
  private attack = 0;

  constructor(g: GameScene, at: Point, room: Room) {
    // Hitbox runs down to the floor, but the counter covers his lower half:
    // shots below its top bounce off (see coverTop), so you have to jump (or
    // get up on the counter) to hit him, in reach of his hot dogs.
    super(g, 'jared', 30, 66, null, at, room);
    // Already behind the register: no drop-in, straight to the health bar.
    this.y = room.floor - this.h;
    this.grounded = true;
    this.state = 'fill';
    this.facing = -1;
  }

  private hotdog(vx: number, vy: number, gravity: boolean): void {
    this.g.spawnEnemyShot({ x: this.x - 4, y: this.y + 14, w: 14, h: 6, vx, vy, tex: 'hotdog', dmg: 3, gravity, spin: gravity ? 0.2 : 0 });
  }

  protected think(): void {
    this.facing = -1;
    if (this.throwPose > 0) this.throwPose--;
    if (++this.timer < (this.phase2 ? 64 : 84)) return;
    this.timer = 0;
    const p = this.g.player;
    const airtime = 46;
    const aim = Phaser.Math.Clamp((p.cx - (this.x - 4)) / airtime, -4, -0.6);
    switch (this.attack++ % 3) {
      case 0:
        this.hotdog(aim, -4.6, true);
        break;
      case 1:
        for (const k of [0.6, 1, 1.4]) this.hotdog(aim * k, -4.6, true);
        break;
      default:
        this.hotdog(-2.6, 0, false);
    }
    this.throwPose = 16;
    sfx.enemyShot();
  }

  /** The counter is two tiles tall. */
  coverTop(): number {
    return this.room.floor - 32;
  }

  protected introPose(): string {
    return 'throw';
  }

  protected pose(): string {
    return this.throwPose > 0 ? 'throw' : 'idle';
  }

  render(): void {
    super.render();
    // He stands on a step behind the counter, so his torso shows above it.
    this.sprite.y -= 14;
  }
}
