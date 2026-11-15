import Phaser from 'phaser';
import type { Point } from '../../level/Level';
import { sfx } from '../../sfx';
import type { GameScene } from '../../scenes/GameScene';
import { Boss, Room } from './Boss';

/**
 * OVERLORD (final boss, phase 1). A huge machine parked on the right side of
 * the arena. It never moves; it just cycles slow, readable attacks:
 *  - volley: three orbs from the cannon, aimed at you
 *  - bombs: two lobbed bombs that burst on the floor
 *  - wave: a ground wave to jump over
 * When it's destroyed, the second phase (Shade) takes over.
 */
export class Overlord extends Boss {
  private timer = 0;
  private attack = 0;

  constructor(g: GameScene, at: Point, room: Room) {
    super(g, 'overlord', 60, 80, null, at, room);
    // Parked against the right edge of the arena.
    this.x = room.right - this.w - 4;
    this.facing = -1;
  }

  protected think(): void {
    this.facing = -1;
    this.physics();
    this.vx = 0;
    this.timer++;
    const pace = this.phase2 ? 70 : 95;
    if (this.timer < pace) return;
    const p = this.g.player;
    const cannonX = this.x + 4;
    const cannonY = this.y + 40;
    switch (this.attack % 3) {
      case 0: {
        const base = Math.atan2(p.cy - cannonY, p.cx - cannonX);
        for (const sp of [-0.2, 0, 0.2]) {
          this.g.spawnEnemyShot({ x: cannonX - 3, y: cannonY - 3, w: 6, h: 6, vx: Math.cos(base + sp) * 2, vy: Math.sin(base + sp) * 2, tex: 'bshot', dmg: 3 });
        }
        sfx.enemyShot();
        break;
      }
      case 1:
        for (const k of [0.8, 1.15]) {
          const airtime = 50;
          const vx = Phaser.Math.Clamp(((p.cx - this.cx) / airtime) * k, -4, -0.5);
          this.g.spawnEnemyShot({ x: this.x + 20, y: this.y + 6, w: 8, h: 8, vx, vy: -5.5, tex: 'fireball', dmg: 3, gravity: true });
        }
        sfx.enemyShot();
        break;
      default:
        this.g.fireGroundWave(this.x - 8, this.room.floor, -1);
        sfx.land();
    }
    this.attack++;
    this.timer = 0;
  }

  protected introPose(): string {
    return 'fire';
  }

  protected pose(): string {
    return this.timer > (this.phase2 ? 50 : 70) ? 'fire' : 'idle';
  }
}
