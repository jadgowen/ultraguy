import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../constants';
import { pixelText } from '../pixelFont';
import { sfx } from '../sfx';
import { ModeScene } from './ModeScene';
import { makeSkiesArt } from './skiesArt';

/**
 * GALE'S SKIES: a vertical-scrolling shooter. Fly up through the clouds while
 * wind gusts shove your ship sideways, past five kinds of foes:
 *  - kites sway down (some shoot seeds)
 *  - swooper squadrons dive across the sky in a U, one after another
 *  - spinners stop, fire a ring of seeds, and leave
 *  - balloon bombers drift down dropping bombs (tough; always carry a P)
 *  - darts flash a warning line, then streak straight down at you
 * P capsules power your shot: single, double, triple, five-way, and at five
 * a big laser beam that cuts through everything in its column (losing a ship
 * costs one level). Then Gale herself: feather fans, wind blades, a sweeping
 * tornado and gales. Three ships.
 */

const FW = 220;
const OX = Math.round((VIEW_W - FW) / 2);
const LIVES = 3;
const GALE_HP = 105;
const BOSS_AT = 60 * 45;
/** The tornado only spans the bottom of the sky: fly above it. */
const TOR_TOP = VIEW_H - 64;
const SHIP_TOP = 96;
const MAX_POWER = 5;
/** Laser: half its width, and damage per step to whatever's in it. */
const LASER_HALF = 7;
const LASER_DPS = 0.25;

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  kind: 'feather' | 'blade' | 'seed' | 'bomb';
  /** Falls (bombs). */
  g?: number;
}

type FoeKind = 'kite' | 'swoop' | 'spin' | 'balloon' | 'dart';

interface Foe {
  kind: FoeKind;
  x: number;
  y: number;
  t: number;
  hp: number;
  /** Carries a P capsule. */
  drop: boolean;
  flash: number;
  // Movement parameters (per kind).
  x0: number;
  amp: number;
  side: 1 | -1;
  shooter: boolean;
  dead?: boolean;
}

/** Hit box half-sizes, and what each is worth in toughness. */
const FOE: Record<FoeKind, { hw: number; hh: number; hp: number }> = {
  kite: { hw: 8, hh: 8, hp: 2 },
  swoop: { hw: 8, hh: 5, hp: 1 },
  spin: { hw: 8, hh: 8, hp: 5 },
  balloon: { hw: 10, hh: 14, hp: 9 },
  dart: { hw: 4, hh: 8, hp: 1 },
};

/** A spark or a puff from a blast. */
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: number;
  size: number;
}

export class SkiesScene extends ModeScene {
  protected readonly voice = 'gale';
  protected readonly music = 'skies';
  protected readonly homeStage = 'stratos' as const;

  private ship = { x: FW / 2, y: 200, invuln: 0, lives: LIVES, power: 1, dead: 0, fireT: 0, bank: 0 };
  private shots: { x: number; y: number; vx: number }[] = [];
  private bullets: Bullet[] = [];
  private foes: Foe[] = [];
  private powers: { x: number; y: number }[] = [];
  private sparks: Spark[] = [];
  private rings: { x: number; y: number; t: number; max: number; color: number }[] = [];
  private laser = { on: false, t: 0, top: 0 };
  private wind = { force: 0, target: 0, warn: 0, t: 0 };
  private gale: { x: number; y: number; hp: number; t: number; attack: number; tornado: { x: number; dir: number; t: number } | null; hurt: number } | null = null;
  private clouds: { x: number; y: number; s: number; key: string; front: boolean }[] = [];
  private islands: { x: number; y: number; key: string }[] = [];
  private g!: Phaser.GameObjects.Graphics;
  private fxG!: Phaser.GameObjects.Graphics;
  private hudG!: Phaser.GameObjects.Graphics;
  private galeImg!: Phaser.GameObjects.Image;
  private shipImg!: Phaser.GameObjects.Image;
  private flameImg!: Phaser.GameObjects.Image;
  private labels: ReturnType<typeof pixelText>[] = [];
  /** Images reused every frame (see put()). */
  private pool: Phaser.GameObjects.Image[] = [];
  private poolUsed = 0;

  constructor() {
    super('skies');
  }

