import Phaser from 'phaser';
import type { GuardianKind, MiniKind, Point } from '../../level/Level';
import { sfx } from '../../sfx';
import type { GameScene } from '../../scenes/GameScene';
import type { WeaponId } from '../../weapons';
import { Boss, Room } from './Boss';

/** Moves a miniboss can use. Each kind picks a few. */
type Move = 'hop' | 'stomp' | 'volley' | 'lob' | 'charge' | 'rain' | 'ring' | 'roll' | 'swoop' | 'dash' | 'spread' | 'slam';

interface MiniDef {
  name: string;
  w: number;
  h: number;
  hp: number;
  weakness: WeaponId | null;
  moves: Move[];
  /** Floats instead of walking (no gravity). */
  flies?: boolean;
  /** Projectile texture for volleys/lobs/rings. */
  shot: { tex: string; w: number; h: number };
}

/**
 * Minibosses guard the middle of each boss stage. Weaker than the stage
 * boss (MINI_HP) and weak to the same weapon as that boss.
 */
export const MINIBOSSES: Record<MiniKind, MiniDef> = {
  press: { name: 'PRESS TITAN', w: 38, h: 36, hp: 18, weakness: 'thorn', moves: ['stomp', 'volley', 'stomp'], shot: { tex: 'bshot', w: 6, h: 6 } },
  toad: { name: 'BRIAR TOAD', w: 38, h: 28, hp: 18, weakness: 'cyclone', moves: ['hop', 'lob', 'hop'], shot: { tex: 'seed', w: 6, h: 6 } },
  mammoth: { name: 'TUSK MAMMOTH', w: 42, h: 32, hp: 18, weakness: 'quake', moves: ['charge', 'rain', 'volley'], shot: { tex: 'iceshard', w: 6, h: 6 } },
  kite: { name: 'STORM KITE', w: 40, h: 20, hp: 16, weakness: 'frost', moves: ['rain', 'swoop', 'volley'], flies: true, shot: { tex: 'bolt', w: 6, h: 12 } },
  dynamo: { name: 'DYNAMO', w: 34, h: 36, hp: 18, weakness: 'saw', moves: ['ring', 'volley', 'hop'], shot: { tex: 'vorb', w: 8, h: 8 } },
  crab: { name: 'CINDER CRAB', w: 40, h: 26, hp: 18, weakness: 'bubble', moves: ['lob', 'charge', 'lob'], shot: { tex: 'fireball', w: 8, h: 8 } },
  crusher: { name: 'CRUSHER', w: 42, h: 30, hp: 20, weakness: 'flame', moves: ['charge', 'roll', 'volley'], shot: { tex: 'scrap', w: 8, h: 8 } },
  angler: { name: 'ANGLER', w: 38, h: 26, hp: 18, weakness: 'spark', moves: ['dash', 'volley', 'ring'], flies: true, shot: { tex: 'bbubble', w: 10, h: 10 } },
};

/**
 * Fortress guardians: full stage bosses (door, boss music, STAGE CLEAR) built
 * on the same move set, bigger and tougher, with the heavier moves.
 */
export const GUARDIANS: Record<GuardianKind, MiniDef> = {
  gatekeeper: { name: 'GATEKEEPER', w: 46, h: 44, hp: 28, weakness: 'spark', moves: ['stomp', 'spread', 'charge', 'volley'], shot: { tex: 'bshot', w: 6, h: 6 } },
  abyss: { name: 'ABYSS EYE', w: 40, h: 40, hp: 28, weakness: 'frost', moves: ['ring', 'spread', 'swoop', 'rain'], flies: true, shot: { tex: 'vorb', w: 8, h: 8 } },
  warden: { name: 'SPIRE WARDEN', w: 34, h: 50, hp: 28, weakness: 'cyclone', moves: ['slam', 'spread', 'roll', 'lob', 'slam'], shot: { tex: 'fireball', w: 8, h: 8 } },
};

/** One class for minibosses and guardians: a small set of moves, picked at random without repeats. */
export class Miniboss extends Boss {
  readonly def: MiniDef;
  private move: Move | 'idle' = 'idle';
  private wait = 30;
  private last: Move | null = null;
  private homeY: number;
  private dir: 1 | -1 = -1;
  /** Columns of thin ice already cracked by this charge. */
  private cracked = new Set<number>();

  constructor(g: GameScene, readonly mini: MiniKind | GuardianKind, at: Point, room: Room) {
    const def = mini in GUARDIANS ? GUARDIANS[mini as GuardianKind] : MINIBOSSES[mini as MiniKind];
    super(g, mini, def.w, def.h, def.weakness, at, room);
    this.def = def;
    this.hp = this.maxHp = def.hp;
    // Fliers hover at chest height (low enough to hit with a jumping shot).
    this.homeY = room.floor - def.h - 52;
  }

