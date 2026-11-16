import Phaser from 'phaser';
import { VIEW_W } from '../constants';
import { sfx } from '../sfx';
import { ModeScene } from './ModeScene';

/**
 * ANVIL'S FORGE WALL: a brick-breaker. Knock the ball through his wall of
 * forge bricks and hit Anvil himself, who paces behind it. He hammers sparks
 * down at you (a hit leaves your paddle stunned) and patches holes in the wall.
 * Hot bricks drop power-ups: WIDE paddle, MULTI ball, SLOW ball.
 */

const FW = 240; // field width
const OX = Math.round((VIEW_W - FW) / 2);
const TOP = 22;
const BOTTOM = 232;
const BW = 20; // brick size
const BH = 8;
const BCOLS = FW / BW; // 12
const BROWS = 5;
const WALL_Y = 66; // top of the brick wall
const PADDLE_Y = 214;
const BALLS = 3;
const ANVIL_HP = 5;
const PW = 60; // paddle width

/** 0 empty, 1 brick, 2 iron (two hits), 3 hot (drops a power-up). */
type Brick = 0 | 1 | 2 | 3;
type Power = 'wide' | 'multi' | 'slow';

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  stuck: boolean;
}

export class BreakerScene extends ModeScene {
  protected readonly voice = 'anvil';
  protected readonly music = 'breaker';
  protected readonly homeStage = 'foundry' as const;

  private bricks: Brick[][] = [];
  private balls: Ball[] = [];
  private px = FW / 2;
  private pw = PW;
  private wideT = 0;
  private slowT = 0;
  private stunT = 0;
  private lives = BALLS;
  private anvil = { x: FW / 2, dir: 1, hp: ANVIL_HP, hurtT: 0, swingT: 0 };
  private sparks: { x: number; y: number; vx: number; vy: number }[] = [];
  private drops: { x: number; y: number; kind: Power }[] = [];
  private speed = 2.8;
  private g!: Phaser.GameObjects.Graphics;
  private anvilImg!: Phaser.GameObjects.Image;

  constructor() {
    super('breaker');
  }

  protected setup(): void {
    this.bricks = Array.from({ length: BROWS }, (_, r) =>
      Array.from({ length: BCOLS }, (_, c) => {
        if (r === 0) return 2 as Brick;
        return ((r * 7 + c * 5) % 6 === 0 ? 3 : 1) as Brick;
      }),
    );
    this.balls = [{ x: 0, y: 0, vx: 0, vy: 0, stuck: true }];
    Object.assign(this, { px: FW / 2, pw: PW, wideT: 0, slowT: 0, stunT: 0, lives: BALLS, sparks: [], drops: [], speed: 2.8 });
    this.anvil = { x: FW / 2, dir: 1, hp: ANVIL_HP, hurtT: 0, swingT: 0 };
    this.cameras.main.setBackgroundColor('#140a08');
    this.g = this.add.graphics();
    this.anvilImg = this.add.image(0, 0, 'anvil_idle').setDepth(5);
    this.help('LEFT/RIGHT MOVE   JUMP/FIRE LAUNCH');
  }

  protected tick(): void {
    const c = this.controls;
    // Paddle.
    // A spark hit only slows the paddle for a moment.
    const pspeed = this.stunT > 0 ? 2.4 : 4.6;
    if (this.stunT > 0) this.stunT--;
    this.px = Phaser.Math.Clamp(this.px + ((c.isDown('right') ? 1 : 0) - (c.isDown('left') ? 1 : 0)) * pspeed, this.pw / 2, FW - this.pw / 2);
    if (this.wideT > 0 && --this.wideT === 0) this.pw = PW;
    if (this.slowT > 0) this.slowT--;
    for (const b of this.balls) {
      if (!b.stuck) continue;
      b.x = this.px;
      b.y = PADDLE_Y - 4;
      if (c.justPressed('jump') || c.justPressed('fire')) {
        b.stuck = false;
        const a = Phaser.Math.DegToRad(-70 + Math.random() * 20);
        b.vx = Math.cos(a) * this.speed;
        b.vy = Math.sin(a) * this.speed;
        sfx.shoot();
      }
    }
    // Balls (in small sub-steps so they can't tunnel through a brick).
    this.speed = Math.min(3.6, 2.8 + this.playT / 3600);
    for (const b of this.balls) if (!b.stuck) for (let i = 0; i < 3; i++) this.moveBall(b, 1 / 3);
    this.balls = this.balls.filter((b) => b.y < BOTTOM + 6);
    if (!this.balls.length) {
      this.lives--;
      sfx.hurt();
      this.cameras.main.shake(200, 0.01);
      if (this.lives <= 0) return this.finish(false, 'THE FORGE WINS');
      this.balls = [{ x: this.px, y: PADDLE_Y - 4, vx: 0, vy: 0, stuck: true }];
    }
    this.stepAnvil();
    this.stepDrops();
    this.hud.setText(`BALLS ${'o'.repeat(this.lives)}   ANVIL ${'#'.repeat(this.anvil.hp)}${'-'.repeat(ANVIL_HP - this.anvil.hp)}`).setX(OX);
  }

