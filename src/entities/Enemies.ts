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

// --- power plant -------------------------------------------------------------------

/** Tesla coil: charges up (glows), then throws arcs both ways along the floor. */
class Zapper extends Enemy {
  private timer = 40;
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 14, 16, 'zapper0');
    this.hp = 3;
  }
  protected update(): void {
    this.timer++;
    const charging = this.timer > 90;
    if (this.timer === 120) {
      for (const dir of [-1, 1]) {
        this.g.spawnEnemyShot({ x: this.cx - 5, y: this.y + 6, w: 10, h: 6, vx: dir * 2.4, vy: 0, tex: 'arc', dmg: 3, life: 60 });
      }
      sfx.zap();
      this.timer = 0;
    }
    this.sprite.setTexture(charging && this.timer % 4 < 2 ? 'zapper1' : 'zapper0');
  }
}

/** Steel ball: waits, then rolls at you, gathering speed and bouncing off walls. */
class Roller extends Enemy {
  private rolling = false;
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 14, 14, 'roller0');
    this.hp = 2;
  }
  protected update(): void {
    if (!this.rolling && Math.abs(this.g.player.cx - this.cx) < 150) {
      this.rolling = true;
      this.vx = 0.4 * this.towardPlayer();
    }
    if (this.rolling && Math.abs(this.vx) < 2.4) this.vx += Math.sign(this.vx) * 0.04;
    if (this.physics()) this.vx = -this.vx * 0.8;
  }
  render(): void {
    super.render();
    this.sprite.setOrigin(0.5, 0.5).setPosition(Math.round(this.cx), Math.round(this.cy));
    this.sprite.rotation += this.vx * 0.15;
  }
}

// --- caldera -----------------------------------------------------------------------

/** Fireball that hides in the lava and leaps out at intervals. Can't be destroyed. */
class Ember extends Enemy {
  private wait = 30;
  private homeY: number;
  private airborne = false;
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 12, 12, 'ember0');
    this.homeY = this.y;
    this.dmg = 3;
  }
  shielded(): boolean {
    return true;
  }
  harmful(): boolean {
    return this.airborne;
  }
  protected update(): void {
    if (!this.airborne) {
      if (--this.wait <= 0) {
        this.airborne = true;
        this.vy = -6;
      }
    } else {
      this.vy = Math.min(this.vy + PHYS.gravity, PHYS.maxFall);
      this.y += this.vy;
      if (this.y >= this.homeY && this.vy > 0) {
        this.y = this.homeY;
        this.airborne = false;
        this.wait = 70 + Math.floor(Math.random() * 40);
      }
    }
    this.sprite.setTexture(`ember${Math.floor(this.t / 4) % 2}`);
    this.sprite.setFlipY(this.vy > 0);
  }
  render(): void {
    super.render();
    this.sprite.setVisible(this.airborne);
  }
}

/** Slow, tough magma slug. */
class Slug extends Enemy {
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 18, 10, 'slug0');
    this.hp = 4;
    this.dmg = 4;
    this.vx = 0.35 * this.towardPlayer();
  }
  protected update(): void {
    if (this.physics()) this.vx = -this.vx;
    this.turnAtLedge();
    this.sprite.setTexture(`slug${Math.floor(this.t / 14) % 2}`);
    this.sprite.setFlipX(this.vx < 0);
  }
}

// --- scrapyard ---------------------------------------------------------------------

/** Rolling saw blade: runs along floors, reverses at walls, drops off ledges. */
class Grinder extends Enemy {
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 14, 14, 'grinder');
    this.hp = 3;
    this.vx = 1.4 * this.towardPlayer();
  }
  protected update(): void {
    if (this.physics()) this.vx = -this.vx;
  }
  render(): void {
    super.render();
    this.sprite.setOrigin(0.5, 0.5).setPosition(Math.round(this.cx), Math.round(this.cy));
    this.sprite.rotation += this.vx * 0.25;
  }
}

