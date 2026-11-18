import Phaser from 'phaser';
import type { Box } from '../physics';
import { PIP_H, PIP_W, PipModule, PipPaint, PipShell, PipTrail, makePipBits, pipTexture } from '../pip';
import { sfx } from '../sfx';
import type { Player } from './Player';

/** What Pip needs from the game. */
export interface PipHost {
  scene: Phaser.Scene;
  player: () => Player;
  view: () => { x: number; y: number; w: number; h: number };
  /** Enemies it may shoot at (alive, on screen). */
  targets: () => (Box & { cx: number; cy: number })[];
  /** Pickups lying about (bolts, health, ammo). */
  pickups: () => (Box & { cx: number; cy: number; life: number; carried?: boolean; vy: number })[];
  /** Enemy shots in flight. */
  shots: () => (Box & { cx: number; cy: number; vx: number; vy: number; dead: boolean })[];
  /** Fire one of Pip's shots (hits enemies only). */
  shoot: (x: number, y: number, vx: number, vy: number) => void;
  /** Pip lights up the dark only where it's dark. */
  dark: () => boolean;
}

interface Bit {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
  max: number;
  grow?: boolean;
  spin?: number;
}

/** Spring toward the spot beside the hero; how springy, and how much it damps. */
const PULL = 0.032;
const DAMP = 0.87;
const MAX_SPEED = 5;

/**
 * PIP, UltraGuy's drone. It hangs just behind his shoulder on a spring, so it
 * lags a little when he moves, overshoots when he stops, and bobs while it
 * waits. It tilts into its motion, flaps its fins, keeps a thruster spitting
 * sparks under itself, and looks where it's interested (an enemy, a bolt, the
 * way it's going). Its upgrades:
 *  - LAMP: a pool of light around it in dark rooms;
 *  - FETCH: darts out to grab a pickup and brings it back;
 *  - GUARD: once charged, zaps an enemy shot about to hit you;
 *  - ZAP: takes a pot shot at the nearest enemy every so often.
 */
export class Pip {
  x: number;
  y: number;
  private vx = 0;
  private vy = 0;
  private t = 0;
  private readonly body: Phaser.GameObjects.Image;
  private readonly pupil: Phaser.GameObjects.Image;
  private readonly ring: Phaser.GameObjects.Image;
  private readonly zapLine: Phaser.GameObjects.Graphics;
  private bits: Bit[] = [];
  private look = { x: 1, y: 0 };
  /** A spin (after the hero's hit, or a happy flip), in steps left. */
  private spin = 0;
  private lastHp = 0;
  private wasGrounded = true;
  private idleT = 0;
  private fetching: ReturnType<PipHost['pickups']>[number] | null = null;
  private fetchCool = 0;
  private guard = 1;
  private zapCool = 60;
  private zapLineT = 0;

  constructor(
    private h: PipHost,
    private look_: { shell: PipShell; paint: PipPaint; trail: PipTrail },
    private modules: Set<PipModule>,
  ) {
    makePipBits(h.scene);
    const p = h.player();
    this.x = p.cx - p.facing * 14;
    this.y = p.y - 10;
    this.body = h.scene.add.image(this.x, this.y, pipTexture(h.scene, look_.shell, look_.paint, 0)).setDepth(10.5);
    this.pupil = h.scene.add.image(this.x, this.y, 'pip_pupil').setDepth(10.6);
    this.ring = h.scene.add.image(this.x, this.y, 'pip_ring').setDepth(10.4).setAlpha(0);
    this.zapLine = h.scene.add.graphics().setDepth(10.7);
    this.lastHp = p.hp;
  }

  has(m: PipModule): boolean {
    return this.modules.has(m);
  }

  /** Where Pip likes to be: just behind the hero's shoulder, drifting a little. */
  private home(): { x: number; y: number } {
    const p = this.h.player();
    const drift = Math.sin(this.t * 0.021) * 4;
    // Stood still a while: now and then it does a lazy loop over his head.
    if (this.idleT > 240) {
      const a = (this.idleT - 240) * 0.05;
      return { x: p.cx + Math.cos(a) * 18, y: p.y - 12 + Math.sin(a) * 8 };
    }
    return { x: p.cx - p.facing * 14 + drift, y: p.y - 8 + Math.sin(this.t * 0.033) * 2 };
  }

