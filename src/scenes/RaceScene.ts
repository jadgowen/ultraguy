import Phaser from 'phaser';
import { loopSfx, playMusic, playVoice, stopMusic } from '../audio';
import { STEP_MS, VIEW_H, VIEW_W } from '../constants';
import { Controls } from '../input';
import type { StageId } from '../level/Level';
import { pixelText } from '../pixelFont';
import { sfx } from '../sfx';
import { pixelateIn } from './cutscene';
import { ModeData, returnToGame } from './encounters';

/**
 * VOLT'S RACE: a side-view motocross race against Volt, in place of his boss
 * fight. Four lanes, a throttle and a turbo that heats the engine (overheat
 * and you stall), ramps where your landing angle matters, mud that slows you,
 * cooling strips that reset the heat.
 *
 * Controls: JUMP = throttle, FIRE = turbo, UP/DOWN = change lane,
 * LEFT/RIGHT in the air = tilt back / forward.
 */

export interface RaceData {
  stage: StageId;
  ret?: ModeData['ret'];
}

const TRACK_LEN = 6200;
const LANES = 4;
/** Screen y of each lane's ground line (back lane first). */
const LANE_Y = [148, 166, 184, 202];
const LANE_H = 18;

// Bike handling.
const THROTTLE = 3.0;
const TURBO = 4.1;
const ACCEL = 0.05;
const COAST = 0.035;
const GRAVITY = 0.17;
const HEAT_THROTTLE = -0.05;
const HEAT_TURBO = 0.42;
const HEAT_COOL = 0.3;
const STALL_FRAMES = 150;
const CRASH_FRAMES = 100;
const TILT = 0.045;
const MUD_CAP = 1.3;

interface Ramp {
  x: number;
  up: number;
  top: number;
  down: number;
  h: number;
}

interface Patch {
  x: number;
  w: number;
  lane: number;
  kind: 'mud' | 'cool';
}

interface Bike {
  x: number;
  v: number;
  lane: number;
  laneTarget: number;
  alt: number;
  vy: number;
  air: boolean;
  angle: number;
  heat: number;
  stall: number;
  crash: number;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  finished: number;
}

/** The course: ramps across every lane, mud and cooling strips in some lanes. */
function buildCourse(): { ramps: Ramp[]; patches: Patch[] } {
  const ramps: Ramp[] = [];
  const patches: Patch[] = [];
  // [x, up, top, down, h]: small bumps, tabletops, big jumps.
  const R: [number, number, number, number, number][] = [
    [420, 40, 10, 40, 10],
    [700, 60, 0, 8, 24],
    [1000, 30, 0, 30, 8], [1060, 30, 0, 30, 8], [1120, 30, 0, 30, 8],
    [1400, 80, 60, 80, 22],
    [1800, 90, 0, 10, 38],
    [2250, 40, 0, 6, 16], [2420, 40, 0, 6, 16],
    [2750, 120, 120, 20, 30],
    [3250, 70, 0, 8, 30],
    [3600, 30, 0, 30, 8], [3660, 30, 0, 30, 8], [3720, 30, 0, 30, 8], [3780, 30, 0, 30, 8],
    [4100, 100, 0, 10, 44],
    [4600, 60, 30, 60, 18],
    [5000, 90, 0, 8, 36],
    [5450, 40, 0, 6, 14], [5600, 40, 0, 6, 14],
  ];
  for (const [x, up, top, down, h] of R) ramps.push({ x, up, top, down, h });
  const P: [number, number, number, Patch['kind']][] = [
    [560, 90, 2, 'mud'],
    [880, 70, 1, 'cool'],
    [1250, 110, 0, 'mud'], [1250, 110, 3, 'mud'],
    [1640, 80, 2, 'cool'],
    [2050, 140, 1, 'mud'], [2050, 140, 2, 'mud'],
    [2600, 70, 0, 'cool'],
    [3000, 160, 3, 'mud'],
    [3420, 80, 1, 'cool'],
    [3950, 120, 0, 'mud'], [3950, 120, 1, 'mud'],
    [4400, 80, 3, 'cool'],
    [4800, 150, 2, 'mud'],
    [5250, 70, 0, 'cool'], [5250, 70, 3, 'cool'],
    [5750, 120, 1, 'mud'],
  ];
  for (const [x, w, lane, kind] of P) patches.push({ x, w, lane, kind });
  return { ramps, patches };
}

