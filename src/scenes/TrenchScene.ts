import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../constants';
import { pixelText } from '../pixelFont';
import { sfx } from '../sfx';
import { ModeScene } from './ModeScene';
import { makeTrenchArt } from './trenchArt';

/**
 * TIDE'S TRENCH: dive to the bottom of a deep-sea trench while Tide hunts you.
 *
 * You sink head-first; LEFT/RIGHT swim, DOWN dives faster, UP slows you. JUMP
 * is a short thruster dash (a moment of safety), FIRE drops a flare that
 * lights the dark around it. Mind the jellyfish, the old sea mines (they blink
 * and blow when you get close) and the urchins on the rock; grab air bubbles,
 * because your air runs down. The deeper you go, the darker it gets.
 *
 * Tide is a leviathan: his body loops through the dark behind the trench, and
 * then he strikes. His lights glow first where he'll come from: from the side
 * he lunges straight across; deeper down he surges up from below. Reach the
 * vent at the bottom and slip through: he follows you in and jams.
 */

const W = VIEW_W;
const H = VIEW_H;
/** How deep the trench goes (world px), and where you sit on screen. */
const DEPTH = 4200;
const VIEW_Y = 78;
const HEARTS = 5;
/** How fast you sink when not diving or braking. */
const CRUISE = 1.05;
const SEGMENTS = 14;
const SEG_GAP = 14;

interface Foe {
  kind: 'jelly' | 'mine' | 'bubble' | 'urchin';
  x: number;
  y: number;
  t: number;
  /** jelly drift phase / mine fuse (-1 = idle) / urchin side. */
  a: number;
  dead?: boolean;
}

type Attack = { kind: 'side'; dir: 1 | -1; y: number; t: number } | { kind: 'rise'; x: number; t: number };

export class TrenchScene extends ModeScene {
  protected readonly voice = 'tide';
  protected readonly music = 'reef';
  protected readonly homeStage = 'reef' as const;

  private p = { x: W / 2, y: 0, vx: 0, hp: HEARTS, air: 100, invuln: 0, dash: 0, dashCd: 0, flares: 3, kick: 0 };
  private camY = 0;
  private foes: Foe[] = [];
  private flares: { x: number; y: number; vy: number; t: number }[] = [];
  private snow: { x: number; y: number; s: number }[] = [];
  private bubbles: { x: number; y: number; t: number }[] = [];
  /** Tide: his body (a chain of points), what he's doing, and his background pass. */
  private body: { x: number; y: number }[] = [];
  private attack: Attack | null = null;
  private attackCd = 240;
  private pass: { x: number; y: number; dir: 1 | -1; t: number } | null = null;
  private ending = 0;
  private wallL: number[] = [];
  private wallR: number[] = [];
  private g!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private dark!: Phaser.GameObjects.RenderTexture;
  /** The soft light the dark is erased with (not on the display list). */
  private lightImg!: Phaser.GameObjects.Image;
  private diver!: Phaser.GameObjects.Image;
  private headImg!: Phaser.GameObjects.Image;
  private segImgs: Phaser.GameObjects.Image[] = [];
  private pool: Phaser.GameObjects.Image[] = [];
  private poolUsed = 0;
  private hudG!: Phaser.GameObjects.Graphics;
  private depthText!: ReturnType<typeof pixelText>;

  constructor() {
    super('trench');
  }

  // --- the trench --------------------------------------------------------------------

  /** Build the walls: a winding channel that narrows at choke points and opens into caverns. */
  private carve(): void {
    this.wallL = [];
    this.wallR = [];
    const seed = Math.random() * 100;
    for (let i = 0; i <= DEPTH / 8 + 40; i++) {
      const y = i * 8;
      const center = W / 2 + Math.sin(y / 260 + seed) * 70 + Math.sin(y / 97 + seed * 2) * 22;
      const choke = Math.max(0, Math.sin(y / 520 + seed * 3)) ** 6;
      let width = 210 - choke * 110 + Math.sin(y / 61 + seed) * 14;
      if (y < 200) width = 300; // a wide mouth at the top
      if (y > DEPTH - 160) width = 120 + (DEPTH - y) * 0.6; // funnel into the vent
      this.wallL.push(Math.max(8, center - width / 2));
      this.wallR.push(Math.min(W - 8, center + width / 2));
    }
  }