  step(): void {
    const p = this.h.player();
    this.t++;
    if (!p.alive) {
      // The hero's down: Pip droops and drifts.
      this.vy += 0.03;
      this.vx *= 0.95;
      this.x += this.vx;
      this.y += Math.min(this.vy, 0.6);
      return;
    }
    this.idleT = Math.abs(p.vx) < 0.05 && p.grounded ? this.idleT + 1 : 0;
    if (this.idleT > 240 + 126) this.idleT = 0; // one loop, then back

    // Reactions: a jolt and a spin when he's hit; a dip when he lands hard.
    if (p.hp < this.lastHp) {
      this.vx += (Math.random() - 0.5) * 6;
      this.vy -= 2.5;
      this.spin = 24;
      this.sparks(8, 1.5);
    }
    this.lastHp = p.hp;
    if (p.grounded && !this.wasGrounded) this.vy += 1.2;
    this.wasGrounded = p.grounded;

    // Where to: home, or out after a pickup.
    let target = this.home();
    let pull = PULL;
    this.stepFetch();
    if (this.fetching) {
      target = this.fetching.carried ? { x: p.cx, y: p.cy - 4 } : { x: this.fetching.cx, y: this.fetching.cy - 4 };
      pull = 0.06;
    }
    this.vx = (this.vx + (target.x - this.x) * pull) * DAMP;
    this.vy = (this.vy + (target.y - this.y) * pull) * DAMP;
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > MAX_SPEED) {
      this.vx *= MAX_SPEED / sp;
      this.vy *= MAX_SPEED / sp;
    }
    this.x += this.vx;
    this.y += this.vy;
    // Far behind (a screen transition, a teleport): catch up at once.
    if (Math.hypot(p.cx - this.x, p.cy - this.y) > 260) {
      this.x = p.cx - p.facing * 14;
      this.y = p.y - 8;
      this.vx = this.vy = 0;
    }
    if (this.fetching?.carried) {
      this.fetching.x = this.x - this.fetching.w / 2;
      this.fetching.y = this.y + 5;
      this.fetching.vy = 0;
    }