  private moveBall(b: Ball, k: number): void {
    const speedK = this.slowT > 0 ? 0.65 : 1;
    const len = Math.hypot(b.vx, b.vy) || 1;
    b.vx = (b.vx / len) * this.speed;
    b.vy = (b.vy / len) * this.speed;
    // Never too flat.
    if (Math.abs(b.vy) < this.speed * 0.3) {
      b.vy = Math.sign(b.vy || -1) * this.speed * 0.3;
      b.vx = Math.sign(b.vx) * Math.sqrt(this.speed ** 2 - b.vy ** 2);
    }
    const nx = b.x + b.vx * k * speedK;
    const ny = b.y + b.vy * k * speedK;
    // Walls.
    if (nx < 2 || nx > FW - 2) {
      b.vx = -b.vx;
      sfx.tick();
      return;
    }
    if (ny < TOP + 2) {
      b.vy = Math.abs(b.vy);
      return;
    }
    // Anvil (behind the wall).
    const a = this.anvil;
    if (a.hurtT === 0 && Math.abs(nx - a.x) < 16 && ny > 30 && ny < 60 && b.vy < 0) {
      a.hp--;
      a.hurtT = 40;
      b.vy = Math.abs(b.vy);
      sfx.weakHit();
      this.cameras.main.shake(160, 0.01);
      if (a.hp <= 0) this.finish(true, 'ANVIL IS DOWN!');
      // A hit knocks a multiball loose from his forge.
      else this.drops.push({ x: a.x, y: 60, kind: 'multi' });
      return;
    }
    // Bricks: bounce off the side we came in from.
    const col = Math.floor(nx / BW);
    const row = Math.floor((ny - WALL_Y) / BH);
    if (row >= 0 && row < BROWS && col >= 0 && col < BCOLS && this.bricks[row][col]) {
      const pr = Math.floor((b.y - WALL_Y) / BH);
      if (pr !== row) b.vy = -b.vy;
      else b.vx = -b.vx;
      this.hitBrick(row, col);
      return;
    }
    // Paddle: the angle depends on where it lands.
    if (b.vy > 0 && ny >= PADDLE_Y - 3 && ny <= PADDLE_Y + 3 && Math.abs(nx - this.px) <= this.pw / 2 + 2) {
      const off = (nx - this.px) / (this.pw / 2);
      const ang = Phaser.Math.DegToRad(-90 + off * 60);
      b.vx = Math.cos(ang) * this.speed;
      b.vy = Math.sin(ang) * this.speed;
      sfx.deflect();
      return;
    }
    b.x = nx;
    b.y = ny;
  }

  private hitBrick(r: number, c: number): void {
    const kind = this.bricks[r][c];
    if (kind === 2) {
      this.bricks[r][c] = 1;
      sfx.hit();
      return;
    }
    this.bricks[r][c] = 0;
    sfx.crumble();
    if (kind === 3) {
      // Multiball is the common one.
      const kinds: Power[] = ['multi', 'multi', 'multi', 'wide', 'slow'];
      this.drops.push({ x: c * BW + BW / 2, y: WALL_Y + r * BH, kind: kinds[Math.floor(Math.random() * kinds.length)] });
    }
  }

  private stepAnvil(): void {
    const a = this.anvil;
    if (a.hurtT > 0) a.hurtT--;
    a.x += a.dir * (0.6 + (ANVIL_HP - a.hp) * 0.08);
    if (a.x < 20 || a.x > FW - 20) a.dir = -a.dir;
    // Hammer down a shower of sparks at you, every couple of seconds.
    a.swingT++;
    const every = Math.max(200, 300 - (ANVIL_HP - a.hp) * 20);
    if (a.swingT % every === 0) {
      sfx.crush();
      const ang = Math.atan2(PADDLE_Y - 50, this.px - a.x);
      this.sparks.push({ x: a.x, y: 50, vx: Math.cos(ang) * 1.5, vy: Math.sin(ang) * 1.5 });
    }
    // Patch a hole in the wall now and then.
    if (a.swingT % 900 === 450) {
      for (let tries = 0; tries < 20; tries++) {
        const r = Math.floor(Math.random() * 3);
        const c = Math.floor(Math.random() * BCOLS);
        if (this.bricks[r][c] === 0 && !this.balls.some((b) => Math.floor(b.x / BW) === c && Math.floor((b.y - WALL_Y) / BH) === r)) {
          this.bricks[r][c] = 1;
          sfx.land();
          break;
        }
      }
    }
    for (const s of this.sparks) {
      s.x += s.vx;
      s.y += s.vy;
      // Sparks pass through the wall (they're falling embers).
      if (this.stunT === 0 && s.y > PADDLE_Y - 4 && s.y < PADDLE_Y + 4 && Math.abs(s.x - this.px) < this.pw / 2) {
        s.y = 999;
        this.stunT = 45;
        sfx.hurt();
      }
    }
    this.sparks = this.sparks.filter((s) => s.y < BOTTOM && s.x > 0 && s.x < FW);
  }

