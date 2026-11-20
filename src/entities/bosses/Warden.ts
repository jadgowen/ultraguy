import Phaser from 'phaser';
import { PHYS } from '../../constants';
import type { Point } from '../../level/Level';
import { sfx } from '../../sfx';
import type { GameScene } from '../../scenes/GameScene';
import { BOSS_ANCHORS } from './bossAnchors';
import { Boss, Room } from './Boss';
import { BossFx } from './bossFx';

type Mode = 'perch' | 'crouch' | 'leap' | 'slash' | 'lob' | 'rise' | 'dive' | 'land';

/** A spot he can stand on: its x, the surface under it, and which tier (0 = the floor). */
interface Perch {
  x: number;
  y: number;
  tier: number;
}

/** The ledges' heights above the floor (the arena in fortress.ts must match). */
export const WARDEN_TIERS = [0, 32, 80, 128];

/**
 * SPIRE WARDEN (Fortress 3 guardian). Weak to Cyclone.
 *
 * A winged knight in a tower of ledges, three tiers above the floor. He leaps
 * from ledge to ledge (preferring yours, or the one above it) and attacks from
 * wherever he lands. Climb after him, or stay low and keep moving:
 *  - slash: a sword wave along his tier (jump it)
 *  - lob: three fireballs arcing down at you
 *  - dive: from up high, he rises and plunges straight down at you; the
 *    landing sends shockwaves along the floor
 *  - at half health he leaps twice before he attacks, and his waves come in pairs
 */
export class Warden extends Boss {
  private mode: Mode = 'perch';
  private at: Perch = { x: 0, y: 0, tier: 0 };
  private from: Perch = { x: 0, y: 0, tier: 0 };
  private to: Perch = { x: 0, y: 0, tier: 0 };
  private hops = 0;
  private last: Mode | null = null;
  private wait = 30;
  private diveX = 0;
  private readonly fx: BossFx;
  private anim = 0;

  constructor(g: GameScene, at: Point, room: Room) {
    super(g, 'warden', 24, 44, 'cyclone', at, room);
    this.fx = new BossFx(g);
    if (!g.textures.exists('swordwave')) {
      const t = g.textures.createCanvas('swordwave', 10, 16)!;
      const c = t.getContext();
      c.fillStyle = '#1a1428';
      c.fillRect(2, 0, 6, 16);
      c.fillRect(0, 3, 10, 10);
      c.fillStyle = '#4ac8f0';
      c.fillRect(3, 1, 4, 14);
      c.fillRect(1, 4, 8, 8);
      c.fillStyle = '#e6fbff';
      c.fillRect(6, 2, 2, 12);
      t.refresh();
    }
  }

  /** Every spot in the tower: two on the floor, two on each lower tier, one at the top. */
  private perches(): Perch[] {
    const { left, floor } = this.room;
    const p = (col: number, tier: number): Perch => ({ x: left + col * 16 + 8, y: floor - WARDEN_TIERS[tier], tier });
    return [p(6, 0), p(25, 0), p(4, 1), p(26, 1), p(11, 2), p(20, 2), p(15, 3)];
  }

  protected begin(): void {
    this.at = { x: this.cx, y: this.bottom, tier: 0 };
    this.setMode('perch', 30);
  }

  private setMode(m: Mode, wait = 0): void {
    this.mode = m;
    this.t = 0;
    this.wait = this.quick(wait);
  }

  /** Stand him on a spot. */
  private place(x: number, bottom: number): void {
    this.x = x - this.w / 2;
    this.y = bottom - this.h;
  }

  /** Which tier the player is on (by height above the floor). */
  private playerTier(): number {
    const up = this.room.floor - this.g.player.bottom;
    let best = 0;
    WARDEN_TIERS.forEach((h, i) => {
      if (Math.abs(up - h) < Math.abs(up - WARDEN_TIERS[best])) best = i;
    });
    return best;
  }