export class RaceScene extends Phaser.Scene {
  private controls!: Controls;
  private stageId: StageId = 'powerplant';
  private ramps: Ramp[] = [];
  private patches: Patch[] = [];
  private player!: Bike;
  private volt!: Bike;
  private camX = 0;
  private acc = 0;
  private frame = 0;
  private laneGfx: Phaser.GameObjects.Graphics[] = [];
  private bg: Phaser.GameObjects.TileSprite[] = [];
  private hud!: Phaser.GameObjects.Graphics;
  /** Dust off the tyres and exhaust puffs (world x, screen y). */
  private dust: { x: number; y: number; vx: number; vy: number; t: number; col: number }[] = [];
  private dustG!: Phaser.GameObjects.Graphics;
  private banner!: ReturnType<typeof pixelText>;
  private timeText!: ReturnType<typeof pixelText>;
  private countdown = 0;
  private result: 'win' | 'lose' | null = null;
  private resultT = 0;
  private engine: Phaser.Sound.BaseSound | null = null;

  constructor() {
    super('race');
  }

  /** Where we came from (sent back at the end). */
  private mode: ModeData = { stage: 'powerplant', ret: { kind: 'vault', step: 0 } };

  create(data: RaceData): void {
    this.stageId = data?.stage ?? 'powerplant';
    this.mode = { stage: this.stageId, ret: data?.ret ?? { kind: 'vault', step: 0 } };
    this.controls = new Controls(this);
    ({ ramps: this.ramps, patches: this.patches } = buildCourse());
    this.acc = 0;
    this.frame = 0;
    this.camX = 0;
    this.result = null;
    this.resultT = 0;
    this.countdown = 200;
    makeBikeTextures(this);

    this.cameras.main.setBackgroundColor('#0a0f1c');
    this.bg = [0, 1, 2].map((l) => this.add.tileSprite(0, -40, VIEW_W, VIEW_H, `bgl_power_${l}`).setOrigin(0).setScrollFactor(0).setDepth(-20 + l));
    // The stands: a crowd strip and a banner.
    this.add.tileSprite(0, 98, VIEW_W, 34, 'race_crowd').setOrigin(0).setScrollFactor(0).setDepth(-5).setName('crowd');
    this.add.rectangle(0, 128, VIEW_W, 6, 0x24385a).setOrigin(0).setScrollFactor(0).setDepth(-4);
    this.add.rectangle(0, 128, VIEW_W, 1, 0x3aa8c8).setOrigin(0).setScrollFactor(0).setDepth(-4);
    this.laneGfx = LANE_Y.map((_, i) => this.add.graphics().setDepth(i * 10));
    const mk = (tex: string, lane: number): Bike => ({
      x: 40,
      v: 0,
      lane,
      laneTarget: lane,
      alt: 0,
      vy: 0,
      air: false,
      angle: 0,
      heat: 0,
      stall: 0,
      crash: 0,
      sprite: this.add.image(0, 0, tex).setOrigin(0.5, 1),
      shadow: this.add.ellipse(0, 0, 20, 4, 0x000000, 0.35),
      finished: 0,
    });
    this.player = mk('bike_hero', 2);
    this.volt = mk('bike_volt', 1);
    this.hud = this.add.graphics().setScrollFactor(0).setDepth(60);
    this.dust = [];
    this.dustG = this.add.graphics().setScrollFactor(0).setDepth(45);
    this.banner = pixelText(this, VIEW_W / 2, 64, '', { fontSize: '16px', color: '#fff1e0', stroke: '#000000' }).setOrigin(0.5).setScrollFactor(0).setDepth(61);
    this.timeText = pixelText(this, VIEW_W - 8, 6, '0:00.0', { color: '#fff1e0', stroke: '#000000' }).setOrigin(1, 0).setScrollFactor(0).setDepth(61);
    pixelText(this, 8, 6, 'VOLT SPEEDWAY', { color: '#f8e040', stroke: '#000000' }).setScrollFactor(0).setDepth(61);
    pixelText(this, 8, VIEW_H - 22, 'JUMP GAS  FIRE TURBO  UP/DOWN LANE  L/R TILT', { color: '#8a8fa8', stroke: '#000000' }).setScrollFactor(0).setDepth(61);

    stopMusic();
    pixelateIn(this, 900);
    this.time.delayedCall(500, () => playVoice(this, 'race_go'));
    this.events.once('shutdown', () => this.engine?.stop());
  }