  get name(): string {
    return this.def.name;
  }

  /** A fortress guardian is the stage's boss, not a mid-stage fight. */
  get guardian(): boolean {
    return this.mini in GUARDIANS;
  }

  protected get texKey(): string {
    return this.mini;
  }

  private setMove(m: Move | 'idle', wait = 0): void {
    this.move = m;
    this.t = 0;
    this.wait = wait;
  }

  private shot(vx: number, vy: number, gravity = false, x = this.cx, y = this.y + 10): void {
    const s = this.def.shot;
    this.g.spawnEnemyShot({ x: x - s.w / 2, y: y - s.h / 2, w: s.w, h: s.h, vx, vy, tex: s.tex, dmg: 3, gravity });
  }

  /** Fliers bob around their home height; walkers use gravity. */
  private float(): { wall: boolean; landed: boolean } {
    if (!this.def.flies) return this.physics();
    const targetY = this.homeY + Math.sin(this.t * 0.06) * 6;
    this.vy = (targetY - this.y) * 0.08;
    this.x += this.vx;
    this.y += this.vy;
    let wall = false;
    if (this.x < this.room.left) {
      this.x = this.room.left;
      wall = true;
    } else if (this.x + this.w > this.room.right) {
      this.x = this.room.right - this.w;
      wall = true;
    }
    return { wall, landed: false };
  }

  step(): void {
    // Fliers drift down to their hover height instead of dropping in.
    if (this.def.flies && this.state === 'drop') {
      this.t++;
      this.facePlayer();
      this.y += 2;
      if (this.y >= this.homeY) {
        this.y = this.homeY;
        this.state = 'fill';
        this.t = 0;
      }
      return;
    }
    super.step();
  }