  /** Pick where to leap: the player's tier or the one above it, never where he is. */
  private pickPerch(): Perch {
    const want = Math.min(3, this.playerTier() + (Math.random() < 0.5 ? 1 : 0));
    const all = this.perches().filter((q) => Math.abs(q.x - this.at.x) > 8 || q.tier !== this.at.tier);
    const near = all.filter((q) => q.tier === want);
    const pool = near.length ? near : all;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  protected think(): void {
    const p = this.g.player;
    const fast = this.phase2;
    switch (this.mode) {
      case 'perch':
        this.facePlayer();
        this.place(this.at.x, this.at.y);
        if (--this.wait <= 0) {
          this.hops = fast ? 2 : 1;
          this.to = this.pickPerch();
          this.setMode('crouch');
        }
        break;

      case 'crouch':
        this.facePlayer();
        if (this.t >= 10) {
          this.from = { ...this.at };
          sfx.jump();
          this.setMode('leap');
        }
        break;

      case 'leap': {
        // A clean arc from perch to perch (he flies; ledges don't stop him).
        const dur = 36;
        const k = Math.min(1, this.t / dur);
        const x = Phaser.Math.Linear(this.from.x, this.to.x, k);
        const rise = 28 + Math.max(0, this.from.y - this.to.y) * 0.4;
        const y = Phaser.Math.Linear(this.from.y, this.to.y, k) - Math.sin(k * Math.PI) * rise;
        this.facing = this.to.x > this.from.x ? 1 : -1;
        this.place(x, y);
        if (this.t % 6 === 0) this.g.burst(this.cx, this.cy, 'shard', 1);
        if (k >= 1) {
          this.at = { ...this.to };
          this.g.shake(2);
          sfx.land();
          this.hops--;
          if (this.hops > 0) {
            this.to = this.pickPerch();
            this.setMode('crouch');
            this.t = 4;
          } else this.setMode('land');
        }
        break;
      }

      case 'land':
        this.place(this.at.x, this.at.y);
        this.facePlayer();
        if (this.t >= 8) this.choose();
        break;

      case 'slash': {
        this.place(this.at.x, this.at.y);
        if (this.t === 1) this.facePlayer();
        if (this.t === 16 || (fast && this.t === 34)) {
          // A wave along his tier at chest height (the second one low, in pairs).
          const y = this.t === 34 ? this.at.y - 10 : this.y + 14;
          this.g.spawnEnemyShot({ x: this.cx + this.facing * 10 - 5, y: y - 8, w: 10, h: 16, vx: this.facing * 3.4, vy: 0, tex: 'swordwave', dmg: 4 });
          sfx.whoosh();
        }
        if (this.t >= (fast ? 50 : 40)) this.setMode('perch', fast ? 30 : 45);
        break;
      }

      case 'lob': {
        this.place(this.at.x, this.at.y);
        this.facePlayer();
        if (this.t === 14 || this.t === 26 || this.t === 38) {
          const h = this.anchor('lob').hand ?? [6, -50];
          const x = this.cx + h[0] * this.facing;
          const y = this.bottom + h[1];
          // Aim each one a little short / on / past where you stand.
          const tx = p.cx + (this.t - 26) * 1.6;
          const vy = -3.2;
          const air = this.airtime(y, vy, p.bottom);
          this.g.spawnEnemyShot({ x: x - 4, y: y - 4, w: 8, h: 8, vx: Phaser.Math.Clamp((tx - x) / air, -3, 3), vy, tex: 'fireball', dmg: 4, gravity: true });
          sfx.flame();
        }
        if (this.t >= 54) this.setMode('perch', fast ? 30 : 45);
        break;
      }

      case 'rise':
        // Up and over you, then down he comes.
        this.y -= 1.2;
        this.diveX = p.cx;
        this.facePlayer();
        if (this.t >= 18) {
          this.x = Phaser.Math.Clamp(this.diveX - this.w / 2, this.room.left, this.room.right - this.w);
          sfx.whoosh();
          this.setMode('dive');
        }
        break;

      case 'dive':
        this.y += 6;
        if (this.bottom >= this.room.floor) {
          this.y = this.room.floor - this.h;
          this.at = { x: this.cx, y: this.room.floor, tier: 0 };
          this.g.shake(6);
          sfx.quake();
          this.g.fireGroundWave(this.cx - 4, this.room.floor, -1);
          this.g.fireGroundWave(this.cx - 4, this.room.floor, 1);
          this.setMode('perch', fast ? 36 : 50);
        }
        break;
    }
  }

  /** Steps for a shot thrown up at vy from y to come down to `to`. */
  private airtime(y: number, vy: number, to: number): number {
    const g = PHYS.gravity;
    const drop = to - y;
    return Math.max(10, (-vy + Math.sqrt(vy * vy + 2 * g * Math.max(0, drop))) / g);
  }

  private choose(): void {
    const p = this.g.player;
    const options: Mode[] = ['slash', 'lob'];
    // Diving only makes sense from above you.
    if (this.at.tier >= 2 && p.bottom > this.at.y + 30) options.push('rise', 'rise');
    if (this.at.tier === this.playerTier()) options.push('slash');
    const pool = options.filter((m) => m !== this.last);
    const pick = pool[Math.floor(Math.random() * pool.length)] ?? 'slash';
    this.last = pick;
    this.setMode(pick);
  }

  protected telegraph(): boolean {
    return (this.mode === 'slash' && this.t < 12 && this.t % 6 < 2) || (this.mode === 'rise' && this.t % 6 < 3);
  }

  private anchor(frame: string) {
    return BOSS_ANCHORS[`warden_${frame}`] ?? BOSS_ANCHORS.warden_idle1;
  }

  /** The frame for right now (see art/guardianArt.mjs). */
  private frame(): string {
    switch (this.mode) {
      case 'crouch':
      case 'land':
        return 'crouch';
      case 'leap':
        return this.t > 30 ? 'crouch' : 'leap';
      case 'slash':
        return this.t < 14 ? 'crouch' : 'slash';
      case 'lob':
        return 'lob';
      case 'rise':
        return 'leap';
      case 'dive':
        return 'dive';
      default:
        return Math.floor(this.anim / 16) % 2 ? 'idle2' : 'idle1';
    }
  }

  step(): void {
    super.step();
    this.anim++;
  }

  render(): void {
    super.render();
    const frame = this.posing ? 'slash' : this.frame();
    this.sprite.setTexture(`warden_${frame}`);
    const a = this.anchor(frame);
    this.fx.update({
      x: Math.round(this.cx),
      bottom: Math.round(this.bottom),
      facing: this.facing,
      floor: this.at.tier > 0 && this.mode !== 'leap' && this.mode !== 'dive' && this.mode !== 'rise' ? this.at.y : this.room.floor,
      eye: a.eye,
      eyeColor: 0x9ee8ff,
      hot: this.mode === 'lob' && a.hand ? [a.hand] : [],
      hotColor: 0xffa040,
      heat: this.mode === 'lob' ? 1 : 0,
      visible: this.sprite.visible && this.state !== 'dying',
    });
  }

  destroy(): void {
    this.fx.destroy();
    super.destroy();
  }

  protected introPose(): string {
    return 'slash';
  }

  protected pose(): string {
    return 'idle1';
  }
}
