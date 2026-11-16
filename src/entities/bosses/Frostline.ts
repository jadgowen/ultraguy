import Phaser from 'phaser';
import type { Point } from '../../level/Level';
import { sfx } from '../../sfx';
import type { GameScene } from '../../scenes/GameScene';
import { Boss, Room } from './Boss';

type Mode = 'idle' | 'windup' | 'slide' | 'volley' | 'hail' | 'blizzard';

/**
 * FROSTLINE (Glacier). Weak to Quake Wave.
 *  - slide: flashes, then belly-slides across the ice and rebounds off the wall
 *  - volley: lobs arcs of ice shards at you
 *  - hail: calls ice blocks down from the ceiling where you're standing
 *  - EX blizzard: a row of ice blocks across the whole room, twice; find the gap
 */
export class Frostline extends Boss {
  private mode: Mode = 'idle';
  private wait = 30;
  private bounced = false;
  private last: Mode | null = null;
  private gap = 0;

  constructor(g: GameScene, at: Point, room: Room) {
    super(g, 'frostline', 28, 26, 'quake', at, room);
  }

  private setMode(m: Mode, wait = 0): void {
    this.mode = m;
    this.t = 0;
    this.wait = this.quick(wait);
  }

  protected think(): void {
    const p = this.g.player;
    switch (this.mode) {
      case 'idle':
        this.vx = 0;
        this.facePlayer();
        this.physics();
        if (--this.wait <= 0) this.choose();
        break;

      case 'windup':
        this.physics();
        if (this.t >= (this.phase2 ? 16 : 26)) {
          this.setMode('slide');
          this.bounced = false;
          this.vx = this.facing * (this.phase2 ? 4.2 : 3.4);
        }
        break;

      case 'slide':
        if (this.physics().wall) {
          this.g.shake(4);
          sfx.land();
          if (!this.bounced && this.phase2) {
            // Phase 2: rebounds once and slides back.
            this.bounced = true;
            this.facing = -this.facing as 1 | -1;
            this.vx = this.facing * 4.2;
          } else {
            this.vx = 0;
            this.setMode('idle', 36);
          }
        }
        break;

      case 'volley':
        this.physics();
        if (this.t % 12 === 0 && this.t <= (this.phase2 ? 48 : 36)) {
          const airtime = 40;
          const vx = Phaser.Math.Clamp((p.cx - this.cx) / airtime + (Math.random() - 0.5) * 0.8, -3, 3);
          this.g.spawnEnemyShot({ x: this.cx - 3, y: this.y + 8, w: 6, h: 6, vx, vy: -4.5, tex: 'iceshard', dmg: 3, gravity: true });
          sfx.enemyShot();
        }
        if (this.t >= 56) this.setMode('idle', this.phase2 ? 18 : 32);
        break;

      case 'blizzard': {
        this.physics();
        // Pick a gap away from you, mark it with sparkles, then drop the row.
        for (const at of [10, 80]) {
          if (this.t === at) {
            const cols = Math.floor((this.room.right - this.room.left) / 16);
            const pc = Math.floor((p.cx - this.room.left) / 16);
            do this.gap = Phaser.Math.Between(1, cols - 3);
            while (Math.abs(this.gap - pc) < 3 && cols > 8);
          }
          if (this.t > at && this.t < at + 40 && this.t % 4 === 0) this.g.burst(this.room.left + this.gap * 16 + 16, this.room.floor - 4, 'shard', 1);
          if (this.t === at + 40) {
            for (let x = this.room.left; x < this.room.right - 8; x += 16) {
              const c = Math.floor((x - this.room.left) / 16);
              if (c === this.gap || c === this.gap + 1) continue;
              this.g.spawnEnemyShot({ x, y: this.room.top, w: 14, h: 14, vx: 0, vy: 0, tex: 'iceblock', dmg: 4, gravity: true });
            }
            sfx.deflect();
            this.g.shake(3);
          }
        }
        if (this.t >= 150) this.setMode('idle', 34);
        break;
      }

      case 'hail':
        this.physics();
        if (this.t === 20 || this.t === 40 || (this.phase2 && this.t === 60)) {
          const x = Phaser.Math.Clamp(p.cx, this.room.left + 8, this.room.right - 8);
          this.g.spawnEnemyShot({ x: x - 7, y: this.room.top, w: 14, h: 14, vx: 0, vy: 0, tex: 'iceblock', dmg: 4, gravity: true });
          sfx.deflect();
        }
        if (this.t >= (this.phase2 ? 84 : 64)) this.setMode('idle', 30);
        break;
    }
  }

  private choose(): void {
    const options: Mode[] = ['windup', 'volley', 'hail', 'windup'];
    const pool = this.withEx(options, 'blizzard').filter((m) => m !== this.last);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this.last = pick;
    this.facePlayer();
    this.setMode(pick);
  }

  protected telegraph(): boolean {
    return this.mode === 'windup' && this.t % 6 < 3;
  }

  protected introPose(): string {
    return 'shoot';
  }

  protected pose(): string {
    if (this.mode === 'windup' || this.mode === 'slide') return 'slide';
    if ((this.mode === 'volley' || this.mode === 'hail' || this.mode === 'blizzard') && this.t >= 6) return 'shoot';
    return 'idle';
  }
}
