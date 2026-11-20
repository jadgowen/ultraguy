import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../constants';
import { pixelText } from '../pixelFont';
import { sfx } from '../sfx';
import { ModeScene } from './ModeScene';
import { makePinballArt } from './pinballArt';

/**
 * TIDE'S TIDE POOL: a pinball duel on an undersea table. Tide swims at the top
 * of the table; hit him while his shell is open. Roll through all three top
 * lanes to pry his shell open; knock down the three targets on the left for a
 * multiball. Three balls, and a ball saver for the first few seconds of each.
 *
 * LEFT / RIGHT work the flippers; JUMP launches.
 */

const TW = 200;
const TH = 236;
const OX = Math.round((VIEW_W - TW) / 2);
const OY = 2;
const R = 4; // ball radius
const GRAV = 0.07;
const MAX_V = 6;
const SAVE_T = 420; // ball saver after each serve
const SUB = 4;
const FL_LEN = 34;
const TIDE_HP = 5;
const BALLS = 3;

type Seg = [number, number, number, number];

const WALLS: Seg[] = [
  [10, 30, 10, 165],
  [10, 30, 30, 10],
  [30, 10, 170, 10],
  [170, 10, 190, 30],
  [190, 30, 190, 232],
  [178, 92, 178, 232],
  [10, 165, 60, 198],
  [178, 165, 140, 198],
  [178, 228, 190, 228], // launch lane floor
];

const BUMPERS = [
  { x: 70, y: 92, r: 9 },
  { x: 130, y: 92, r: 9 },
];

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  inLane: boolean;
  /** Recent positions, for the motion trail. */
  trail?: [number, number][];
}

interface Flipper {
  px: number;
  py: number;
  side: 1 | -1;
  a: number;
  w: number;
  from: number;
  to: number;
}

export class PinballScene extends ModeScene {
  protected readonly voice = 'tide';
  protected readonly music = 'pinball';
  protected readonly homeStage = 'reef' as const;

