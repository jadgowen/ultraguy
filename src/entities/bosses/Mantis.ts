import Phaser from 'phaser';
import type { Point } from '../../level/Level';
import { sfx } from '../../sfx';
import type { GameScene } from '../../scenes/GameScene';
import { BOSS_ANCHORS } from './bossAnchors';
import { Boss, Room } from './Boss';
import { BossFx } from './bossFx';

type Mode = 'idle' | 'leap' | 'throw' | 'vanish' | 'pounce' | 'rain';

/**
 * MANTIS (Canopy). Weak to Cyclone.
 *  - leap: high jump that lands on the far side of the player
 *  - throw: two thorn boomerangs that fly out and curve back
 *  - vanish: fades out (can't be hit), reappears above you and drops
 *  - EX rain: leaps to the ceiling and hurls a fan of thorns down at you
 */
export class Mantis extends Boss {
  private mode: Mode = 'idle';
  private wait = 30;
  private last: Mode | null = null;

  private readonly fx: BossFx;
  /** Steps airborne, and left in the landing squash. */
  private airT = 0;
  private landT = 0;
  private wasGrounded = true;

  constructor(g: GameScene, at: Point, room: Room) {
    super(g, 'mantis', 22, 30, 'cyclone', at, room);
    this.fx = new BossFx(g);
    // An orchid petal (he vanishes in a scatter of them).
    if (!g.textures.exists('petal')) {
      const t = g.textures.createCanvas('petal', 3, 2)!;
      const ctx = t.getContext();
      ctx.fillStyle = '#ffc0dc';
      ctx.fillRect(0, 0, 3, 2);
      ctx.fillStyle = '#fff0f8';
      ctx.fillRect(0, 0, 1, 1);
      t.refresh();
    }
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
        this.vx = 0;
        this.facePlayer();
        this.physics();
        if (--this.wait <= 0) this.choose();
        break;

      case 'leap': {
        if (this.t === 1) {
          // Land about 56px past the player, inside the room.
          const side = p.cx < this.cx ? -1 : 1;
          const target = Phaser.Math.Clamp(p.cx + side * 56, this.room.left + 16, this.room.right - 16);
          this.vx = (target - this.cx) / 52;
          this.vy = -6.5;
          this.grounded = false;
          this.facing = side as 1 | -1;
        }
        const r = this.physics();
        if (r.wall) this.vx = 0;
        if (r.landed && this.t > 2) {
          sfx.land();
          this.facePlayer();
          this.setMode('idle', this.phase2 ? 14 : 28);
        }
        break;
      }

      case 'throw':
        this.physics();
        if (this.t === 14 || (this.phase2 && this.t === 30)) {
          for (const dy of [-8, 8]) {
            this.g.spawnEnemyShot({
              x: this.cx - 5,
              y: this.cy + dy - 5,
              w: 10,
              h: 10,
              vx: this.facing * 3.4,
              vy: 0,
              ax: -this.facing * 0.075, // slows, then comes back
              tex: 'bthorn',
              dmg: 3,
              spin: 0.3,
              life: 170,
            });
          }
          sfx.enemyShot();
        }
        if (this.t >= (this.phase2 ? 44 : 30)) this.setMode('idle', this.phase2 ? 20 : 36);
        break;

      case 'rain': {
        if (this.t === 1) {
          this.vx = ((this.room.left + this.room.right) / 2 - this.cx) / 40;
          this.vy = -7.4;
          this.grounded = false;
        }
        // At the top of the leap: a fan of three thorns aimed at you.
        if (this.t === 22 || (this.phase2 && this.t === 34)) {
          const a0 = Math.atan2(p.cy - this.cy, p.cx - this.cx);
          for (const da of [-0.32, 0, 0.32]) {
            const a = a0 + da;
            this.g.spawnEnemyShot({ x: this.cx - 5, y: this.cy - 5, w: 10, h: 10, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, tex: 'bthorn', dmg: 3, spin: 0.3, life: 120 });
          }
          sfx.enemyShot();
        }
        const r = this.physics();
        if (r.wall) this.vx = 0;
        if (r.landed && this.t > 2) {
          sfx.land();
          this.setMode('idle', this.phase2 ? 18 : 30);
        }
        break;
      }

      case 'vanish':
        // Fade out, hang invisible, then reappear above the player.
        this.physics();
        this.alpha = Math.max(0, 1 - this.t / 24);
        if (this.t === 50) {
          this.x = Phaser.Math.Clamp(p.cx - this.w / 2, this.room.left, this.room.right - this.w);
          this.y = this.room.top;
          this.vx = this.vy = 0;
          this.grounded = false;
          this.setMode('pounce');
        }
        break;

      case 'pounce':
        this.alpha = Math.min(1, this.t / 12);
        if (this.t < 16) break; // hover while it fades in (the tell)
        if (this.physics().landed) {
          this.g.shake(4);
          sfx.land();
          this.alpha = 1;
          this.setMode('idle', this.phase2 ? 18 : 32);
        }
        break;
    }
  }

  private choose(): void {
    const options: Mode[] = ['leap', 'leap', 'throw', 'vanish'];
    const pool = this.withEx(options, 'rain').filter((m) => !((m === 'vanish' || m === 'rain') && this.last === m));
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this.last = pick;
    this.facePlayer();
    this.setMode(pick);
  }

  protected introPose(): string {
    return 'throw';
  }

  step(): void {
    super.step();
    if (this.grounded && !this.wasGrounded) this.landT = 8;
    this.wasGrounded = this.grounded;
    if (this.landT > 0) this.landT--;
    this.airT = this.grounded ? 0 : this.airT + 1;
  }

  /** The frame for right now (see art/mantisArt.mjs for what each looks like). */
  private frame(): string {
    const m = this.mode;
    if (this.state === 'dying') return 'land';
    if (!this.grounded && this.state !== 'fill') return this.airT < 10 && this.vy < 0 ? 'jump_up' : 'jump_top';
    if (this.landT > 0) return 'land';
    if (m === 'throw') return this.t < 8 ? 'throw1' : this.t < 34 ? 'throw2' : 'throw1';
    return `idle${1 + (Math.floor(this.t / 10) % 4)}`;
  }

  render(): void {
    super.render();
    const key = `mantis_${this.frame()}`;
    this.sprite.setTexture(key);
    const a = BOSS_ANCHORS[key] ?? BOSS_ANCHORS.mantis_idle;
    // Vanishing (or coming back): a scatter of orchid petals.
    if ((this.mode === 'vanish' || this.mode === 'pounce') && this.alpha < 0.95 && this.t % 3 === 0) this.g.burst(this.cx + (Math.random() - 0.5) * 20, this.y + Math.random() * this.h, 'petal', 1);
    this.fx.update({
      x: Math.round(this.cx),
      bottom: Math.round(this.bottom),
      facing: this.facing,
      floor: this.room.floor,
      eye: a.eye,
      eyeColor: 0x7ad04a,
      heat: 0,
      visible: this.sprite.visible && this.state !== 'dying',
    });
  }

  destroy(): void {
    this.fx.destroy();
    super.destroy();
  }

  protected pose(): string {
    if (!this.grounded) return 'jump';
    if (this.mode === 'throw' && this.t >= 8) return 'throw';
    return 'idle';
  }
}