  protected think(): void {
    const p = this.g.player;
    const fast = this.phase2;
    switch (this.move) {
      case 'idle':
        this.vx = 0;
        this.facePlayer();
        this.float();
        if (--this.wait <= 0) this.choose();
        break;

      // Jump at the player; 'stomp' sends shockwaves both ways on landing.
      case 'hop':
      case 'stomp': {
        if (this.t === 1) {
          this.facePlayer();
          const big = this.move === 'stomp';
          this.vx = Phaser.Math.Clamp((p.cx - this.cx) / (big ? 50 : 30), -2.4, 2.4);
          this.vy = big ? -6.2 : -4.2;
          this.grounded = false;
        }
        const r = this.physics();
        if (r.wall) this.vx = 0;
        if (r.landed && this.t > 2) {
          this.vx = 0;
          this.g.shake(this.move === 'stomp' ? 5 : 2);
          sfx.land();
          if (this.move === 'stomp') {
            sfx.quake();
            this.g.fireGroundWave(this.cx - 4, this.room.floor, -1);
            this.g.fireGroundWave(this.cx - 4, this.room.floor, 1);
          }
          // Toads hop three times in a row.
          const again = this.move === 'hop' && this.t < 120 && Math.random() < 0.6;
          if (again) this.t = 0;
          else this.setMove('idle', fast ? 18 : 30);
        }
        break;
      }

      // Aimed shots.
      case 'volley': {
        this.float();
        const n = fast ? 4 : 3;
        if (this.t % 16 === 0 && this.t <= n * 16) {
          this.facePlayer();
          const a = Math.atan2(p.cy - (this.y + 10), p.cx - this.cx);
          this.shot(Math.cos(a) * 2.4, Math.sin(a) * 2.4);
          sfx.enemyShot();
        }
        if (this.t >= n * 16 + 24) this.setMove('idle', 30);
        break;
      }

      // Arcs landing around the player.
      case 'lob':
        this.float();
        if (this.t % 12 === 0 && this.t <= (fast ? 48 : 36)) {
          const airtime = 44;
          const vx = Phaser.Math.Clamp((p.cx - this.cx) / airtime + (Math.random() - 0.5) * 1.2, -3, 3);
          this.shot(vx, -5, true, this.cx, this.y + 4);
          sfx.enemyShot();
        }
        if (this.t >= 60) this.setMove('idle', 30);
        break;

      // Flash (telegraph), then rush to the wall.
      case 'charge':
        if (this.t < (fast ? 20 : 32)) {
          this.vx = 0;
          this.facePlayer();
          this.float();
          this.cracked.clear();
        } else {
          if (this.t === (fast ? 20 : 32)) this.vx = this.facing * (fast ? 3.6 : 3);
          // On thin ice: pull up short at a gap, and crack every slab charged over.
          const thin = !this.def.flies && this.g.level.thinIce.length > 0;
          const T = 16;
          const row = Math.floor((this.bottom + 1) / T);
          const front = this.vx > 0 ? this.x + this.w + this.vx + 2 : this.x + this.vx - 2;
          const gapAhead = thin && !this.g.level.isSolid(Math.floor(front / T), row);
          if (thin) {
            for (let c = Math.floor((this.x + 4) / T); c <= Math.floor((this.x + this.w - 4) / T); c++) {
              if (this.cracked.has(c)) continue;
              this.cracked.add(c);
              this.g.crackIce(c, c, row);
            }
          }
          if (gapAhead || this.float().wall) {
            this.g.shake(5);
            sfx.land();
            this.vx = 0;
            // Phase 2 on thin ice: the slam shakes two more slabs loose somewhere in the arena.
            if (thin && fast && !gapAhead) {
              const slabs = this.g.level.thinIce.filter((t) => t.c * T >= this.room.left && t.c * T < this.room.right && this.g.level.tileAt(t.c, t.r) !== 0);
              for (let i = 0; i < 2 && slabs.length; i++) {
                const s = slabs.splice(Math.floor(Math.random() * slabs.length), 1)[0];
                this.g.crackIce(s.c, s.c, s.r);
              }
            }
            this.setMove('idle', 34);
          }
        }
        break;

      // Shots falling from the ceiling, one on the player's position.
      case 'rain': {
        this.float();
        const count = fast ? 6 : 4;
        if (this.t % 14 === 0 && this.t <= count * 14) {
          const i = this.t / 14;
          const x = i === 1 ? p.cx : this.room.left + 20 + Math.random() * (this.room.right - this.room.left - 40);
          this.shot(0, 1.5, true, x, this.room.top + 4);
          sfx.enemyShot();
        }
        if (this.t >= count * 14 + 40) this.setMove('idle', 24);
        break;
      }

      // Burst of shots in every direction.
      case 'ring':
        this.float();
        if (this.t === 20 || (fast && this.t === 44)) {
          const n = 8;
          const off = this.t === 44 ? Math.PI / n : 0;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + off;
            this.shot(Math.cos(a) * 1.8, Math.sin(a) * 1.8, false, this.cx, this.cy);
          }
          sfx.zap();
        }
        if (this.t >= 70) this.setMove('idle', 30);
        break;

      // Rolling hazards along the floor.
      case 'roll':
        this.float();
        if (this.t % 30 === 10 && this.t < (fast ? 100 : 70)) {
          this.facePlayer();
          this.g.spawnEnemyShot({ x: this.cx - 7, y: this.room.floor - 14, w: 14, h: 14, vx: this.facing * 2.2, vy: 0, tex: 'sawshot', dmg: 3, rolls: true, spin: 0.3, life: 240 });
          sfx.enemyShot();
        }
        if (this.t >= 110) this.setMove('idle', 24);
        break;

      // Flier dives low across the room, then climbs back up.
      case 'swoop': {
        if (this.t === 1) {
          this.dir = p.cx < this.cx ? -1 : 1;
          this.facing = this.dir;
        }
        const k = Math.min(1, this.t / 90);
        this.vx = this.dir * (fast ? 3 : 2.4);
        this.x += this.vx;
        this.y = this.homeY + Math.sin(k * Math.PI) * 44;
        if (this.x < this.room.left || this.x + this.w > this.room.right) {
          this.x = Phaser.Math.Clamp(this.x, this.room.left, this.room.right - this.w);
          this.dir = -this.dir as 1 | -1;
          this.facing = this.dir;
        }
        if (this.t >= 90) this.setMove('idle', 30);
        break;
      }

      // Swimmer lines up with the player, then darts straight at them.
      case 'dash': {
        if (this.t < 30) {
          this.facePlayer();
          this.vx = 0;
          this.y += Phaser.Math.Clamp(p.cy - this.cy, -1.2, 1.2);
        } else {
          if (this.t === 30) this.vx = this.facing * (fast ? 4 : 3.2);
          this.x += this.vx;
          if (this.x < this.room.left || this.x + this.w > this.room.right) {
            this.x = Phaser.Math.Clamp(this.x, this.room.left, this.room.right - this.w);
            this.g.shake(3);
            this.vx = 0;
            this.setMove('idle', 30);
          }
        }
        break;
      }

      // Fan of five aimed shots (twice when hurt).
      case 'spread': {
        this.float();
        const volleys = fast ? [16, 46] : [16];
        if (volleys.includes(this.t)) {
          this.facePlayer();
          const a0 = Math.atan2(p.cy - (this.y + 12), p.cx - this.cx);
          for (let i = -2; i <= 2; i++) {
            const a = a0 + i * 0.26;
            this.shot(Math.cos(a) * 2.2, Math.sin(a) * 2.2, false, this.cx, this.y + 12);
          }
          sfx.enemyShot();
        }
        if (this.t >= volleys[volleys.length - 1] + 40) this.setMove('idle', 30);
        break;
      }

      // Leap above the player, hang for a beat, drop straight down; shockwaves on landing.
      case 'slam': {
        if (this.t === 1) {
          this.facePlayer();
          this.vx = Phaser.Math.Clamp((p.cx - this.cx) / 34, -3.4, 3.4);
          this.vy = -7;
          this.grounded = false;
          this.slamHang = 0;
        }
        if (this.slamHang === 0 && this.vy >= 0 && this.t > 2 && !this.grounded) this.slamHang = 1;
        if (this.slamHang > 0 && this.slamHang < 14) {
          // Hanging at the top (flashes): the tell to get out from under it.
          this.slamHang++;
          this.vx = 0;
          this.vy = 0;
          if (this.slamHang === 14) this.vy = 6;
          break;
        }
        const r = this.physics();
        if (r.wall) this.vx = 0;
        if (r.landed && this.t > 2) {
          this.vx = 0;
          this.slamHang = 0;
          this.g.shake(6);
          sfx.quake();
          this.g.fireGroundWave(this.cx - 4, this.room.floor, -1);
          this.g.fireGroundWave(this.cx - 4, this.room.floor, 1);
          this.setMove('idle', fast ? 22 : 34);
        }
        break;
      }
    }
    // Keep inside the room vertically.
    if (this.def.flies) this.y = Phaser.Math.Clamp(this.y, this.room.top, this.room.floor - this.h);
  }

  private slamHang = 0;

  // --- the Angler's lure (Reef's dark trench) -------------------------------------
  private lureImg: Phaser.GameObjects.Image | null = null;

  private lurePos(): { x: number; y: number } {
    const bob = Math.sin(this.t * 0.15) * 2;
    return { x: this.facing > 0 ? this.x + this.w + 5 : this.x - 5, y: this.y - 5 + bob };
  }

  /** Lights it carries into the dark: the Angler's lure (dims and flickers just before it lunges). */
  lights(): { x: number; y: number; s: number }[] {
    if (this.mini !== 'angler' || this.state === 'dying') return [];
    const windup = this.move === 'dash' && this.t < 30;
    const s = windup ? (this.t % 6 < 3 ? 0.3 : 0.55) : 0.75;
    return [{ ...this.lurePos(), s }];
  }

  render(): void {
    super.render();
    if (this.mini !== 'angler') return;
    if (!this.lureImg) {
      if (!this.g.textures.exists('lure_glow')) {
        const gr = this.g.make.graphics({ x: 0, y: 0 }, false);
        gr.fillStyle(0xfff4a0, 0.35).fillCircle(5, 5, 5);
        gr.fillStyle(0xfff4a0).fillCircle(5, 5, 3);
        gr.fillStyle(0xffffff).fillRect(4, 3, 2, 2);
        gr.generateTexture('lure_glow', 10, 10);
        gr.destroy();
      }
      // Over the darkness: in the trench, it's the one thing you can always see.
      this.lureImg = this.g.add.image(0, 0, 'lure_glow').setDepth(31);
    }
    const l = this.lurePos();
    const windup = this.move === 'dash' && this.t < 30;
    this.lureImg.setPosition(Math.round(l.x), Math.round(l.y)).setVisible(this.state !== 'dying' && (!windup || this.t % 6 < 3));
  }

  destroy(): void {
    this.lureImg?.destroy();
    super.destroy();
  }

  private choose(): void {
    const pool = this.def.moves.filter((m) => m !== this.last);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this.last = pick;
    this.setMove(pick);
  }

  protected telegraph(): boolean {
    const windup =
      (this.move === 'charge' && this.t < (this.phase2 ? 20 : 32)) ||
      (this.move === 'dash' && this.t < 30) ||
      (this.move === 'slam' && this.slamHang > 0);
    return windup && this.t % 6 < 3;
  }

  protected introPose(): string {
    return 'attack';
  }

  protected pose(): string {
    return this.move === 'idle' || this.move === 'hop' ? 'idle' : 'attack';
  }
}