  private walls(y: number): [number, number] {
    const i = Math.max(0, Math.min(this.wallL.length - 2, Math.floor(y / 8)));
    const k = (y / 8) - i;
    return [this.wallL[i] + (this.wallL[i + 1] - this.wallL[i]) * k, this.wallR[i] + (this.wallR[i + 1] - this.wallR[i]) * k];
  }

  /** Scatter what's in the trench, thicker the deeper it goes. */
  private populate(): void {
    this.foes = [];
    for (let y = 260; y < DEPTH - 200; y += 70) {
      const [l, r] = this.walls(y);
      const k = y / DEPTH;
      const roll = Math.random();
      const x = l + 20 + Math.random() * Math.max(10, r - l - 40);
      if (roll < 0.26 + k * 0.12) this.foes.push({ kind: 'jelly', x, y, t: 0, a: Math.random() * 6 });
      else if (roll < 0.52 + k * 0.15) this.foes.push({ kind: 'mine', x, y, t: 0, a: -1 });
      else if (roll < 0.68) {
        const side = Math.random() < 0.5 ? -1 : 1;
        this.foes.push({ kind: 'urchin', x: side < 0 ? l + 6 : r - 6, y, t: 0, a: side });
      }
      if (y % 280 < 70) this.foes.push({ kind: 'bubble', x: l + 20 + Math.random() * Math.max(10, r - l - 40), y: y + 30, t: 0, a: 0 });
    }
  }

