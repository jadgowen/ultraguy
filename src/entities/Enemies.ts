import Phaser from 'phaser';
import { PHYS, TILE } from '../constants';
import type { EnemyKind, Spawn } from '../level/Level';
import { moveX, moveY } from '../physics';
import { sfx } from '../sfx';
import type { GameScene } from '../scenes/GameScene';

export abstract class Enemy {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  hp = 1;
  dmg = 3; // contact damage
  flash = 0;
  t = 0;
  grounded = false;
  readonly sprite: Phaser.GameObjects.Image;

  constructor(
    protected g: GameScene,
    readonly spawn: Spawn,
    readonly w: number,
    readonly h: number,
    tex: string,
  ) {
    this.x = spawn.x - w / 2;
    this.y = spawn.y - h;
    this.sprite = g.add.image(0, 0, tex).setOrigin(0.5, 1).setDepth(5);
  }

  get cx(): number {
    return this.x + this.w / 2;
  }
  get cy(): number {
    return this.y + this.h / 2;
  }

  /** Shielded enemies deflect player shots. */
  shielded(): boolean {
    return false;
  }

  step(): void {
    this.t++;
    if (this.flash > 0) this.flash--;
    this.update();
  }

  protected abstract update(): void;

  protected towardPlayer(): 1 | -1 {
    return this.g.player.cx < this.cx ? -1 : 1;
  }

  /** Gravity + tile collision. Returns true if blocked horizontally. */
  protected physics(): boolean {
    const L = this.g.level;
    this.vy = Math.min(this.vy + PHYS.gravity, PHYS.maxFall);
    const wall = moveX(L, this, this.vx);
    const falling = this.vy > 0;
    const hit = moveY(L, this, this.vy, true);
    this.grounded = hit && falling;
    if (hit) this.vy = 0;
    return wall;
  }

  render(): void {
    this.sprite.setPosition(Math.round(this.cx), Math.round(this.y + this.h));
    if (this.flash > 0 && this.flash % 4 < 2) this.sprite.setTintFill(0xffffff);
    else this.sprite.clearTint();
  }

  destroy(): void {
    this.sprite.destroy();
  }
}

/** Walks toward the player at spawn, turning at walls and ledges. */
class Walker extends Enemy {
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 14, 16, 'walker0');
    this.vx = 0.6 * this.towardPlayer();
  }
  protected update(): void {
    if (this.physics()) this.vx = -this.vx;
    if (this.grounded) {
      const frontX = this.vx > 0 ? this.x + this.w + 1 : this.x - 1;
      const row = Math.floor((this.y + this.h + 1) / TILE);
      if (!this.g.level.isFloor(Math.floor(frontX / TILE), row)) this.vx = -this.vx;
    }
    this.sprite.setTexture(`walker${Math.floor(this.t / 10) % 2}`);
    this.sprite.setFlipX(this.vx < 0);
  }
}

/** Sits, then hops at the player. */
class Hopper extends Enemy {
  private wait = 30;
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 14, 14, 'hopper0');
    this.hp = 2;
    this.dmg = 4;
  }
  protected update(): void {
    if (this.grounded) {
      this.vx = 0;
      if (--this.wait <= 0) {
        this.vx = 1.1 * this.towardPlayer();
        this.vy = -4.2;
        this.grounded = false;
        this.wait = 50;
      }
    }
    if (this.physics()) this.vx = 0;
    this.sprite.setTexture(this.grounded ? 'hopper0' : 'hopper1');
  }
}

/** Flies across the screen in a wave, drifting toward the player's height. */
class Flyer extends Enemy {
  private baseY: number;
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 14, 10, 'flyer0');
    this.y = s.y - TILE / 2 - this.h / 2;
    this.baseY = this.y;
    this.vx = 0.8 * this.towardPlayer();
  }
  protected update(): void {
    this.x += this.vx;
    const target = this.g.player.cy - this.h / 2;
    this.baseY += Math.sign(target - this.baseY) * 0.25;
    this.y = this.baseY + Math.sin(this.t * 0.08) * 12;
    this.sprite.setTexture(`flyer${Math.floor(this.t / 6) % 2}`);
  }
}

/** Shielded while closed; opens to fire an aimed shot. */
class Turret extends Enemy {
  private open = false;
  private timer = 40;
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 14, 14, 'turret0');
    this.hp = 3;
    this.dmg = 2;
  }
  shielded(): boolean {
    return !this.open;
  }
  protected update(): void {
    this.timer++;
    const near = Math.abs(this.g.player.cx - this.cx) < 180;
    if (!this.open && near && this.timer >= 80) {
      this.open = true;
      this.timer = 0;
    } else if (this.open) {
      if (this.timer === 16) {
        const p = this.g.player;
        const a = Math.atan2(p.cy - this.cy, p.cx - this.cx);
        this.g.fireEnemyShot(this.cx, this.y + 6, Math.cos(a) * 1.6, Math.sin(a) * 1.6);
        sfx.enemyShot();
      }
      if (this.timer >= 44) {
        this.open = false;
        this.timer = 0;
      }
    }
    this.sprite.setTexture(this.open ? 'turret1' : 'turret0');
  }
}

export function createEnemy(g: GameScene, s: Spawn): Enemy {
  const ctor: Record<EnemyKind, new (g: GameScene, s: Spawn) => Enemy> = {
    walker: Walker,
    hopper: Hopper,
    flyer: Flyer,
    turret: Turret,
  };
  return new ctor[s.kind](g, s);
}

/** Simple moving box used for player bullets, enemy shots and pickups. */
export class Projectile {
  dead = false;
  deflected = false;
  life = 0;
  readonly sprite: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    public x: number,
    public y: number,
    readonly w: number,
    readonly h: number,
    public vx: number,
    public vy: number,
    tex: string,
  ) {
    this.sprite = scene.add.image(0, 0, tex).setOrigin(0).setDepth(8);
  }

  step(): void {
    this.x += this.vx;
    this.y += this.vy;
    this.life++;
  }

  deflect(): void {
    this.deflected = true;
    this.vx = -Math.sign(this.vx) * 3;
    this.vy = -3;
  }

  render(): void {
    this.sprite.setPosition(Math.round(this.x), Math.round(this.y));
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
