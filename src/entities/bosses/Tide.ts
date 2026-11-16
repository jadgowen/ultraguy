import Phaser from 'phaser';
import type { Point } from '../../level/Level';
import { sfx } from '../../sfx';
import type { GameScene } from '../../scenes/GameScene';
import { Boss, Room } from './Boss';

type Mode = 'rise' | 'cruise' | 'aim' | 'dash' | 'bubbles' | 'dive' | 'geyser' | 'ring';

/**
 * TIDE (Reef). Weak to Spark Ring. Swims after the intro.
 *  - dash: flashes, then charges straight across at your height
 *  - bubbles: releases slow bubbles that drift toward you
 *  - geyser: dives to the floor and sends water spouts up under you
 *  - EX ring: swims to the middle and blows rings of bubbles outward
 */
export class Tide extends Boss {
  private mode: Mode = 'rise';
  private side: 1 | -1 = 1;
  private last: Mode | null = null;
  private geyserX = 0;

  constructor(g: GameScene, at: Point, room: Room) {
    super(g, 'tide', 30, 20, 'spark', at, room);
  }

  private setMode(m: Mode): void {
    this.mode = m;
    this.t = 0;
  }

  private swimTo(x: number, y: number, speed: number): boolean {
    const dx = x - this.cx;
    const dy = y - this.cy;
    const d = Math.hypot(dx, dy);
    if (d <= speed) {
      this.x += dx;
      this.y += dy;
      return true;
    }
    this.x += (dx / d) * speed;
    this.y += (dy / d) * speed;
    return false;
  }

  protected think(): void {
    const p = this.g.player;
    const cruiseY = this.room.floor - 80;
    switch (this.mode) {
      case 'rise':
        if (this.swimTo(this.cx, cruiseY, 1.5)) this.setMode('cruise');
        break;

      case 'cruise': {
        const tx = this.side > 0 ? this.room.right - 40 : this.room.left + 40;
        this.swimTo(tx, cruiseY + Math.sin(this.t * 0.06) * 10, this.phase2 ? 1.8 : 1.3);
        this.facePlayer();
        if (this.t >= this.quick(this.phase2 ? 50 : 70)) this.choose();
        break;
      }

      case 'aim':
        this.facePlayer();
        this.swimTo(this.cx, Phaser.Math.Clamp(p.cy, this.room.top + 20, this.room.floor - 12), 1.5);
        if (this.t >= (this.phase2 ? 20 : 30)) this.setMode('dash');
        break;

      case 'dash':
        this.x += this.facing * (this.phase2 ? 4.2 : 3.4);
        if (this.x <= this.room.left || this.x + this.w >= this.room.right) {
          this.x = Phaser.Math.Clamp(this.x, this.room.left, this.room.right - this.w);
          this.g.shake(3);
          sfx.land();
          this.side = this.facing;
          this.setMode('cruise');
        }
        break;

      case 'bubbles':
        this.facePlayer();
        if (this.t % 18 === 0 && this.t <= (this.phase2 ? 90 : 54)) {
          const vx = Math.sign(p.cx - this.cx) * 0.7;
          this.g.spawnEnemyShot({ x: this.cx - 5, y: this.cy - 5, w: 10, h: 10, vx, vy: -0.4, tex: 'bbubble', dmg: 3, life: 260 });
          sfx.bubble();
        }
        if (this.t >= 100) this.endAttack();
        break;

      case 'ring': {
        const midX = (this.room.left + this.room.right) / 2;
        if (this.t < 40) {
          this.swimTo(midX, this.room.floor - 90, 2.2);
          break;
        }
        const rings = this.phase2 ? 3 : 2;
        for (let i = 0; i < rings; i++) {
          if (this.t === 46 + i * 34) {
            const n = 10;
            for (let k = 0; k < n; k++) {
              const a = ((k + (i % 2) * 0.5) / n) * Math.PI * 2;
              this.g.spawnEnemyShot({ x: this.cx - 5, y: this.cy - 5, w: 10, h: 10, vx: Math.cos(a) * 1.3, vy: Math.sin(a) * 1.3, tex: 'bbubble', dmg: 3, life: 200 });
            }
            sfx.bubble();
          }
        }
        if (this.t >= 46 + rings * 34 + 20) this.endAttack();
        break;
      }

      case 'dive':
        this.facePlayer();
        if (this.swimTo(this.cx, this.room.floor - this.h / 2 - 2, 2.4) || this.t > 80) {
          this.geyserX = p.cx;
          this.setMode('geyser');
        }
        break;

      case 'geyser': {
        const spouts = this.phase2 ? 3 : 2;
        for (let i = 0; i < spouts; i++) {
          if (this.t === 10 + i * 26) this.geyserX = Phaser.Math.Clamp(p.cx, this.room.left + 8, this.room.right - 8);
          if (this.t > 10 + i * 26 && this.t < 26 + i * 26 && this.t % 3 === 0) this.g.burst(this.geyserX, this.room.floor - 2, 'bubble_fx', 2);
          if (this.t === 26 + i * 26) {
            this.g.spawnEnemyShot({ x: this.geyserX - 6, y: this.room.floor - 16, w: 12, h: 30, vx: 0, vy: -4, tex: 'geyser', dmg: 4, life: 45 });
            sfx.bubble();
          }
        }
        if (this.t >= 26 + spouts * 26 + 20) {
          this.mode = 'rise';
          this.t = 0;
        }
        break;
      }
    }
  }

  private endAttack(): void {
    this.side = -this.side as 1 | -1;
    this.setMode('cruise');
  }

  private choose(): void {
    const options: Mode[] = ['aim', 'bubbles', 'dive'];
    const pool = this.withEx(options, 'ring').filter((m) => m !== this.last);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this.last = pick;
    this.setMode(pick);
  }

  protected telegraph(): boolean {
    return ((this.mode === 'aim' && this.t > 10) || (this.mode === 'ring' && this.t >= 30 && this.t < 46)) && this.t % 6 < 3;
  }

  protected introPose(): string {
    return 'open';
  }

  protected pose(): string {
    if (this.mode === 'dash' || this.mode === 'aim') return 'dash';
    if (this.mode === 'bubbles' || this.mode === 'geyser' || this.mode === 'ring') return 'open';
    return 'swim';
  }
}