/** Junk robot that shuffles toward you and lobs scrap. */
class Junkbot extends Enemy {
  private timer = 30;
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 16, 18, 'junkbot0');
    this.hp = 4;
  }
  protected update(): void {
    const p = this.g.player;
    this.timer++;
    this.vx = this.timer > 70 ? 0 : 0.3 * this.towardPlayer();
    this.physics();
    this.turnAtLedge();
    if (this.timer === 90 && Math.abs(p.cx - this.cx) < 180) {
      const vy = -4;
      const airtime = (2 * -vy) / PHYS.gravity;
      const vx = Phaser.Math.Clamp((p.cx - this.cx) / airtime, -2.4, 2.4);
      this.g.spawnEnemyShot({ x: this.cx - 4, y: this.y, w: 8, h: 8, vx, vy, tex: 'scrap', dmg: 3, gravity: true, spin: 0.3 });
      sfx.enemyShot();
    }
    if (this.timer >= 110) this.timer = 0;
    this.sprite.setTexture(this.timer > 80 && this.timer < 96 ? 'junkbot1' : 'junkbot0');
    this.sprite.setFlipX(this.towardPlayer() < 0);
  }
}

// --- reef --------------------------------------------------------------------------

/** Pufferfish that drifts toward you and puffs up when close. */
class Puffer extends Enemy {
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 14, 12, 'puffer0');
    this.hp = 2;
    this.y = s.y - TILE / 2 - this.h / 2;
  }
  protected update(): void {
    const p = this.g.player;
    const dx = p.cx - this.cx;
    const dy = p.cy - this.cy;
    const d = Math.max(1, Math.hypot(dx, dy));
    this.x += (dx / d) * 0.5;
    this.y += (dy / d) * 0.5 + Math.sin(this.t * 0.1) * 0.2;
    this.sprite.setTexture(d < 48 ? 'puffer1' : 'puffer0');
    this.sprite.setFlipX(dx < 0);
  }
}

/** Clam: shielded while shut; opens to spit three pearls. */
class Clam extends Enemy {
  private timer = 30;
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 16, 12, 'clam0');
    this.hp = 3;
  }
  shielded(): boolean {
    return this.timer < 80;
  }
  protected update(): void {
    this.timer++;
    if (this.timer === 96) {
      for (const vx of [-1.4, 0, 1.4]) {
        this.g.spawnEnemyShot({ x: this.cx - 3, y: this.y, w: 6, h: 6, vx, vy: -3.2, tex: 'pearl', dmg: 2, gravity: true });
      }
      sfx.bubble();
    }
    if (this.timer >= 130) this.timer = 0;
    this.sprite.setTexture(this.timer >= 80 ? 'clam1' : 'clam0');
  }
}

// --- dojo ----------------------------------------------------------------------

/** A training dummy: stands there, can't be beaten, never hurts. */
class Dummy extends Enemy {
  constructor(g: GameScene, s: Spawn, tex = 'dummy') {
    super(g, s, 16, 26, tex);
    this.hp = 1e9;
  }
  harmful(): boolean {
    return false;
  }
  protected update(): void {
    this.hp = 1e9;
    this.physics();
  }
}

/** A dummy behind a shield on its right side: shots from that side bounce off. */
class ShieldDummy extends Dummy {
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 'dummy_shield');
  }
  shielded(): boolean {
    return this.g.player.cx > this.cx;
  }
}

/** A floating target that drifts up and down. */
class AirDummy extends Enemy {
  private y0: number;
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 14, 14, 'dummy_air');
    this.hp = 1e9;
    this.y0 = this.y;
  }
  harmful(): boolean {
    return false;
  }
  protected update(): void {
    this.hp = 1e9;
    this.y = this.y0 + Math.sin(this.t / 40) * 14;
  }
}

// --- signature enemies (one per stage) -----------------------------------------