  private balls: Ball[] = [];
  private lives = BALLS;
  private flippers: Flipper[] = [];
  private tide = { x: 100, y: 52, t: 0, hp: TIDE_HP, open: false, openT: 0, hurtT: 0, forced: 0 };
  private lanes = [false, false, false];
  private targets = [true, true, true];
  private bumpFlash = [0, 0];
  private saveT = 0;
  private g!: Phaser.GameObjects.Graphics;
  private fxG!: Phaser.GameObjects.Graphics;
  private hudG!: Phaser.GameObjects.Graphics;
  private tideImg!: Phaser.GameObjects.Image;
  private bumperImgs: Phaser.GameObjects.Image[] = [];
  private targetImgs: Phaser.GameObjects.Image[] = [];
  private laneImgs: Phaser.GameObjects.Image[] = [];
  private flipperImgs: Phaser.GameObjects.Image[] = [];
  private plunger!: Phaser.GameObjects.Image;
  private ballImgs: Phaser.GameObjects.Image[] = [];
  private bubbles: { x: number; y: number; s: number; r: number }[] = [];
  private bumpRings: { x: number; y: number; t: number }[] = [];
  private panelIcons: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('pinball');
  }

  protected setup(): void {
    this.cameras.main.setBackgroundColor('#04101c');
    this.balls = [];
    this.lives = BALLS;
    this.flippers = [
      { px: 62, py: 200, side: 1, a: 0.5, w: 0, from: 0.5, to: 0.5 },
      { px: 138, py: 200, side: -1, a: 0.5, w: 0, from: 0.5, to: 0.5 },
    ];
    this.tide = { x: 100, y: 52, t: 0, hp: TIDE_HP, open: false, openT: 0, hurtT: 0, forced: 0 };
    this.lanes = [false, false, false];
    this.targets = [true, true, true];
    this.bumpFlash = [0, 0];
    this.saveT = 0;
    makePinballArt(this, WALLS, TW, TH);
    this.drawFrame();
    this.add.image(OX, OY, 'pb_table').setOrigin(0).setDepth(0);
    this.g = this.add.graphics().setDepth(1);
    this.fxG = this.add.graphics().setDepth(8).setBlendMode(Phaser.BlendModes.ADD);
    this.hudG = this.add.graphics().setDepth(21);
    this.laneImgs = [0, 1, 2].map((i) => this.add.image(OX + 70 + i * 30, OY + 22, 'pb_lane_off').setDepth(2));
    this.targetImgs = [0, 1, 2].map(() => this.add.image(0, 0, 'pb_target_up').setOrigin(0).setDepth(2));
    this.bumperImgs = BUMPERS.map((bp) => this.add.image(OX + bp.x, OY + bp.y, 'pb_bumper0').setDepth(3));
    this.flipperImgs = this.flippers.map(() => this.add.image(0, 0, 'pb_flipper').setOrigin(5 / 40, 0.5).setDepth(4));
    this.plunger = this.add.image(OX + 184, OY + 230, 'pb_plunger').setOrigin(0.5, 0).setDepth(2);
    this.ballImgs = [];
    this.bumpRings = [];
    this.panelIcons = [];
    this.bubbles = Array.from({ length: 18 }, () => ({ x: 14 + Math.random() * 160, y: Math.random() * TH, s: 0.2 + Math.random() * 0.4, r: Math.random() < 0.3 ? 2 : 1 }));
    this.tideImg = this.add.image(0, 0, 'tide_swim1').setDepth(5);
    this.serve();
    // The table fills the screen's height, so the help and score sit beside it.
    this.help('LEFT/RIGHT\nFLIPPERS\n\nJUMP\nLAUNCH', OX / 2, 150);
    const label = (x: number, y: number, t: string) => pixelText(this, x, y, t, { color: '#8ad0f0', stroke: '#000000' }).setOrigin(0.5, 0).setDepth(22);
    label(OX / 2, 26, 'BALLS');
    label(OX + TW + (VIEW_W - OX - TW) / 2, 26, 'TIDE');
  }

  /** The side panels: riveted, with a sea-glass inner bevel. */
  private drawFrame(): void {
    const f = this.add.graphics().setDepth(20);
    for (const [x, w] of [[0, OX], [OX + TW, VIEW_W - OX - TW]] as const) {
      f.fillStyle(0x061424).fillRect(x, 0, w, VIEW_H);
      for (let y = 0; y < VIEW_H; y += 4) f.fillStyle(y % 8 ? 0x08182c : 0x0a1e36).fillRect(x, y, w, 2);
      f.fillStyle(0x1e5a8a).fillRect(x + 4, 8, w - 8, VIEW_H - 16);
      f.fillStyle(0x0a2440).fillRect(x + 5, 9, w - 10, VIEW_H - 18);
      for (const [rx, ry] of [[x + 7, 11], [x + w - 9, 11], [x + 7, VIEW_H - 13], [x + w - 9, VIEW_H - 13]]) {
        f.fillStyle(0x8ad0f0).fillRect(rx, ry, 2, 2);
        f.fillStyle(0x04101c).fillRect(rx + 1, ry + 1, 1, 1);
      }
    }
    f.fillStyle(0x04101c).fillRect(OX - 3, 0, 3, VIEW_H).fillRect(OX + TW, 0, 3, VIEW_H);
    f.fillStyle(0x8ad0f0).fillRect(OX - 1, 0, 1, VIEW_H).fillRect(OX + TW, 0, 1, VIEW_H);
  }

  /** A new ball in the lane (a saved ball doesn't get another save). */
  private serve(saved = false): void {
    this.balls.push({ x: 184, y: 222, vx: 0, vy: 0, inLane: true });
    this.saveT = saved ? 0 : SAVE_T;
  }

  // --- geometry ----------------------------------------------------------------------

  /** A flipper's segment (pivot to tip). Angle: 0.5 rad is down (resting), -0.45 up. */
  private flipperSeg(f: Flipper): Seg {
    const ang = f.side === 1 ? f.a : Math.PI - f.a;
    return [f.px, f.py, f.px + Math.cos(ang) * FL_LEN, f.py + Math.sin(ang) * FL_LEN];
  }

  /** Push a ball out of a segment and bounce it (surface moving at sv). */
  private collideSeg(b: Ball, s: Seg, e: number, sv?: (x: number, y: number) => [number, number]): boolean {
    const [x1, y1, x2, y2] = s;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    const t = Phaser.Math.Clamp(((b.x - x1) * dx + (b.y - y1) * dy) / len2, 0, 1);
    const cx = x1 + dx * t;
    const cy = y1 + dy * t;
    let nx = b.x - cx;
    let ny = b.y - cy;
    const d = Math.hypot(nx, ny);
    if (d >= R + (sv ? 2 : 0.5) || d === 0) return false;
    nx /= d;
    ny /= d;
    b.x = cx + nx * (R + (sv ? 2 : 0.5));
    b.y = cy + ny * (R + (sv ? 2 : 0.5));
    const [svx, svy] = sv ? sv(cx, cy) : [0, 0];
    const rvx = b.vx - svx;
    const rvy = b.vy - svy;
    const vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      b.vx = rvx - (1 + e) * vn * nx + svx;
      b.vy = rvy - (1 + e) * vn * ny + svy;
    }
    return true;
  }

  // --- the loop ----------------------------------------------------------------------

  protected tick(): void {
    const c = this.controls;
    // Flippers swing up fast and fall back slower.
    for (const f of this.flippers) {
      const held = f.side === 1 ? c.isDown('left') : c.isDown('right') || c.isDown('fire');
      const target = held ? -0.45 : 0.5;
      f.from = f.a;
      f.to = held ? Math.max(target, f.a - 0.32) : Math.min(target, f.a + 0.16);
      f.w = (f.to - f.from) / SUB;
      if (held && f.from > 0.4 && f.to < f.from) sfx.tick();
    }
    // Launch.
    for (const b of this.balls) {
      if (b.inLane && b.y > 200 && Math.abs(b.vy) < 0.3 && (c.justPressed('jump') || c.justPressed('up'))) {
        b.vy = -6 - Math.random() * 0.4;
        sfx.chargeShot();
      }
    }
    // Sub-steps: flippers swing a little each time, so a fast flip can't skip past the ball.
    for (let i = 0; i < SUB; i++) {
      for (const f of this.flippers) f.a = f.from + (f.to - f.from) * ((i + 1) / SUB);
      for (const b of this.balls) this.moveBall(b);
    }
    // Drains.
    const before = this.balls.length;
    this.balls = this.balls.filter((b) => b.y < TH + 6);
    if (this.saveT > 0 && !this.balls.some((b) => b.inLane)) this.saveT--;
    if (this.balls.length < before && this.balls.length === 0) {
      if (this.saveT > 0) {
        this.banner.setText('BALL SAVED!');
        this.time.delayedCall(900, () => !this.result && this.banner.setText(''));
        sfx.pickup();
        this.serve(true);
        return;
      }
      this.lives--;
      sfx.hurt();
      if (this.lives <= 0) return this.finish(false, 'WASHED OUT...');
      this.serve();
    }
    this.stepTide();
    for (let i = 0; i < this.bumpFlash.length; i++) if (this.bumpFlash[i] > 0) this.bumpFlash[i]--;
    this.hud.setText('');
    for (const b of this.balls) {
      b.trail = [[b.x, b.y] as [number, number], ...(b.trail ?? [])].slice(0, 5);
    }
    for (const bb of this.bubbles) {
      bb.y -= bb.s;
      bb.x += Math.sin((this.frame + bb.y) / 20) * 0.15;
      if (bb.y < 8) Object.assign(bb, { y: TH - 30, x: 14 + Math.random() * 160 });
    }
    for (const r of this.bumpRings) r.t++;
    this.bumpRings = this.bumpRings.filter((r) => r.t < 14);
    if (this.frame % 40 === 0 && this.tide.open) this.bubbles.push({ x: this.tide.x, y: this.tide.y - 8, s: 0.6, r: 2 });
    if (this.bubbles.length > 30) this.bubbles.splice(18, this.bubbles.length - 30);
  }

  private moveBall(b: Ball): void {
    b.vy += GRAV / SUB;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > MAX_V) {
      b.vx *= MAX_V / sp;
      b.vy *= MAX_V / sp;
    }
    b.x += b.vx / SUB;
    b.y += b.vy / SUB;
    b.inLane = b.x > 178 && b.y > 92;
    for (const s of WALLS) if (this.collideSeg(b, s, 0.45)) break;
    for (const f of this.flippers) {
      // The flipper's surface moves with its swing: v = w x r.
      this.collideSeg(b, this.flipperSeg(f), 0.25, (x, y) => {
        const w = (f.side === 1 ? f.w : -f.w) * 1.1;
        return [-(y - f.py) * w * SUB, (x - f.px) * w * SUB];
      });
    }
    BUMPERS.forEach((bp, i) => {
      const dx = b.x - bp.x;
      const dy = b.y - bp.y;
      const d = Math.hypot(dx, dy);
      if (d < bp.r + R && d > 0) {
        b.x = bp.x + (dx / d) * (bp.r + R);
        b.y = bp.y + (dy / d) * (bp.r + R);
        b.vx = (dx / d) * 3.4;
        b.vy = (dy / d) * 3.4;
        if (this.bumpFlash[i] === 0) this.bumpRings.push({ x: bp.x, y: bp.y, t: 0 });
        this.bumpFlash[i] = 8;
        sfx.bubble();
      }
    });
    // Drop targets on the left wall.
    this.targets.forEach((up, i) => {
      const ty = 70 + i * 22;
      if (!up || Math.abs(b.y - ty) > 8 || b.x > 10 + R + 4) return;
      this.targets[i] = false;
      b.vx = Math.abs(b.vx) + 1;
      sfx.hit();
      if (this.targets.every((t) => !t)) this.multiball();
    });
    // Top lanes (roll-overs).
    this.lanes.forEach((lit, i) => {
      if (lit || Math.abs(b.x - (70 + i * 30)) > 5 || Math.abs(b.y - 22) > 5) return;
      this.lanes[i] = true;
      sfx.pickup();
      if (this.lanes.every((l) => l)) {
        this.lanes = [false, false, false];
        this.tide.forced = 300;
        this.tide.open = true;
        sfx.weakHit();
        this.banner.setText('SHELL OPEN!');
        this.time.delayedCall(900, () => !this.result && this.banner.setText(''));
      }
    });
    // Tide himself.
    const t = this.tide;
    const dx = b.x - t.x;
    const dy = b.y - t.y;
    const d = Math.hypot(dx, dy);
    if (d < 12 + R && d > 0) {
      b.x = t.x + (dx / d) * (12 + R);
      b.y = t.y + (dy / d) * (12 + R);
      b.vx = (dx / d) * 3.2;
      b.vy = (dy / d) * 3.2;
      if (t.open && t.hurtT === 0) {
        t.hp--;
        t.hurtT = 30;
        sfx.weakHit();
        this.cameras.main.shake(150, 0.01);
        if (t.hp <= 0) this.finish(true, 'TIDE IS BEACHED!');
      } else sfx.deflect();
    }
  }

  private multiball(): void {
    this.targets = [true, true, true];
    this.banner.setText('MULTIBALL!');
    this.time.delayedCall(900, () => !this.result && this.banner.setText(''));
    sfx.weakHit();
    for (const vx of [-1.5, 1.5]) this.balls.push({ x: 100, y: 30, vx, vy: 1, inLane: false });
  }

  private stepTide(): void {
    const t = this.tide;
    t.t++;
    if (t.hurtT > 0) t.hurtT--;
    // Swims a lazy loop across the top of the table.
    t.x = 100 + Math.sin(t.t / 90) * 52;
    t.y = 54 + Math.sin(t.t / 45) * 8;
    if (t.forced > 0) {
      t.forced--;
      t.open = true;
    } else {
      // Opens his shell now and then (more often as he weakens).
      t.openT++;
      const shut = 150;
      const openFor = 110 + (TIDE_HP - t.hp) * 6;
      t.open = t.openT % (shut + openFor) >= shut;
    }
  }

  protected draw(): void {
    const g = this.g;
    const f = this.fxG;
    g.clear();
    f.clear();
    const fr = this.frame;
    // Kelp swaying along the walls, over the painted table.
    for (const [x, h] of [[18, 46], [24, 34], [168, 40], [174, 30]] as const) {
      for (let y = 0; y < h; y += 2) {
        const sway = Math.sin((fr + y * 3 + x * 7) / 26) * (y / h) * 3;
        g.fillStyle(y % 6 < 3 ? 0x2e7a34 : 0x3a9a44).fillRect(OX + x + sway, OY + 196 - y, 2, 2);
      }
    }
    // Rising bubbles.
    for (const bb of this.bubbles) {
      g.lineStyle(1, 0x9ad8ff, 0.7).strokeCircle(OX + bb.x, OY + bb.y, bb.r);
      g.fillStyle(0xffffff, 0.8).fillRect(OX + bb.x - bb.r * 0.5, OY + bb.y - bb.r * 0.5, 1, 1);
    }
    // Lanes, targets, bumpers.
    this.lanes.forEach((lit, i) => {
      const on = lit || (this.lanes.filter(Boolean).length === 2 && !lit && fr % 20 < 10);
      this.laneImgs[i].setTexture(lit ? 'pb_lane_on' : 'pb_lane_off').setAlpha(on || lit ? 1 : 0.85);
      if (lit) f.fillStyle(0xffe14a, 0.35).fillCircle(OX + 70 + i * 30, OY + 22, 8);
    });
    this.targets.forEach((up, i) => {
      this.targetImgs[i].setTexture(up ? 'pb_target_up' : 'pb_target_down').setPosition(OX + 10, OY + (up ? 64 : 74) + i * 22);
      if (!up) f.fillStyle(0xff5a5a, 0.4).fillRect(OX + 20, OY + 66 + i * 22, 6, 8);
    });
    BUMPERS.forEach((bp, i) => {
      this.bumperImgs[i].setTexture(this.bumpFlash[i] ? 'pb_bumper1' : 'pb_bumper0').setScale(this.bumpFlash[i] > 4 ? 1.12 : 1);
      if (this.bumpFlash[i]) f.fillStyle(0xff8aa8, 0.4).fillCircle(OX + bp.x, OY + bp.y, bp.r + 6);
    });
    for (const r of this.bumpRings) {
      const k = r.t / 14;
      f.lineStyle(2 - k, 0xffd0e0, 1 - k).strokeCircle(OX + r.x, OY + r.y, 10 + k * 12);
    }
    // The ball saver lamp.
    if (this.saveT > 0 && (this.saveT > 90 || fr % 10 < 5)) {
      g.fillStyle(0xffe14a).fillRect(OX + 91, OY + 213, 18, 5);
      f.fillStyle(0xffe14a, 0.35).fillRect(OX + 86, OY + 209, 28, 13);
    }
    // Tide: swims when shut (dim, safe), jaws open (lit, hittable), flashes when hit.
    const t = this.tide;
    const frame = t.open ? `tide_open${(Math.floor(fr / 10) % 2) + 1}` : `tide_swim${(Math.floor(fr / 8) % 4) + 1}`;
    this.tideImg.setPosition(OX + t.x, OY + t.y + 6).setTexture(frame).setFlipX(Math.cos(t.t / 90) < 0);
    if (t.hurtT > 0 && fr % 6 < 3) this.tideImg.setTintFill(0xffffff);
    else this.tideImg.setTint(t.open ? 0xffffff : 0x8aa0c0);
    if (t.open) {
      f.lineStyle(1, 0xffe14a, 0.6).strokeCircle(OX + t.x, OY + t.y, 16 + (fr % 20) / 4);
      f.fillStyle(0x5ef0c8, 0.18).fillCircle(OX + t.x, OY + t.y, 20);
    }
    // Flippers.
    this.flippers.forEach((fl, i) => {
      const ang = fl.side === 1 ? fl.a : Math.PI - fl.a;
      this.flipperImgs[i].setPosition(OX + fl.px, OY + fl.py).setRotation(ang).setFlipY(fl.side === -1);
    });
    // The plunger draws back while a ball waits in the lane.
    const waiting = this.balls.some((b) => b.inLane && b.y > 200);
    this.plunger.setY(OY + 226 + (waiting ? 2 + Math.sin(fr / 10) * 2 : 0));
    // Balls, with a faint trail when they're moving fast.
    while (this.ballImgs.length < this.balls.length) this.ballImgs.push(this.add.image(0, 0, 'pb_ball').setDepth(6));
    this.ballImgs.forEach((img, i) => {
      const b = this.balls[i];
      img.setVisible(!!b);
      if (!b) return;
      img.setPosition(Math.round(OX + b.x), Math.round(OY + b.y));
      if (Math.hypot(b.vx, b.vy) > 2.5)
        (b.trail ?? []).forEach(([x, y], k) => {
          if (k > 0) f.fillStyle(0x9ad8ff, 0.22 - k * 0.04).fillCircle(OX + x, OY + y, R - k * 0.5);
        });
    });
    // Light rippling over the water.
    for (let i = 0; i < 6; i++) {
      const x = OX + 20 + ((i * 53 + fr * 0.3) % 160);
      const y = OY + 20 + ((i * 37) % 150) + Math.sin((fr + i * 40) / 30) * 6;
      f.fillStyle(0x6ab8e8, 0.06).fillEllipse(x, y, 30, 8);
    }
    this.drawPanels();
  }

  /** Balls left (little chrome balls) and Tide's shell (five pips) beside the table. */
  private drawPanels(): void {
    while (this.panelIcons.length < BALLS) this.panelIcons.push(this.add.image(0, 0, 'pb_ball').setDepth(22));
    this.panelIcons.forEach((img, i) => img.setPosition(OX / 2 - 12 + i * 12, 46).setVisible(i < this.lives));
    const g = this.hudG;
    g.clear();
    const rx = OX + TW + (VIEW_W - OX - TW) / 2;
    for (let i = 0; i < TIDE_HP; i++) {
      const y = 44 + i * 12;
      const on = i < this.tide.hp;
      g.fillStyle(0x04101c).fillRect(rx - 8, y, 16, 9);
      g.fillStyle(on ? 0x2aa088 : 0x14304a).fillRect(rx - 7, y + 1, 14, 7);
      if (on) g.fillStyle(0x8af0d0).fillRect(rx - 7, y + 1, 14, 2);
    }
  }
}
