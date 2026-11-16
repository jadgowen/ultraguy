import Phaser from 'phaser';
import { VIEW_W } from '../constants';
import { sfx } from '../sfx';
import { ModeScene } from './ModeScene';

/**
 * TIDE'S TIDE POOL: a pinball duel on an undersea table. Tide swims at the top
 * of the table; hit him while his shell is open. Roll through all three top
 * lanes to pry his shell open; knock down the three targets on the left for a
 * multiball. He blows bubbles that drift down and get in the way. Three balls.
 *
 * LEFT / RIGHT work the flippers; JUMP launches.
 */

const TW = 200;
const TH = 236;
const OX = Math.round((VIEW_W - TW) / 2);
const OY = 2;
const R = 4; // ball radius
const GRAV = 0.1;
const SUB = 4;
const FL_LEN = 30;
const TIDE_HP = 10;
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
  { x: 100, y: 124, r: 9 },
];

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  inLane: boolean;
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
  private bubbles: { x: number; y: number; vy: number }[] = [];
  private bumpFlash = [0, 0, 0];
  private g!: Phaser.GameObjects.Graphics;
  private tideImg!: Phaser.GameObjects.Image;

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
    this.bubbles = [];
    this.bumpFlash = [0, 0, 0];
    this.g = this.add.graphics();
    this.tideImg = this.add.image(0, 0, 'tide_idle').setDepth(5);
    this.serve();
    // The table fills the screen's height, so the help and score sit beside it.
    this.help('LEFT/RIGHT\nFLIPPERS\n\nJUMP\nLAUNCH', OX / 2, 150);
  }

  private serve(): void {
    this.balls.push({ x: 184, y: 222, vx: 0, vy: 0, inLane: true });
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
        b.vy = -7.2 - Math.random() * 0.5;
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
    if (this.balls.length < before && this.balls.length === 0) {
      this.lives--;
      sfx.hurt();
      if (this.lives <= 0) return this.finish(false, 'WASHED OUT...');
      this.serve();
    }
    this.stepTide();
    for (let i = 0; i < 3; i++) if (this.bumpFlash[i] > 0) this.bumpFlash[i]--;
    this.hud.setText(`BALLS\n${'o'.repeat(this.lives)}\n\nTIDE\n${'#'.repeat(this.tide.hp)}${'-'.repeat(TIDE_HP - this.tide.hp)}`).setPosition(8, 40);
  }

  private moveBall(b: Ball): void {
    b.vy += GRAV / SUB;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > 8) {
      b.vx *= 8 / sp;
      b.vy *= 8 / sp;
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
        b.vx = (dx / d) * 4.6;
        b.vy = (dy / d) * 4.6;
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
    // Bubbles: the ball pops them (and bounces a little).
    for (const bu of this.bubbles) {
      if (Math.hypot(b.x - bu.x, b.y - bu.y) < R + 6) {
        b.vy = -Math.abs(b.vy) * 0.5 - 1;
        bu.y = 999;
        sfx.bubble();
      }
    }
    // Tide himself.
    const t = this.tide;
    const dx = b.x - t.x;
    const dy = b.y - t.y;
    const d = Math.hypot(dx, dy);
    if (d < 12 + R && d > 0) {
      b.x = t.x + (dx / d) * (12 + R);
      b.y = t.y + (dy / d) * (12 + R);
      b.vx = (dx / d) * 4;
      b.vy = (dy / d) * 4;
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
      const shut = 200;
      const openFor = 110 + (TIDE_HP - t.hp) * 6;
      t.open = t.openT % (shut + openFor) >= shut;
    }
    // Bubbles drift down.
    if (t.t % 200 === 100) {
      sfx.bubble();
      for (const dx of [-14, 14]) this.bubbles.push({ x: t.x + dx, y: t.y + 10, vy: 0.35 });
    }
    for (const bu of this.bubbles) {
      bu.y += bu.vy;
      bu.x += Math.sin((bu.y + t.t) / 20) * 0.3;
    }
    this.bubbles = this.bubbles.filter((bu) => bu.y < 180);
  }

  protected draw(): void {
    const g = this.g;
    g.clear();
    // The table: deep water, sand at the bottom, kelp.
    g.fillStyle(0x0c2a4a).fillRect(OX, OY, TW, TH);
    g.fillStyle(0x12406a).fillRect(OX + 10, OY + 10, 168, 150);
    g.fillStyle(0xc8a060).fillRect(OX, OY + 210, TW, TH - 210);
    for (let i = 0; i < 6; i++) {
      const x = OX + 20 + i * 28;
      g.fillStyle(0x2e7a34, 0.6).fillRect(x + Math.sin((this.frame + i * 30) / 30) * 2, OY + 150, 3, 50);
    }
    // Walls.
    g.lineStyle(3, 0x6ab8e8);
    for (const [x1, y1, x2, y2] of WALLS) g.lineBetween(OX + x1, OY + y1, OX + x2, OY + y2);
    // Lanes, targets, bumpers.
    this.lanes.forEach((lit, i) => {
      g.fillStyle(lit ? 0xffe14a : 0x3a5a7a).fillCircle(OX + 70 + i * 30, OY + 22, 4);
    });
    this.targets.forEach((up, i) => {
      if (up) g.fillStyle(0xd83a4a).fillRect(OX + 11, OY + 64 + i * 22, 4, 12);
      else g.fillStyle(0x3a2030).fillRect(OX + 11, OY + 74 + i * 22, 4, 2);
    });
    BUMPERS.forEach((bp, i) => {
      g.fillStyle(0x1a1428).fillCircle(OX + bp.x, OY + bp.y, bp.r + 1);
      g.fillStyle(this.bumpFlash[i] ? 0xffffff : 0xff8aa8).fillCircle(OX + bp.x, OY + bp.y, bp.r);
      g.fillStyle(0xd83a4a).fillCircle(OX + bp.x, OY + bp.y, bp.r - 4);
    });
    for (const bu of this.bubbles) {
      g.lineStyle(1, 0xc8f0ff).strokeCircle(OX + bu.x, OY + bu.y, 6);
      g.fillStyle(0xffffff).fillRect(OX + bu.x - 3, OY + bu.y - 3, 2, 2);
    }
    // Tide.
    const t = this.tide;
    this.tideImg.setPosition(OX + t.x, OY + t.y).setTexture(t.open ? 'tide_open' : 'tide_idle');
    this.tideImg.setAlpha(t.hurtT > 0 && this.frame % 6 < 3 ? 0.3 : 1).setTint(t.open ? 0xffffff : 0xb0c0d0);
    if (t.open) g.lineStyle(1, 0xffe14a, 0.7).strokeCircle(OX + t.x, OY + t.y, 15 + (this.frame % 20) / 5);
    // Flippers and balls.
    g.lineStyle(5, 0xf28c28);
    for (const f of this.flippers) {
      const [x1, y1, x2, y2] = this.flipperSeg(f);
      g.lineBetween(OX + x1, OY + y1, OX + x2, OY + y2);
    }
    for (const f of this.flippers) g.fillStyle(0xffe14a).fillCircle(OX + f.px, OY + f.py, 3);
    for (const b of this.balls) {
      g.fillStyle(0x1a1428).fillCircle(OX + b.x, OY + b.y, R + 1);
      g.fillStyle(0xc8ccd8).fillCircle(OX + b.x, OY + b.y, R);
      g.fillStyle(0xffffff).fillRect(OX + b.x - 2, OY + b.y - 2, 2, 2);
    }
  }
}
