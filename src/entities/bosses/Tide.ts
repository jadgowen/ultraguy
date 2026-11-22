import Phaser from 'phaser';
import type { Point } from '../../level/Level';
import { sfx } from '../../sfx';
import type { GameScene } from '../../scenes/GameScene';
import { BOSS_ANCHORS } from './bossAnchors';
import { Boss, Room } from './Boss';
import { BossFx } from './bossFx';

type Mode = 'rise' | 'cruise' | 'aim' | 'dash' | 'bubbles' | 'dive' | 'geyser' | 'ring';

/** Tide is drawn at twice his sprite's size: a leviathan, as big as he is in his own game. */
const SCALE = 2;

/**
 * TIDE (Reef). Weak to Spark Ring. Swims after the intro.
 *  - dash: flashes, then charges straight across at your height, shedding
 *    bubbles behind him that drift up
 *  - bubbles: volleys of three bubbles fired at you (four volleys when he's hurt)
 *  - geyser: dives to the floor and sends water spouts up under you
 *  - cruising, once he's hurt: now and then a bubble at you
 *  - EX ring: swims to the middle and blows rings of bubbles outward
 */
export class Tide extends Boss {
  private mode: Mode = 'rise';
  private side: 1 | -1 = 1;
  private last: Mode | null = null;
  private geyserX = 0;

  private readonly fx: BossFx;
  /** Steps airborne, and left in the landing squash. */
  private airT = 0;
  private landT = 0;
  private wasGrounded = true;

  constructor(g: GameScene, at: Point, room: Room) {
    super(g, 'tide', 30 * SCALE, 20 * SCALE, 'spark', at, room);
    this.sprite.setScale(SCALE);
    this.fx = new BossFx(g);
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

  /** A bubble from his mouth, aimed at the player (angle offset `spread`). */
  private spit(speed: number, spread = 0): void {
    const p = this.g.player;
    const mx = this.cx + this.facing * this.w * 0.45;
    const my = this.cy - 4;
    const a = Math.atan2(p.cy - my, p.cx - mx) + spread;
    this.g.spawnEnemyShot({ x: mx - 5, y: my - 5, w: 10, h: 10, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, tex: 'bbubble', dmg: 3, life: 220 });
  }

  protected think(): void {
    const p = this.g.player;
    const cruiseY = this.room.floor - 84;
    const minY = this.room.top + this.h / 2 + 6;
    const maxY = this.room.floor - this.h / 2 - 2;
    switch (this.mode) {
      case 'rise':
        if (this.swimTo(this.cx, cruiseY, 1.5)) this.setMode('cruise');
        break;

      case 'cruise': {
        const tx = this.side > 0 ? this.room.right - 40 : this.room.left + 40;
        this.swimTo(tx, cruiseY + Math.sin(this.t * 0.06) * 10, this.phase2 ? 1.8 : 1.3);
        this.facePlayer();
        // Hurt, he doesn't let you rest: a bubble at you while he circles.
        if (this.phase2 && this.t === 30) {
          this.spit(1.8);
          sfx.bubble();
        }
        if (this.t >= this.quick(this.phase2 ? 50 : 70)) this.choose();
        break;
      }

      case 'aim':
        this.facePlayer();
        this.swimTo(this.cx, Phaser.Math.Clamp(p.cy, minY, maxY), 1.8);
        if (this.t >= (this.phase2 ? 20 : 30)) this.setMode('dash');
        break;

      case 'dash':
        this.x += this.facing * (this.phase2 ? 4.2 : 3.4);
        // Bubbles shed in his wake drift up behind him: the water he's crossed stays dangerous.
        if (this.t % (this.phase2 ? 8 : 11) === 0) {
          this.g.spawnEnemyShot({ x: this.cx - this.facing * this.w * 0.4 - 5, y: this.cy - 5, w: 10, h: 10, vx: -this.facing * 0.2, vy: -0.45, tex: 'bbubble', dmg: 3, life: 150 });
        }
        if (this.x <= this.room.left || this.x + this.w >= this.room.right) {
          this.x = Phaser.Math.Clamp(this.x, this.room.left, this.room.right - this.w);
          this.g.shake(3);
          sfx.land();
          this.side = this.facing;
          this.setMode('cruise');
        }
        break;

      case 'bubbles': {
        // Volleys of three, fired straight at you (a fan you have to slip through).
        this.facePlayer();
        const volleys = this.phase2 ? 4 : 3;
        const gap = this.phase2 ? 22 : 28;
        if (this.t >= 16 && (this.t - 16) % gap === 0 && (this.t - 16) / gap < volleys) {
          const speed = this.phase2 ? 2.1 : 1.7;
          for (const sp of [-0.28, 0, 0.28]) this.spit(speed, sp);
          sfx.bubble();
        }
        if (this.t >= 16 + volleys * gap + 20) this.endAttack();
        break;
      }

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
        if (this.swimTo(this.cx, maxY, 2.4) || this.t > 80) {
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

  step(): void {
    super.step();
    if (this.grounded && !this.wasGrounded) this.landT = 8;
    this.wasGrounded = this.grounded;
    if (this.landT > 0) this.landT--;
    this.airT = this.grounded ? 0 : this.airT + 1;
  }

  /** The frame for right now (see art/tideArt.mjs for what each looks like). */
  private frame(): string {
    const m = this.mode;
    if (m === 'dash') return this.t % 8 < 4 ? 'dash1' : 'dash2';
    if (m === 'aim') return 'open1';
    if (m === 'bubbles' || m === 'geyser' || m === 'ring') return this.t % 16 < 8 ? 'open1' : 'open2';
    // Swimming: the wave runs down his body.
    return `swim${1 + (Math.floor(this.t / 7) % 4)}`;
  }

  render(): void {
    super.render();
    const key = `tide_${this.frame()}`;
    this.sprite.setTexture(key);
    const raw = BOSS_ANCHORS[key] ?? BOSS_ANCHORS.tide_idle;
    const sc = (pt: [number, number]): [number, number] => [pt[0] * SCALE, pt[1] * SCALE];
    const a = { eye: raw.eye && sc(raw.eye), lights: raw.lights?.map(sc) };
    this.fx.update({
      x: Math.round(this.cx),
      bottom: Math.round(this.bottom),
      facing: this.facing,
      floor: this.room.floor,
      eye: a.eye,
      eyeColor: 0xffe14a,
      // The glowing lights down his back.
      hot: a.lights ?? [],
      hotColor: 0x5ef0c8,
      heat: 0.7,
      visible: this.sprite.visible && this.state !== 'dying',
    });
  }

  destroy(): void {
    this.fx.destroy();
    super.destroy();
  }

  protected pose(): string {
    if (this.mode === 'dash' || this.mode === 'aim') return 'dash';
    if (this.mode === 'bubbles' || this.mode === 'geyser' || this.mode === 'ring') return 'open';
    return 'swim';
  }
}
