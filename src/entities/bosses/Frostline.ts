import Phaser from 'phaser';
import type { Point } from '../../level/Level';
import { sfx } from '../../sfx';
import type { GameScene } from '../../scenes/GameScene';
import { Boss, Room } from './Boss';

type Mode = 'idle' | 'windup' | 'slide' | 'volley' | 'hail';

/**
 * FROSTLINE (Glacier). Weak to Quake Wave.
 *  - slide: flashes, then belly-slides across the ice and rebounds off the wall
 *  - volley: lobs arcs of ice shards at you
 *  - hail: calls ice blocks down from the ceiling where you're standing
 */
export class Frostline extends Boss {
  private mode: Mode = 'idle';
  private wait = 30;
  private bounced = false;
  private last: Mode | null = null;

  constructor(g: GameScene, at: Point, room: Room) {
    super(g, 'frostline', 28, 26, 'quake', at, room);
  }

  private setMode(m: Mode, wait = 0): void {
    this.mode = m;
    this.t = 0;
    this.wait = wait;
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
    const pool = options.filter((m) => m !== this.last);
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
    if ((this.mode === 'volley' || this.mode === 'hail') && this.t >= 6) return 'shoot';
    return 'idle';
  }
}