  protected setup(): void {
    makeSkiesArt(this);
    this.cameras.main.setBackgroundColor('#4a88c8');
    this.ship = { x: FW / 2, y: 200, invuln: 0, lives: LIVES, power: 1, dead: 0, fireT: 0, bank: 0 };
    Object.assign(this, { shots: [], bullets: [], foes: [], powers: [], sparks: [], rings: [], gale: null, pool: [], poolUsed: 0, labels: [] });
    this.laser = { on: false, t: 0, top: 0 };
    this.wind = { force: 0, target: 0, warn: 0, t: 0 };
    this.clouds = Array.from({ length: 14 }, (_, i) => {
      const front = i % 5 === 0;
      return { x: Math.random() * FW, y: Math.random() * VIEW_H, s: front ? 2.2 + Math.random() * 0.6 : 0.5 + Math.random() * 1.1, key: `sk_cloud${front ? 0 : i % 3}`, front };
    });
    this.islands = [
      { x: FW * 0.25, y: 40, key: 'sk_island0' },
      { x: FW * 0.75, y: 160, key: 'sk_island1' },
    ];
    this.g = this.add.graphics().setDepth(0);
    this.fxG = this.add.graphics().setDepth(11).setBlendMode(Phaser.BlendModes.ADD);
    this.drawFrame();
    this.hudG = this.add.graphics().setDepth(21);
    this.galeImg = this.add.image(0, -50, 'gale_idle1').setScale(1.2).setDepth(6).setVisible(false);
    this.shipImg = this.add.image(0, 0, 'sk_ship').setDepth(8);
    this.flameImg = this.add.image(0, 0, 'sk_flame0').setDepth(7.9);
    const label = (x: number, y: number, t: string, color = '#9ac8f0') => {
      const l = pixelText(this, x, y, t, { color, stroke: '#000000' }).setOrigin(0.5, 0).setDepth(22);
      this.labels.push(l);
      return l;
    };
    label(OX / 2, 26, 'SHIPS');
    label(OX / 2, 74, 'POWER');
    label(OX / 2, 122, '').setName('laserTag');
    label(OX + FW + (VIEW_W - OX - FW) / 2, 18, 'ALTITUDE').setName('rightTag');
    this.help('ARROWS\nFLY\n\nHOLD FIRE\nSHOOT', OX / 2, 150);
  }

