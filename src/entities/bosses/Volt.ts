import Phaser from 'phaser';
import type { Point } from '../../level/Level';
import { sfx } from '../../sfx';
import type { GameScene } from '../../scenes/GameScene';
import { Boss, Room } from './Boss';

type Mode = 'idle' | 'warpOut' | 'warpIn' | 'orbs' | 'strike' | 'grid';

/**
 * VOLT (Power Plant). Weak to Saw Blade.
 *  - warp: fades out (can't be hit) and reappears at another spot
 *  - orbs: a fan of electric orbs aimed at you
 *  - strike: sparks mark the floor where you stand, then lightning falls there
 *  - EX grid: sparks mark every other strip of floor, lightning falls, then the other strips
 */
export class Volt extends Boss {
  private mode: Mode = 'idle';
  private wait = 30;
  private last: Mode | null = null;
  private strikeX: number[] = [];
  /** Floor glow marking where the EX grid's lightning will fall. */
  private mark: Phaser.GameObjects.Graphics | null = null;

  constructor(g: GameScene, at: Point, room: Room) {
    super(g, 'volt', 24, 28, 'saw', at, room);
  }

  protected untouchable(): boolean {
    return this.alpha < 0.5;
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
        this.facePlayer();
        this.physics();
        if (--this.wait <= 0) this.choose();
        break;

      case 'warpOut':
        this.alpha = Math.max(0, 1 - this.t / 16);
        if (this.t >= 24) {
          // Reappear on the far side from the player.
          const left = p.cx > (this.room.left + this.room.right) / 2;
          const x = left ? this.room.left + 24 : this.room.right - 24;
          this.x = x - this.w / 2;
          this.y = this.room.floor - this.h;
          this.grounded = true;
          this.setMode('warpIn');
          sfx.zap();
        }
        break;

      case 'warpIn':
        this.alpha = Math.min(1, this.t / 12);
        this.facePlayer();
        if (this.t >= 14) this.setMode('idle', this.phase2 ? 10 : 22);
        break;

      case 'orbs':
        this.physics();
        if (this.t === 16 || (this.phase2 && this.t === 36)) {
          const ox = this.cx + this.facing * 10;
          const oy = this.y + 8;
          const base = Math.atan2(p.cy - oy, p.cx - ox);
          const spreads = this.phase2 ? [-0.5, -0.25, 0, 0.25, 0.5] : [-0.35, 0, 0.35];
          for (const sp of spreads) {
            const a = base + sp;
            this.g.spawnEnemyShot({ x: ox - 4, y: oy - 4, w: 8, h: 8, vx: Math.cos(a) * 2.4, vy: Math.sin(a) * 2.4, tex: 'vorb', dmg: 3 });
          }
          sfx.zap();
        }
        if (this.t >= 50) this.setMode('idle', this.phase2 ? 16 : 30);
        break;

      case 'grid': {
        this.physics();
        const mark = (this.mark ??= this.g.add.graphics().setDepth(5));
        mark.clear();
        const W = 24;
        const cols = Math.floor((this.room.right - this.room.left) / W);
        const sets = this.phase2 ? [0, 1, 0] : [0, 1];
        sets.forEach((parity, i) => {
          const markT = 10 + i * 56;
          for (let c = parity; c < cols; c += 2) {
            const x = this.room.left + c * W;
            // The warning: each marked stretch of floor glows (and a spark or two).
            if (this.t > markT && this.t < markT + 40) {
              const on = this.t > markT + 28 ? this.t % 4 < 2 : this.t % 8 < 6;
              if (on) mark.fillStyle(0x5ef0c8, 0.55).fillRect(x + 2, this.room.floor - 6, W - 4, 6).fillStyle(0xffffff, 0.8).fillRect(x + 2, this.room.floor - 2, W - 4, 2);
              if (this.t % 8 === c % 8) this.g.burst(x + W / 2, this.room.floor - 2, 'spark', 1);
            }
            if (this.t === markT + 40) {
              for (const ox of [2, 9, 16]) {
                for (let k = 0; k < 4; k++) this.g.spawnEnemyShot({ x: x + ox, y: this.room.top + k * 40, w: 6, h: 12, vx: 0, vy: 7, tex: 'bolt', dmg: 4, life: 40 });
              }
            }
          }
          if (this.t === markT + 40) {
            this.g.shake(3);
            sfx.zap();
          }
        });
        if (this.t >= 10 + sets.length * 56 + 20) {
          mark.clear();
          this.setMode('idle', 30);
        }
        break;
      }

      case 'strike': {
        this.physics();
        const marks = this.phase2 ? 3 : 2;
        // Mark targets one at a time, then strike each after a delay.
        for (let i = 0; i < marks; i++) {
          if (this.t === 8 + i * 24) this.strikeX[i] = Phaser.Math.Clamp(p.cx, this.room.left + 8, this.room.right - 8);
          const markT = 8 + i * 24;
          if (this.t > markT && this.t < markT + 36 && this.t % 4 === 0) this.g.burst(this.strikeX[i], this.room.floor - 2, 'spark', 2);
          if (this.t === markT + 36) {
            for (let k = 0; k < 4; k++) {
              this.g.spawnEnemyShot({ x: this.strikeX[i] - 3, y: this.room.top + k * 40, w: 6, h: 12, vx: 0, vy: 7, tex: 'bolt', dmg: 4, life: 40 });
            }
            this.g.shake(2);
            sfx.zap();
          }
        }
        if (this.t >= 8 + marks * 24 + 50) this.setMode('idle', 26);
        break;
      }
    }
  }

  private choose(): void {
    const options: Mode[] = ['warpOut', 'orbs', 'strike', 'orbs'];
    const pool = this.withEx(options, 'grid').filter((m) => m !== this.last);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this.last = pick;
    this.setMode(pick);
  }

  hit(dmg: number, weak: boolean): void {
    super.hit(dmg, weak);
    if (this.state === 'dying') this.mark?.clear();
  }

  destroy(): void {
    this.mark?.destroy();
    super.destroy();
  }

  protected introPose(): string {
    return 'cast';
  }

  protected pose(): string {
    if (this.mode === 'orbs' || this.mode === 'strike' || this.mode === 'grid') return 'cast';
    return 'idle';
  }
}
