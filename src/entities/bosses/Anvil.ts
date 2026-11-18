import Phaser from 'phaser';
import type { Point } from '../../level/Level';
import { sfx } from '../../sfx';
import type { GameScene } from '../../scenes/GameScene';
import { ANVIL_ANCHORS } from './anvilAnchors';
import { Boss, Room } from './Boss';
import { BossFx } from './bossFx';

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
  /** How hot his forge is running (0..1): firing and slamming heat it up, and it cools off. */
  private heat = 0;
  /** Steps left in the cannon's kick, and in the landing squash. */
  private recoilT = 0;
  private landT = 0;
  private airT = 0;
  private readonly fx: BossFx;

  constructor(g: GameScene, at: Point, room: Room) {
    super(g, 'anvil', 26, 30, 'thorn', at, room);
    this.fx = new BossFx(g);
  }

  step(): void {
    super.step();
    this.heat = Math.max(0, this.heat - 1 / 360);
    if (this.recoilT > 0) this.recoilT--;
    if (this.landT > 0) this.landT--;
    this.airT = this.grounded ? 0 : this.airT + 1;
  }

  /** A hard landing: the slam heats his fists, sparks fly, he squashes. */
  private slam(): void {
    this.heat = 1;
    this.landT = 10;
    this.g.burst(this.cx - 10, this.bottom - 2, 'spark', 5);
    this.g.burst(this.cx + 10, this.bottom - 2, 'spark', 5);
    this.g.burst(this.cx, this.bottom - 2, 'boom', 2);
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
          this.slam();
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
          this.slam();
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
    this.recoilT = 6;
    this.heat = Math.min(1, this.heat + 0.35);
  }

  protected telegraph(): boolean {
    return (this.mode === 'crouch' || (this.mode === 'hammer' && this.t < 20)) && this.t % 6 < 3;
  }

  protected introPose(): string {
    return 'jump';
  }

  /**
   * The frame for right now: four breaths of idle, the crouched tell (shaking),
   * the dash, stretched on takeoff and tucked at the top of a jump, squashed for a
   * moment on landing, the cannon (kicking back as it fires). The white-hot
   * version once his forge is running hot.
   */
  private frame(): string {
    let f: string;
    const m = this.mode;
    if (this.state === 'dying') f = 'land1';
    else if (!this.grounded && (this.state === 'drop' || m === 'jump' || m === 'hammer')) f = this.airT < 8 && this.vy < 0 ? 'jump_up' : 'jump_top';
    else if (this.landT > 0) f = this.landT > 5 ? 'land1' : 'land2';
    else if (m === 'shoot' && this.t >= 10) f = this.recoilT > 2 ? 'shoot_fire' : 'shoot';
    else if (m === 'dash') f = 'dash';
    else if (m === 'crouch' || (m === 'hammer' && this.t < 20)) f = 'crouch';
    else f = `idle${1 + (Math.floor(this.t / 9) % 4)}`;
    return `${f}${this.heat > 0.5 ? '_h' : ''}`;
  }

  render(): void {
    super.render();
    const key = `anvil_${this.frame()}`;
    this.sprite.setTexture(key);
    // The tell: he trembles in his crouch.
    const tell = this.mode === 'crouch' || (this.mode === 'hammer' && this.t < 20);
    if (tell) this.sprite.x += this.t % 4 < 2 ? 1 : -1;
    const a = ANVIL_ANCHORS[key] ?? ANVIL_ANCHORS.anvil_idle1;
    const angry = this.mode !== 'idle' || this.state === 'fill';
    this.fx.update({
      x: Math.round(this.cx),
      bottom: Math.round(this.bottom),
      facing: this.facing,
      floor: this.room.floor,
      core: a.furnace,
      coreColor: 0xff8c28,
      eye: a.visor,
      eyeColor: angry ? 0xff4040 : 0xffe14a,
      hot: [...a.fists, ...(a.muzzle ? [[a.muzzle[0] - 6, a.muzzle[1]] as [number, number]] : [])],
      heat: this.heat,
      muzzle: a.muzzle,
      flash: this.recoilT / 6,
      embers: true,
      visible: this.sprite.visible && this.state !== 'dying',
    });
  }

  destroy(): void {
    this.fx.destroy();
    super.destroy();
  }

  protected pose(): string {
    if (this.state === 'drop' || this.mode === 'jump' || this.mode === 'hammer') return this.grounded ? (this.mode === 'hammer' ? 'crouch' : 'idle') : 'jump';
    if (this.mode === 'shoot' && this.t >= 10) return 'shoot';
    if (this.mode === 'crouch' || this.mode === 'dash') return 'crouch';
    return 'idle';
  }
}