  /** The side panels: riveted steel with a sky-blue inner bevel. */
  private drawFrame(): void {
    const f = this.add.graphics().setDepth(20);
    for (const [x, w] of [[0, OX], [OX + FW, VIEW_W - OX - FW]] as const) {
      f.fillStyle(0x14203a).fillRect(x, 0, w, VIEW_H);
      for (let y = 0; y < VIEW_H; y += 4) f.fillStyle(y % 8 ? 0x182640 : 0x1c2c4a).fillRect(x, y, w, 2);
      f.fillStyle(0x2e4a7a).fillRect(x + 4, 8, w - 8, VIEW_H - 16);
      f.fillStyle(0x1a2a4a).fillRect(x + 5, 9, w - 10, VIEW_H - 18);
      for (const [rx, ry] of [[x + 7, 11], [x + w - 9, 11], [x + 7, VIEW_H - 13], [x + w - 9, VIEW_H - 13]]) {
        f.fillStyle(0x8ccaf0).fillRect(rx, ry, 2, 2);
        f.fillStyle(0x0e1626).fillRect(rx + 1, ry + 1, 1, 1);
      }
    }
    // Field edges: a dark rim, then a bright inner line.
    f.fillStyle(0x0e1626).fillRect(OX - 3, 0, 3, VIEW_H).fillRect(OX + FW, 0, 3, VIEW_H);
    f.fillStyle(0x8ccaf0).fillRect(OX - 1, 0, 1, VIEW_H).fillRect(OX + FW, 0, 1, VIEW_H);
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
    this.laser.on = false;
    if (s.dead > 0) {
      if (--s.dead === 0) {
        if (s.lives <= 0) return this.finish(false, 'BLOWN AWAY...');
        Object.assign(s, { x: FW / 2, y: 200, invuln: 120 });
      }
    } else {
      const dx = (c.isDown('right') ? 1 : 0) - (c.isDown('left') ? 1 : 0);
      s.x += dx * 2.1 + w.force;
      s.y += ((c.isDown('down') ? 1 : 0) - (c.isDown('up') ? 1 : 0)) * 2.1;
      s.bank += (dx - s.bank) * 0.25;
      s.x = Phaser.Math.Clamp(s.x, 8, FW - 8);
      s.y = Phaser.Math.Clamp(s.y, SHIP_TOP, VIEW_H - 12);
      const firing = c.isDown('fire') || c.isDown('jump');
      if (firing && s.power >= MAX_POWER) {
        // The big laser: a beam straight up for as long as you hold fire.
        this.laser.on = true;
        this.laser.t++;
        if (this.laser.t % 10 === 1) sfx.laser();
      } else {
        this.laser.t = 0;
        if (firing && ++s.fireT % 7 === 1) {
          const spread = [[0], [-4, 4], [-6, 0, 6], [-10, -5, 0, 5, 10]][s.power - 1] ?? [0];
          for (const dx2 of spread) this.shots.push({ x: s.x + dx2, y: s.y - 8, vx: dx2 * (s.power >= 4 ? 0.09 : 0.05) });
          sfx.shoot();
        }
      }
      if (s.invuln > 0) s.invuln--;
    }
    for (const sh of this.shots) {
      sh.y -= 6;
      sh.x += sh.vx;
    }
    this.shots = this.shots.filter((sh) => sh.y > -8);
    // Where the laser stops: it cuts through everything, up to the top of the sky.
    this.laser.top = 0;
    if (this.playT < BOSS_AT) this.stepFoes();
    else this.stepGale();
    this.stepBullets();
    for (const p of this.powers) {
      p.y += 0.9;
      if (Math.abs(p.x - s.x) < 11 && Math.abs(p.y - s.y) < 11 && s.dead === 0) {
        p.y = 999;
        const was = s.power;
        s.power = Math.min(MAX_POWER, s.power + 1);
        sfx.pickup();
        this.ring(s.x, s.y, 0xffe14a, 18);
        if (s.power === MAX_POWER && was < MAX_POWER) {
          this.banner.setText('LASER!');
          this.time.delayedCall(900, () => !this.result && this.banner.text === 'LASER!' && this.banner.setText(''));
        }
      }
    }
    this.powers = this.powers.filter((p) => p.y < VIEW_H);
    for (const cl of this.clouds) {
      cl.y += cl.s;
      if (cl.y > VIEW_H + 30) Object.assign(cl, { y: -30, x: Math.random() * FW });
    }
    for (const is of this.islands) {
      is.y += 0.25;
      if (is.y > VIEW_H + 40) Object.assign(is, { y: -40, x: 20 + Math.random() * (FW - 40) });
    }
    this.stepFx();
  }

  private hitShip(): void {
    const s = this.ship;
    if (s.dead || s.invuln) return;
    s.lives--;
    s.dead = 70;
    // Losing a ship costs a level of shot (the laser has to be earned back).
    s.power = Math.max(1, s.power - 1);
    sfx.explode();
    this.blast(s.x, s.y, 1.6);
    this.cameras.main.shake(220, 0.012);
  }

  // --- effects -------------------------------------------------------------------------

  private ring(x: number, y: number, color: number, max = 14): void {
    this.rings.push({ x, y, t: 0, max, color });
  }