/** FOUNDRY: stomps toward you, raises its hammer (flashing), slams shockwaves both ways. */
class Hammerbot extends Enemy {
  private windup = 0;
  private rest = 60;
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 16, 20, 'hammerbot0');
    this.hp = 4;
  }
  protected update(): void {
    const near = Math.abs(this.g.player.cx - this.cx) < 60;
    if (this.windup > 0) {
      this.vx = 0;
      if (--this.windup === 0) {
        this.g.fireGroundWave(this.cx - 10, this.y + this.h, -1);
        this.g.fireGroundWave(this.cx + 2, this.y + this.h, 1);
        this.g.shake(2);
        sfx.land();
        this.rest = 80;
      }
    } else {
      if (this.rest > 0) this.rest--;
      this.vx = this.rest > 40 ? 0 : 0.5 * this.towardPlayer();
      if (near && this.grounded && this.rest === 0) this.windup = 30;
    }
    if (this.physics()) this.vx = 0;
    this.turnAtLedge();
    this.sprite.setTexture(this.windup > 0 ? 'hammerbot1' : 'hammerbot0').setFlipX(this.towardPlayer() < 0);
  }
  render(): void {
    super.render();
    if (this.windup > 0 && this.windup % 6 < 3) this.sprite.setTintFill(0xffffff);
  }
}

/** CANOPY: a bud in the ground (shots bounce off) that bursts open when you're close and spits seeds. */
class Snapper extends Enemy {
  private openT = 0;
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 14, 18, 'snapper0');
    this.hp = 3;
  }
  shielded(): boolean {
    return this.openT === 0;
  }
  harmful(): boolean {
    return this.openT > 0 && super.harmful();
  }
  protected update(): void {
    this.physics();
    const near = Math.abs(this.g.player.cx - this.cx) < 56;
    if (this.openT === 0 && near && this.t % 20 === 0) this.openT = 90;
    if (this.openT > 0) {
      this.openT--;
      if (this.openT === 70 || this.openT === 40) {
        for (const vx of [-1.4, 1.4]) this.g.spawnEnemyShot({ x: this.cx - 3, y: this.y, w: 6, h: 6, vx, vy: -4, tex: 'seed', dmg: 3, gravity: true });
        sfx.enemyShot();
      }
    }
    this.sprite.setTexture(this.openT > 0 ? 'snapper1' : 'snapper0');
  }
}

/** GLACIER: a snowball that rolls at you, growing and speeding up; it shatters on walls. */
class SnowRoller extends Enemy {
  private dir: 1 | -1;
  private speed = 0.6;
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 14, 14, 'snowball0');
    this.hp = 2;
    this.dir = this.towardPlayer();
  }
  protected update(): void {
    this.speed = Math.min(2.6, this.speed + 0.012);
    this.vx = this.dir * this.speed;
    if (this.physics()) {
      // Shatters against a wall.
      this.g.burst(this.cx, this.cy, 'spark', 8);
      sfx.crumble();
      this.hp = 0;
      return;
    }
    const k = 1 + Math.min(0.6, this.t / 300);
    this.sprite.setScale(k).setTexture(`snowball${Math.floor(this.t / 6) % 2}`).setFlipX(this.dir < 0);
  }
}

/** STRATOS: a hovering fan that blows you backward when you're in front of it. */
class GustFan extends Enemy {
  private y0: number;
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 18, 14, 'gustfan0');
    this.hp = 3;
    this.y0 = this.y;
  }
  protected update(): void {
    this.y = this.y0 + Math.sin(this.t / 30) * 6;
    const p = this.g.player;
    const dir = this.towardPlayer();
    const inFront = Math.abs(p.cx - this.cx) < 150 && Math.abs(p.cy - this.cy) < 40;
    if (inFront && Math.floor(this.t / 120) % 2 === 0) {
      this.g.enemyWind += dir * 0.75;
      if (this.t % 4 === 0) this.g.windStreak(dir);
      if (this.t % 30 === 0) sfx.wind();
    }
    this.sprite.setTexture(`gustfan${Math.floor(this.t / 3) % 2}`).setFlipX(dir < 0);
  }
}

/** POWER PLANT: a pylon that charges (glowing) and fires a ring of sparks. */
class TeslaCoil extends Enemy {
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 12, 26, 'tesla0');
    this.hp = 5;
  }
  protected update(): void {
    this.physics();
    const c = this.t % 150;
    const charging = c > 100;
    if (c === 149) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.26;
        this.g.spawnEnemyShot({ x: this.cx - 4, y: this.y + 2, w: 8, h: 8, vx: Math.cos(a) * 1.7, vy: Math.sin(a) * 1.7, tex: 'vorb', dmg: 3, life: 120 });
      }
      sfx.zap();
    }
    if (charging && this.t % 6 === 0) this.g.burst(this.cx, this.y + 4, 'spark', 1);
    this.sprite.setTexture(charging && this.t % 4 < 2 ? 'tesla1' : 'tesla0');
  }
}

