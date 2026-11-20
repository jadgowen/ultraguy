import Phaser from 'phaser';
import { playMusic, playVoice, stopMusic } from '../audio';
import { STEP_MS, VIEW_H, VIEW_W } from '../constants';
import { Controls } from '../input';
import { pixelText } from '../pixelFont';
import { sfx } from '../sfx';
import { pixelateIn } from './cutscene';
import { ModeData, returnToGame } from './encounters';
import { makeSkiesArt } from './skiesArt';

/**
 * OVERLORD'S ARMADA: a fixed-screen alien shooter. Your fighter slides along
 * the bottom and fires up. Wave 1: a marching formation that speeds up as you
 * thin it out (shields to hide behind). Wave 2: the same, with drones peeling
 * off to dive at you. Wave 3: the Overlord's mothership: knock out both
 * cannons, then hit the core. Three lives.
 */

const FIELD_W = 260;
const OX = Math.round((VIEW_W - FIELD_W) / 2);
const TOP = 22;
const SHIP_Y = 214;
const LIVES = 3;

interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dead?: boolean;
}

interface Drone {
  x: number;
  y: number;
  kind: number;
  alive: boolean;
  /** Diving: an arc down at the player and back to the formation. */
  dive: { t: number; fromX: number; fromY: number; aimX: number } | null;
}

export class ShooterScene extends Phaser.Scene {
  private controls!: Controls;
  private mode!: ModeData;
  private acc = 0;
  private frame = 0;
  private shipX = FIELD_W / 2;
  private lives = LIVES;
  private invuln = 0;
  private dead = 0;
  private shots: Shot[] = [];
  private enemyShots: Shot[] = [];
  private drones: Drone[] = [];
  private formX = 0;
  private formY = 0;
  private formDir = 1;
  private wave = 0;
  private shields: boolean[][][] = [];
  private boss: { x: number; dir: number; cannons: number[]; core: number; t: number } | null = null;
  private score = 0;
  private result: 'win' | 'lose' | null = null;
  private overT = 0;
  private waveT = 0;
  private g!: Phaser.GameObjects.Graphics;
  private fxG!: Phaser.GameObjects.Graphics;
  private flame!: Phaser.GameObjects.Image;
  private sparks: { x: number; y: number; vx: number; vy: number; t: number; col: number }[] = [];
  private ship!: Phaser.GameObjects.Image;
  private bossImg!: Phaser.GameObjects.Image;
  private droneImgs: Phaser.GameObjects.Image[] = [];
  private banner!: ReturnType<typeof pixelText>;
  private hud!: ReturnType<typeof pixelText>;
  private stars: { x: number; y: number; s: number }[] = [];

  constructor() {
    super('shooter');
  }

  create(data: ModeData): void {
    this.mode = { stage: data?.stage ?? 'finale', ret: data?.ret ?? { kind: 'vault', step: 0 } };
    this.controls = new Controls(this);
    Object.assign(this, { acc: 0, frame: 0, shipX: FIELD_W / 2, lives: LIVES, invuln: 0, dead: 0, shots: [], enemyShots: [], drones: [], wave: 0, boss: null, score: 0, result: null, overT: 0, waveT: 0, droneImgs: [] });
    makeShooterTextures(this);
    makeSkiesArt(this);
    this.cameras.main.setBackgroundColor('#05020a');
    this.add.image(OX, TOP, makeSpace(this, FIELD_W, 240 - TOP)).setOrigin(0).setDepth(-1);
    this.sparks = [];
    this.fxG = this.add.graphics().setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
    this.flame = this.add.image(0, 0, 'sk_flame0').setDepth(5.9);
    this.stars = Array.from({ length: 60 }, () => ({ x: Math.random() * FIELD_W, y: Math.random() * 240, s: 0.2 + Math.random() * 0.8 }));
    this.g = this.add.graphics();
    this.bossImg = this.add.image(0, 0, 'overlord_idle').setVisible(false).setDepth(3);
    this.ship = this.add.image(0, 0, 'sk_ship').setDepth(6);
    this.banner = pixelText(this, VIEW_W / 2, 110, '', { fontSize: '16px', color: '#fff1e0', stroke: '#000000' }).setOrigin(0.5).setDepth(20);
    this.hud = pixelText(this, OX, 6, '', { color: '#fff1e0', stroke: '#000000' }).setDepth(20);
    pixelText(this, OX, VIEW_H - 10, 'LEFT/RIGHT MOVE  JUMP/FIRE SHOOT', { color: '#8a8fa8', stroke: '#000000' }).setDepth(20);
    this.makeShields();
    stopMusic();
    pixelateIn(this, 800);
    this.time.delayedCall(400, () => playMusic(this, 'shooter'));
    this.startWave(1);
  }