  protected setup(): void {
    makeTrenchArt(this);
    this.cameras.main.setBackgroundColor('#2a6ab0');
    this.p = { x: W / 2, y: 0, vx: 0, hp: HEARTS, air: 100, invuln: 0, dash: 0, dashCd: 0, flares: 3, kick: 0 };
    this.camY = -VIEW_Y;
    Object.assign(this, { flares: [], bubbles: [], attack: null, attackCd: 240, pass: null, ending: 0, pool: [], poolUsed: 0, segImgs: [] });
    this.carve();
    this.populate();
    this.snow = Array.from({ length: 50 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 0.2 + Math.random() * 0.6 }));
    this.body = Array.from({ length: SEGMENTS + 1 }, () => ({ x: -200, y: -200 }));
    this.g = this.add.graphics().setDepth(1);
    this.segImgs = Array.from({ length: SEGMENTS }, () => this.add.image(-100, -100, 'tr_seg').setDepth(4));
    this.headImg = this.add.image(-100, -100, 'tr_head0').setDepth(4.5);
    this.diver = this.add.image(0, 0, 'tr_diver0').setDepth(5);
    // The dark: a layer over everything, with lights erased out of it each frame.
    this.dark = this.add.renderTexture(0, 0, W, H).setOrigin(0).setDepth(10);
    this.lightImg = this.make.image({ key: 'tr_light', add: false });
    this.fx = this.add.graphics().setDepth(11).setBlendMode(Phaser.BlendModes.ADD);
    this.hudG = this.add.graphics().setDepth(20);
    this.depthText = pixelText(this, W - 6, 6, '', { color: '#9ad8ff', stroke: '#000000' }).setOrigin(1, 0).setDepth(21);
    this.help('ARROWS SWIM  JUMP DASH  FIRE FLARE', W / 2, H - 10);
  }

  // --- the dive ------------------------------------------------------------------------

  protected tick(): void {
    const p = this.p;
    const c = this.controls;
    if (this.ending) return this.stepEnding();
    // Swim: LEFT/RIGHT steer, DOWN dives, UP brakes; the dash is a burst with a beat of safety.
    const ix = (c.isDown('right') ? 1 : 0) - (c.isDown('left') ? 1 : 0);
    p.vx = p.vx * 0.86 + ix * 0.32;
    let sink = c.isDown('down') ? 1.9 : c.isDown('up') ? 0.45 : CRUISE;
    if (p.dashCd > 0) p.dashCd--;
    if (c.justPressed('jump') && p.dashCd === 0) {
      p.dash = 14;
      p.dashCd = 60;
      p.invuln = Math.max(p.invuln, 16);
      sfx.whoosh();
      for (let i = 0; i < 6; i++) this.bubbles.push({ x: p.x, y: p.y - 8, t: 30 + i * 3 });
    }
    if (p.dash > 0) {
      p.dash--;
      p.vx += ix * 0.9;
      sink += ix ? 0.4 : 2.5;
    }
    p.x += p.vx;
    p.y += sink;
    p.kick += Math.abs(p.vx) * 0.2 + sink * 0.12;
    const [l, r] = this.walls(p.y);
    if (p.x < l + 7) {
      p.x = l + 7;
      p.vx = Math.abs(p.vx) * 0.5;
    }
    if (p.x > r - 7) {
      p.x = r - 7;
      p.vx = -Math.abs(p.vx) * 0.5;
    }
    if (c.justPressed('fire') && p.flares > 0) {
      p.flares--;
      this.flares.push({ x: p.x, y: p.y + 8, vy: 0.4, t: 300 });
      sfx.flame();
    }
    if (p.invuln > 0) p.invuln--;
    // Air runs down; bubbles refill it; with none left, it hurts.
    if (this.frame % 28 === 0) p.air = Math.max(0, p.air - 1);
    if (p.air === 0 && this.frame % 60 === 0) this.hurt(true);
    if (this.frame % 20 === 0) this.bubbles.push({ x: p.x + (Math.random() - 0.5) * 4, y: p.y - 10, t: 60 });
    this.camY = p.y - VIEW_Y;
    this.stepFoes();
    this.stepTide();
    for (const f of this.flares) {
      f.y += f.vy;
      f.t--;
    }
    this.flares = this.flares.filter((f) => f.t > 0);
    for (const b of this.bubbles) {
      b.y -= 0.7;
      b.x += Math.sin((b.t + b.y) / 8) * 0.3;
      b.t--;
    }
    this.bubbles = this.bubbles.filter((b) => b.t > 0);
    if (p.y >= DEPTH - 40) {
      this.ending = 1;
      this.attack = null;
      this.banner.setText('THE VENT!');
    }
  }

  private hurt(drowning = false): void {
    const p = this.p;
    if (!drowning && (p.invuln > 0 || this.ending)) return;
    p.hp--;
    p.invuln = 70;
    sfx.hurt();
    this.cameras.main.shake(150, 0.01);
    if (p.hp <= 0) this.finish(false, drowning ? 'OUT OF AIR...' : 'SWALLOWED BY THE DEEP...');
  }

  private stepFoes(): void {
    const p = this.p;
    for (const f of this.foes) {
      if (f.dead || Math.abs(f.y - p.y) > 220) continue;
      f.t++;
      switch (f.kind) {
        case 'jelly': {
          // Drifts on a slow sway, pulsing up.
          const [l, r] = this.walls(f.y);
          f.x = Math.max(l + 10, Math.min(r - 10, f.x + Math.sin(f.t / 50 + f.a) * 0.5));
          f.y -= f.t % 60 < 20 ? 0.35 : -0.08;
          if (Math.hypot(f.x - p.x, f.y - p.y) < 11) this.hurt();
          break;
        }
        case 'mine':
          // Gets close: it starts to blink; after the fuse, it goes off.
          if (f.a < 0 && Math.hypot(f.x - p.x, f.y - p.y) < 34) {
            f.a = 45;
            sfx.tick();
          }
          if (f.a > 0 && --f.a === 0) {
            f.dead = true;
            sfx.explode();
            this.cameras.main.shake(180, 0.012);
            for (let i = 0; i < 14; i++) this.bubbles.push({ x: f.x + (Math.random() - 0.5) * 20, y: f.y + (Math.random() - 0.5) * 20, t: 40 });
            if (Math.hypot(f.x - p.x, f.y - p.y) < 36) this.hurt();
          }
          if (!f.dead && Math.hypot(f.x - p.x, f.y - p.y) < 10) {
            f.a = 1;
          }
          break;
        case 'urchin':
          if (Math.hypot(f.x - p.x, f.y - p.y) < 11) this.hurt();
          break;
        case 'bubble':
          f.y -= 0.25;
          if (Math.hypot(f.x - p.x, f.y - p.y) < 13) {
            f.dead = true;
            p.air = Math.min(100, p.air + 35);
            sfx.pickup();
          }
          break;
      }
    }
  }

  // --- Tide -----------------------------------------------------------------------------

  /** Move the head; the body follows it like a chain. */
  private steer(hx: number, hy: number): void {
    const b = this.body;
    b[0].x = hx;
    b[0].y = hy;
    for (let i = 1; i < b.length; i++) {
      const dx = b[i].x - b[i - 1].x, dy = b[i].y - b[i - 1].y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > SEG_GAP) {
        b[i].x = b[i - 1].x + (dx / d) * SEG_GAP;
        b[i].y = b[i - 1].y + (dy / d) * SEG_GAP;
      }
    }
  }

  /** Lay his body out in a straight line trailing behind (dir), off the edge of the screen. */
  private lineUp(x: number, y: number, dx: number, dy: number): void {
    this.body.forEach((s, i) => {
      s.x = x - dx * SEG_GAP * i;
      s.y = y - dy * SEG_GAP * i;
    });
  }

  private stepTide(): void {
    const p = this.p;
    const depthK = p.y / DEPTH;
    // Now and then he slides past far behind the trench (no harm: a reminder he's there).
    if (!this.pass && !this.attack && this.frame % 500 === 250) this.pass = { x: -80, y: p.y + 40 + Math.random() * 80, dir: Math.random() < 0.5 ? 1 : -1, t: 0 };
    if (this.pass) {
      this.pass.t++;
      if (this.pass.t > 420) this.pass = null;
    }
    if (this.attack) {
      const a = this.attack;
      a.t++;
      const warn = this.warnFrames();
      if (a.kind === 'side') {
        // Lights glow at the edge first, then he lunges straight across.
        const sx = a.dir > 0 ? -30 : W + 30;
        if (a.t < warn) {
          this.lineUp(sx, a.y, a.dir, 0);
          if (a.t % 10 === 0) this.cameras.main.shake(60, 0.003);
        } else {
          const k = a.t - warn;
          this.steer(sx + a.dir * k * 7.5, a.y + Math.sin(k / 6) * 6);
          if (k === 1) sfx.whoosh();
          if (k > (W + SEGMENTS * SEG_GAP + 80) / 7.5) this.endAttack();
        }
      } else {
        // From below: a glow rising in your column, then he surges up through it.
        const sy = p.y + (H - VIEW_Y) + 40;
        if (a.t < warn + 10) this.lineUp(a.x, sy, 0, -1);
        else {
          const k = a.t - warn - 10;
          this.steer(a.x + Math.sin(k / 5) * 8, sy - k * 6.5);
          if (k === 1) sfx.whoosh();
          if (k > (H + SEGMENTS * SEG_GAP + 80) / 6.5) this.endAttack();
        }
      }
      // Touching him hurts (head or body).
      if (this.attackLive()) for (const s of this.body) if (Math.hypot(s.x - p.x, s.y - p.y) < 13) this.hurt();
      return;
    }
    if (--this.attackCd > 0 || p.y < 300) return;
    // Pick a strike: from the side at your depth (give or take), or from below once it's deep.
    if (depthK > 0.45 && Math.random() < 0.4) this.attack = { kind: 'rise', x: Math.max(30, Math.min(W - 30, p.x + (Math.random() - 0.5) * 40)), t: 0 };
    else {
      // Aimed where you'll be when his head reaches the middle if you keep cruising,
      // so you have to brake (UP) or dive (DOWN) out of the way.
      const lead = (this.warnFrames() + (W / 2 + 30) / 7.5) * CRUISE;
      this.attack = { kind: 'side', dir: Math.random() < 0.5 ? 1 : -1, y: p.y + lead + (Math.random() - 0.5) * 24, t: 0 };
    }
    sfx.cyclone();
  }

  /** How long his lights glow before he strikes (shorter deeper down). */
  private warnFrames(): number {
    return this.p.y / DEPTH > 0.6 ? 32 : 42;
  }

  private attackLive(): boolean {
    const a = this.attack;
    if (!a) return false;
    const warn = this.warnFrames();
    return a.t >= warn + (a.kind === 'rise' ? 10 : 0);
  }

  private endAttack(): void {
    this.attack = null;
    const depthK = this.p.y / DEPTH;
    this.attackCd = Math.round(220 - depthK * 110 + Math.random() * 60);
  }

  /** The vent: you slip in, he lunges after you and jams in the opening. */
  private stepEnding(): void {
    const p = this.p;
    this.ending++;
    p.y += 0.8;
    p.x += (W / 2 - p.x) * 0.05;
    this.camY = p.y - VIEW_Y;
    const ventY = DEPTH + 30;
    if (this.ending < 30) this.lineUp(W / 2, ventY - 260, 0, -1);
    else if (this.ending < 70) this.steer(W / 2 + Math.sin(this.ending / 5) * 4, ventY - 260 + (this.ending - 30) * 6);
    else if (this.ending === 70) {
      this.cameras.main.shake(400, 0.02);
      sfx.crush();
      this.banner.setText('');
    } else if (this.ending > 70 && this.ending < 120) this.steer(W / 2 + Math.sin(this.ending) * 2, ventY - 20);
    if (this.ending === 130) this.finish(true, 'TIDE IS STUCK!');
  }

  // --- drawing ----------------------------------------------------------------------

  private put(key: string, x: number, y: number, o: { depth?: number; rot?: number; alpha?: number; flipX?: boolean; scale?: number; tint?: number } = {}): void {
    let img = this.pool[this.poolUsed];
    if (!img) {
      img = this.add.image(0, 0, key);
      this.pool.push(img);
    }
    this.poolUsed++;
    img.setTexture(key).setPosition(Math.round(x), Math.round(y)).setDepth(o.depth ?? 3).setRotation(o.rot ?? 0).setAlpha(o.alpha ?? 1).setFlipX(!!o.flipX).setScale(o.scale ?? 1).setVisible(true);
    if (o.tint !== undefined) img.setTint(o.tint);
    else img.clearTint();
  }

  protected draw(): void {
    const g = this.g;
    const fx = this.fx;
    g.clear();
    fx.clear();
    this.poolUsed = 0;
    const p = this.p;
    const cy = this.camY;
    const k = Math.max(0, Math.min(1, p.y / DEPTH));
    // Water darkens from blue to near-black as you go down.
    const top = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0x2a6ab0), Phaser.Display.Color.ValueToColor(0x04101c), 100, Math.round(k * 100));
    this.cameras.main.setBackgroundColor(Phaser.Display.Color.GetColor(top.r, top.g, top.b));
    // Light shafts near the surface.
    if (k < 0.25) for (let i = 0; i < 5; i++) g.fillStyle(0xbfe6ff, 0.06 * (1 - k * 4)).fillTriangle(40 + i * 90, 0, 70 + i * 90, 0, 10 + i * 90 + Math.sin(this.frame / 60 + i) * 10, H);
    // Marine snow, drifting up past you.
    for (const s of this.snow) {
      s.y -= 0.3 + s.s * 0.4;
      if (s.y < 0) Object.assign(s, { y: H, x: Math.random() * W });
      g.fillStyle(0xe6f4ff, 0.3 + s.s * 0.4).fillRect(s.x, s.y, 1, 1);
    }
    // Tide's pass in the far dark: a long dim shape with glinting lights.
    if (this.pass) {
      const ps = this.pass;
      const x0 = ps.dir > 0 ? -300 + ps.t * 2 : W + 300 - ps.t * 2;
      for (let i = 0; i < 26; i++) {
        const x = x0 - ps.dir * i * 16;
        const y = ps.y - cy + Math.sin(ps.t / 20 + i / 2) * 14;
        g.fillStyle(0x0a1a24, 0.75).fillCircle(x, y, 13 - i * 0.25);
        if (i % 3 === 1) fx.fillStyle(0x5ef0c8, 0.35).fillCircle(x, y - 6, 2);
      }
    }
    // The trench walls: layered rock, a lit lip, kelp and coral on the ledges.
    const y0 = Math.floor(cy / 8) * 8;
    for (let wy = y0 - 8; wy < cy + H + 8; wy += 4) {
      const [l, r] = this.walls(wy);
      const sy = wy - cy;
      const shade = Math.max(0, 1 - k * 0.8);
      g.fillStyle(Phaser.Display.Color.GetColor(30 * shade + 10, 44 * shade + 12, 60 * shade + 18)).fillRect(0, sy, l, 4).fillRect(r, sy, W - r, 4);
      g.fillStyle(Phaser.Display.Color.GetColor(60 * shade + 14, 90 * shade + 18, 110 * shade + 24)).fillRect(l - 4, sy, 4, 4).fillRect(r, sy, 4, 4);
      g.fillStyle(Phaser.Display.Color.GetColor(110 * shade + 20, 150 * shade + 26, 170 * shade + 30)).fillRect(l - 1, sy, 1, 4).fillRect(r, sy, 1, 4);
      // Speckled rock.
      for (let k2 = 0; k2 < 3; k2++) {
        const hx = Math.sin((wy + k2 * 31) * 7.13) * 9999;
        const fxr = hx - Math.floor(hx);
        const sx2 = fxr * W;
        if (sx2 < l - 6 || sx2 > r + 6) g.fillStyle(0x000000, 0.35).fillRect(sx2, sy + k2, 2, 1);
      }
      // Strata.
      if ((wy / 4) % 9 === 0) g.fillStyle(0x000000, 0.25).fillRect(0, sy, l - 6, 1).fillRect(r + 6, sy, W - r, 1);
      // Kelp and glowing coral at intervals along the edges.
      const hsh = Math.sin(wy * 12.9898) * 43758.5453;
      const v = hsh - Math.floor(hsh);
      if (v < 0.05) for (let i = 0; i < 18; i++) g.fillStyle(0x2e7a34, 0.8).fillRect(l - 2 + Math.sin(this.frame / 30 + i / 3 + wy) * 3 + i * 0.3, sy - i * 2, 2, 2);
      if (v > 0.96) {
        g.fillStyle(0xff7aa8).fillRect(r + 2, sy - 2, 3, 3);
        fx.fillStyle(0xff7aa8, 0.25).fillCircle(r + 3, sy, 5);
      }
    }
    // The vent at the bottom.
    const ventY = DEPTH + 30 - cy;
    if (ventY < H + 40) {
      g.fillStyle(0x020408).fillEllipse(W / 2, ventY + 20, 90, 30);
      fx.fillStyle(0xff8a2a, 0.3 + Math.sin(this.frame / 6) * 0.1).fillEllipse(W / 2, ventY + 14, 70, 16);
      for (let i = 0; i < 4; i++) fx.fillStyle(0xffe14a, 0.4).fillRect(W / 2 - 20 + i * 12, ventY + 8 - ((this.frame * 2 + i * 9) % 30), 2, 2);
    }
    // Things in the trench.
    for (const f of this.foes) {
      if (f.dead) continue;
      const sy = f.y - cy;
      if (sy < -30 || sy > H + 30) continue;
      if (f.kind === 'jelly') {
        this.put(`tr_jelly${Math.floor(f.t / 20) % 2}`, f.x, sy, { depth: 3 });
        fx.fillStyle(0xd0a8f0, 0.22).fillCircle(f.x, sy - 2, 12);
      } else if (f.kind === 'mine') {
        const blink = f.a > 0 && (f.a < 15 ? this.frame % 4 < 2 : this.frame % 10 < 5);
        this.put(`tr_mine${blink ? 1 : 0}`, f.x, sy, { depth: 3 });
        if (blink) fx.fillStyle(0xff3a3a, 0.4).fillCircle(f.x, sy - 4, 10);
      } else if (f.kind === 'urchin') this.put('tr_urchin', f.x, sy, { depth: 3, rot: f.a < 0 ? Math.PI / 2 : -Math.PI / 2 });
      else {
        this.put('tr_bubble', f.x + Math.sin(f.t / 10) * 2, sy, { depth: 3, scale: 1.4 });
        fx.fillStyle(0xbfe6ff, 0.2).fillCircle(f.x, sy, 10);
      }
    }
    for (const f of this.flares) {
      this.put('tr_flare', f.x, f.y - cy, { depth: 3, rot: Math.sin(f.t / 10) * 0.3 });
      fx.fillStyle(0xff5a3a, 0.35 + Math.random() * 0.1).fillCircle(f.x, f.y - cy - 4, 6);
    }
    for (const b of this.bubbles) g.lineStyle(1, 0xbfe6ff, Math.min(1, b.t / 20)).strokeCircle(b.x, b.y - cy, 1.5);
    // Tide: his segments and head, his lights glowing (brightest while he winds up).
    const winding = this.attack && !this.attackLive();
    const showBody = !!this.attack || this.ending > 0;
    this.body.forEach((s, i) => {
      if (i === 0) return;
      const img = this.segImgs[i - 1];
      const prev = this.body[i - 1];
      img.setPosition(Math.round(s.x), Math.round(s.y - cy)).setRotation(Math.atan2(prev.y - s.y, prev.x - s.x)).setScale(1 - i * 0.025).setVisible(showBody);
      if (showBody) fx.fillStyle(0x5ef0c8, winding ? 0.55 : 0.3).fillCircle(s.x, s.y - cy - 4, winding ? 6 : 4);
    });
    const h0 = this.body[0], h1 = this.body[1];
    const ang = Math.atan2(h0.y - h1.y, h0.x - h1.x);
    const left = Math.cos(ang) < 0;
    this.headImg
      .setTexture(this.attackLive() || (this.ending > 30 && this.ending < 75) ? 'tr_head1' : 'tr_head0')
      .setPosition(Math.round(h0.x), Math.round(h0.y - cy))
      .setRotation(left ? ang - Math.PI : ang)
      .setFlipX(left)
      .setVisible(showBody);
    if (showBody) fx.fillStyle(0xffe14a, winding ? 0.7 : 0.45).fillCircle(h0.x + Math.cos(ang) * 6, h0.y - cy - 4, winding ? 10 : 6);
    // From-the-side warning: his eyes and lights glowing at the edge, and a band of churning water across.
    if (this.attack?.kind === 'side' && winding) {
      const a = this.attack;
      const ex = a.dir > 0 ? 6 : W - 6;
      const ey = a.y - cy;
      const pulse = 0.5 + Math.sin(a.t / 3) * 0.3;
      fx.fillStyle(0x5ef0c8, 0.06 + (a.t / 52) * 0.08).fillRect(0, ey - 14, W, 28);
      fx.fillStyle(0xffe14a, pulse).fillCircle(ex, ey - 3, 7);
      fx.fillStyle(0xffffff, pulse).fillCircle(ex, ey - 3, 3);
      for (let i = 1; i < 5; i++) fx.fillStyle(0x5ef0c8, pulse * 0.8).fillCircle(ex - a.dir * i * 3, ey + 8 + (i % 2) * 3, 2);
      for (let i = 0; i < 6; i++) {
        const bx = (a.dir > 0 ? (a.t * 4 + i * 70) % W : W - ((a.t * 4 + i * 70) % W));
        g.fillStyle(0xbfe6ff, 0.5).fillRect(bx, ey + ((i * 9) % 20) - 10, 6, 1);
      }
    }
    // From-below warning: a column of light rising toward you.
    if (this.attack?.kind === 'rise' && winding) fx.fillStyle(0x5ef0c8, 0.08 + (this.attack.t % 10) / 100).fillRect(this.attack.x - 16, VIEW_Y, 32, H - VIEW_Y);
    // You, kicking down, with your lamp.
    const shown = !(p.invuln > 0 && this.frame % 6 < 3) || this.ending > 0;
    this.diver.setTexture(`tr_diver${Math.floor(p.kick / 3) % 2}`).setPosition(Math.round(p.x), VIEW_Y).setRotation(-p.vx * 0.08).setVisible(shown && this.result !== 'lose');
    if (p.dash > 0) fx.fillStyle(0x9ad8ff, 0.3).fillEllipse(p.x, VIEW_Y - 12, 14, 24);
    for (let i = this.poolUsed; i < this.pool.length; i++) this.pool[i].setVisible(false);
    // The dark: deeper is darker; your lamp, flares, jellies, the vent and his lights cut through it.
    const dark = this.dark;
    dark.clear();
    const alpha = Math.min(0.92, 0.1 + k * 1.1);
    dark.fill(0x01040a, alpha);
    const lights: [number, number, number][] = [[p.x, VIEW_Y + 26, 70], [p.x, VIEW_Y, 36]];
    for (const f of this.flares) lights.push([f.x, f.y - cy, 86]);
    for (const f of this.foes) if (!f.dead && (f.kind === 'jelly' || f.kind === 'bubble') && Math.abs(f.y - cy - H / 2) < H) lights.push([f.x, f.y - cy, 22]);
    if (ventY < H + 40) lights.push([W / 2, ventY + 14, 70]);
    for (const [x, y, r] of lights) dark.erase(this.lightImg.setScale((r * 2) / 128), x, y);
    this.drawHud();
  }

  private drawHud(): void {
    const p = this.p;
    const h = this.hudG;
    h.clear();
    this.hud.setText('');
    // Hearts.
    for (let i = 0; i < HEARTS; i++) {
      const x = 8 + i * 10;
      h.fillStyle(0x1a1428).fillRect(x - 1, 7, 9, 8);
      h.fillStyle(i < p.hp ? 0xe8484e : 0x3a2030).fillRect(x, 8, 3, 3).fillRect(x + 4, 8, 3, 3).fillRect(x + 1, 11, 5, 2).fillRect(x + 2, 13, 3, 1);
    }
    // Air.
    h.fillStyle(0x1a1428).fillRect(7, 19, 62, 7);
    h.fillStyle(0x14304a).fillRect(8, 20, 60, 5);
    h.fillStyle(p.air < 25 && this.frame % 20 < 10 ? 0xff8a8a : 0x5ab0f0).fillRect(8, 20, Math.round(p.air * 0.6), 5);
    h.fillStyle(0xbfe6ff).fillRect(8, 20, Math.round(p.air * 0.6), 1);
    // Flares.
    for (let i = 0; i < 3; i++) h.fillStyle(i < p.flares ? 0xe8484e : 0x3a2030).fillRect(8 + i * 6, 30, 3, 7);
    // Depth: a gauge down the right side, with you on it.
    const gx = W - 14;
    h.fillStyle(0x1a1428).fillRect(gx - 1, 20, 7, 180);
    h.fillStyle(0x0a1a2a).fillRect(gx, 21, 5, 178);
    const k = Math.max(0, Math.min(1, p.y / DEPTH));
    h.fillStyle(0x2a6ab0).fillRect(gx, 21, 5, Math.round(178 * k));
    h.fillStyle(0xf28c28).fillRect(gx - 2, 21 + Math.round(178 * k) - 1, 9, 3);
    h.fillStyle(0xff8a2a).fillRect(gx - 1, 198, 7, 2);
    this.depthText.setText(`${Math.round(Math.max(0, p.y) / 4)} M`);
  }
}
