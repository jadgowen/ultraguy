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
  private fxG!: Phaser.GameObjects.Graphics;
  private brickImgs: Phaser.GameObjects.Image[] = [];
  private trails: [number, number][][] = [];
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
    makeBreakerArt(this);
    this.add.image(OX - 6, TOP - 4, 'bk_forge').setOrigin(0).setDepth(-1);
    this.g = this.add.graphics().setDepth(2);
    this.fxG = this.add.graphics().setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
    this.brickImgs = [];
    for (let r = 0; r < BROWS; r++) for (let c = 0; c < BCOLS; c++) this.brickImgs.push(this.add.image(OX + c * BW, WALL_Y + r * BH, 'bk_brick1').setOrigin(0).setDepth(1));
    this.trails = [];
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
    const fx = this.fxG;
    g.clear();
    fx.clear();
    // The furnace strip breathes behind Anvil.
    fx.fillStyle(0xff5a1a, 0.12 + Math.sin(this.frame / 20) * 0.05).fillRect(OX, TOP, FW, 40);
    // Bricks: clay, steel, and hot ones that pulse.
    for (let r = 0; r < BROWS; r++)
      for (let c = 0; c < BCOLS; c++) {
        const k = this.bricks[r][c];
        const img = this.brickImgs[r * BCOLS + c];
        img.setVisible(!!k);
        if (!k) continue;
        img.setTexture(`bk_brick${k}`);
        if (k === 3) fx.fillStyle(0xff8a2a, 0.12 + (Math.sin(this.frame / 8 + c) + 1) * 0.06).fillRect(OX + c * BW - 1, WALL_Y + r * BH - 1, BW + 1, BH + 1);
      }
    // Anvil behind the wall.
    const a = this.anvil;
    this.anvilImg.setPosition(OX + a.x, 44).setFlipX(a.dir < 0).setAlpha(a.hurtT > 0 && this.frame % 6 < 3 ? 0.3 : 1);
    this.anvilImg.setTint(this.result === 'win' ? 0x555555 : 0xffffff);
    // Sparks and drops.
    for (const s of this.sparks) {
      fx.fillStyle(0xffe14a).fillRect(OX + s.x - 1, s.y - 1, 2, 2);
      fx.fillStyle(0xf28c28, 0.7).fillRect(OX + s.x - s.vx * 2, s.y - s.vy * 2, 2, 2);
    }
    const dropColor: Record<Power, number> = { wide: 0x5ab84a, multi: 0x6ab8e8, slow: 0xc8ccd8 };
    for (const d of this.drops) {
      // A pill capsule with its icon.
      g.fillStyle(0x1a1428).fillRoundedRect(OX + d.x - 8, d.y - 5, 16, 10, 4);
      g.fillStyle(dropColor[d.kind]).fillRoundedRect(OX + d.x - 7, d.y - 4, 14, 8, 3);
      g.fillStyle(0xffffff, 0.5).fillRect(OX + d.x - 5, d.y - 3, 10, 1);
      fx.fillStyle(dropColor[d.kind], 0.25).fillCircle(OX + d.x, d.y, 9);
      g.fillStyle(0xffffff);
      if (d.kind === 'multi') for (const dx of [-3, 0, 3]) g.fillRect(OX + d.x + dx - 1, d.y - 1, 2, 2);
      else if (d.kind === 'wide') g.fillRect(OX + d.x - 4, d.y - 1, 8, 2);
      else g.fillRect(OX + d.x - 1, d.y - 1, 2, 2);
    }
    // Paddle: an orange bar with chrome end caps and a teal light strip (grey and flickering while stunned).
    const stunned = this.stunT > 0;
    const flick = stunned && this.frame % 6 < 3;
    const x0 = OX + this.px - this.pw / 2;
    g.fillStyle(0x1a1428).fillRoundedRect(x0 - 2, PADDLE_Y - 2, this.pw + 4, 8, 3);
    g.fillStyle(flick ? 0x8a8fa8 : 0xb85a1a).fillRect(x0, PADDLE_Y, this.pw, 4);
    g.fillStyle(flick ? 0xc8ccd8 : 0xf28c28).fillRect(x0, PADDLE_Y, this.pw, 2);
    g.fillStyle(flick ? 0xeef2fa : 0xffc070).fillRect(x0, PADDLE_Y, this.pw, 1);
    for (const ex of [x0 - 1, x0 + this.pw - 5]) {
      g.fillStyle(0x8a8fa8).fillRect(ex, PADDLE_Y - 1, 6, 6);
      g.fillStyle(0xeef2fa).fillRect(ex, PADDLE_Y - 1, 6, 1);
    }
    g.fillStyle(stunned ? 0x55607a : 0x5ef0c8).fillRect(x0 + 8, PADDLE_Y + 2, this.pw - 16, 1);
    if (!stunned) fx.fillStyle(0x5ef0c8, 0.15).fillRect(x0, PADDLE_Y - 2, this.pw, 8);
    // Balls: chrome, with a short trail and a glow.
    while (this.trails.length < this.balls.length) this.trails.push([]);
    this.balls.forEach((b, i) => {
      const t = (this.trails[i] = [[b.x, b.y] as [number, number], ...this.trails[i]].slice(0, 5));
      if (!b.stuck) t.forEach(([x, y], k) => k > 0 && fx.fillStyle(0xfff1e0, 0.25 - k * 0.05).fillCircle(OX + x, y, 2.5 - k * 0.3));
      g.fillStyle(0x1a1428).fillCircle(OX + b.x, b.y, 3.5);
      g.fillStyle(0xc8ccd8).fillCircle(OX + b.x, b.y, 2.6);
      g.fillStyle(0xffffff).fillRect(OX + b.x - 1.5, b.y - 1.5, 1.5, 1.5);
      fx.fillStyle(0xfff4c0, 0.2).fillCircle(OX + b.x, b.y, 6);
    });
    this.trails.length = this.balls.length;
  }
}

