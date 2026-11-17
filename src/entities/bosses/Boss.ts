import Phaser from 'phaser';
import { PHYS } from '../../constants';
import type { BossKind, Point } from '../../level/Level';
import { moveX, moveY } from '../../physics';
import { sfx } from '../../sfx';
import type { GameScene } from '../../scenes/GameScene';
import type { WeaponId } from '../../weapons';

export const BOSS_MAX_HP = 28;

/** The boss room's usable area, in world pixels. */
export interface Room {
  left: number;
  right: number;
  top: number;
  floor: number;
}

/**
 * Shared boss behavior: drop-in intro while the health bar fills, taking hits
 * (with a brief invincibility window and a weakness), and the death state.
 * Subclasses implement `think()` (the attack pattern) and `pose()` (which
 * texture to show: `${kind}_${pose}`).
 */
export abstract class Boss {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  hp = BOSS_MAX_HP;
  /** Full health (minibosses have less). */
  maxHp = BOSS_MAX_HP;
  /** What the health bar shows; fills up during the intro. */
  barHp = 0;
  invuln = 0;
  facing: 1 | -1 = -1;
  state: 'drop' | 'fill' | 'fight' | 'dying' = 'drop';
  /** Frames since the current mode started. */
  protected t = 0;
  protected grounded = false;
  protected flash = 0;
  protected alpha = 1;
  readonly sprite: Phaser.GameObjects.Image;
  /** Intro staging (set by the scene for a full intro): steps before the bar fills, and the earliest the fight starts. */
  fillDelay = 0;
  introHold = 0;
  /** EX rematch (after the game is beaten): tougher, quicker, and an extra attack. */
  readonly ex: boolean;

  constructor(
    protected g: GameScene,
    readonly kind: BossKind,
    readonly w: number,
    readonly h: number,
    /** Takes heavy damage from this weapon (null: no weakness). */
    readonly weakness: WeaponId | null,
    at: Point,
    protected room: Room,
  ) {
    this.x = at.x - w / 2;
    this.y = room.top; // drops in from the top of the room
    this.sprite = g.add.image(0, 0, `${kind}_idle`).setOrigin(0.5, 1).setDepth(6);
    this.ex = g.exMode;
  }

  /** A pause between attacks: shorter in EX. */
  protected quick(frames: number): number {
    return this.ex ? Math.round(frames * 0.65) : frames;
  }

  /** The attack pool, plus the EX-only attack in an EX rematch. */
  protected withEx<T>(options: T[], exMove: T): T[] {
    return this.ex ? [...options, exMove] : options;
  }

  /** Texture prefix (`${texKey}_${pose}`); defaults to the boss kind. */
  protected get texKey(): string {
    return this.kind;
  }

  get cx(): number {
    return this.x + this.w / 2;
  }
  get cy(): number {
    return this.y + this.h / 2;
  }
  get bottom(): number {
    return this.y + this.h;
  }
  /** Steps since landing while posing for the intro (-1 otherwise). */
  get introT(): number {
    return this.state === 'fill' ? this.t : -1;
  }
  get inIntro(): boolean {
    return this.state === 'drop' || this.state === 'fill';
  }
  get phase2(): boolean {
    return this.hp <= this.maxHp / 2;
  }
  /** Can be damaged right now. */
  get vulnerable(): boolean {
    return this.state === 'fight' && this.invuln === 0 && !this.untouchable() && !this.blocksShots();
  }
  /** Touching it hurts. */
  get harmful(): boolean {
    return this.state === 'fight' && !this.untouchable();
  }

  /**
   * Override: a world y below which the boss is behind cover (shots that low
   * bounce off it instead of hitting). null = no cover.
   */
  coverTop(): number | null {
    return null;
  }

  /** Override: shots bounce off instead of passing through (e.g. a shield). */
  blocksShots(): boolean {
    return false;
  }

  /** Override for phases where the boss can't be touched or hit (e.g. vanished). */
  protected untouchable(): boolean {
    return false;
  }

  protected abstract think(): void;
  protected abstract pose(): string;
  /** Called once when the fight starts. */
  protected begin(): void {}

  /**
   * The pose struck while the health bar fills (after a beat of standing
   * still): each boss shows off its attack stance. Default: its normal pose.
   */
  protected introPose(): string {
    return this.pose();
  }

  /** Frames into the health-bar fill when the boss strikes its intro pose. */
  static readonly INTRO_POSE_AT = 24;

  /** Striking the intro pose right now. */
  protected get posing(): boolean {
    return this.state === 'fill' && this.t >= Boss.INTRO_POSE_AT;
  }

  protected facePlayer(): void {
    this.facing = this.g.player.cx < this.cx ? -1 : 1;
  }

  /** Gravity + tile collision. */
  protected physics(): { wall: boolean; landed: boolean } {
    const L = this.g.level;
    this.vy = Math.min(this.vy + PHYS.gravity, PHYS.maxFall);
    let wall = moveX(L, this, this.vx);
    // The arena edges act as walls.
    if (this.x < this.room.left) {
      this.x = this.room.left;
      wall = true;
    } else if (this.x + this.w > this.room.right) {
      this.x = this.room.right - this.w;
      wall = true;
    }
    const falling = this.vy > 0;
    const hit = moveY(L, this, this.vy, false);
    const was = this.grounded;
    this.grounded = hit && falling;
    if (hit) this.vy = 0;
    return { wall, landed: this.grounded && !was };
  }

  hit(dmg: number, weak: boolean): void {
    // EX bosses are tougher: hits do about 40% less (at least 1).
    if (this.ex) dmg = Math.max(1, Math.round(dmg * 0.6));
    this.hp = Math.max(0, this.hp - dmg);
    this.barHp = this.hp;
    // A short window where shots pass through, so a rapid triple shot can't land every bullet.
    this.invuln = weak ? 32 : 20;
    this.flash = this.invuln;
    if (this.hp === 0) {
      this.state = 'dying';
      this.vx = this.vy = 0;
      this.alpha = 1;
    }
  }

  step(): void {
    this.t++;
    if (this.invuln > 0) this.invuln--;
    if (this.flash > 0) this.flash--;
    switch (this.state) {
      case 'drop':
        this.facePlayer();
        if (this.physics().landed) {
          this.g.shake(6);
          this.state = 'fill';
          this.t = 0;
        }
        break;
      case 'fill':
        if (this.t === Boss.INTRO_POSE_AT) {
          // Intro pose: a white flash and a thump.
          this.flash = 6;
          this.g.shake(2);
          sfx.charge(2);
        }
        if (this.t >= this.fillDelay && this.t % 3 === 0 && this.barHp < this.maxHp) {
          this.barHp++;
          sfx.tick();
        }
        if (this.barHp >= this.maxHp && this.t > Boss.INTRO_POSE_AT + 30 && this.t >= this.introHold) {
          this.state = 'fight';
          this.t = 0;
          this.begin();
        }
        break;
      case 'fight':
        this.think();
        break;
      case 'dying':
        break;
    }
  }

  render(): void {
    this.sprite.setTexture(`${this.texKey}_${this.posing ? this.introPose() : this.pose()}`);
    this.sprite.setFlipX(this.facing < 0);
    this.sprite.setPosition(Math.round(this.cx), Math.round(this.bottom));
    this.sprite.setAlpha(this.alpha);
    if (this.flash > 0 && this.flash % 4 < 2) this.sprite.setTintFill(0xffffff);
    else if (this.telegraph()) this.sprite.setTintFill(0xffffff);
    else this.sprite.clearTint();
  }

  /** Override to flash the boss as a warning before an attack. */
  protected telegraph(): boolean {
    return false;
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