/** CALDERA: a molten blob that springs high at you, then rests. */
class LavaLeaper extends Enemy {
  private wait = 50;
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 14, 12, 'leaper0');
    this.hp = 2;
  }
  protected update(): void {
    if (this.grounded) {
      this.vx = 0;
      if (--this.wait <= 0) {
        this.vy = -6.8;
        this.vx = Phaser.Math.Clamp((this.g.player.cx - this.cx) / 60, -1.6, 1.6);
        this.wait = 90;
        sfx.flame();
      }
    } else if (this.t % 4 === 0) this.g.burst(this.cx, this.y + this.h, 'shard', 1);
    this.physics();
    this.sprite.setTexture(this.grounded ? 'leaper0' : 'leaper1');
  }
}

/** SCRAPYARD: hovers above, tugs you underneath it and drops scrap. */
class MagnetDrone extends Enemy {
  private hoverY: number;
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 18, 14, 'magdrone0');
    this.hp = 3;
    this.hoverY = this.y;
  }
  protected update(): void {
    const p = this.g.player;
    this.x += Phaser.Math.Clamp(p.cx - this.cx, -0.7, 0.7);
    this.y = this.hoverY + Math.sin(this.t / 25) * 4;
    const pulling = Math.abs(p.cx - this.cx) < 90 && p.y > this.y && Math.floor(this.t / 90) % 2 === 1;
    if (pulling) this.g.enemyWind += Math.sign(this.cx - p.cx) * 0.6;
    if (this.t % 80 === 40 && Math.abs(p.cx - this.cx) < 30) {
      this.g.spawnEnemyShot({ x: this.cx - 4, y: this.y + this.h, w: 8, h: 8, vx: 0, vy: 1, tex: 'scrap', dmg: 3, gravity: true, spin: 0.2 });
      sfx.thorn();
    }
    this.sprite.setTexture(pulling ? 'magdrone1' : 'magdrone0');
  }
}

/** REEF: drifts up and down, zapping straight down when you pass underneath. */
class Jelly extends Enemy {
  private y0: number;
  private cool = 0;
  constructor(g: GameScene, s: Spawn) {
    super(g, s, 14, 18, 'jelly0');
    this.hp = 2;
    this.y0 = this.y;
  }
  protected update(): void {
    this.y = this.y0 + Math.sin(this.t / 50) * 18;
    if (this.cool > 0) this.cool--;
    const p = this.g.player;
    if (this.cool === 0 && Math.abs(p.cx - this.cx) < 14 && p.y > this.y) {
      this.g.spawnEnemyShot({ x: this.cx - 3, y: this.y + this.h, w: 6, h: 12, vx: 0, vy: 3.5, tex: 'bolt', dmg: 3, life: 60 });
      sfx.zap();
      this.cool = 90;
    }
    this.sprite.setTexture(`jelly${Math.floor(this.t / 20) % 2}`);
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
    zapper: Zapper,
    roller: Roller,
    ember: Ember,
    slug: Slug,
    grinder: Grinder,
    junkbot: Junkbot,
    puffer: Puffer,
    clam: Clam,
    dummy: Dummy,
    shieldDummy: ShieldDummy,
    airDummy: AirDummy,
    hammerbot: Hammerbot,
    snapper: Snapper,
    snowRoller: SnowRoller,
    gustFan: GustFan,
    teslaCoil: TeslaCoil,
    lavaLeaper: LavaLeaper,
    magnetDrone: MagnetDrone,
    jelly: Jelly,
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
  rolls = false; // falls, then rolls along the floor until it hits a wall
  bounces = false; // falls and bounces along the floor (and off walls)
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
  /** Weapon-specific state (spark ring: 0 orbiting / 1 thrown; flame: facing). */
  state = 0;
  pierce = false; // keeps going after a hit (hits each target once)
  pip = false; // one of Pip's shots (hits enemies, not bosses)
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
