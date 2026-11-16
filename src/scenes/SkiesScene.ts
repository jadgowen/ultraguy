import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../constants';
import { sfx } from '../sfx';
import { ModeScene } from './ModeScene';
import { makeShooterTextures } from './ShooterScene';

/**
 * GALE'S SKIES: a vertical-scrolling shooter. Fly up through the clouds,
 * shooting down kites (some drop a P for a wider shot), while wind gusts shove
 * your ship sideways. Then Gale herself: feather fans, wind blades, a sweeping
 * tornado and gales. Three ships.
 */

const FW = 220;
const OX = Math.round((VIEW_W - FW) / 2);
const LIVES = 3;
const GALE_HP = 105;
const BOSS_AT = 60 * 45;

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  kind: 'feather' | 'blade' | 'seed';
}

interface Kite {
  x: number;
  y: number;
  t: number;
  x0: number;
  amp: number;
  hp: number;
  drop: boolean;
  /** Only some kites shoot. */
  shooter: boolean;
}

export class SkiesScene extends ModeScene {
  protected readonly voice = 'gale';
  protected readonly music = 'skies';
  protected readonly homeStage = 'stratos' as const;

  private ship = { x: FW / 2, y: 200, invuln: 0, lives: LIVES, power: 1, dead: 0, fireT: 0 };
  private shots: { x: number; y: number; vx: number }[] = [];
  private bullets: Bullet[] = [];
  private kites: Kite[] = [];
  private powers: { x: number; y: number }[] = [];
  private wind = { force: 0, target: 0, warn: 0, t: 0 };
  private gale: { x: number; y: number; hp: number; t: number; attack: number; tornado: { x: number; dir: number; t: number } | null; hurt: number } | null = null;
  private clouds: { x: number; y: number; w: number; s: number }[] = [];
  private g!: Phaser.GameObjects.Graphics;
  private galeImg!: Phaser.GameObjects.Image;
  private shipImg!: Phaser.GameObjects.Image;
  private kiteImgs: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('skies');
  }

  protected setup(): void {
    makeShooterTextures(this);
    this.cameras.main.setBackgroundColor('#4a88c8');
    this.ship = { x: FW / 2, y: 200, invuln: 0, lives: LIVES, power: 1, dead: 0, fireT: 0 };
    Object.assign(this, { shots: [], bullets: [], kites: [], powers: [], gale: null, kiteImgs: [] });
    this.wind = { force: 0, target: 0, warn: 0, t: 0 };
    this.clouds = Array.from({ length: 14 }, () => ({ x: Math.random() * FW, y: Math.random() * VIEW_H, w: 20 + Math.random() * 40, s: 0.6 + Math.random() * 1.4 }));
    this.g = this.add.graphics();
    this.galeImg = this.add.image(0, -50, 'gale_idle').setScale(1.4).setDepth(6).setVisible(false);
    this.shipImg = this.add.image(0, 0, 'sh_ship').setDepth(8);
    this.help('ARROWS FLY   HOLD FIRE SHOOT');
  }

  protected tick(): void {
    const c = this.controls;
    const s = this.ship;
    // Wind: warned a moment before it blows.
    const w = this.wind;
    w.t++;
    if (!this.gale && w.t % 330 === 0) {
      w.warn = 50;
      w.target = (Math.random() < 0.5 ? -1 : 1) * 1.1;
    }
    if (w.warn > 0 && --w.warn === 0) {
      w.force = w.target;
      sfx.cyclone();
    }
    if (w.force && !this.gale && w.t % 330 === 170) w.force = 0;
    // Your ship.
    if (s.dead > 0) {
      if (--s.dead === 0) {
        if (s.lives <= 0) return this.finish(false, 'BLOWN AWAY...');
        Object.assign(s, { x: FW / 2, y: 200, invuln: 120 });
      }
    } else {
      s.x += ((c.isDown('right') ? 1 : 0) - (c.isDown('left') ? 1 : 0)) * 2.1 + w.force;
      s.y += ((c.isDown('down') ? 1 : 0) - (c.isDown('up') ? 1 : 0)) * 2.1;
      s.x = Phaser.Math.Clamp(s.x, 8, FW - 8);
      s.y = Phaser.Math.Clamp(s.y, 110, VIEW_H - 22);
      if ((c.isDown('fire') || c.isDown('jump')) && ++s.fireT % 7 === 1) {
        const spread = s.power === 1 ? [0] : s.power === 2 ? [-4, 4] : [-6, 0, 6];
        for (const dx of spread) this.shots.push({ x: s.x + dx, y: s.y - 8, vx: dx * 0.05 });
        sfx.shoot();
      }
      if (s.invuln > 0) s.invuln--;
    }
    for (const sh of this.shots) {
      sh.y -= 6;
      sh.x += sh.vx;
    }
    this.shots = this.shots.filter((sh) => sh.y > -8);
    if (this.playT < BOSS_AT) this.stepKites();
    else this.stepGale();
    this.stepBullets();
    for (const p of this.powers) {
      p.y += 0.9;
      if (Math.abs(p.x - s.x) < 10 && Math.abs(p.y - s.y) < 10 && s.dead === 0) {
        p.y = 999;
        s.power = Math.min(3, s.power + 1);
        sfx.pickup();
      }
    }
    this.powers = this.powers.filter((p) => p.y < VIEW_H);
    for (const cl of this.clouds) {
      cl.y += cl.s;
      if (cl.y > VIEW_H + 20) Object.assign(cl, { y: -20, x: Math.random() * FW });
    }
    const galeBar = this.gale ? `   GALE ${'#'.repeat(Math.ceil(this.gale.hp / 12))}` : '';
    this.hud.setText(`SHIPS ${'^'.repeat(Math.max(0, s.lives))}  SHOT ${'>'.repeat(s.power)}${galeBar}`).setX(OX);
  }

  private hitShip(): void {
    const s = this.ship;
    if (s.dead || s.invuln) return;
    s.lives--;
    s.dead = 70;
    sfx.explode();
    this.cameras.main.shake(220, 0.012);
  }

  // --- kites ---------------------------------------------------------------------------

  private stepKites(): void {
    const t = this.playT;
    if (t % 50 === 0 && t < BOSS_AT - 180) {
      const x0 = 30 + Math.random() * (FW - 60);
      const n = t % 300 === 0 ? 4 : 1;
      for (let i = 0; i < n; i++) this.kites.push({ x: x0, y: -16 - i * 22, t: -i * 14, x0, amp: 20 + Math.random() * 40, hp: 2, drop: Math.random() < 0.12, shooter: Math.random() < 0.5 });
    }
    for (const k of this.kites) {
      k.t++;
      k.y += 0.9;
      k.x = k.x0 + Math.sin(k.t / 30) * k.amp + this.wind.force * k.t * 0.2;
      if (k.shooter && k.t > 0 && k.t % 140 === 40 && k.y > 0 && k.y < 140) {
        const a = Math.atan2(this.ship.y - k.y, this.ship.x - k.x);
        this.bullets.push({ x: k.x, y: k.y, vx: Math.cos(a) * 1.6, vy: Math.sin(a) * 1.6, r: 2, kind: 'seed' });
      }
      for (const sh of this.shots) {
        if (Math.abs(sh.x - k.x) < 11 && Math.abs(sh.y - k.y) < 8) {
          sh.y = -99;
          if (--k.hp <= 0) {
            if (k.drop) this.powers.push({ x: k.x, y: k.y });
            k.y = 999;
            sfx.alienDie();
          }
        }
      }
      if (k.y < VIEW_H && Math.abs(k.x - this.ship.x) < 12 && Math.abs(k.y - this.ship.y) < 9) this.hitShip();
    }
    this.kites = this.kites.filter((k) => k.y < VIEW_H + 20);
    while (this.kiteImgs.length < this.kites.length) this.kiteImgs.push(this.add.image(0, 0, 'kite_idle').setScale(0.55).setDepth(5));
    this.kiteImgs.forEach((img, i) => {
      const k = this.kites[i];
      img.setVisible(!!k);
      if (k) img.setPosition(OX + k.x, k.y);
    });
  }

  // --- Gale ----------------------------------------------------------------------------

  private stepGale(): void {
    for (const img of this.kiteImgs) img.setVisible(false);
    if (!this.gale) {
      this.gale = { x: FW / 2, y: -40, hp: GALE_HP, t: 0, attack: 0, tornado: null, hurt: 0 };
      this.galeImg.setVisible(true);
      this.banner.setText('GALE!');
      this.time.delayedCall(1200, () => !this.result && this.banner.setText(''));
      this.wind.force = 0;
      sfx.cyclone();
    }
    const gl = this.gale;
    gl.t++;
    if (gl.hurt > 0) gl.hurt--;
    if (gl.y < 44) {
      gl.y += 0.8;
      return;
    }
    const rage = gl.hp < GALE_HP / 2;
    gl.x = FW / 2 + Math.sin(gl.t / 70) * (FW / 2 - 34);
    // Attack cycle: feathers, blades, tornado, gale.
    const cycle = rage ? 100 : 130;
    if (gl.t % cycle === 0) gl.attack = (gl.attack + 1) % 4;
    const at = gl.t % cycle;
    const s = this.ship;
    if (gl.attack === 0 && (at === 20 || at === 60 || (rage && at === 90))) {
      for (let i = -3; i <= 3; i++) {
        const a = Math.PI / 2 + i * 0.22;
        this.bullets.push({ x: gl.x, y: gl.y + 10, vx: Math.cos(a) * 1.7, vy: Math.sin(a) * 1.7, r: 3, kind: 'feather' });
      }
      sfx.whoosh();
    }
    if (gl.attack === 1 && at >= 20 && at <= 70 && at % 16 === 4) {
      const a = Math.atan2(s.y - gl.y, s.x - gl.x);
      this.bullets.push({ x: gl.x, y: gl.y + 8, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, r: 3, kind: 'blade' });
      sfx.thorn();
    }
    if (gl.attack === 2 && at === 10) {
      gl.tornado = { x: Math.random() < 0.5 ? -12 : FW + 12, dir: 0, t: 0 };
      gl.tornado.dir = gl.tornado.x < 0 ? 1 : -1;
      sfx.cyclone();
    }
    if (gl.attack === 3 && at === 10) {
      this.wind.warn = 30;
      this.wind.target = s.x < FW / 2 ? -1.3 : 1.3;
    }
    if (gl.attack !== 3 && this.wind.force && at === 0) this.wind.force = 0;
    if (gl.attack === 3 && at % 24 === 12) {
      for (const dx of [-30, 30]) this.bullets.push({ x: gl.x + dx, y: gl.y, vx: 0, vy: 2, r: 3, kind: 'feather' });
    }
    // The tornado sweeps across the bottom of the sky.
    const tor = gl.tornado;
    if (tor) {
      tor.t++;
      if (tor.t > 30) tor.x += tor.dir * (rage ? 1.8 : 1.4);
      if (tor.t > 30 && Math.abs(tor.x - s.x) < 14 && s.y > 100) this.hitShip();
      if (tor.x < -20 || tor.x > FW + 20) gl.tornado = null;
    }
    // Your shots.
    for (const sh of this.shots) {
      if (Math.abs(sh.x - gl.x) < 20 && Math.abs(sh.y - gl.y) < 18) {
        sh.y = -99;
        gl.hp--;
        gl.hurt = 4;
        sfx.hit();
        if (gl.hp <= 0) {
          this.cameras.main.shake(500, 0.02);
          sfx.explode();
          this.bullets = [];
          return this.finish(true, 'GALE IS GROUNDED!');
        }
      }
    }
    if (Math.abs(gl.x - s.x) < 18 && Math.abs(gl.y - s.y) < 16) this.hitShip();
  }

  private stepBullets(): void {
    const s = this.ship;
    for (const b of this.bullets) {
      b.x += b.vx + this.wind.force * 0.3;
      b.y += b.vy;
      if (Math.abs(b.x - s.x) < b.r + 2 && Math.abs(b.y - s.y) < b.r + 2) {
        b.y = 999;
        this.hitShip();
      }
    }
    this.bullets = this.bullets.filter((b) => b.y < VIEW_H + 8 && b.y > -20 && b.x > -10 && b.x < FW + 10);
  }

  protected draw(): void {
    const g = this.g;
    g.clear();
    // Sky gradient and clouds.
    g.fillStyle(0x6ab8e8).fillRect(OX, 0, FW, VIEW_H);
    g.fillStyle(0x8ccaf0).fillRect(OX, VIEW_H * 0.5, FW, VIEW_H * 0.5);
    for (const cl of this.clouds) {
      g.fillStyle(0xffffff, 0.75).fillEllipse(OX + cl.x, cl.y, cl.w, cl.w * 0.4);
      g.fillStyle(0xe6f8ff, 0.75).fillEllipse(OX + cl.x + 6, cl.y + 3, cl.w * 0.7, cl.w * 0.25);
    }
    // Side margins.
    g.fillStyle(0x1a2a4a).fillRect(0, 0, OX, VIEW_H).fillRect(OX + FW, 0, VIEW_W - OX - FW, VIEW_H);
    // Wind: streaks blowing across (or arrows warning of it).
    const w = this.wind;
    if (w.warn > 0 && this.frame % 10 < 6) {
      for (let y = 40; y < VIEW_H; y += 40) {
        const x = w.target > 0 ? OX + 6 : OX + FW - 14;
        g.fillStyle(0xffffff).fillTriangle(x + (w.target > 0 ? 8 : 0), y, x + (w.target > 0 ? 0 : 8), y - 5, x + (w.target > 0 ? 0 : 8), y + 5);
      }
    }
    if (w.force) {
      g.fillStyle(0xffffff, 0.6);
      for (let i = 0; i < 16; i++) {
        const y = (i * 53 + this.frame * 3) % VIEW_H;
        const x = (i * 97 + this.frame * w.force * 6 + 1000 * FW) % FW;
        g.fillRect(OX + x, y, 14, 1);
      }
    }
    // Tornado.
    const tor = this.gale?.tornado;
    if (tor) {
      for (let y = 100; y < VIEW_H; y += 6) {
        const wob = Math.sin((y + this.frame * 6) / 9) * 4;
        g.fillStyle(tor.t > 30 ? 0xc8ccd8 : 0xffffff, tor.t > 30 ? 0.9 : 0.35).fillEllipse(OX + tor.x + wob, y, 10 + (y - 100) * 0.12, 4);
      }
    }
    // Gale.
    const gl = this.gale;
    if (gl) this.galeImg.setPosition(OX + gl.x, gl.y).setTexture(gl.attack === 3 ? 'gale_blow' : 'gale_idle').setTint(gl.hurt > 0 ? 0xff8888 : 0xffffff);
    // Bullets, power-ups, your shots, the ship.
    for (const b of this.bullets) {
      const col = b.kind === 'blade' ? 0xe6f8ff : b.kind === 'seed' ? 0x7a5a3a : 0xffe14a;
      g.fillStyle(0x1a1428).fillCircle(OX + b.x, b.y, b.r + 1);
      g.fillStyle(col).fillCircle(OX + b.x, b.y, b.r);
    }
    for (const p of this.powers) {
      g.fillStyle(0x1a1428).fillRect(OX + p.x - 6, p.y - 6, 12, 12);
      g.fillStyle(this.frame % 20 < 10 ? 0xf28c28 : 0xffe14a).fillRect(OX + p.x - 5, p.y - 5, 10, 10);
      g.fillStyle(0x1a1428).fillRect(OX + p.x - 2, p.y - 3, 2, 7).fillRect(OX + p.x - 2, p.y - 3, 5, 2).fillRect(OX + p.x + 2, p.y - 3, 1, 4).fillRect(OX + p.x - 2, p.y, 5, 1);
    }
    for (const sh of this.shots) g.fillStyle(0x5ef0c8).fillRect(OX + sh.x - 1, sh.y - 4, 2, 7);
    const s = this.ship;
    this.shipImg.setPosition(OX + s.x, s.y).setVisible(s.dead === 0 && !(s.invuln > 0 && this.frame % 6 < 3));
  }
}