/** The forge behind the wall (with its frame) and the three kinds of brick. */
function makeBreakerArt(scene: Phaser.Scene): void {
  if (scene.textures.exists('bk_forge')) return;
  const bay = (x: number, y: number) => [0, 0.5, 0.75, 0.25][(x & 1) + ((y & 1) << 1)];
  const hsh = (x: number, y: number, s = 0) => {
    let q = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
    q = Math.imul(q ^ (q >>> 13), 1274126177);
    return ((q ^ (q >>> 16)) >>> 0) / 4294967296;
  };
  const pick = (ramp: string[], k: number, x: number, y: number) => {
    const v = Math.min(ramp.length - 1, Math.max(0, k * (ramp.length - 1)));
    const lo = Math.floor(v);
    return ramp[Math.min(ramp.length - 1, lo + (v - lo > bay(x, y) ? 1 : 0))];
  };
  const W = FW + 12, H = BOTTOM - TOP + 8;
  const bg = scene.textures.createCanvas('bk_forge', W, H)!;
  const c = bg.getContext();
  const px = (col: string, x: number, y: number, w = 1, h = 1) => {
    c.fillStyle = col;
    c.fillRect(x, y, w, h);
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const frame = x < 6 || x >= W - 6 || y < 4 || y >= H - 4;
      if (frame) {
        px(pick(['#1a1010', '#3a2420', '#5a3a30', '#8a5a44'], 0.6 - (x < 6 ? 0 : 0.2) + (y < 4 ? 0.2 : 0), x, y), x, y);
        continue;
      }
      // Stone wall, lit from the furnace at the top, fading to dark toward the paddle.
      const lit = Math.max(0, 1 - (y - 4) / 150);
      const row = (y - 4) >> 3, off = (row & 1) * 10;
      const mortar = (y - 4) % 8 === 7 || (x - 6 + off) % 20 === 19;
      px(mortar ? '#0c0606' : pick(['#120808', '#2a1410', '#4a2418', '#7a3a1e'], lit * 0.85 + hsh((x + off) >> 4, row, 2) * 0.15, x, y), x, y);
    }
  // The furnace strip where Anvil walks, chains hanging, pipes up the sides.
  for (let y = 4; y < 44; y++) for (let x = 6; x < W - 6; x++) px(pick(['#5a1a0a', '#8c2a10', '#c8501a', '#ff8a2a'], 0.25 + (y - 4) / 60 + hsh(x >> 2, y >> 2, 4) * 0.2, x, y), x, y);
  for (let x = 6; x < W - 6; x++) px('#1a0c08', x, 44, 1, 2);
  for (const cx of [40, W - 46]) for (let y = 46; y < 110; y += 4) {
    px('#1a1428', cx - 1, y, 4, 3);
    px('#8a8fa8', cx, y + 1, 2, 1);
  }
  for (const pxX of [8, W - 12])
    for (let y = 50; y < H - 6; y++) px(pick(['#2b2540', '#55607a', '#8a8fa8', '#c8ccd8'], 0.3 + (pxX < 20 ? 0.4 : 0.1) + ((y % 30) < 2 ? 0.3 : 0), y, pxX), pxX, y, 4, 1);
  bg.refresh();
  const brick = (key: string, ramp: string[], rivets: boolean, hot: boolean) => {
    const t = scene.textures.createCanvas(key, BW, BH)!;
    const b = t.getContext();
    for (let y = 0; y < BH; y++)
      for (let x = 0; x < BW; x++) {
        const edge = x === BW - 1 || y === BH - 1;
        const k = 0.6 - y / 14 + (y === 0 || x === 0 ? 0.35 : 0) - (y === BH - 2 ? 0.2 : 0) + hsh(x >> 2, y, key.length) * 0.1;
        b.fillStyle = edge ? '#1a1428' : pick(ramp, k, x, y);
        b.fillRect(x, y, 1, 1);
      }
    if (rivets) for (const rx of [3, BW - 5]) {
      b.fillStyle = '#ffffff';
      b.fillRect(rx, 3, 1, 1);
      b.fillStyle = '#2b2540';
      b.fillRect(rx + 1, 4, 1, 1);
    }
    if (hot) {
      b.fillStyle = '#fff4c0';
      b.fillRect(8, 3, 4, 2);
    }
    t.refresh();
  };
  brick('bk_brick1', ['#5a2a10', '#b85a1a', '#f28c28', '#ffc070'], false, false);
  brick('bk_brick2', ['#2b2540', '#55607a', '#8a8fa8', '#eef2fa'], true, false);
  brick('bk_brick3', ['#8c2030', '#d83a4a', '#ff8a2a', '#ffe14a'], false, true);
}