  private makeShields(): void {
    // Three bunkers, each a 8 x 5 grid of 3px chips with a notch underneath.
    this.shields = [0, 1, 2].map(() => Array.from({ length: 5 }, (_, r) => Array.from({ length: 8 }, (_, c) => !(r >= 3 && c >= 2 && c <= 5))));
  }

  private shieldX(i: number): number {
    return 40 + i * 80;
  }

  private startWave(n: number): void {
    this.wave = n;
    this.waveT = 0;
    this.banner.setText(n === 3 ? 'THE MOTHERSHIP!' : `WAVE ${n}`);
    this.time.delayedCall(1300, () => !this.result && this.banner.setText(''));
    for (const img of this.droneImgs) img.destroy();
    this.droneImgs = [];
    this.drones = [];
    if (n < 3) {
      for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) this.drones.push({ x: c * 22, y: r * 16, kind: r === 0 ? 2 : r < 3 ? 1 : 0, alive: true, dive: null });
      this.formX = 30;
      this.formY = 34;
      this.formDir = 1;
      this.droneImgs = this.drones.map((d) => this.add.image(0, 0, `sh_drone${d.kind}a`).setDepth(4));
    } else {
      this.boss = { x: FIELD_W / 2, dir: 1, cannons: [14, 14], core: 24, t: 0 };
      // A spare ship for the last stand.
      if (this.lives < LIVES) {
        this.lives++;
        sfx.pickup();
      }
      this.bossImg.setVisible(true);
    }
  }

  update(_t: number, delta: number): void {
    this.acc += Math.min(delta, 100);
    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS;
      this.step();
    }
    this.draw();
  }

  private step(): void {
    this.frame++;
    this.controls.poll();
    for (const s of this.stars) s.y = (s.y + s.s) % 240;
    if (this.result) {
      if (++this.overT === 220) returnToGame(this, this.mode, this.result === 'win');
      this.moveShots();
      return;
    }
    this.waveT++;
    if (this.waveT < 70) return;
    // Your fighter.
    const c = this.controls;
    if (this.dead > 0) {
      if (--this.dead === 0) {
        if (this.lives <= 0) return this.finish(false);
        this.invuln = 120;
        this.shipX = FIELD_W / 2;
      }
    } else {
      this.shipX = Phaser.Math.Clamp(this.shipX + ((c.isDown('right') ? 1 : 0) - (c.isDown('left') ? 1 : 0)) * 2, 10, FIELD_W - 10);
      if ((c.justPressed('jump') || c.justPressed('fire')) && this.shots.length < 3) {
        this.shots.push({ x: this.shipX, y: SHIP_Y - 8, vx: 0, vy: -6 });
        sfx.laser();
      }
    }
    if (this.invuln > 0) this.invuln--;
    if (this.wave < 3) this.stepFormation();
    else this.stepBoss();
    this.moveShots();
    this.collide();
  }

  private stepFormation(): void {
    const alive = this.drones.filter((d) => d.alive);
    if (!alive.length) {
      this.startWave(this.wave + 1);
      return;
    }
    // March: faster as the formation thins out; step down at the edges.
    const speed = 0.3 + (32 - alive.length) * 0.03 + (this.wave - 1) * 0.12;
    this.formX += this.formDir * speed;
    const left = Math.min(...alive.map((d) => d.x)) + this.formX;
    const right = Math.max(...alive.map((d) => d.x)) + this.formX + 12;
    if ((this.formDir > 0 && right > FIELD_W - 4) || (this.formDir < 0 && left < 4)) {
      this.formDir = -this.formDir as 1 | -1;
      this.formY += 4;
    }
    // Shots from the bottom drone in a random column.
    if (this.frame % Math.max(34, 70 - (32 - alive.length)) === 0 && this.enemyShots.length < 4) {
      const shooter = alive[Math.floor(Math.random() * alive.length)];
      const [x, y] = this.dronePos(shooter);
      this.enemyShots.push({ x: x + 6, y: y + 10, vx: 0, vy: 1.6 + this.wave * 0.15 });
    }
    // Wave 2: dives.
    if (this.wave === 2 && alive.length > 3 && this.frame % 90 === 0) {
      const idle = alive.filter((d) => !d.dive);
      const d = idle[Math.floor(Math.random() * idle.length)];
      if (d) {
        const [x, y] = this.dronePos(d);
        d.dive = { t: 0, fromX: x, fromY: y, aimX: this.shipX };
      }
    }
    for (const d of alive) {
      if (!d.dive) continue;
      d.dive.t++;
      if (d.dive.t > 150) d.dive = null;
      else if (d.dive.t === 60) this.enemyShots.push({ x: this.dronePos(d)[0] + 6, y: this.dronePos(d)[1] + 10, vx: 0, vy: 2.6 });
    }
    // The formation reaching your row ends it.
    if (this.formY + Math.max(...alive.map((d) => d.y)) > SHIP_Y - 30) this.finish(false);
  }

  /** A drone's screen position (field coords): in formation, or along its dive arc. */
  private dronePos(d: Drone): [number, number] {
    const homeX = d.x + this.formX;
    const homeY = d.y + this.formY;
    if (!d.dive) return [homeX, homeY];
    const k = d.dive.t / 150;
    const x = Phaser.Math.Linear(d.dive.fromX, d.dive.aimX, Math.sin(k * Math.PI)) + Math.sin(k * Math.PI * 2) * 30;
    const y = homeY + Math.sin(k * Math.PI) * (SHIP_Y - 40 - homeY);
    return [x, y];
  }

  private stepBoss(): void {
    const b = this.boss!;
    b.t++;
    b.x += b.dir * 0.6;
    if (b.x < 50 || b.x > FIELD_W - 50) b.dir = -b.dir;
    // Cannons fire aimed shots; once both are gone, the core fires spreads.
    if (b.t % 50 === 0) {
      for (const [i, side] of [-1, 1].entries()) {
        if (b.cannons[i] <= 0) continue;
        const sx = b.x + side * 26;
        const a = Math.atan2(SHIP_Y - 70, this.shipX - sx);
        this.enemyShots.push({ x: sx, y: 70, vx: Math.cos(a) * 2.2, vy: Math.sin(a) * 2.2 });
      }
    }
    if (b.cannons.every((h) => h <= 0) && b.t % 70 === 0) {
      for (let k = -2; k <= 2; k++) this.enemyShots.push({ x: b.x, y: 60, vx: k * 0.7, vy: 2.2 });
    }
  }

  private moveShots(): void {
    for (const s of [...this.shots, ...this.enemyShots]) {
      s.x += s.vx;
      s.y += s.vy;
      if (s.y < TOP - 10 || s.y > 250 || s.x < -10 || s.x > FIELD_W + 10) s.dead = true;
    }
    this.shots = this.shots.filter((s) => !s.dead);
    this.enemyShots = this.enemyShots.filter((s) => !s.dead);
  }

  private hitShield(s: Shot): boolean {
    for (let i = 0; i < 3; i++) {
      const sx = this.shieldX(i);
      const c = Math.floor((s.x - sx) / 3);
      const r = Math.floor((s.y - 180) / 3);
      if (this.shields[i][r]?.[c]) {
        this.shields[i][r][c] = false;
        if (this.shields[i][r][c + 1]) this.shields[i][r][c + 1] = false;
        return true;
      }
    }
    return false;
  }

  private collide(): void {
    // Your shots.
    for (const s of this.shots) {
      if (this.hitShield(s)) {
        s.dead = true;
        continue;
      }
      if (this.wave < 3) {
        for (const d of this.drones) {
          if (!d.alive) continue;
          const [x, y] = this.dronePos(d);
          if (s.x >= x - 1 && s.x <= x + 13 && s.y >= y - 2 && s.y <= y + 10) {
            d.alive = false;
            s.dead = true;
            this.pop(x + 6, y + 5, [0xc8a0ff, 0xff8a8a, 0xc8ccd8][d.kind]);
            this.score += [10, 20, 40][d.kind] * (d.dive ? 2 : 1);
            sfx.alienDie();
            break;
          }
        }
      } else if (this.boss) {
        const b = this.boss;
        for (const [i, side] of [-1, 1].entries()) {
          const cx = b.x + side * 26;
          if (b.cannons[i] > 0 && Math.abs(s.x - cx) < 7 && s.y < 76 && s.y > 50) {
            b.cannons[i]--;
            this.pop(s.x, s.y, 0xffe14a, 5);
            s.dead = true;
            sfx.hit();
            if (b.cannons[i] === 0) {
              sfx.explode();
              this.cameras.main.shake(200, 0.01);
            }
          }
        }
        const coreOpen = b.cannons.every((h) => h <= 0);
        if (!s.dead && Math.abs(s.x - b.x) < 9 && s.y < 70 && s.y > 40) {
          s.dead = true;
          if (coreOpen) {
            b.core--;
            this.pop(s.x, s.y, 0xff5050, 6);
            sfx.hit();
            if (b.core <= 0) {
              this.score += 1000;
              this.cameras.main.shake(600, 0.02);
              sfx.explode();
              this.finish(true);
            }
          } else sfx.deflect();
        }
      }
    }
    // Their shots and divers vs. you and the shields.
    for (const s of this.enemyShots) if (this.hitShield(s)) s.dead = true;
    if (this.dead || this.invuln) return;
    const hitYou = (x: number, y: number, w: number, h: number) => this.shipX + 7 > x && this.shipX - 7 < x + w && SHIP_Y + 5 > y && SHIP_Y - 5 < y + h;
    for (const s of this.enemyShots) {
      if (hitYou(s.x - 1, s.y - 2, 2, 4)) {
        s.dead = true;
        this.loseLife();
        return;
      }
    }
    for (const d of this.drones) {
      if (!d.alive || !d.dive) continue;
      const [x, y] = this.dronePos(d);
      if (hitYou(x, y, 12, 10)) {
        d.alive = false;
        this.loseLife();
        return;
      }
    }
  }

  private loseLife(): void {
    this.lives--;
    this.dead = 90;
    sfx.explode();
    this.cameras.main.shake(250, 0.015);
  }

  private finish(won: boolean): void {
    if (this.result) return;
    this.result = won ? 'win' : 'lose';
    this.banner.setText(won ? 'THE ARMADA FALLS!' : 'SHOT DOWN');
    stopMusic();
    if (won) playVoice(this, 'overlord_loses');
  }

  /** A burst of sparks (in field coordinates). */
  private pop(x: number, y: number, col: number, n = 10): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 0.6 + Math.random() * 1.8;
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 14 + Math.floor(Math.random() * 10), col: i % 3 === 0 ? 0xffffff : col });
    }
  }

  private draw(): void {
    const g = this.g;
    g.clear();
    const fx = this.fxG;
    fx.clear();
    // Stars twinkle over the painted nebula.
    for (const s of this.stars) {
      if (s.y < TOP) continue;
      const tw = (Math.sin(this.frame / (8 + s.s * 20) + s.x) + 1) / 2;
      g.fillStyle(s.s > 0.7 ? 0xe6eaff : 0x6a6aa0, 0.4 + tw * 0.6).fillRect(OX + s.x, s.y, s.s > 0.9 ? 2 : 1, 1);
    }
    g.lineStyle(1, 0x5a3a8a).strokeRect(OX - 1, TOP - 1, FIELD_W + 2, 240 - TOP + 2);
    g.lineStyle(1, 0x2a1a4a).strokeRect(OX - 2, TOP - 2, FIELD_W + 4, 240 - TOP + 4);
    // Shields: glowing energy barriers that lose blocks as they're hit.
    for (let i = 0; i < 3; i++) {
      const sx = OX + this.shieldX(i);
      this.shields[i].forEach((row, r) =>
        row.forEach((on, c) => {
          if (!on) return;
          const top = r === 0 || !this.shields[i][r - 1][c];
          g.fillStyle(top ? 0xbffff0 : (c + r) % 2 ? 0x3ab89a : 0x2aa088).fillRect(sx + c * 3, 180 + r * 3, 3, 3);
          fx.fillStyle(0x5ef0c8, 0.12).fillRect(sx + c * 3 - 1, 180 + r * 3 - 1, 5, 5);
        }),
      );
    }
    // Drones.
    const flap = Math.floor(this.frame / 20) % 2 ? 'b' : 'a';
    this.drones.forEach((d, i) => {
      const img = this.droneImgs[i];
      if (!img) return;
      const [x, y] = this.dronePos(d);
      img.setVisible(d.alive).setTexture(`sh_drone${d.kind}${flap}`).setPosition(OX + x + 6, y + 5);
    });
    // The mothership.
    if (this.boss) {
      const b = this.boss;
      this.bossImg.setPosition(OX + b.x, 46).setScale(0.75);
      this.bossImg.setTint(b.core < 8 && this.frame % 10 < 5 ? 0xff8080 : 0xffffff);
      for (const [i, side] of [-1, 1].entries()) {
        const cx = OX + b.x + side * 26;
        if (b.cannons[i] > 0) {
          g.fillStyle(0x1a1428).fillRect(cx - 6, 56, 12, 14);
          g.fillStyle(0x8a8fa8).fillRect(cx - 5, 57, 10, 12);
          g.fillStyle(0xff3a3a).fillRect(cx - 2, 66, 4, 3);
          g.fillStyle(0x3a3450).fillRect(cx - 5, 52, 10, 3);
          g.fillStyle(0xff5050).fillRect(cx - 5, 52, Math.round((b.cannons[i] / 14) * 10), 3);
        } else {
          g.fillStyle(0x3a1a1a).fillRect(cx - 5, 60, 10, 6);
          if (this.frame % 6 < 3) g.fillStyle(0xff7a2a).fillRect(cx - 2, 58, 4, 3);
        }
      }
      const open = b.cannons.every((h) => h <= 0);
      g.fillStyle(open ? (this.frame % 10 < 5 ? 0xffe14a : 0xff5050) : 0x3a3450).fillCircle(OX + b.x, 62, 5);
      if (open) {
        g.fillStyle(0x3a3450).fillRect(OX + b.x - 20, 30, 40, 3);
        g.fillStyle(0xffe14a).fillRect(OX + b.x - 20, 30, Math.round((b.core / 24) * 40), 3);
      }
    }
    // Shots.
    for (const s of this.shots) {
      g.fillStyle(0x2aa088).fillRect(OX + s.x - 1, s.y - 4, 3, 8);
      g.fillStyle(0xbffff0).fillRect(OX + s.x, s.y - 5, 1, 8);
      fx.fillStyle(0x5ef0c8, 0.3).fillCircle(OX + s.x, s.y, 5);
    }
    for (const s of this.enemyShots) {
      g.fillStyle(this.frame % 4 < 2 ? 0xff5050 : 0xffe14a).fillRect(OX + s.x - 1, s.y - 3, 3, 6);
      fx.fillStyle(0xff5050, 0.3).fillCircle(OX + s.x, s.y, 5);
    }
    // Sparks from hits.
    for (const p of this.sparks) {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.t--;
      fx.fillStyle(p.col, Math.min(1, p.t / 10)).fillRect(OX + p.x, p.y, 2, 2);
    }
    this.sparks = this.sparks.filter((p) => p.t > 0);
    // You.
    const shown = this.dead === 0 && (this.invuln === 0 || this.frame % 6 < 3);
    this.ship.setPosition(OX + this.shipX, SHIP_Y).setVisible(shown);
    this.flame.setTexture(`sk_flame${Math.floor(this.frame / 3) % 2}`).setPosition(OX + this.shipX, SHIP_Y + 11).setVisible(shown);
    if (this.dead > 60) for (let k = 0; k < 6; k++) g.fillStyle(k % 2 ? 0xff7a2a : 0xffe14a).fillCircle(OX + this.shipX + Math.cos(k + this.dead) * (90 - this.dead), SHIP_Y + Math.sin(k * 2 + this.dead) * (90 - this.dead) * 0.5, 2);
    this.hud.setText(`SCORE ${String(this.score).padStart(5, '0')}   LIVES ${Math.max(0, this.lives)}   WAVE ${this.wave}`);
  }
}