  private stepDrops(): void {
    for (const d of this.drops) {
      d.y += 1.1;
      if (d.y > PADDLE_Y - 4 && d.y < PADDLE_Y + 4 && Math.abs(d.x - this.px) < this.pw / 2 + 4) {
        d.y = 999;
        sfx.pickup();
        if (d.kind === 'wide') {
          this.pw = 84;
          this.wideT = 600;
        } else if (d.kind === 'slow') this.slowT = 480;
        else {
          // Two more balls from every ball in play (up to eight).
          for (const src of this.balls.filter((b) => !b.stuck).slice(0, 3)) {
            for (const s of [-1, 1]) {
              if (this.balls.length >= 8) break;
              this.balls.push({ x: src.x, y: src.y, vx: src.vx + s * 1.2, vy: -Math.abs(src.vy || 2), stuck: false });
            }
          }
          if (!this.balls.some((b) => !b.stuck)) for (const s of [-1, 1]) this.balls.push({ x: this.px, y: PADDLE_Y - 6, vx: s * 1.2, vy: -2, stuck: false });
        }
      }
    }
    this.drops = this.drops.filter((d) => d.y < BOTTOM);
  }

  protected draw(): void {
    const g = this.g;
    g.clear();
    // The forge: walls, glow at the top.
    g.fillStyle(0x2a1410).fillRect(OX - 6, TOP - 4, FW + 12, BOTTOM - TOP + 8);
    g.fillStyle(0x0c0606).fillRect(OX, TOP, FW, BOTTOM - TOP);
    g.fillStyle(0x5a1a0a).fillRect(OX, TOP, FW, 40);
    g.fillStyle(0x8c2a10, 0.5).fillRect(OX, TOP + 34, FW, 6);
    // Bricks.
    const colors: Record<number, [number, number]> = { 1: [0xb85a1a, 0xf28c28], 2: [0x55607a, 0x8a8fa8], 3: [0xd83a4a, 0xffe14a] };
    for (let r = 0; r < BROWS; r++)
      for (let c = 0; c < BCOLS; c++) {
        const k = this.bricks[r][c];
        if (!k) continue;
        const [dark, light] = colors[k];
        const x = OX + c * BW;
        const y = WALL_Y + r * BH;
        g.fillStyle(dark).fillRect(x, y, BW - 1, BH - 1);
        g.fillStyle(light).fillRect(x, y, BW - 1, 2);
        if (k === 3 && this.frame % 20 < 10) g.fillStyle(0xfff1e0).fillRect(x + 8, y + 3, 3, 2);
      }
    // Anvil behind the wall.
    const a = this.anvil;
    this.anvilImg.setPosition(OX + a.x, 44).setFlipX(a.dir < 0).setAlpha(a.hurtT > 0 && this.frame % 6 < 3 ? 0.3 : 1);
    this.anvilImg.setTint(this.result === 'win' ? 0x555555 : 0xffffff);
    // Sparks and drops.
    for (const s of this.sparks) {
      g.fillStyle(0xffe14a).fillRect(OX + s.x - 1, s.y - 1, 3, 3);
      g.fillStyle(0xf28c28).fillRect(OX + s.x - s.vx * 2, s.y - s.vy * 2, 2, 2);
    }
    const dropColor: Record<Power, number> = { wide: 0x5ab84a, multi: 0x6ab8e8, slow: 0xc8ccd8 };
    for (const d of this.drops) {
      g.fillStyle(0x1a1428).fillRect(OX + d.x - 6, d.y - 4, 12, 8);
      g.fillStyle(dropColor[d.kind]).fillRect(OX + d.x - 5, d.y - 3, 10, 6);
      // An icon: three balls for MULTI, a long bar for WIDE, one dot for SLOW.
      g.fillStyle(0xffffff);
      if (d.kind === 'multi') for (const dx of [-3, 0, 3]) g.fillRect(OX + d.x + dx - 1, d.y - 1, 2, 2);
      else if (d.kind === 'wide') g.fillRect(OX + d.x - 4, d.y - 1, 8, 2);
      else g.fillRect(OX + d.x - 1, d.y - 1, 2, 2);
    }
    // Paddle (flickers while stunned) and balls.
    const stunned = this.stunT > 0 && this.frame % 6 < 3;
    g.fillStyle(0x1a1428).fillRect(OX + this.px - this.pw / 2 - 1, PADDLE_Y - 1, this.pw + 2, 6);
    g.fillStyle(stunned ? 0x8a8fa8 : 0xf28c28).fillRect(OX + this.px - this.pw / 2, PADDLE_Y, this.pw, 4);
    g.fillStyle(stunned ? 0xc8ccd8 : 0x5ef0c8).fillRect(OX + this.px - this.pw / 2 + 2, PADDLE_Y, this.pw - 4, 1);
    for (const b of this.balls) {
      g.fillStyle(0x1a1428).fillCircle(OX + b.x, b.y, 3.5);
      g.fillStyle(0xfff1e0).fillCircle(OX + b.x, b.y, 2.5);
    }
  }
}
