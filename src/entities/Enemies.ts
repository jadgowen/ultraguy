import Phaser from 'phaser';
import { PHYS, TILE } from '../constants';
import type { EnemyKind, Spawn } from '../level/Level';
import { moveX, moveY } from '../physics';
import { sfx } from '../sfx';
import type { WeaponId } from '../weapons';
import type { GameScene } from '../scenes/GameScene';

export abstract class Enemy {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  hp = 1;
  dmg = 3; // contact damage
  flash = 0;
  /** Frames left frozen by the Frost Spike: no movement, no contact damage. */
  frozen = 0;
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

  /** Whether touching it hurts. */
  harmful(): boolean {
    return this.frozen === 0;
  }

  step(): void {
    if (this.flash > 0) this.flash--;
    if (this.frozen > 0) {
      this.frozen--;
      return;
    }
    this.t++;
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

  /** Turn around at the edge of a floor. */
  protected turnAtLedge(): void {
    if (!this.grounded) return;
    const frontX = this.vx > 0 ? this.x + this.w + 1 : this.x - 1;
    const row = Math.floor((this.y + this.h + 1) / TILE);
    if (!this.g.level.isFloor(Math.floor(frontX / TILE), row)) this.vx = -this.vx;
  }

  render(): void {
    this.sprite.setPosition(Math.round(this.cx), Math.round(this.y + this.h));
    if (this.flash > 0 && this.flash % 4 < 2) this.sprite.setTintFill(0xffffff);
    else if (this.frozen > 0) this.sprite.setTint(0x88ccff);
    else this.sprite.clearTint();
  }

  destroy(): void {
    this.sprite.destroy();
  }
}

// --- foundry ---------------------------------------------------------------------

/** Walks toward the player at spawn, turning at walls and ledges. */
class Walker extends Enemy {
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 14, 16, 'walker0');
    this.vx = 0.6 * this.towardPlayer();
  }
  protected update(): void {
    if (this.physics()) this.vx = -this.vx;
    this.turnAtLedge();
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

// --- jungle ----------------------------------------------------------------------

/**
 * Camouflaged lizard: nearly invisible (and immune) until you get close, then
 * it reveals itself, lunges and chases you along the ground.
 */
class Lurker extends Enemy {
  private hidden = true;
  private reveal = 0;
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 16, 12, 'lurker0');
    this.hp = 2;
  }
  shielded(): boolean {
    return this.hidden;
  }
  harmful(): boolean {
    return !this.hidden && super.harmful();
  }
  protected update(): void {
    if (this.hidden) {
      this.physics();
      if (Math.abs(this.g.player.cx - this.cx) < 72 && Math.abs(this.g.player.cy - this.cy) < 64) {
        this.hidden = false;
        this.reveal = 20;
      }
    } else if (this.reveal > 0) {
      if (--this.reveal === 0) {
        this.vx = 1.4 * this.towardPlayer();
        this.vy = -3.5;
      }
      this.physics();
    } else {
      if (this.grounded && Math.abs(this.vx) > 0.8) this.vx = Math.sign(this.vx) * 0.8;
      if (this.physics()) this.vx = -this.vx;
      this.turnAtLedge();
    }
    this.sprite.setTexture(`lurker${Math.floor(this.t / 8) % 2}`);
    this.sprite.setFlipX((this.vx || this.towardPlayer()) < 0);
  }
  render(): void {
    super.render();
    // Shimmer while camouflaged; flash during the reveal.
    const alpha = this.hidden ? 0.12 + 0.06 * Math.sin(this.t * 0.2) : this.reveal > 0 && this.reveal % 4 < 2 ? 0.5 : 1;
    this.sprite.setAlpha(alpha);
  }
}

/** Plant that opens up and lobs seeds in an arc at the player. */
class Spitter extends Enemy {
  private timer = 30;
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 14, 16, 'spitter0');
    this.hp = 3;
  }
  protected update(): void {
    this.timer++;
    const p = this.g.player;
    const near = Math.abs(p.cx - this.cx) < 170;
    const open = this.timer > 90 && this.timer < 120;
    if (near && this.timer === 104) {
      // Fixed upward speed; pick vx so the seed comes down near the player.
      const vy = -4;
      const airtime = (2 * -vy) / PHYS.gravity + 6;
      const vx = Phaser.Math.Clamp((p.cx - this.cx) / airtime, -2.2, 2.2);
      this.g.spawnEnemyShot({ x: this.cx - 3, y: this.y, w: 6, h: 6, vx, vy, tex: 'seed', dmg: 3, gravity: true });
      sfx.enemyShot();
    }
    if (this.timer >= 130) this.timer = 0;
    this.sprite.setTexture(open ? 'spitter1' : 'spitter0');
  }
}

// --- ice -------------------------------------------------------------------------

/** Penguin-bot that skates straight at you and rebounds off walls. */
class Slider extends Enemy {
  private wait = 20;
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 14, 14, 'slider0');
    this.hp = 2;
  }
  protected update(): void {
    if (this.wait > 0) {
      this.wait--;
      if (this.wait === 0) this.vx = 2.2 * this.towardPlayer();
      this.physics();
    } else if (this.physics()) {
      this.vx = -this.vx;
      sfx.land();
    }
    this.sprite.setTexture(`slider${Math.floor(this.t / 6) % 2}`);
    if (this.vx !== 0) this.sprite.setFlipX(this.vx < 0);
  }
}

