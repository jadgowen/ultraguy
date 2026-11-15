import Phaser from 'phaser';
import { PHYS } from '../constants';
import type { Point } from '../level/Level';
import { moveX, moveY } from '../physics';
import { sfx } from '../sfx';
import type { GameScene } from '../scenes/GameScene';

export const BOSS_MAX_HP = 28;

type BossState = 'drop' | 'fill' | 'idle' | 'jump' | 'shoot' | 'crouch' | 'dash' | 'dying';
type Attack = 'jump' | 'shoot' | 'dash';

/**
 * "Anvil", the Foundry boss. Pattern-based:
 *  - jump: leaps at the player; landing sends ground waves both ways (jump them)
 *  - shoot: 3-way aimed spread (two volleys in phase 2)
 *  - dash: crouches as a tell, then charges into the wall
 * Below half health (phase 2) it waits less and moves faster.
 */
export class Boss {
  x: number;
  y: number;
  readonly w = 26;
  readonly h = 30;
  vx = 0;
  vy = 0;
  hp = BOSS_MAX_HP;
  /** What the health bar shows; fills up during the intro. */
  barHp = 0;
  invuln = 0;
  facing: 1 | -1 = -1;
  state: BossState = 'drop';
  private t = 0;
  private wait = 0;
  private grounded = false;
  private last: Attack | null = null;
  private flash = 0;
  readonly sprite: Phaser.GameObjects.Image;

  /** `dropFromY` is where it appears (top of the room); it falls to the floor. */
  constructor(private g: GameScene, at: Point, dropFromY: number) {
    this.x = at.x - this.w / 2;
    this.y = dropFromY;
    this.sprite = g.add.image(0, 0, 'boss_idle').setOrigin(0.5, 1).setDepth(6);
  }

  get cx(): number {
    return this.x + this.w / 2;
  }
  get cy(): number {
    return this.y + this.h / 2;
  }
  /** True until the intro (drop + health bar fill) is done. */
  get inIntro(): boolean {
    return this.state === 'drop' || this.state === 'fill';
  }
  get phase2(): boolean {
    return this.hp <= BOSS_MAX_HP / 2;
  }
  get vulnerable(): boolean {
    return !this.inIntro && this.state !== 'dying' && this.invuln === 0;
  }

  private setState(s: BossState): void {
    this.state = s;
    this.t = 0;
  }

  private facePlayer(): void {
    this.facing = this.g.player.cx < this.cx ? -1 : 1;
  }

  private physics(): { wall: boolean; landed: boolean } {
    const L = this.g.level;
    this.vy = Math.min(this.vy + PHYS.gravity, PHYS.maxFall);
    const wall = moveX(L, this, this.vx);
    const falling = this.vy > 0;
    const hit = moveY(L, this, this.vy, false);
    const was = this.grounded;
    this.grounded = hit && falling;
    if (hit) this.vy = 0;
    return { wall, landed: this.grounded && !was };
  }

  hit(dmg: number): void {
    this.hp = Math.max(0, this.hp - dmg);
    this.barHp = this.hp;
    this.invuln = 14;
    this.flash = 14;
    if (this.hp === 0) {
      this.setState('dying');
      this.vx = 0;
    }
  }

  step(): void {
    this.t++;
    if (this.invuln > 0) this.invuln--;
    if (this.flash > 0) this.flash--;

    switch (this.state) {
      case 'drop': {
        this.facePlayer();
        if (this.physics().landed) {
          this.g.shake(6);
          this.setState('fill');
        }
        break;
      }
      case 'fill':
        if (this.t % 3 === 0 && this.barHp < BOSS_MAX_HP) {
          this.barHp++;
          sfx.tick();
        }
        if (this.barHp >= BOSS_MAX_HP && this.t > 20) this.toIdle(30);
        break;

      case 'idle':
        this.vx = 0;
        this.facePlayer();
        this.physics();
        if (--this.wait <= 0) this.chooseAttack();
        break;

      case 'jump': {
        if (this.t === 1) {
          this.facePlayer();
          const airtime = 50;
          this.vx = Phaser.Math.Clamp((this.g.player.cx - this.cx) / airtime, -2.6, 2.6);
          this.vy = -6.2;
          this.grounded = false;
        }
        const r = this.physics();
        if (r.wall) this.vx = 0;
        if (r.landed && this.t > 2) {
          this.g.shake(5);
          sfx.land();
          const floor = this.y + this.h;
          this.g.fireGroundWave(this.cx - 10, floor, -1);
          this.g.fireGroundWave(this.cx + 2, floor, 1);
          this.toIdle(this.phase2 ? 22 : 40);
        }
        break;
      }

      case 'shoot':
        this.physics();
        if (this.t === 18 || (this.phase2 && this.t === 40)) this.volley();
        if (this.t >= (this.phase2 ? 56 : 40)) this.toIdle(this.phase2 ? 20 : 36);
        break;

      case 'crouch':
        this.physics();
        if (this.t >= (this.phase2 ? 18 : 28)) {
          this.setState('dash');
          this.vx = this.facing * (this.phase2 ? 4 : 3.2);
        }
        break;

      case 'dash': {
        if (this.physics().wall) {
          this.g.shake(4);
          sfx.land();
          this.vx = 0;
          this.toIdle(this.phase2 ? 24 : 40);
        }
        break;
      }

      case 'dying':
        // Handled by the scene (explosions); just freeze in place.
        break;
    }
  }

  private toIdle(wait: number): void {
    this.setState('idle');
    this.wait = wait;
  }

  private chooseAttack(): void {
    const dist = Math.abs(this.g.player.cx - this.cx);
    const options: Attack[] = dist > 140 ? ['jump', 'jump', 'shoot', 'dash'] : ['jump', 'shoot', 'shoot', 'dash'];
    // Never repeat a dash; otherwise allow repeats (keeps it unpredictable).
    const pool = options.filter((a) => !(a === 'dash' && this.last === 'dash'));
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this.last = pick;
    this.facePlayer();
    this.setState(pick === 'dash' ? 'crouch' : pick);
  }

  private volley(): void {
    const p = this.g.player;
    const ox = this.cx + this.facing * 16;
    const oy = this.y + 14;
    const base = Math.atan2(p.cy - oy, p.cx - ox);
    for (const spread of [-0.28, 0, 0.28]) {
      const a = base + spread;
      this.g.fireBossShot(ox, oy, Math.cos(a) * 2.2, Math.sin(a) * 2.2);
    }
    sfx.enemyShot();
  }

  render(): void {
    let key = 'boss_idle';
    if (this.state === 'jump' || this.state === 'drop') key = this.grounded ? 'boss_idle' : 'boss_jump';
    else if (this.state === 'shoot' && this.t >= 10) key = 'boss_shoot';
    else if (this.state === 'crouch' || this.state === 'dash') key = 'boss_crouch';
    this.sprite.setTexture(key);
    this.sprite.setFlipX(this.facing < 0);
    this.sprite.setPosition(Math.round(this.cx), Math.round(this.y + this.h));
    // Crouch tell flashes; damage flashes white.
    const tell = this.state === 'crouch' && this.t % 6 < 3;
    if ((this.flash > 0 && this.flash % 4 < 2) || tell) this.sprite.setTintFill(0xffffff);
    else this.sprite.clearTint();
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
