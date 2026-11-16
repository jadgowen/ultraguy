import Phaser from 'phaser';
import type { Point } from '../../level/Level';
import { sfx } from '../../sfx';
import type { GameScene } from '../../scenes/GameScene';
import { Boss, Room } from './Boss';

type Mode = 'idle' | 'jump' | 'shoot' | 'crouch' | 'dash' | 'hammer';

/**
 * ANVIL (Foundry). Weak to Thorn Rang.
 *  - jump: leaps at the player; landing sends ground waves both ways (jump them)
 *  - shoot: 3-way aimed spread (two volleys in phase 2)
 *  - dash: crouches as a tell, then charges into the wall
 *  - EX hammer: three quick hops at you, a ground wave each way on every landing
 */
export class Anvil extends Boss {
  private mode: Mode = 'idle';
  private wait = 30;
  private last: Mode | null = null;
  private hops = 0;

  constructor(g: GameScene, at: Point, room: Room) {
    super(g, 'anvil', 26, 30, 'thorn', at, room);
  }

  private setMode(m: Mode, wait = 0): void {
    this.mode = m;
    this.t = 0;
    this.wait = this.quick(wait);
  }

  protected think(): void {
    switch (this.mode) {
      case 'idle':
        this.vx = 0;
        this.facePlayer();
        this.physics();
        if (--this.wait <= 0) this.choose();
        break;
      case 'jump': {
        if (this.t === 1) {
          this.facePlayer();
          this.vx = Phaser.Math.Clamp((this.g.player.cx - this.cx) / 50, -2.6, 2.6);
          this.vy = -6.2;
          this.grounded = false;
        }
        const r = this.physics();
        if (r.wall) this.vx = 0;
        if (r.landed && this.t > 2) {
          this.g.shake(5);
          sfx.land();
          this.g.fireGroundWave(this.cx - 10, this.bottom, -1);
          this.g.fireGroundWave(this.cx + 2, this.bottom, 1);
          this.setMode('idle', this.phase2 ? 22 : 40);
        }
        break;
      }
      case 'shoot':
        this.physics();
        if (this.t === 18 || (this.phase2 && this.t === 40)) this.volley();
        if (this.t >= (this.phase2 ? 56 : 40)) this.setMode('idle', this.phase2 ? 20 : 36);
        break;
      case 'crouch':
        this.physics();
        if (this.t >= (this.phase2 ? 18 : 28)) {
          this.setMode('dash');
          this.vx = this.facing * (this.phase2 ? 4 : 3.2);
        }
        break;
      case 'hammer': {
        // A beat crouched (flashing), then hop, hop, hop.
        if (this.t < 20) {
          this.physics();
          break;
        }
        if (this.grounded && this.t > 20 && this.vy === 0 && this.hops < 3 && this.wait <= 0) {
          this.facePlayer();
          this.vx = Phaser.Math.Clamp((this.g.player.cx - this.cx) / 30, -2.4, 2.4);
          this.vy = -4.4;
          this.grounded = false;
          this.hops++;
        }
        if (this.wait > 0) this.wait--;
        const r = this.physics();
        if (r.wall) this.vx = 0;
        if (r.landed) {
          this.vx = 0;
          this.g.shake(4);
          sfx.land();
          this.g.fireGroundWave(this.cx - 10, this.bottom, -1);
          this.g.fireGroundWave(this.cx + 2, this.bottom, 1);
          this.wait = 14;
          if (this.hops >= 3) this.setMode('idle', 46);
        }
        break;
      }
      case 'dash':
        if (this.physics().wall) {
          this.g.shake(4);
          sfx.land();
          this.vx = 0;
          this.setMode('idle', this.phase2 ? 24 : 40);
        }
        break;
    }
  }

  private choose(): void {
    const far = Math.abs(this.g.player.cx - this.cx) > 140;
    const options: Mode[] = far ? ['jump', 'jump', 'shoot', 'crouch'] : ['jump', 'shoot', 'shoot', 'crouch'];
    const pool = this.withEx(options, 'hammer').filter((a) => !((a === 'crouch' || a === 'hammer') && this.last === a));
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this.last = pick;
    this.facePlayer();
    this.setMode(pick);
    this.hops = 0;
  }

  private volley(): void {
    const p = this.g.player;
    const ox = this.cx + this.facing * 16;
    const oy = this.y + 14;
    const base = Math.atan2(p.cy - oy, p.cx - ox);
    for (const spread of [-0.28, 0, 0.28]) {
      const a = base + spread;
      this.g.spawnEnemyShot({ x: ox - 3, y: oy - 3, w: 6, h: 6, vx: Math.cos(a) * 2.2, vy: Math.sin(a) * 2.2, tex: 'bshot', dmg: 3 });
    }
    sfx.enemyShot();
  }

  protected telegraph(): boolean {
    return (this.mode === 'crouch' || (this.mode === 'hammer' && this.t < 20)) && this.t % 6 < 3;
  }

  protected introPose(): string {
    return 'jump';
  }

  protected pose(): string {
    if (this.state === 'drop' || this.mode === 'jump' || this.mode === 'hammer') return this.grounded ? (this.mode === 'hammer' ? 'crouch' : 'idle') : 'jump';
    if (this.mode === 'shoot' && this.t >= 10) return 'shoot';
    if (this.mode === 'crouch' || this.mode === 'dash') return 'crouch';
    return 'idle';
  }
}