    this.stepGuard();
    this.stepZap();
    this.stepLook();
    this.stepBits();
    if (this.spin > 0) this.spin--;
  }

  // --- upgrades ------------------------------------------------------------------

  private stepFetch(): void {
    if (!this.has('fetch')) return;
    const p = this.h.player();
    if (this.fetchCool > 0) this.fetchCool--;
    const f = this.fetching;
    if (f) {
      if (!this.h.pickups().includes(f)) {
        this.fetching = null; // collected (or gone)
        this.fetchCool = 20;
        return;
      }
      if (!f.carried && Math.hypot(f.cx - this.x, f.cy - this.y) < 8) {
        f.carried = true;
        sfx.tick();
        this.sparks(4, 1);
      }
      // Home with it: drop it right on him.
      if (f.carried && Math.hypot(p.cx - this.x, p.cy - 4 - this.y) < 10) {
        f.carried = false;
        f.x = p.cx - f.w / 2;
        f.y = p.cy - f.h / 2;
      }
      return;
    }
    if (this.fetchCool > 0) return;
    const near = this.h.pickups().filter((k) => k.life > 15 && !k.carried && Math.hypot(k.cx - p.cx, k.cy - p.cy) < 110 && Math.hypot(k.cx - p.cx, k.cy - p.cy) > 18);
    near.sort((a, b) => Math.hypot(a.cx - p.cx, a.cy - p.cy) - Math.hypot(b.cx - p.cx, b.cy - p.cy));
    if (near[0]) this.fetching = near[0];
  }

  private stepGuard(): void {
    if (!this.has('guard')) {
      this.ring.setAlpha(0);
      return;
    }
    const p = this.h.player();
    if (this.guard < 1) this.guard = Math.min(1, this.guard + 1 / 480);
    // Ready: a faint ring pulses around it.
    this.ring.setAlpha(this.guard >= 1 ? 0.35 + 0.25 * Math.sin(this.t * 0.15) : 0);
    if (this.guard < 1 || p.invuln > 0) return;
    // A shot about to hit him: zap it.
    const s = this.h.shots().find((k) => {
      if (k.dead) return false;
      const dx = p.cx - k.cx;
      const dy = p.cy - k.cy;
      const d = Math.hypot(dx, dy);
      return d < 40 && k.vx * dx + k.vy * dy > 0;
    });
    if (!s) return;
    s.dead = true;
    this.guard = 0;
    this.zapTo(s.cx, s.cy);
    this.vx += (s.cx - this.x) * 0.15;
    this.vy += (s.cy - this.y) * 0.15;
    sfx.deflect();
    this.burstAt(s.cx, s.cy, 6);
  }

  private stepZap(): void {
    if (!this.has('zap')) return;
    if (this.zapCool > 0) {
      this.zapCool--;
      return;
    }
    const tgt = this.nearestTarget(140);
    if (!tgt) return;
    const a = Math.atan2(tgt.cy - this.y, tgt.cx - this.x);
    this.h.shoot(this.x - 2, this.y - 2, Math.cos(a) * 4, Math.sin(a) * 4);
    // Recoil, and a muzzle spark.
    this.vx -= Math.cos(a) * 1.6;
    this.vy -= Math.sin(a) * 1.6;
    this.burstAt(this.x + Math.cos(a) * 6, this.y + Math.sin(a) * 6, 3);
    sfx.enemyShot();
    this.zapCool = 80;
  }

  private nearestTarget(range: number): (Box & { cx: number; cy: number }) | null {
    let best: (Box & { cx: number; cy: number }) | null = null;
    let bd = range;
    for (const e of this.h.targets()) {
      const d = Math.hypot(e.cx - this.x, e.cy - this.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  /** The eye looks at what it's interested in: a pickup it's after, an enemy, or where it's going. */
  private stepLook(): void {
    let lx = this.vx;
    let ly = this.vy;
    const f = this.fetching;
    const e = f ? null : this.nearestTarget(120);
    if (f) {
      lx = f.cx - this.x;
      ly = f.cy - this.y;
    } else if (e) {
      lx = e.cx - this.x;
      ly = e.cy - this.y;
    } else if (Math.hypot(lx, ly) < 0.3) {
      lx = this.h.player().facing;
      ly = 0;
    }
    const d = Math.max(0.01, Math.hypot(lx, ly));
    this.look.x += (lx / d - this.look.x) * 0.2;
    this.look.y += (ly / d - this.look.y) * 0.2;
  }

  // --- particles -----------------------------------------------------------------

  private addBit(tex: string, x: number, y: number, vx: number, vy: number, life: number, opts: Partial<Bit> = {}): void {
    const img = this.h.scene.add.image(x, y, tex).setDepth(10.3);
    this.bits.push({ img, vx, vy, life, max: life, ...opts });
  }

  /** Thruster sparks from underneath (more when it's working hard), and the trail it wears. */
  private stepBits(): void {
    const sp = Math.hypot(this.vx, this.vy);
    const every = sp > 2 ? 1 : sp > 0.8 ? 2 : 3;
    if (this.t % every === 0) {
      this.addBit(Math.random() < 0.5 ? 'pip_flame' : 'pip_dot', this.x + (Math.random() - 0.5) * 3, this.y + 7, (Math.random() - 0.5) * 0.4 - this.vx * 0.2, 0.6 + Math.random() * 0.6, 10 + Math.floor(Math.random() * 6));
    }
    const trail = this.look_.trail;
    if (trail === 'sparks' && this.t % 2 === 0) this.addBit('pip_flame', this.x - this.vx * 2, this.y, (Math.random() - 0.5) * 1.6, -0.5 - Math.random(), 22, { spin: 0 });
    if (trail === 'bubbles' && this.t % 7 === 0) this.addBit('pip_bubble', this.x + (Math.random() - 0.5) * 8, this.y + 2, (Math.random() - 0.5) * 0.3, -0.35, 50, { grow: true });
    if (trail === 'notes' && this.t % 18 === 0) this.addBit('pip_note', this.x - this.h.player().facing * 6, this.y - 2, (Math.random() - 0.5) * 0.4, -0.45, 55, { spin: 0.02 });
    if (trail === 'stars' && this.t % 6 === 0) this.addBit('pip_star', this.x + (Math.random() - 0.5) * 10, this.y + (Math.random() - 0.5) * 8, 0, 0.1, 30, { spin: 0.08 });
    for (const b of this.bits) {
      b.life--;
      b.vy += b.img.texture.key === 'pip_flame' || b.img.texture.key === 'pip_dot' ? 0.05 : 0;
      b.img.x += b.vx;
      b.img.y += b.vy;
      if (b.spin) b.img.rotation += b.spin;
      if (b.img.texture.key === 'pip_note') b.img.x += Math.sin((b.max - b.life) * 0.15) * 0.3;
      const k = b.life / b.max;
      b.img.setAlpha(Math.min(1, k * 1.6));
      if (b.grow) b.img.setScale(0.6 + (1 - k) * 0.8);
      if (b.img.texture.key === 'pip_star') b.img.setScale(0.5 + Math.abs(Math.sin(b.life * 0.3)) * 0.7);
      if (b.life <= 0) b.img.destroy();
    }
    this.bits = this.bits.filter((b) => b.life > 0);
  }

  private sparks(n: number, sp: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.addBit('pip_flame', this.x, this.y, Math.cos(a) * sp * (0.5 + Math.random()), Math.sin(a) * sp * (0.5 + Math.random()) - 0.5, 18);
    }
  }

  private burstAt(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.addBit('pip_dot', x, y, Math.cos(a) * 1.5, Math.sin(a) * 1.5, 14);
    }
  }

  /** A crackle of lightning from Pip to a point (the guard's zap). */
  private zapTo(x: number, y: number): void {
    this.zapLineT = 8;
    const g = this.zapLine.clear().lineStyle(1, 0x9af0ff, 1);
    g.beginPath();
    g.moveTo(this.x, this.y);
    const n = 5;
    for (let i = 1; i < n; i++) {
      const k = i / n;
      g.lineTo(this.x + (x - this.x) * k + (Math.random() - 0.5) * 6, this.y + (y - this.y) * k + (Math.random() - 0.5) * 6);
    }
    g.lineTo(x, y);
    g.strokePath();
  }

  // --- drawing -------------------------------------------------------------------

  render(): void {
    const p = this.h.player();
    const frame: 0 | 1 = Math.floor(this.t / (Math.hypot(this.vx, this.vy) > 1.5 ? 3 : 7)) % 2 === 0 ? 0 : 1;
    this.body.setTexture(pipTexture(this.h.scene, this.look_.shell, this.look_.paint, frame));
    const bob = Math.sin(this.t * 0.12) * 1.5;
    const x = Math.round(this.x);
    const y = Math.round(this.y + bob);
    // Tilt into the motion; a full spin when something's happened.
    const tilt = Phaser.Math.Clamp(this.vx * 0.1, -0.4, 0.4);
    this.body.setPosition(x, y).setRotation(this.spin > 0 ? tilt + (1 - this.spin / 24) * Math.PI * 2 : tilt);
    this.body.setFlipX(this.look.x < -0.2 && !this.spin);
    this.body.setAlpha(p.alive ? 1 : 0.5);
    // The pupil sits in the eye window (a 4x3 slot) and looks about inside it.
    const o = pupilOffset(this.look_.shell, this.look.x, this.look.y);
    const blink = this.t % 200 > 194;
    this.pupil
      .setPosition(x + o.x, y + o.y)
      .setRotation(this.body.rotation)
      .setScale(1, blink ? 0.5 : 1)
      .setVisible(!this.spin);
    this.ring.setPosition(x, y);
    if (this.zapLineT > 0 && --this.zapLineT === 0) this.zapLine.clear();
  }

  /** Lights it carries into the dark (its lamp). */
  lights(): { x: number; y: number; s: number }[] {
    if (!this.has('lamp') || !this.h.dark()) return [];
    return [{ x: this.x, y: this.y, s: 0.55 + Math.sin(this.t * 0.07) * 0.03 }];
  }

  /** Back beside the hero (after a respawn). */
  reset(): void {
    const p = this.h.player();
    this.x = p.cx - p.facing * 14;
    this.y = p.y - 8;
    this.vx = this.vy = 0;
    this.fetching = null;
    this.lastHp = p.hp;
    this.guard = 1;
    this.spin = 0;
  }

  destroy(): void {
    this.body.destroy();
    this.pupil.destroy();
    this.ring.destroy();
    this.zapLine.destroy();
    for (const b of this.bits) b.img.destroy();
    this.bits = [];
  }
}

export { PIP_W, PIP_H };

/** Where the pupil goes (from Pip's center) for a shell, looking along (lx, ly): it stays inside the eye window. */
export function pupilOffset(shell: PipShell, lx: number, ly: number): { x: number; y: number } {
  const top = shell === 'saucer' ? -3 : shell === 'cube' ? 0 : -1;
  return { x: Phaser.Math.Clamp(Math.round(lx * 1.4), -1, 1), y: top + (ly > 0.35 ? 1 : 0) };
}
