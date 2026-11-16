import Phaser from 'phaser';
import { playMusic, playVoice, stopMusic } from '../audio';
import { STEP_MS, VIEW_H, VIEW_W } from '../constants';
import { Controls } from '../input';
import { pixelText } from '../pixelFont';
import { sfx } from '../sfx';
import { pixelateIn } from './cutscene';
import { ModeData, returnToGame } from './encounters';

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
    this.cameras.main.setBackgroundColor('#05020a');
    this.stars = Array.from({ length: 60 }, () => ({ x: Math.random() * FIELD_W, y: Math.random() * 240, s: 0.2 + Math.random() * 0.8 }));
    this.g = this.add.graphics();
    this.bossImg = this.add.image(0, 0, 'overlord_idle').setVisible(false).setDepth(3);
    this.ship = this.add.image(0, 0, 'sh_ship').setDepth(6);
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

  private draw(): void {
    const g = this.g;
    g.clear();
    g.fillStyle(0x0a0614).fillRect(OX, TOP, FIELD_W, 240 - TOP);
    for (const s of this.stars) g.fillStyle(s.s > 0.7 ? 0xc8ccf0 : 0x4a4a7a).fillRect(OX + s.x, s.y, 1, 1);
    g.lineStyle(1, 0x3a2a5a).strokeRect(OX - 1, TOP - 1, FIELD_W + 2, 240 - TOP + 2);
    // Shields.
    for (let i = 0; i < 3; i++) {
      const sx = OX + this.shieldX(i);
      this.shields[i].forEach((row, r) => row.forEach((on, c) => on && g.fillStyle(r === 0 ? 0x8af0c8 : 0x3aa88a).fillRect(sx + c * 3, 180 + r * 3, 3, 3)));
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
    for (const s of this.shots) g.fillStyle(0x5ef0c8).fillRect(OX + s.x - 1, s.y - 4, 2, 6).fillStyle(0xffffff).fillRect(OX + s.x - 1, s.y - 4, 2, 2);
    for (const s of this.enemyShots) g.fillStyle(this.frame % 4 < 2 ? 0xff5050 : 0xffe14a).fillRect(OX + s.x - 1, s.y - 2, 3, 4);
    // You.
    this.ship.setPosition(OX + this.shipX, SHIP_Y).setVisible(this.dead === 0 && (this.invuln === 0 || this.frame % 6 < 3));
    if (this.dead > 60) for (let k = 0; k < 6; k++) g.fillStyle(k % 2 ? 0xff7a2a : 0xffe14a).fillCircle(OX + this.shipX + Math.cos(k + this.dead) * (90 - this.dead), SHIP_Y + Math.sin(k * 2 + this.dead) * (90 - this.dead) * 0.5, 2);
    this.hud.setText(`SCORE ${String(this.score).padStart(5, '0')}   LIVES ${Math.max(0, this.lives)}   WAVE ${this.wave}`);
  }
}

export function makeShooterTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('sh_ship')) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const K = 0x1a1428;
  // UltraGuy's fighter: orange hull, teal cockpit, twin engines.
  g.fillStyle(K).fillTriangle(8, 0, 0, 12, 16, 12);
  g.fillStyle(0xf28c28).fillTriangle(8, 1, 2, 11, 14, 11);
  g.fillStyle(0xffc070).fillTriangle(8, 2, 6, 6, 10, 6);
  g.fillStyle(0x5ef0c8).fillRect(7, 5, 2, 3);
  g.fillStyle(0xb85a1a).fillRect(2, 10, 4, 2).fillRect(10, 10, 4, 2);
  g.fillStyle(0xffe14a).fillRect(3, 12, 2, 1).fillRect(11, 12, 2, 1);
  g.generateTexture('sh_ship', 16, 13);
  // Overlord drones: three kinds, two frames each.
  const colors = [[0x8c4ad8, 0x5a2a8a], [0xd83a4a, 0x8c2030], [0x55607a, 0x8a8fa8]];
  colors.forEach(([body, dark], kind) => {
    for (const frame of ['a', 'b']) {
      g.clear();
      g.fillStyle(K).fillRect(1, 1, 10, 7);
      g.fillStyle(body).fillRect(2, 2, 8, 5);
      g.fillStyle(dark).fillRect(2, 5, 8, 2);
      g.fillStyle(0xffe14a).fillRect(kind === 2 ? 5 : 3, 3, 2, 2);
      if (kind !== 2) g.fillStyle(0xffe14a).fillRect(7, 3, 2, 2);
      g.fillStyle(K);
      if (frame === 'a') g.fillRect(0, 7, 2, 3).fillRect(10, 7, 2, 3);
      else g.fillRect(2, 8, 2, 2).fillRect(8, 8, 2, 2);
      g.generateTexture(`sh_drone${kind}${frame}`, 12, 10);
    }
  });
  g.destroy();
}
