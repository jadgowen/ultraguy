import Phaser from 'phaser';
import type { Point } from '../../level/Level';
import { sfx } from '../../sfx';
import type { GameScene } from '../../scenes/GameScene';
import { Boss, Room } from './Boss';

type Mode = 'idle' | 'leap' | 'lob' | 'windup' | 'charge' | 'erupt';

/**
 * MAGMA (Caldera). Weak to Bubble Bomb.
 *  - leap: jumps at you; flame pillars burst up on both sides where it lands
 *  - lob: arcs of fireballs
 *  - charge: flashes, then rushes across the room trailing fire
 *  - EX erupt: flame pillars ripple out from it both ways (jump each as it reaches you)
 */
export class Magma extends Boss {
  private mode: Mode = 'idle';
  private wait = 30;
  private last: Mode | null = null;

  constructor(g: GameScene, at: Point, room: Room) {
    super(g, 'magma', 26, 28, 'bubble', at, room);
  }

  private setMode(m: Mode, wait = 0): void {
    this.mode = m;
    this.t = 0;
    this.wait = this.quick(wait);
  }

  private pillar(x: number, life = 28): void {
    this.g.spawnEnemyShot({ x: x - 6, y: this.room.floor - 30, w: 12, h: 30, vx: 0, vy: 0, tex: 'pillar', dmg: 4, life });
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

      case 'leap': {
        if (this.t === 1) {
          this.facePlayer();
          this.vx = Phaser.Math.Clamp((p.cx - this.cx) / 48, -2.8, 2.8);
          this.vy = -6;
          this.grounded = false;
        }
        const r = this.physics();
        if (r.wall) this.vx = 0;
        if (r.landed && this.t > 2) {
          this.g.shake(5);
          sfx.flame();
          this.pillar(this.cx - 30);
          this.pillar(this.cx + 30);
          if (this.phase2) {
            this.pillar(this.cx - 60);
            this.pillar(this.cx + 60);
          }
          this.setMode('idle', this.phase2 ? 20 : 36);
        }
        break;
      }

      case 'lob':
        this.physics();
        if (this.t % 14 === 0 && this.t <= (this.phase2 ? 56 : 42)) {
          const airtime = 44;
          const vx = Phaser.Math.Clamp((p.cx - this.cx) / airtime + (Math.random() - 0.5), -3, 3);
          this.g.spawnEnemyShot({ x: this.cx - 4, y: this.y + 4, w: 8, h: 8, vx, vy: -5, tex: 'fireball', dmg: 3, gravity: true });
          sfx.enemyShot();
        }
        if (this.t >= 64) this.setMode('idle', 28);
        break;

      case 'erupt': {
        this.physics();
        // Rings of pillars, 24px apart, every 9 frames; a second wave in phase 2.
        const waves = this.phase2 ? [24, 70] : [24];
        for (const w0 of waves) {
          const k = (this.t - w0) / 9;
          if (k >= 1 && Number.isInteger(k)) {
            for (const dir of [-1, 1]) {
              const x = this.cx + dir * k * 24;
              // Short-lived, so the ripple is a narrow band you can jump through.
              if (x > this.room.left + 4 && x < this.room.right - 4) this.pillar(x, 14);
            }
            if (k === 1) sfx.flame();
          }
        }
        if (this.t >= (this.phase2 ? 150 : 110)) this.setMode('idle', 30);
        break;
      }

      case 'windup':
        this.physics();
        if (this.t >= (this.phase2 ? 18 : 28)) {
          this.setMode('charge');
          this.vx = this.facing * (this.phase2 ? 4 : 3.2);
        }
        break;

      case 'charge':
        // A short trail: it burns out about a body-length behind, so jumping
        // over the charge lands you on clear floor.
        if (this.t % 6 === 0) {
          this.g.spawnEnemyShot({ x: this.cx - 4, y: this.room.floor - 10, w: 8, h: 10, vx: 0, vy: 0, tex: 'flamelick', dmg: 3, life: 16 });
        }
        if (this.physics().wall) {
          this.g.shake(4);
          sfx.land();
          this.vx = 0;
          this.setMode('idle', 34);
        }
        break;
    }
  }

  private choose(): void {
    const options: Mode[] = ['leap', 'lob', 'windup', 'leap'];
    const pool = this.withEx(options, 'erupt').filter((m) => m !== this.last);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this.last = pick;
    this.facePlayer();
    this.setMode(pick);
  }

  protected telegraph(): boolean {
    return (this.mode === 'windup' || (this.mode === 'erupt' && this.t < 24)) && this.t % 6 < 3;
  }

  protected introPose(): string {
    return 'throw';
  }

  protected pose(): string {
    if (!this.grounded) return 'jump';
    if (this.mode === 'lob' || this.mode === 'windup' || this.mode === 'charge' || this.mode === 'erupt') return 'throw';
    return 'idle';
  }
}