/** The space behind the armada: a deep gradient, two nebula clouds, a ringed planet low on one side. */
function makeSpace(scene: Phaser.Scene, w: number, h: number): string {
  const key = 'sh_space';
  if (scene.textures.exists(key)) return key;
  const t = scene.textures.createCanvas(key, w, h)!;
  const c = t.getContext();
  const bay = (x: number, y: number) => [0, 0.5, 0.75, 0.25][(x & 1) + ((y & 1) << 1)];
  const hsh = (x: number, y: number) => {
    let q = (x * 374761393 + y * 668265263) | 0;
    q = Math.imul(q ^ (q >>> 13), 1274126177);
    return ((q ^ (q >>> 16)) >>> 0) / 4294967296;
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const n1 = Math.max(0, 1 - Math.hypot((x - w * 0.25) / 70, (y - h * 0.3) / 40)) * (0.6 + hsh(x >> 3, y >> 3) * 0.4);
      const n2 = Math.max(0, 1 - Math.hypot((x - w * 0.8) / 60, (y - h * 0.65) / 50)) * (0.6 + hsh((x >> 3) + 40, y >> 3) * 0.4);
      const k = bay(x, y) * 0.3;
      const r = 8 + n1 * 70 + n2 * 20 + k * 10, g = 4 + n1 * 20 + n2 * 50 + k * 6, b = 18 + n1 * 80 + n2 * 70 + k * 14;
      c.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      c.fillRect(x, y, 1, 1);
    }
  // A ringed planet peeking up from the bottom corner.
  const px0 = w - 46, py0 = h + 18;
  for (let y = h - 60; y < h; y++)
    for (let x = w - 110; x < w; x++) {
      const d = Math.hypot(x - px0, y - py0);
      if (d < 54) {
        const lit = 1 - Math.hypot(x - (px0 - 20), y - (py0 - 30)) / 80 + bay(x, y) * 0.15;
        c.fillStyle = lit > 0.55 ? '#c86a8a' : lit > 0.3 ? '#8a3a6a' : '#4a1a4a';
        c.fillRect(x, y, 1, 1);
      }
      const rx = (x - px0) / 80, ry = (y - py0 + 30) / 10;
      const rd = rx * rx + ry * ry;
      if (rd > 0.8 && rd < 1 && !(d < 54 && y > py0 - 30)) {
        c.fillStyle = '#e8b0c8';
        c.fillRect(x, y, 1, 1);
      }
    }
  t.refresh();
  return key;
}