  update(_t: number, delta: number): void {
    this.acc += Math.min(delta, 100);
    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS;
      this.step();
    }
    this.draw();
  }

  // --- course -----------------------------------------------------------------

  private groundH(x: number): number {
    for (const r of this.ramps) {
      if (x < r.x || x > r.x + r.up + r.top + r.down) continue;
      const u = x - r.x;
      if (u < r.up) return (u / r.up) * r.h;
      if (u < r.up + r.top) return r.h;
      return r.h * (1 - (u - r.up - r.top) / r.down);
    }
    return 0;
  }

  private slopeAt(x: number): number {
    return (this.groundH(x + 2) - this.groundH(x - 2)) / 4;
  }

  private patchAt(x: number, lane: number): Patch['kind'] | null {
    const l = Math.round(lane);
    for (const p of this.patches) if (p.lane === l && x >= p.x && x <= p.x + p.w) return p.kind;
    return null;
  }

  // --- simulation -------------------------------------------------------------------

  private step(): void {
    this.frame++;
    this.controls.poll();
    if (this.countdown > 0) {
      this.countdown--;
      const n = Math.ceil((this.countdown - 20) / 60);
      this.banner.setText(this.countdown > 20 ? (n > 0 ? String(n) : '') : 'GO!');
      if (this.countdown === 20) {
        sfx.rev();
        playMusic(this, 'race');
        this.engine = loopSfx(this, 'engine', 0.25);
      }
      if (this.countdown === 0) this.banner.setText('');
      if (this.countdown > 20) return;
    }
    if (this.result) {
      this.coastBike(this.player);
      this.coastBike(this.volt);
      if (++this.resultT === 180) this.finish();
      return;
    }
    this.stepPlayer();
    this.stepVolt();
    this.collideBikes();
    this.camX = Phaser.Math.Clamp(this.player.x - VIEW_W * 0.35, 0, TRACK_LEN + 200 - VIEW_W);
    // Finish line.
    for (const b of [this.player, this.volt]) if (!b.finished && b.x >= TRACK_LEN) b.finished = this.frame;
    if (this.player.finished || this.volt.finished) {
      const won = this.player.finished > 0 && (!this.volt.finished || this.player.finished <= this.volt.finished);
      this.result = won ? 'win' : 'lose';
      this.banner.setText(won ? 'YOU WIN!' : 'VOLT WINS');
      sfx.crowd();
      playVoice(this, won ? 'volt_loses' : 'volt_wins');
      this.engine?.stop();
    }
    const secs = this.frame / 60;
    this.timeText.setText(`${Math.floor(secs / 60)}:${(secs % 60).toFixed(1).padStart(4, '0')}`);
  }

  private stepPlayer(): void {
    const b = this.player;
    const c = this.controls;
    if (b.crash > 0) {
      b.crash--;
      b.v = 0;
      b.angle += 0.3;
      if (b.crash === 0) {
        b.angle = 0;
        b.air = false;
        b.alt = this.groundH(b.x);
        b.heat = 0;
      }
      return;
    }
    // Throttle, turbo, heat.
    let target = 0;
    if (b.stall > 0) {
      b.stall--;
      if (b.stall === 0) b.heat = 40;
    } else if (c.isDown('fire')) target = TURBO;
    else if (c.isDown('jump')) target = THROTTLE;
    if (b.stall === 0) {
      if (target === TURBO) b.heat += HEAT_TURBO;
      else if (target === THROTTLE) b.heat += HEAT_THROTTLE;
      else b.heat -= HEAT_COOL;
      b.heat = Math.max(0, b.heat);
      if (b.heat >= 100) {
        b.heat = 100;
        b.stall = STALL_FRAMES;
        sfx.overheat();
      }
    }
    if (!b.air) {
      const patch = this.patchAt(b.x, b.lane);
      if (patch === 'cool') b.heat = Math.max(0, b.heat - 3);
      if (target > 0) b.v = Math.min(target, b.v + ACCEL);
      if (b.v > target) b.v = Math.max(target, b.v - (target > 0 ? ACCEL : COAST));
      if (patch === 'mud') b.v = Math.min(b.v, MUD_CAP);
      // Lanes.
      if (b.stall === 0 && Math.abs(b.lane - b.laneTarget) < 0.05) {
        if (c.justPressed('up') && b.laneTarget > 0) b.laneTarget--;
        if (c.justPressed('down') && b.laneTarget < LANES - 1) b.laneTarget++;
      }
    } else {
      // In the air: tilt.
      if (c.isDown('left')) b.angle -= TILT;
      if (c.isDown('right')) b.angle += TILT;
    }
    this.moveBike(b, true);
  }

  /** Volt: steady speed with a little rubber band, picks lanes to dodge mud, lands perfectly. */
  private stepVolt(): void {
    const b = this.volt;
    if (b.crash > 0) {
      b.crash--;
      b.v = 0;
      b.angle += 0.3;
      if (b.crash === 0) b.angle = 0;
      return;
    }
    const gap = b.x - this.player.x;
    const target = gap > 260 ? 2.9 : gap < -260 ? 3.65 : 3.24;
    if (!b.air) {
      b.v += Phaser.Math.Clamp(target - b.v, -ACCEL, ACCEL);
      if (this.patchAt(b.x, b.lane) === 'mud') b.v = Math.min(b.v, MUD_CAP + 0.4);
      // Look ahead for mud and change lanes away from it.
      if (Math.abs(b.lane - b.laneTarget) < 0.05 && this.frame % 20 === 0) {
        const ahead = this.patchAt(b.x + 90, b.laneTarget);
        if (ahead === 'mud') {
          const options = [b.laneTarget - 1, b.laneTarget + 1].filter((l) => l >= 0 && l < LANES && this.patchAt(b.x + 90, l) !== 'mud');
          if (options.length) b.laneTarget = options[Math.floor(Math.random() * options.length)];
        }
      }
    }
    this.moveBike(b, false);
  }

  private moveBike(b: Bike, isPlayer: boolean): void {
    b.lane += Phaser.Math.Clamp(b.laneTarget - b.lane, -0.09, 0.09);
    if (!b.air) {
      const slope = this.slopeAt(b.x);
      const next = b.x + b.v;
      const nextH = this.groundH(next);
      // Ground drops away faster than gravity would follow: launch.
      if (nextH < b.alt - 3 && slope > 0.05) {
        b.air = true;
        b.vy = b.v * slope;
        b.x = next;
        b.alt += b.vy;
        return;
      }
      b.x = next;
      b.alt = nextH;
      b.angle += (-Math.atan(this.slopeAt(b.x)) - b.angle) * 0.4;
      return;
    }
    // Airborne.
    b.vy -= GRAVITY;
    b.x += b.v;
    b.alt += b.vy;
    if (!isPlayer) b.angle += (-Math.atan(this.slopeAt(b.x + 20)) - b.angle) * 0.15;
    // The player's nose follows the arc (it drops as you fall) unless you hold it with LEFT/RIGHT.
    else b.angle += (-Math.atan2(b.vy, Math.max(1, b.v)) - b.angle) * 0.07;
    const ground = this.groundH(b.x);
    if (b.alt <= ground) {
      b.alt = ground;
      b.air = false;
      const groundAngle = -Math.atan(this.slopeAt(b.x));
      const diff = Math.abs(Phaser.Math.Angle.Wrap(b.angle - groundAngle));
      if (isPlayer && diff > 0.5) this.crashBike(b);
      else {
        sfx.bikeLand();
        // A clean landing keeps your speed; a sloppy one costs some.
        if (diff > 0.2) b.v *= 0.6;
        b.angle = groundAngle;
      }
    }
  }

  private crashBike(b: Bike): void {
    b.crash = CRASH_FRAMES;
    b.v = 0;
    b.air = false;
    b.alt = this.groundH(b.x);
    sfx.bikeCrash();
    this.cameras.main.shake(200, 0.01);
  }

  /** Running into the back of the other bike knocks you down. */
  private collideBikes(): void {
    const p = this.player;
    const v = this.volt;
    if (p.crash || v.crash || Math.abs(p.lane - v.lane) > 0.6 || Math.abs(p.alt - v.alt) > 10) return;
    const d = v.x - p.x;
    if (d > 0 && d < 20 && p.v > v.v) this.crashBike(p);
    else if (d < 0 && d > -20 && v.v > p.v) {
      v.crash = 60;
      sfx.bikeCrash();
    }
  }

  private coastBike(b: Bike): void {
    b.v = Math.max(0, b.v - 0.05);
    this.moveBike(b, false);
  }

  private finish(): void {
    const won = this.result === 'win';
    returnToGame(this, this.mode, won);
  }

  // --- drawing ------------------------------------------------------------------------

  private draw(): void {
    const camX = Math.round(this.camX);
    this.bg.forEach((b, i) => (b.tilePositionX = camX * [0.05, 0.15, 0.3][i]));
    (this.children.getByName('crowd') as Phaser.GameObjects.TileSprite).tilePositionX = camX * 0.6;
    const dirt = [0x6a4a30, 0x765236, 0x6a4a30, 0x765236];
    const face = [0x8a6040, 0x96683f, 0x8a6040, 0x96683f];
    LANE_Y.forEach((ly, i) => {
      const g = this.laneGfx[i];
      g.clear();
      for (let sx = 0; sx < VIEW_W; sx += 2) {
        const wx = camX + sx;
        const h = this.groundH(wx);
        const slope = this.slopeAt(wx);
        // Ramp faces lighter going up, darker going down.
        g.fillStyle(h > 0 ? (slope > 0.02 ? face[i] : slope < -0.02 ? 0x4a3020 : dirt[i]) : dirt[i]);
        g.fillRect(sx, ly - h - 2, 2, LANE_H + h + 2);
        g.fillStyle(0x3a2818);
        g.fillRect(sx, ly - h - 2, 2, 1);
        const patch = this.patchAt(wx, i);
        if (patch === 'mud') {
          g.fillStyle(0x3a2a1a);
          g.fillRect(sx, ly - h + 2, 2, LANE_H - 6);
          if ((wx + i * 7) % 9 < 2) g.fillStyle(0x5a4028).fillRect(sx, ly - h + 4 + ((wx >> 2) % 6), 2, 1);
        } else if (patch === 'cool') {
          g.fillStyle((wx >> 3) % 2 ? 0x3aa8c8 : 0x8af0ff);
          g.fillRect(sx, ly - h + 4, 2, LANE_H - 10);
        }
        // Lane line.
        if ((wx >> 3) % 2 === 0) g.fillStyle(0xd8c8a8).fillRect(sx, ly + LANE_H - 3, 2, 1);
      }
      // Start and finish lines.
      for (const lx of [40, TRACK_LEN]) {
        const sx = lx - camX;
        if (sx < -8 || sx > VIEW_W) continue;
        for (let k = 0; k < 4; k++) g.fillStyle(k % 2 ? 0xffffff : 0x1a1428).fillRect(sx + (k % 2) * 3, ly + k * 4, 3, 4);
      }
    });
    for (const b of [this.volt, this.player]) {
      const li = Phaser.Math.Clamp(b.lane, 0, LANES - 1);
      const lo = Math.floor(li);
      const ly = Phaser.Math.Linear(LANE_Y[lo], LANE_Y[Math.min(LANES - 1, lo + 1)], li - lo);
      const sx = b.x - camX;
      b.sprite.setPosition(Math.round(sx), Math.round(ly - b.alt + 4)).setRotation(b.angle).setDepth(Math.round(li) * 10 + 5);
      b.shadow.setPosition(Math.round(sx), Math.round(ly - this.groundH(b.x) + 3)).setDepth(Math.round(li) * 10 + 4).setVisible(b.air);
      b.sprite.setTint(b.stall > 0 && this.frame % 10 < 5 ? 0xff8a8a : 0xffffff);
    }
    // Dust kicked up behind the rear wheel, exhaust puffs (thicker with turbo heat).
    const dg = this.dustG;
    dg.clear();
    for (const b of [this.volt, this.player]) {
      if (b.air || b.v < 0.8 || this.frame % 2) continue;
      const li = Phaser.Math.Clamp(b.lane, 0, LANES - 1);
      const lo = Math.floor(li);
      const ly = Phaser.Math.Linear(LANE_Y[lo], LANE_Y[Math.min(LANES - 1, lo + 1)], li - lo);
      const y = ly - this.groundH(b.x) + 2;
      this.dust.push({ x: b.x - 10, y, vx: -0.4 - Math.random() * 0.6, vy: -0.3 - Math.random() * 0.5, t: 18, col: 0xb08a5a });
      if (b.heat > 40) this.dust.push({ x: b.x - 14, y: y - 8, vx: -0.6, vy: -0.2, t: 14, col: b === this.player ? 0xffa040 : 0xf8e040 });
    }
    for (const d of this.dust) {
      d.x += d.vx;
      d.y += d.vy;
      d.vy += 0.03;
      d.t--;
      const r = 1 + (18 - d.t) * 0.12;
      dg.fillStyle(d.col, Math.min(0.7, d.t / 20)).fillCircle(d.x - camX, d.y, r);
    }
    this.dust = this.dust.filter((d) => d.t > 0);
    // Speed lines when someone is flat out.
    if (this.player.v > 3) for (let i = 0; i < 6; i++) {
      const y = 40 + ((i * 37 + this.frame * 3) % 150);
      const x = (VIEW_W - ((this.frame * 9 + i * 71) % (VIEW_W + 40)));
      dg.fillStyle(0xffffff, 0.25).fillRect(x, y, 24, 1);
    }

    // HUD: heat gauge and the race map.
    const h = this.hud;
    h.clear();
    h.fillStyle(0x0a0c18, 0.8).fillRect(6, VIEW_H - 40, 106, 14);
    h.lineStyle(1, 0x3a4470).strokeRect(6, VIEW_H - 40, 106, 14);
    const heat = this.player.heat;
    h.fillStyle(heat > 80 ? 0xff3a3a : heat > 55 ? 0xffc040 : 0x5ef0c8).fillRect(9, VIEW_H - 37, Math.round(heat), 8);
    h.fillStyle(0xffffff, 0.25).fillRect(9, VIEW_H - 37, Math.round(heat), 2);
    const mapX = VIEW_W / 2 - 100;
    h.fillStyle(0x0a0c18, 0.8).fillRect(mapX - 4, 8, 208, 10);
    h.fillStyle(0x3a4470).fillRect(mapX, 12, 200, 2);
    h.fillStyle(0xffffff).fillRect(mapX + 200, 9, 2, 8);
    h.fillStyle(0xf8e040).fillRect(mapX + Math.min(200, (this.volt.x / TRACK_LEN) * 200) - 2, 10, 4, 6);
    h.fillStyle(0xf28c28).fillRect(mapX + Math.min(200, (this.player.x / TRACK_LEN) * 200) - 2, 10, 4, 6);
    if (this.player.stall > 0) this.banner.setText(this.frame % 30 < 20 ? 'OVERHEAT!' : '');
    else if (!this.result && this.countdown === 0 && this.banner.text === 'OVERHEAT!') this.banner.setText('');
  }
}

