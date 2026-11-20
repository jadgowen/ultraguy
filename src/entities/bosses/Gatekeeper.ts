import type { Point } from '../../level/Level';
import { sfx } from '../../sfx';
import type { GameScene } from '../../scenes/GameScene';
import { BOSS_ANCHORS } from './bossAnchors';
import { Boss, Room } from './Boss';
import { BossFx } from './bossFx';

type Mode = 'walk' | 'shoot' | 'bash' | 'daze' | 'slam' | 'recover';

/**
 * GATEKEEPER (Fortress 1 guardian). Weak to Spark Shock.
 *
 * A golem behind a portcullis tower shield: shots from the front bounce off
 * it. Get behind him (the ledges let you hop over), or catch him open:
 *  - walk: plods after you, shield first
 *  - shoot: fires over the top of the shield
 *  - bash: crouches (the tell), then charges shield-first to the wall; if he
 *    hits it he's dazed for a moment with his shield dropped (hit him anywhere)
 *  - slam: raises the shield overhead (his front is open) and slams it down,
 *    sending shockwaves both ways
 *  - EX: bashes back the other way after the first
 */
export class Gatekeeper extends Boss {
  private mode: Mode = 'walk';
  private last: Mode | null = null;
  private bashes = 0;
  private readonly fx: BossFx;
  private anim = 0;

  constructor(g: GameScene, at: Point, room: Room) {
    super(g, 'gatekeeper', 34, 40, 'spark', at, room);
    this.fx = new BossFx(g);
  }

  private setMode(m: Mode): void {
    this.mode = m;
    this.t = 0;
  }

  /** The shield covers his front unless it's raised or dropped. */
  private get shieldUp(): boolean {
    return this.mode !== 'daze' && !(this.mode === 'slam' && this.t < 40);
  }

  blocksShot(shot: { vx: number }): boolean {
    // A shot heading against his facing is coming at his front.
    return this.shieldUp && shot.vx * this.facing < 0;
  }

  protected think(): void {
    const p = this.g.player;
    const fast = this.phase2;
    switch (this.mode) {
      case 'walk': {
        this.facePlayer();
        const close = Math.abs(p.cx - this.cx) < 30;
        this.vx = close ? 0 : this.facing * (fast ? 0.75 : 0.5);
        const r = this.physics();
        if (r.wall) this.vx = 0;
        if (this.t >= this.quick(fast ? 60 : 85)) this.choose();
        break;
      }

      case 'shoot':
        this.vx = 0;
        this.physics();
        this.facePlayer();
        if (this.t % 16 === 8 && this.t < (fast ? 60 : 44)) {
          const a = this.anchor('shoot').eye ?? [0, -40];
          const x = this.cx + a[0] * this.facing;
          const y = this.bottom + a[1];
          const d = Math.max(1, Math.hypot(p.cx - x, p.cy - y));
          this.g.spawnEnemyShot({ x: x - 3, y: y - 3, w: 6, h: 6, vx: ((p.cx - x) / d) * 2.6, vy: ((p.cy - y) / d) * 2.6, tex: 'bshot', dmg: 3 });
          sfx.enemyShot();
        }
        if (this.t >= (fast ? 76 : 60)) this.setMode('walk');
        break;

      case 'bash': {
        // The tell: a crouch and a tremble, then the charge.
        const wind = fast ? 18 : 26;
        if (this.t === 1) this.facePlayer();
        if (this.t < wind) {
          this.vx = 0;
          this.physics();
          break;
        }
        if (this.t === wind) sfx.rev();
        this.vx = this.facing * (fast ? 4 : 3.2);
        const r = this.physics();
        if (r.wall) {
          this.vx = 0;
          this.g.shake(7);
          sfx.crush();
          this.g.burst(this.facing > 0 ? this.x + this.w : this.x, this.y + 10, 'spark', 8);
          // EX: off the wall and straight back the other way.
          if (this.ex && this.bashes === 0) {
            this.bashes = 1;
            this.facing = -this.facing as 1 | -1;
            this.t = wind - 8;
            break;
          }
          this.bashes = 0;
          this.setMode('daze');
        }
        break;
      }

      case 'daze':
        this.vx = 0;
        this.physics();
        if (this.t % 12 === 0) this.g.burst(this.cx, this.y - 4, 'spark', 1);
        if (this.t >= (fast ? 70 : 95)) this.setMode('recover');
        break;

      case 'slam': {
        // Up goes the shield (front open), a hop, then down it comes.
        this.vx = 0;
        if (this.t === 1) this.facePlayer();
        if (this.t === 30) {
          this.vy = -3.5;
          this.grounded = false;
        }
        const r = this.physics();
        if (r.landed && this.t > 30) {
          this.g.shake(6);
          sfx.quake();
          this.g.fireGroundWave(this.cx - 4, this.room.floor, -1);
          this.g.fireGroundWave(this.cx - 4, this.room.floor, 1);
          this.t = 40;
        }
        if (this.t >= 64) this.setMode('walk');
        break;
      }

      case 'recover':
        this.vx = 0;
        this.physics();
        if (this.t >= 20) this.setMode('walk');
        break;
    }
  }

  private choose(): void {
    const options: Mode[] = ['shoot', 'bash', 'slam', 'bash'];
    const pool = options.filter((m) => m !== this.last);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this.last = pick;
    this.setMode(pick);
  }

  protected telegraph(): boolean {
    return this.mode === 'bash' && this.t < (this.phase2 ? 18 : 26) && this.t % 8 < 2;
  }

  private anchor(frame: string) {
    return BOSS_ANCHORS[`gatekeeper_${frame}`] ?? BOSS_ANCHORS.gatekeeper_idle1;
  }

  /** The frame for right now (see art/guardianArt.mjs). */
  private frame(): string {
    const m = this.mode;
    if (m === 'bash') return 'bash';
    if (m === 'daze') return 'daze';
    if (m === 'slam') return this.t < 40 ? 'raise' : 'slam';
    if (m === 'shoot') return 'shoot';
    if (m === 'recover') return 'idle2';
    if (this.vx !== 0) return Math.floor(this.anim / 10) % 2 ? 'walk2' : 'walk1';
    return Math.floor(this.anim / 20) % 2 ? 'idle2' : 'idle1';
  }

  step(): void {
    super.step();
    this.anim++;
  }

  render(): void {
    super.render();
    const frame = this.posing ? 'raise' : this.frame();
    // The tremble before a bash.
    const shake = this.mode === 'bash' && this.t < (this.phase2 ? 18 : 26) ? (this.t % 4 < 2 ? 1 : -1) : 0;
    this.sprite.setTexture(`gatekeeper_${frame}`).setX(Math.round(this.cx) + shake);
    const a = this.anchor(frame);
    this.fx.update({
      x: Math.round(this.cx),
      bottom: Math.round(this.bottom),
      facing: this.facing,
      floor: this.room.floor,
      eye: this.mode === 'daze' ? undefined : a.eye,
      eyeColor: this.mode === 'bash' || this.mode === 'slam' ? 0xff5a5a : 0x9ee8ff,
      heat: 0,
      visible: this.sprite.visible && this.state !== 'dying',
    });
  }

  destroy(): void {
    this.fx.destroy();
    super.destroy();
  }

  protected introPose(): string {
    return 'raise';
  }

  protected pose(): string {
    return 'idle1';
  }
}