/** Hangs from the ceiling; shakes and drops when you pass underneath. */
class Icicle extends Enemy {
  private state: 'hang' | 'shake' | 'fall' = 'hang';
  private shake = 0;
  private readonly hangX: number;
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 8, 14, 'icicle');
    // Hang from the top of the tile the marker sits in.
    this.y = s.y - TILE;
    this.hangX = this.x;
    this.dmg = 4;
  }
  protected update(): void {
    const p = this.g.player;
    if (this.state === 'hang') {
      if (Math.abs(p.cx - this.cx) < 28 && p.cy > this.cy) {
        this.state = 'shake';
        this.shake = 20;
      }
    } else if (this.state === 'shake') {
      this.x = this.hangX + (this.shake % 4 < 2 ? 1 : -1);
      if (--this.shake === 0) {
        this.x = this.hangX;
        this.state = 'fall';
      }
    } else {
      this.vy = Math.min(this.vy + PHYS.gravity, PHYS.maxFall);
      if (moveY(this.g.level, this, this.vy, false)) {
        this.hp = 0; // shatters on the floor
        this.g.burst(this.cx, this.y + this.h, 'spark', 6);
        sfx.deflect();
      }
    }
  }
}

// --- sky -------------------------------------------------------------------------

/** Flies straight across high up and drops an egg when it passes over you. */
class Bomber extends Enemy {
  private dropped = false;
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 16, 10, 'bomber0');
    this.y = s.y - TILE / 2 - this.h / 2;
    this.vx = 1.3 * this.towardPlayer();
  }
  protected update(): void {
    this.x += this.vx;
    const p = this.g.player;
    // Lead the target a little so the egg lands where you're going.
    if (!this.dropped && Math.abs(p.cx + p.vx * 20 - this.cx) < 10 && p.cy > this.cy) {
      this.dropped = true;
      this.g.spawnEnemyShot({ x: this.cx - 3, y: this.y + this.h, w: 6, h: 8, vx: this.vx * 0.3, vy: 0, tex: 'egg', dmg: 3, gravity: true });
    }
    this.sprite.setTexture(`bomber${Math.floor(this.t / 8) % 2}`);
    this.sprite.setFlipX(this.vx < 0);
  }
}

/** Rides a little cloud above you and throws lightning straight down. */
class Sparker extends Enemy {
  private timer = 40;
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 18, 16, 'sparker0');
    this.hp = 3;
    this.dmg = 2;
  }
  protected update(): void {
    const p = this.g.player;
    this.vx = Phaser.Math.Clamp((p.cx - this.cx) * 0.02, -0.7, 0.7);
    this.x += this.vx;
    this.y += Math.sin(this.t * 0.05) * 0.15;
    this.timer++;
    if (this.timer >= 110 && Math.abs(p.cx - this.cx) < 24) {
      this.timer = 0;
      this.g.spawnEnemyShot({ x: this.cx - 3, y: this.y + this.h, w: 6, h: 12, vx: 0, vy: 3.5, tex: 'bolt', dmg: 3 });
      sfx.enemyShot();
    }
    this.sprite.setTexture(this.timer < 12 ? 'sparker1' : 'sparker0');
  }
}

export function createEnemy(g: GameScene, s: Spawn): Enemy {
  const ctor: Record<EnemyKind, new (g: GameScene, s: Spawn) => Enemy> = {
    walker: Walker,
    hopper: Hopper,
    flyer: Flyer,
    turret: Turret,
    lurker: Lurker,
    spitter: Spitter,
    slider: Slider,
    icicle: Icicle,
    bomber: Bomber,
    sparker: Sparker,
  };
  return new ctor[s.kind](g, s);
}

/** Simple moving box used for player bullets, enemy shots and pickups. */
export class Projectile {
  dead = false;
  deflected = false;
  life = 0;
  dmg = 2; // damage to the player (enemy shots)
  stopAtWalls = false; // most shots pass through walls; ground waves don't
  diesOnSolid = false; // lobbed shots break when they hit the ground
  /** Sprite rotation per step (radians), for spinning shots. */
  spin = 0;
  /** Acceleration per step (gravity, boomerang pull). */
  ax = 0;
  ay = 0;
  /** Remove after this many steps (0 = only when off screen). */
  maxLife = 0;
  // Player weapon shots:
  weapon: WeaponId = 'buster';
  power = 1; // damage to enemies
  /** Charge level for Ultra Gun shots (0 = normal). */
  charge = 0;
  pierce = false; // keeps going after a hit (hits each target once)
  ignoresShield = false;
  hasGravity = false;
  readonly hitTargets = new Set<object>();
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
    this.sprite = scene.add.image(0, 0, tex).setOrigin(0.5).setDepth(8);
  }

  get cx(): number {
    return this.x + this.w / 2;
  }
  get cy(): number {
    return this.y + this.h / 2;
  }

  step(): void {
    this.x += this.vx;
    this.y += this.vy;
    this.life++;
  }

  deflect(): void {
    this.deflected = true;
    this.vx = -Math.sign(this.vx || 1) * 3;
    this.vy = -3;
  }

  render(): void {
    this.sprite.setPosition(Math.round(this.cx), Math.round(this.cy));
    if (this.spin) this.sprite.rotation += this.spin;
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