/** Bikes and the crowd, drawn once. */
function makeBikeTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('bike_hero')) return;
  /** A shaded motocross bike and rider, 30 x 23, facing right. */
  const bike = (key: string, frame: string[], accent: string, rider: string[], visor: string, bolt: boolean) => {
    const t = scene.textures.createCanvas(key, 30, 23)!;
    const c = t.getContext();
    const p = (col: string, x: number, y: number, w = 1, h = 1) => {
      c.fillStyle = col;
      c.fillRect(x, y, w, h);
    };
    const K = '#1a1428';
    // Knobbly wheels with spokes and a hub glint.
    for (const cx of [6, 24]) {
      for (let y = 12; y < 23; y++)
        for (let x = cx - 6; x <= cx + 6; x++) {
          const d = Math.hypot(x - cx, y - 17.5);
          if (d > 5.6) continue;
          p(d > 4.6 ? ((Math.atan2(y - 17.5, x - cx) * 4) | 0) % 2 ? K : '#2b2540' : d > 3.6 ? '#3a3a44' : d > 1.5 ? (((x + y) & 1) ? '#55607a' : '#8a8fa8') : '#c8ccd8', x, y);
        }
      p('#ffffff', cx - 1, 16);
    }
    // Swingarm, fork, frame, tank and seat.
    for (let i = 0; i < 8; i++) p('#8a8fa8', 7 + i, 16 - i * 0.4);
    for (let i = 0; i < 7; i++) p('#c8ccd8', 23 - i * 0.3, 16 - i);
    p(K, 7, 8, 17, 7);
    for (let y = 9; y < 14; y++) p(y === 9 ? frame[2] : y < 12 ? frame[1] : frame[0], 8, y, 15, 1);
    p(accent, 13, 10, 7, 2);
    if (bolt) {
      p('#fff4b0', 15, 10, 1, 1);
      p('#fff4b0', 16, 11, 1, 1);
    }
    p(K, 21, 5, 4, 5);
    p('#c8ccd8', 22, 5, 2, 1); // handlebar
    p('#2b2540', 4, 12, 6, 2); // exhaust
    p('#8a8fa8', 4, 12, 6, 1);
    // Rider: boot, leg, body leaning forward, arm to the bars, helmet with visor.
    p(K, 10, 10, 5, 4);
    p(rider[1], 11, 11, 3, 2);
    p(K, 10, 1, 9, 9);
    for (let y = 2; y < 9; y++) p(y < 4 ? rider[2] : y < 7 ? rider[1] : rider[0], 11, y, 7, 1);
    p(K, 16, 5, 7, 3);
    p(rider[1], 17, 6, 5, 1);
    p(K, 13, -1, 8, 7);
    for (let y = 0; y < 5; y++) p(y < 2 ? rider[2] : rider[1], 14, y, 6, 1);
    p(K, 17, 1, 4, 3);
    p(visor, 18, 1, 3, 2);
    p('#ffffff', 18, 1, 1, 1);
    t.refresh();
  };
  bike('bike_hero', ['#2b2540', '#55607a', '#8a8fa8'], '#f28c28', ['#b85a1a', '#f28c28', '#ffc070'], '#5ef0c8', false);
  bike('bike_volt', ['#1a2a4a', '#2a4a7a', '#4a6aa0'], '#f8e040', ['#1e2858', '#34428a', '#5a6ac8'], '#9ee8ff', true);
  const c = scene.make.graphics({ x: 0, y: 0 }, false);
  c.fillStyle(0x1c2438).fillRect(0, 0, 64, 34);
  const colors = [0xf28c28, 0x5ef0c8, 0xf8e040, 0xd83a4a, 0xc8ccd8, 0x8c4ad8];
  for (let y = 2; y < 30; y += 6) {
    for (let x = (y / 6) % 2 ? 0 : 4; x < 64; x += 8) {
      c.fillStyle(colors[(x * 7 + y * 3) % colors.length]).fillRect(x + 1, y + 2, 4, 3);
      c.fillStyle(0xe0b070).fillRect(x + 2, y, 2, 2);
    }
  }
  c.fillStyle(0x24385a).fillRect(0, 31, 64, 3);
  c.generateTexture('race_crowd', 64, 34);
  c.destroy();
}
