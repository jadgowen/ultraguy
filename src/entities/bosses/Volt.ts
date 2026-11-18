import Phaser from 'phaser';
import type { Point } from '../../level/Level';
import { sfx } from '../../sfx';
import type { GameScene } from '../../scenes/GameScene';
import { Boss, Room } from './Boss';
import { BossFx } from './bossFx';
import { VOLT_ANCHORS } from './voltAnchors';

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

  private readonly fx: BossFx;

  constructor(g: GameScene, at: Point, room: Room) {
    super(g, 'volt', 24, 28, 'saw', at, room);
    this.fx = new BossFx(g);
  }

  /** Where his front hand is right now (world px): the orbs come out of it. */
  private hand(): { x: number; y: number } {
    const a = VOLT_ANCHORS[`volt_${this.frame()}`] ?? VOLT_ANCHORS.volt_cast2;
    const h = a.hands[1];
    return { x: this.cx + h[0] * this.facing, y: this.bottom + h[1] };
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
          // Out of his raised front hand.
          const { x: ox, y: oy } = this.hand();
          this.g.burst(ox, oy, 'spark', 4);
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
    this.fx.destroy();
    super.destroy();
  }

  protected introPose(): string {
    return 'cast';
  }

  /**
   * The frame for right now: four breaths of idle, arms rising as the battery
   * charges for the orbs (full at the throw), the strike's point, the grid's
   * cast, and the warp coming apart (and back together) in bands with his fade.
   */
  private frame(): string {
    const m = this.mode;
    if (this.state === 'fill') return this.t >= Boss.INTRO_POSE_AT ? 'cast2' : 'idle1';
    if (this.state === 'dying') return 'cast1';
    if (m === 'warpOut' || m === 'warpIn') {
      const a = this.alpha;
      return a > 0.8 ? 'idle1' : a > 0.55 ? 'warp1' : a > 0.3 ? 'warp2' : 'warp3';
    }
    if (m === 'orbs') return this.t < 12 ? 'cast1' : 'cast2';
    if (m === 'strike') return 'point';
    if (m === 'grid') return 'cast2';
    return `idle${1 + (Math.floor(this.t / 10) % 4)}`;
  }

  render(): void {
    super.render();
    const key = `volt_${this.frame()}`;
    this.sprite.setTexture(key);
    const a = VOLT_ANCHORS[key] ?? VOLT_ANCHORS.volt_idle1;
    const warping = this.mode === 'warpOut' || this.mode === 'warpIn';
    // Warping throws sparks off him.
    if (warping && this.state === 'fight' && this.t % 2 === 0) this.g.burst(this.cx + (Math.random() - 0.5) * 20, this.y + Math.random() * this.h, 'spark', 1);
    const [n0, n1] = a.antennae;
    const arcs = [{ a: n0, b: n1, chance: 0.25 + a.charge * 0.6 }];
    if (a.casting) for (const h of a.hands) arcs.push({ a: a.core, b: h, chance: 0.7 });
    this.fx.update({
      x: Math.round(this.cx),
      bottom: Math.round(this.bottom),
      facing: this.facing,
      floor: this.room.floor,
      core: a.core,
      coreColor: 0xffe14a,
      eye: a.eye,
      eyeColor: 0x9ee8ff,
      heat: a.charge * 0.6,
      hot: a.casting ? a.hands : [],
      arcs,
      visible: this.sprite.visible && this.alpha > 0.3 && this.state !== 'dying',
    });
  }

  protected pose(): string {
    if (this.mode === 'orbs' || this.mode === 'strike' || this.mode === 'grid') return 'cast';
    return 'idle';
  }
}