  /** An explosion: a flash ring, hot sparks and a few dark puffs. */
  private blast(x: number, y: number, size = 1): void {
    this.ring(x, y, 0xfff4c0, 12 * size);
    const n = Math.round(10 * size);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (0.6 + Math.random() * 1.8) * size;
      const life = 16 + Math.floor(Math.random() * 14);
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color: i % 3 === 0 ? 0xffffff : i % 3 === 1 ? 0xffe14a : 0xf28c28, size: 1 + Math.random() * 1.5 });
    }
  }

  private stepFx(): void {
    for (const p of this.sparks) {
      p.x += p.vx;
      p.y += p.vy + 0.4;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life--;
    }
    this.sparks = this.sparks.filter((p) => p.life > 0);
    for (const r of this.rings) r.t++;
    this.rings = this.rings.filter((r) => r.t < 14);
  }

  // --- foes ----------------------------------------------------------------------------

  private spawn(kind: FoeKind, x: number, y: number, extra: Partial<Foe> = {}): void {
    this.foes.push({ kind, x, y, t: 0, hp: FOE[kind].hp, drop: false, flash: 0, x0: x, amp: 0, side: 1, shooter: false, ...extra });
  }

  /** The flight in: what turns up when. */
  private schedule(t: number): void {
    if (t >= BOSS_AT - 180) return;
    // Kites all the way (fewer once the others join in).
    if (t % (t < 600 ? 50 : 80) === 0) {
      const x0 = 30 + Math.random() * (FW - 60);
      const n = t % 300 === 0 ? 4 : 1;
      for (let i = 0; i < n; i++) this.spawn('kite', x0, -16 - i * 22, { t: -i * 14, x0, amp: 20 + Math.random() * 40, drop: Math.random() < 0.12, shooter: Math.random() < 0.5 });
    }
    // Swooper squadrons, alternating sides.
    if ([300, 900, 1500, 2050, 2450].includes(t)) {
      const side: 1 | -1 = (t / 300) % 2 ? 1 : -1;
      for (let i = 0; i < 5; i++) this.spawn('swoop', 0, -20, { t: -i * 12, side, drop: i === 4 && Math.random() < 0.5 });
    }
    // Spinners hang in the sky and fire rings.
    if ([700, 1300, 1900, 2300].includes(t)) this.spawn('spin', 40 + Math.random() * (FW - 80), -12);
    if (t === 1900) this.spawn('spin', FW - 40, -30);
    // Balloon bombers: slow, tough, and always carrying a P.
    if ([500, 1100, 1700, 2200].includes(t)) this.spawn('balloon', 30 + Math.random() * (FW - 60), -30, { drop: true });
    // Darts at your column, more often as you climb.
    if (t >= 1000 && t % (t > 1900 ? 150 : 230) === 0) this.spawn('dart', Phaser.Math.Clamp(this.ship.x, 10, FW - 10), -14);
  }

  private stepFoes(): void {
    const t = this.playT;
    const s = this.ship;
    this.schedule(t);
    for (const f of this.foes) {
      f.t++;
      if (f.flash > 0) f.flash--;
      switch (f.kind) {
        case 'kite':
          f.y += 0.9;
          f.x = Phaser.Math.Clamp(f.x0 + Math.sin(f.t / 30) * f.amp + this.wind.force * f.t * 0.2, 10, FW - 10);
          if (f.shooter && f.t > 0 && f.t % 140 === 40 && f.y > 0 && f.y < 140) this.aimed(f.x, f.y, 1.6, 'seed');
          break;
        case 'swoop': {
          // A U across the sky: in from the top on one side, down, and out the top on the other.
          if (f.t < 0) {
            f.y = -30;
            break;
          }
          const u = f.t / 150;
          f.x = f.side > 0 ? -12 + u * (FW + 24) : FW + 12 - u * (FW + 24);
          f.y = -16 + Math.sin(Math.min(1, u) * Math.PI) * 130;
          if (f.t === 75) this.aimed(f.x, f.y, 2, 'seed');
          if (u > 1) f.y = -99;
          break;
        }
        case 'spin':
          // Down, a pause, two rings of seeds, then away up.
          if (f.t < 50) f.y += 1.6 * (1 - f.t / 60);
          else if (f.t > 150) f.y -= 1.4;
          if (f.t === 70 || f.t === 115) {
            const n = 8;
            for (let i = 0; i < n; i++) {
              const a = (i / n) * Math.PI * 2 + (f.t === 115 ? Math.PI / n : 0);
              this.bullets.push({ x: f.x, y: f.y, vx: Math.cos(a) * 1.4, vy: Math.sin(a) * 1.4, r: 2, kind: 'seed' });
            }
            sfx.zap();
          }
          if (f.t > 150 && f.y < -20) f.y = -99;
          break;
        case 'balloon':
          f.y += 0.35;
          f.x = Phaser.Math.Clamp(f.x0 + Math.sin(f.t / 60) * 14 + this.wind.force * f.t * 0.1, 12, FW - 12);
          if (f.t % 80 === 40 && f.y > 0) {
            this.bullets.push({ x: f.x, y: f.y + 16, vx: 0, vy: 0.3, r: 3, kind: 'bomb', g: 0.05 });
            sfx.enemyShot();
          }
          break;
        case 'dart':
          // A warning line for a moment, then straight down.
          if (f.t > 42) f.y += 5;
          break;
      }
      // Your shots.
      const box = FOE[f.kind];
      if (f.y > -10 && !(f.kind === 'dart' && f.t <= 42)) {
        for (const sh of this.shots) {
          if (Math.abs(sh.x - f.x) < box.hw + 2 && Math.abs(sh.y - f.y) < box.hh + 3) {
            sh.y = -99;
            this.hurtFoe(f, 1);
          }
        }
        if (this.laser.on && f.y < s.y && Math.abs(f.x - s.x) < box.hw + LASER_HALF) this.hurtFoe(f, LASER_DPS);
      }
      if (!f.dead && f.y < VIEW_H && f.y > -10 && Math.abs(f.x - s.x) < box.hw + 4 && Math.abs(f.y - s.y) < box.hh + 4) this.hitShip();
    }
    this.foes = this.foes.filter((f) => !f.dead && f.y < VIEW_H + 30 && f.y > -98);
  }

  private aimed(x: number, y: number, speed: number, kind: Bullet['kind']): void {
    const a = Math.atan2(this.ship.y - y, this.ship.x - x);
    this.bullets.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 2, kind });
  }

  private hurtFoe(f: Foe, dmg: number): void {
    if (f.dead) return;
    f.hp -= dmg;
    if (dmg >= 1 || f.flash === 0) f.flash = 4;
    if (f.hp > 0) return;
    f.dead = true;
    if (f.drop) this.powers.push({ x: f.x, y: f.y });
    this.blast(f.x, f.y, f.kind === 'balloon' ? 1.8 : f.kind === 'spin' ? 1.3 : 1);
    if (f.kind === 'balloon') {
      sfx.explode();
      this.cameras.main.shake(120, 0.006);
    } else sfx.alienDie();
  }

  // --- Gale ----------------------------------------------------------------------------

  private stepGale(): void {
    if (!this.gale) {
      for (const f of this.foes) if (!f.dead && f.y > 0) this.blast(f.x, f.y, 0.8);
      this.foes = [];
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
      if (tor.t > 30 && Math.abs(tor.x - s.x) < 14 && s.y > TOR_TOP - 4) this.hitShip();
      if (tor.x < -20 || tor.x > FW + 20) gl.tornado = null;
    }
    // Your shots, and the laser.
    let dmg = 0;
    for (const sh of this.shots) {
      if (Math.abs(sh.x - gl.x) < 20 && Math.abs(sh.y - gl.y) < 18) {
        sh.y = -99;
        dmg += 1;
      }
    }
    if (this.laser.on && gl.y < s.y && Math.abs(gl.x - s.x) < 20 + LASER_HALF) {
      dmg += LASER_DPS * 0.8;
      this.laser.top = gl.y + 14;
    }
    if (dmg > 0) {
      gl.hp -= dmg;
      if (dmg >= 1 || gl.hurt === 0) gl.hurt = 4;
      if (dmg >= 1) sfx.hit();
      if (gl.hp <= 0) {
        this.cameras.main.shake(500, 0.02);
        sfx.explode();
        this.bullets = [];
        for (let i = 0; i < 4; i++) this.blast(gl.x + Phaser.Math.Between(-16, 16), gl.y + Phaser.Math.Between(-12, 12), 1.6);
        this.galeImg.setVisible(false);
        return this.finish(true, 'GALE IS GROUNDED!');
      }
    }
    if (Math.abs(gl.x - s.x) < 18 && Math.abs(gl.y - s.y) < 16) this.hitShip();
  }

  private stepBullets(): void {
    const s = this.ship;
    for (const b of this.bullets) {
      if (b.g) b.vy += b.g;
      b.x += b.vx + this.wind.force * 0.3;
      b.y += b.vy;
      if (Math.abs(b.x - s.x) < b.r + 2 && Math.abs(b.y - s.y) < b.r + 2) {
        b.y = 999;
        this.hitShip();
      }
    }
    this.bullets = this.bullets.filter((b) => b.y < VIEW_H + 8 && b.y > -20 && b.x > -10 && b.x < FW + 10);
  }

  // --- drawing -------------------------------------------------------------------------

  /** Show a pooled image this frame. */
  private put(key: string, x: number, y: number, o: { depth?: number; rot?: number; alpha?: number; flash?: boolean; sx?: number; sy?: number; flipX?: boolean } = {}): void {
    let img = this.pool[this.poolUsed];
    if (!img) {
      img = this.add.image(0, 0, key);
      this.pool.push(img);
    }
    this.poolUsed++;
    img.setTexture(key).setPosition(Math.round(x), Math.round(y)).setDepth(o.depth ?? 5).setRotation(o.rot ?? 0).setAlpha(o.alpha ?? 1).setScale(o.sx ?? 1, o.sy ?? o.sx ?? 1).setFlipX(!!o.flipX).setVisible(true);
    if (o.flash) img.setTintFill(0xffffff);
    else img.clearTint();
  }

  protected draw(): void {
    const g = this.g;
    g.clear();
    this.poolUsed = 0;
    // Sky: a dithered gradient from deep blue up top to pale near the clouds below.
    const bands = 24;
    const top = Phaser.Display.Color.ValueToColor(0x3a7cc8);
    const low = Phaser.Display.Color.ValueToColor(0xa8dcf6);
    for (let i = 0; i < bands; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, low, bands - 1, i);
      const y = Math.floor((i * VIEW_H) / bands);
      const h = Math.ceil(VIEW_H / bands) + 1;
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b)).fillRect(OX, y, FW, h);
      // A checker row where bands meet, so the steps blend.
      if (i > 0) {
        const p = Phaser.Display.Color.Interpolate.ColorWithColor(top, low, bands - 1, i - 1);
        g.fillStyle(Phaser.Display.Color.GetColor(p.r, p.g, p.b));
        for (let x = (i % 2) * 2; x < FW; x += 4) g.fillRect(OX + x, y, 2, 1);
      }
    }
    // Sun glare near the top.
    g.fillStyle(0xffffff, 0.08).fillCircle(OX + FW * 0.78, 18, 46);
    g.fillStyle(0xffffff, 0.12).fillCircle(OX + FW * 0.78, 18, 24);
    // Far below: floating islands drifting past, then the clouds (slow ones behind).
    for (const is of this.islands) this.put(is.key, OX + is.x, is.y, { depth: 0.5, alpha: 0.75 });
    for (const cl of this.clouds) if (!cl.front) this.put(cl.key, OX + cl.x, cl.y, { depth: 1, alpha: 0.55 + cl.s * 0.3 });
    // Wind: streaks blowing across (or arrows warning of it).
    const w = this.wind;
    if (w.warn > 0 && this.frame % 10 < 6) {
      for (let y = 30; y < VIEW_H; y += 40) {
        const x = w.target > 0 ? OX + 6 : OX + FW - 14;
        g.fillStyle(0xffffff).fillTriangle(x + (w.target > 0 ? 8 : 0), y, x + (w.target > 0 ? 0 : 8), y - 5, x + (w.target > 0 ? 0 : 8), y + 5);
      }
    }
    if (w.force) {
      for (let i = 0; i < 16; i++) {
        const y = (i * 53 + this.frame * 3) % VIEW_H;
        const x = (i * 97 + this.frame * w.force * 6 + 1000 * FW) % FW;
        g.fillStyle(0xffffff, 0.35).fillRect(OX + x, y, 22, 1);
        g.fillStyle(0xffffff, 0.7).fillRect(OX + x + (w.force > 0 ? 14 : 0), y, 8, 1);
      }
    }
    // Dart warnings: a blinking line down its column.
    for (const f of this.foes)
      if (f.kind === 'dart' && f.t <= 42 && this.frame % 8 < 5) {
        for (let y = 4; y < VIEW_H; y += 8) g.fillStyle(0xff4a5a, 0.7).fillRect(OX + f.x - 1, y, 2, 4);
        g.fillStyle(0xff4a5a).fillTriangle(OX + f.x, 14, OX + f.x - 5, 4, OX + f.x + 5, 4);
      }
    // Tornado.
    const tor = this.gale?.tornado;
    if (tor) {
      for (let y = TOR_TOP; y < VIEW_H + 4; y += 4) {
        const wob = Math.sin((y + this.frame * 6) / 9) * 4;
        const k = (y - TOR_TOP) / (VIEW_H - TOR_TOP);
        g.fillStyle(tor.t > 30 ? (y % 8 ? 0xc8ccd8 : 0xeef2fa) : 0xffffff, tor.t > 30 ? 0.9 : 0.35).fillEllipse(OX + tor.x + wob, y, 8 + (1 - k) * 34, 5);
      }
    }
    // Foes.
    for (const f of this.foes) {
      if (f.y < -20) continue;
      const flash = f.flash > 0 && f.flash % 2 === 0;
      const x = OX + f.x;
      switch (f.kind) {
        case 'kite':
          this.put(`sk_kite${Math.floor(f.t / 12) % 2}`, x, f.y + 4, { flash });
          break;
        case 'swoop':
          this.put(`sk_swoop${Math.floor(f.t / 5) % 2}`, x, f.y, { flash, flipX: f.side < 0 });
          break;
        case 'spin':
          this.put(`sk_spin${Math.floor(f.t / 3) % 2}`, x, f.y, { flash });
          break;
        case 'balloon':
          this.put('sk_balloon', x, f.y, { flash });
          break;
        case 'dart':
          if (f.t > 42) this.put('sk_dart', x, f.y, { flash });
          break;
      }
    }
    // Gale.
    const gl = this.gale;
    if (gl) {
      const frame = gl.attack === 3 ? `gale_blow${Math.floor(gl.t / 4) % 2 + 1}` : gl.attack === 1 ? 'gale_aim' : `gale_idle${(Math.floor(gl.t / 6) % 4) + 1}`;
      this.galeImg.setPosition(OX + gl.x, gl.y + 10).setTexture(frame);
      if (gl.hurt > 0 && gl.hurt % 2 === 0) this.galeImg.setTintFill(0xffffff);
      else this.galeImg.clearTint();
    }
    // Enemy shots.
    for (const b of this.bullets) {
      const x = OX + b.x;
      if (b.kind === 'feather') this.put('sk_feather', x, b.y, { depth: 9, rot: Math.atan2(b.vy, b.vx) - Math.PI / 2 });
      else if (b.kind === 'blade') this.put('sk_blade', x, b.y, { depth: 9, rot: this.frame * 0.4 });
      else if (b.kind === 'bomb') this.put('sk_bomb', x, b.y, { depth: 9 });
      else this.put('sk_seed', x, b.y, { depth: 9 });
    }
    for (const p of this.powers) this.put('sk_power', OX + p.x, p.y + Math.sin(this.frame / 6) * 1.5, { depth: 9 });
    // Your shots: glowing bolts.
    for (const sh of this.shots) {
      g.fillStyle(0x2aa088).fillRect(OX + sh.x - 1, sh.y - 3, 3, 8);
      g.fillStyle(0xbffff0).fillRect(OX + sh.x, sh.y - 4, 1, 8);
    }
    // The ship (banking as it slides), its engine, and the clouds that pass over it.
    const s = this.ship;
    const shown = s.dead === 0 && !(s.invuln > 0 && this.frame % 6 < 3);
    this.shipImg.setPosition(OX + Math.round(s.x), Math.round(s.y)).setScale(1 - Math.abs(s.bank) * 0.18, 1).setVisible(shown);
    this.flameImg
      .setTexture(`sk_flame${Math.floor(this.frame / 3) % 2}`)
      .setPosition(OX + Math.round(s.x), Math.round(s.y) + 11)
      .setVisible(shown);
    for (const cl of this.clouds) if (cl.front) this.put(cl.key, OX + cl.x, cl.y, { depth: 12, alpha: 0.5 });
    this.drawFx(shown);
    this.drawHud();
    for (let i = this.poolUsed; i < this.pool.length; i++) this.pool[i].setVisible(false);
  }

  /** Additive light: the laser, shot glows, blast rings and sparks. */
  private drawFx(shipShown: boolean): void {
    const f = this.fxG;
    f.clear();
    const s = this.ship;
    if (this.laser.on && shipShown) {
      const x = OX + s.x;
      const y0 = s.y - 10;
      const y1 = this.laser.top;
      const flick = 0.85 + Math.random() * 0.15;
      const wob = Math.sin(this.frame * 0.9) * 1.5;
      f.fillStyle(0x2a9ad8, 0.35 * flick).fillRect(x - LASER_HALF - 4 - wob, y1, (LASER_HALF + 4) * 2 + wob * 2, y0 - y1);
      f.fillStyle(0x5ef0f0, 0.7 * flick).fillRect(x - LASER_HALF, y1, LASER_HALF * 2, y0 - y1);
      f.fillStyle(0xe6fbff, flick).fillRect(x - 2, y1, 4, y0 - y1);
      // Rings travelling up the beam, a blaze at the muzzle, sparks where it ends.
      for (let i = 0; i < 6; i++) {
        const yy = y0 - ((this.frame * 7 + i * 40) % Math.max(1, y0 - y1));
        f.fillStyle(0xffffff, 0.5).fillRect(x - LASER_HALF - 1, yy, LASER_HALF * 2 + 2, 2);
      }
      f.fillStyle(0xffffff, 0.9).fillCircle(x, y0, 7 + Math.random() * 2);
      f.fillStyle(0x5ef0f0, 0.5).fillCircle(x, y0, 12);
      if (y1 > 0) {
        f.fillStyle(0xffffff, 0.8).fillCircle(x, y1, 6 + Math.random() * 3);
        if (this.frame % 2 === 0) this.sparks.push({ x: s.x + Phaser.Math.Between(-6, 6), y: y1 - 2, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2, life: 10, max: 10, color: 0xbffff0, size: 1.5 });
      }
    }
    for (const sh of this.shots) f.fillStyle(0x5ef0c8, 0.3).fillCircle(OX + sh.x, sh.y, 4);
    for (const b of this.bullets) f.fillStyle(b.kind === 'blade' ? 0x9ee8ff : b.kind === 'feather' ? 0xffe14a : 0xff8a5a, 0.25).fillCircle(OX + b.x, b.y, b.r + 4);
    for (const p of this.powers) f.fillStyle(0xffe14a, 0.25 + Math.sin(this.frame / 5) * 0.12).fillCircle(OX + p.x, p.y, 11);
    for (const r of this.rings) {
      const k = r.t / 14;
      f.lineStyle(3 - k * 2, r.color, 1 - k).strokeCircle(OX + r.x, r.y, 3 + k * r.max);
    }
    for (const p of this.sparks) {
      const a = p.life / p.max;
      f.fillStyle(p.color, a).fillRect(OX + p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  }

  /** Side panels: ships left and shot power on the left; altitude (then Gale's health) on the right. */
  private drawHud(): void {
    const h = this.hudG;
    h.clear();
    this.hud.setText('');
    const s = this.ship;
    const cx = OX / 2;
    // Ships: little fighters.
    for (let i = 0; i < Math.max(0, s.lives); i++) this.put('sk_ship', cx - 12 + i * 12, 46, { depth: 22, sx: 0.6 });
    // Power: five pips; the fifth is the laser.
    for (let i = 0; i < MAX_POWER; i++) {
      const x = cx - 22 + i * 9;
      const on = i < s.power;
      const laser = i === MAX_POWER - 1;
      h.fillStyle(0x0e1626).fillRect(x, 90, 8, 12);
      h.fillStyle(on ? (laser ? (this.frame % 10 < 5 ? 0x5ef0f0 : 0xe6fbff) : 0xf28c28) : 0x2a3a5a).fillRect(x + 1, 91, 6, 10);
      if (on) h.fillStyle(laser ? 0xffffff : 0xffe14a).fillRect(x + 1, 91, 6, 2);
    }
    const tag = this.labels.find((l) => l.name === 'laserTag');
    tag?.setText(s.power >= MAX_POWER ? 'LASER!' : '').setColor(this.frame % 20 < 10 ? '#5ef0f0' : '#e6fbff');
    // Right: the climb to Gale, then her health.
    const rx = OX + FW + (VIEW_W - OX - FW) / 2;
    const right = this.labels.find((l) => l.name === 'rightTag');
    const gl = this.gale;
    const barTop = 32;
    const barH = 152;
    h.fillStyle(0x0e1626).fillRect(rx - 6, barTop - 2, 12, barH + 4);
    h.fillStyle(0x55607a).fillRect(rx - 5, barTop - 1, 10, barH + 2);
    h.fillStyle(0x0e1626).fillRect(rx - 3, barTop, 6, barH);
    if (gl) {
      right?.setText('GALE');
      const units = 28;
      const filled = Math.ceil((units * Math.max(0, gl.hp)) / GALE_HP);
      for (let i = 0; i < units; i++) {
        const y = barTop + barH - (i + 1) * (barH / units) + 1;
        if (i < filled) {
          h.fillStyle(0xf28c28).fillRect(rx - 3, y, 6, barH / units - 2);
          h.fillStyle(0xffe14a).fillRect(rx - 3, y, 1, barH / units - 2);
        } else h.fillStyle(0x2a2a40).fillRect(rx - 3, y, 6, barH / units - 2);
      }
    } else {
      right?.setText('ALTITUDE');
      const k = Math.min(1, this.playT / BOSS_AT);
      const fill = Math.round(barH * k);
      h.fillStyle(0x3a7cc8).fillRect(rx - 3, barTop + barH - fill, 6, fill);
      h.fillStyle(0x9cd4f4).fillRect(rx - 3, barTop + barH - fill, 2, fill);
      // Gale waits at the top; your ship climbs toward her.
      this.put('gale_idle1', rx, barTop - 4, { depth: 22, sx: 0.4 });
      this.put('sk_ship', rx, barTop + barH - fill, { depth: 22, sx: 0.6 });
    }
  }
}