export function makeShooterTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('sh_drone0a')) return;
  // The Overlord's drones, three kinds (purple squid, red crab, grey sentinel), two frames each, shaded.
  const K = '#1a1428';
  const pal: Record<string, string>[] = [
    { K, B: '#c8a0ff', b: '#8c4ad8', d: '#5a2a8a', Y: '#ffe14a', W: '#ffffff' },
    { K, B: '#ff8a8a', b: '#d83a4a', d: '#8c2030', Y: '#ffe14a', W: '#ffffff' },
    { K, B: '#c8ccd8', b: '#8a8fa8', d: '#55607a', Y: '#ff5050', W: '#ffffff' },
  ];
  const art: Record<string, string[]>[] = [
    {
      a: ['...KKKKKK...', '..KBBBBBbK..', '.KBWYbbYWbK.', '.KBBbbbbbbK.', '..KbdbbdbK..', '.KdK.KK.KdK.', 'KdK......KdK', 'KK........KK', '............', '............'],
      b: ['...KKKKKK...', '..KBBBBBbK..', '.KBWYbbYWbK.', '.KBBbbbbbbK.', '..KbdbbdbK..', '..KdKKKKdK..', '..KdK..KdK..', '...KK..KK...', '............', '............'],
    },
    {
      a: ['K..........K', 'KbK......KbK', '.KbKKKKKKbK.', '..KBBBBBbK..', '.KBYWbbWYbK.', '.KbbbbbbbbK.', '..KdddddK...', '.KdK...KdK..', 'KdK.....KdK.', '............'],
      b: ['............', '.KbK....KbK.', 'KbKKKKKKKKbK', '..KBBBBBbK..', '.KBYWbbWYbK.', '.KbbbbbbbbK.', '..KdddddK...', '..KdK.KdK...', '..KK...KK...', '............'],
    },
    {
      a: ['....KKKK....', '..KKBBBBKK..', '.KBBBbbBBbK.', 'KBBKYYYYKbbK', 'KbbbbbbbbbdK', '.KdKdKKdKdK.', '..K.K..K.K..', '............', '............', '............'],
      b: ['....KKKK....', '..KKBBBBKK..', '.KBBBbbBBbK.', 'KBBKWYYWKbbK', 'KbbbbbbbbbdK', '.KdKdKKdKdK.', '.K..K..K..K.', '............', '............', '............'],
    },
  ];
  art.forEach((frames, kind) => {
    for (const [frame, rows] of Object.entries(frames)) {
      const t = scene.textures.createCanvas(`sh_drone${kind}${frame}`, 12, 10)!;
      const c = t.getContext();
      rows.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === '.') return;
        c.fillStyle = pal[kind][ch];
        c.fillRect(x, y, 1, 1);
      }));
      t.refresh();
    }
  });
}
