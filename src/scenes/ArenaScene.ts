import Phaser from 'phaser';
import { playMusic, stopMusic } from '../audio';
import { STEP_MS, VIEW_H, VIEW_W } from '../constants';
import { Controls } from '../input';
import { pixelText } from '../pixelFont';
import { sfx } from '../sfx';
import { setTouchMode, touchEnabled } from '../touch';
import { pixelateIn, pixelateOut } from './cutscene';

/**
 * ULTRA ARENA: a first-person deathmatch in the style of the old 90s
 * shooters, from the title menu. A raycaster draws the arena (textured walls,
 * floors and ceilings or open sky, fog with distance) into a canvas texture
 * every frame; bots (the eight bosses, as their own sprites) and pickups are
 * billboards checked against a depth buffer. First to 10 frags.
 *
 * UP/DOWN move, LEFT/RIGHT turn, PREV/NEXT (Q/E, shoulder buttons) strafe,
 * FIRE shoots, JUMP switches weapons, START pauses. Click to turn with the mouse.
 * On a phone: a stick under the left thumb moves and strafes, dragging on the
 * right looks, FIRE (drag it to aim too), WPN (see touch.ts). A gentle aim
 * assist helps everyone: near a bot, turning slows and the view leans onto it.
 */

const W = VIEW_W;
const H = VIEW_H - 18; // the status bar sits below the view
const TS = 32;
const FRAG_LIMIT = 10;
/** Radians per CSS pixel of touch look drag. */
const LOOK_SENS = 0.0075;
/** Aim assist: how far off the crosshair (radians) a bot can be and still pull. */
const ASSIST_CONE = 0.14;

// 1 brick / rust / panel, 2 door / plates / vent, 3 banner / tyres / stripe, 4 torch / hazard / glow.
const MAP = [
  '111111111111111111111111',
  '1......................1',
  '1..22........22........1',
  '1..2..........2...3....1',
  '1.......44.........3...1',
  '1.......44.............1',
  '1..............2222....1',
  '1...3..........2..2....1',
  '1...3..................1',
  '1.......11....11.......1',
  '1.......1......1...44..1',
  '1..44..............44..1',
  '1..44..................1',
  '1.......1......1.......1',
  '1.......11....11...3...1',
  '1..................3...1',
  '1....2.................1',
  '1....2.....33......22..1',
  '1....2.................1',
  '1..........44..........1',
  '1...22.....44....2.....1',
  '1................2.....1',
  '1......................1',
  '111111111111111111111111',
];
const MW = MAP[0].length;
const MH = MAP.length;
const cell = (x: number, y: number): number => {
  if (x < 0 || y < 0 || x >= MW || y >= MH) return 1;
  const ch = MAP[y][x];
  return ch === '.' ? 0 : +ch;
};
const solid = (x: number, y: number) => cell(Math.floor(x), Math.floor(y)) > 0;
const free = (x: number, y: number, r = 0.22) => !solid(x - r, y - r) && !solid(x + r, y - r) && !solid(x - r, y + r) && !solid(x + r, y + r);

const SPAWNS: [number, number][] = [[2.5, 21.5], [21.5, 2.5], [21.5, 21.5], [12, 4], [14, 21.5], [6, 12], [18, 12], [1.5, 1.5]];
const PICKUPS: { x: number; y: number; kind: number | 'hp' }[] = [
  { x: 6.5, y: 4.5, kind: 1 }, { x: 17.5, y: 11.5, kind: 2 }, { x: 5.5, y: 11.5, kind: 3 }, { x: 9.5, y: 19.5, kind: 4 },
  { x: 12, y: 12, kind: 'hp' }, { x: 21.5, y: 18.5, kind: 'hp' }, { x: 6.5, y: 18.5, kind: 'hp' },
];

// --- colors and textures ------------------------------------------------------------
const c8 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const rgb = (r: number, g: number, b: number) => ((255 << 24) | (c8(b) << 16) | (c8(g) << 8) | c8(r)) >>> 0;
const hexRgb = (h: number): [number, number, number] => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const hash = (x: number, y: number, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const bayer = (x: number, y: number) => [0, 0.5, 0.75, 0.25][(x & 1) + ((y & 1) << 1)];

type Theme = {
  name: string;
  fog: [number, number, number];
  sky: [number, number, number][] | null;
  walls: Record<number, string>;
  floor: (x: number, y: number) => [number, number, number];
  ceil: ((x: number, y: number) => [number, number, number]) | null;
};

const THEMES: Theme[] = [
  {
    name: 'FORTRESS', fog: [20, 12, 34], sky: null, walls: { 1: 'brick', 2: 'door', 3: 'banner', 4: 'torch' },
    floor: (x, y) => { const t = ((x >> 3) + (y >> 3)) & 1; const k = 0.55 + hash(x >> 2, y >> 2, 3) * 0.2 + (x % 8 === 0 || y % 8 === 0 ? -0.2 : 0); return t ? [86 * k, 70 * k, 110 * k] : [70 * k, 58 * k, 92 * k]; },
    ceil: (x, y) => { const k = 0.35 + hash(x >> 2, y >> 3, 5) * 0.15 - (y % 16 === 0 ? 0.15 : 0); return [60 * k, 50 * k, 80 * k]; },
  },
  {
    name: 'SCRAPYARD', fog: [40, 22, 18], sky: [[38, 20, 40], [200, 90, 60], [255, 170, 90]], walls: { 1: 'rust', 2: 'plates', 3: 'tyres', 4: 'hazard' },
    floor: (x, y) => { const k = 0.5 + hash(x >> 1, y >> 1, 7) * 0.25 - (x % 16 === 0 || y % 16 === 0 ? 0.25 : 0); return [110 * k, 88 * k, 64 * k]; },
    ceil: null,
  },
  {
    name: 'STRATOS', fog: [150, 200, 240], sky: [[40, 110, 200], [120, 190, 240], [220, 240, 255]], walls: { 1: 'panel', 2: 'vent', 3: 'stripe', 4: 'glow' },
    floor: (x, y) => { const g = x % 4 === 0 || y % 4 === 0; const k = 0.7 + bayer(x, y) * 0.08; return g ? [70 * k, 80 * k, 100 * k] : [170 * k, 182 * k, 200 * k]; },
    ceil: null,
  },
];

/** A 32x32 wall texture of the given kind. */
function wallTex(kind: string): Uint32Array {
  const t = new Uint32Array(TS * TS);
  for (let y = 0; y < TS; y++)
    for (let x = 0; x < TS; x++) {
      let c: number[];
      const n = hash(x >> 1, y >> 1, kind.length);
      switch (kind) {
        case 'brick': { const off = ((y >> 3) & 1) * 8; const mortar = y % 8 === 7 || (x + off) % 16 === 15; const k = 0.6 + n * 0.3 + (y % 8 === 0 ? 0.15 : 0); c = mortar ? [40, 32, 54] : [110 * k, 92 * k, 140 * k]; break; }
        case 'door': { const k = 0.55 + n * 0.15 + (x % 16 === 0 ? -0.3 : 0) + (x % 16 === 1 ? 0.25 : 0); c = [120 * k, 126 * k, 150 * k]; if ((x % 16 === 4 || x % 16 === 12) && y % 8 === 4) c = [230, 236, 250]; break; }
        case 'banner': { const edge = x < 4 || x > 27; const k = 0.7 + n * 0.2; c = edge ? [90 * k, 80 * k, 110 * k] : [200 * k, 50 * k, 70 * k]; if (!edge && Math.abs(x - 15.5) < 4 && Math.abs(y - 14) < 7) c = [255, 225, 74]; if (!edge && y > 28) c = [180, 140, 40]; break; }
        case 'torch': { const brick = (y >> 3) & 1 ? (x + 8) % 16 === 15 : x % 16 === 15; const k = 0.55 + n * 0.25; c = y % 8 === 7 || brick ? [40, 32, 54] : [110 * k, 92 * k, 140 * k]; const d = Math.hypot(x - 15.5, y - 12); if (d < 6) c = d < 2.5 ? [255, 250, 210] : d < 4 ? [255, 200, 80] : [240, 120, 40]; if (Math.abs(x - 15.5) < 2 && y > 16 && y < 26) c = [80, 60, 40]; break; }
        case 'rust': { const k = 0.45 + n * 0.35 - (y % 11 === 0 ? 0.25 : 0); c = [150 * k, 80 * k, 44 * k]; if (hash(x, y, 9) < 0.03) c = [220, 150, 90]; break; }
        case 'plates': { const seam = x % 16 === 0 || y % 10 === 0; const k = 0.5 + n * 0.2 + (y % 10 === 1 ? 0.2 : 0); c = seam ? [40, 38, 50] : [130 * k, 134 * k, 150 * k]; if (x % 16 === 3 && y % 10 === 3) c = [230, 232, 240]; if (hash(x >> 2, y >> 2, 4) < 0.15) c = [140 * k, 70 * k, 30 * k]; break; }
        case 'tyres': { const cy = (y % 11) - 5, cx = (x % 16) - 8; const d = Math.hypot(cx, cy * 1.4); const k = 0.5 + n * 0.3; c = d < 6.5 && d > 2.5 ? [36, 36, 42] : d <= 2.5 ? [20, 18, 24] : [120 * k, 70 * k, 40]; if (d < 6.5 && d > 5.5) c = [70, 70, 80]; break; }
        case 'hazard': { const stripe = ((x + y) >> 2) & 1; c = y < 6 || y > 25 ? (stripe ? [240, 200, 40] : [26, 20, 40]) : [110 + n * 40, 112 + n * 40, 124 + n * 40]; break; }
        case 'panel': { const seam = x % 16 === 0 || y % 16 === 0; const k = 0.75 + n * 0.12 + (x % 16 === 1 || y % 16 === 1 ? 0.12 : 0); c = seam ? [90, 104, 130] : [200 * k, 214 * k, 232 * k]; break; }
        case 'vent': { const slat = y % 4 < 2 && x > 4 && x < 27 && y > 4 && y < 27; c = slat ? [60, 70, 90] : [190 + n * 30, 204 + n * 30, 224 + n * 20]; break; }
        case 'stripe': { c = [200 + n * 30, 214 + n * 30, 232]; if (y > 13 && y < 18) c = [74, 200, 240]; if (y === 14) c = [230, 251, 255]; break; }
        default: { c = [180 + n * 30, 196 + n * 30, 220]; const d = Math.abs(x - 15.5); if (d < 5 && y > 3 && y < 28) c = d < 2 ? [230, 251, 255] : [94, 240, 200]; }
      }
      t[y * TS + x] = rgb(c[0], c[1], c[2]);
    }
  return t;
}

/** A theme's floor or ceiling, baked to a 64x64 tile (two cells across, for checkers). */
function flatTex(fn: (x: number, y: number) => [number, number, number]): Uint32Array {
  const t = new Uint32Array(64 * 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const c = fn(x, y); t[y * 64 + x] = rgb(c[0], c[1], c[2]); }
  return t;
}

// --- the fighters and their weapons --------------------------------------------------
const BOTS: [string, string, number][] = [
  ['anvil_idle1', 'ANVIL', 0xff8a3a], ['mantis_idle1', 'MANTIS', 0x7ad04a], ['frostline_idle1', 'FROSTLINE', 0x9ee8ff], ['gale_idle1', 'GALE', 0xf4f6fb],
  ['volt_idle1', 'VOLT', 0xffe14a], ['magma_idle1', 'MAGMA', 0xff5a2a], ['scrap_idle1', 'SCRAP', 0xb8703a], ['tide_swim1', 'TIDE', 0x5ef0c8],
];

interface Weapon {
  name: string;
  col: number;
  speed: number;
  dmg: number;
  rate: number;
  spread?: number;
  short?: number;
  bounces?: number;
}
const WEAPONS: Weapon[] = [
  { name: 'ULTRA BUSTER', col: 0x5ef0c8, speed: 0.32, dmg: 1, rate: 12 },
  { name: 'SPARK SHOCK', col: 0xf8e040, speed: 0.26, dmg: 2, rate: 18, spread: 2 },
  { name: 'FROST SPIKE', col: 0x8ad8f8, speed: 0.42, dmg: 3, rate: 26 },
  { name: 'FLAME BURST', col: 0xff7038, speed: 0.22, dmg: 1, rate: 6, short: 26 },
  { name: 'SAW BLADE', col: 0xc8ccd8, speed: 0.24, dmg: 2, rate: 20, bounces: 3 },
];

interface Bot {
  key: string;
  name: string;
  col: number;
  x: number;
  y: number;
  a: number;
  hp: number;
  cool: number;
  tx: number;
  ty: number;
  flash: number;
  dead: number;
  frags: number;
  strafe: number;
  idx: number;
}
interface Shot {
  x: number;
  y: number;
  dx: number;
  dy: number;
  col: number;
  dmg: number;
  owner: Bot | null; // null: yours
  life: number;
  bounces: number;
}
interface Pickup {
  x: number;
  y: number;
  kind: number | 'hp';
  t: number;
}
interface Spark {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  col: number;
  t: number;
}

export class ArenaScene extends Phaser.Scene {
  private controls!: Controls;
  private acc = 0;
  private frame = 0;
  private theme = 0;
  private phase: 'pick' | 'play' | 'paused' | 'over' = 'pick';
  private overT = 0;
  private p = { x: 1.5, y: 1.5, a: 0.8, hp: 100, frags: 0, weapon: 0, ammo: [Infinity, 0, 0, 0, 0], cool: 0, bob: 0, recoil: 0, hurt: 0, dead: 0 };
  private bots: Bot[] = [];
  private shots: Shot[] = [];
  private pickups: Pickup[] = [];
  private sparks: Spark[] = [];
  private feedLines: { text: string; t: number }[] = [];
  private mouseDX = 0;
  private mouseFire = false;
  // Rendering.
  private tex!: Phaser.Textures.CanvasTexture;
  private ctx!: CanvasRenderingContext2D;
  private img!: ImageData;
  private buf!: Uint32Array;
  private zbuf = new Float32Array(W);
  private walls: Record<string, Uint32Array> = {};
  private flats: { floor: Uint32Array; ceil: Uint32Array | null }[] = [];
  private spr: Record<string, { w: number; h: number; px: Uint32Array }> = {};
  // Text.
  private hpText!: ReturnType<typeof pixelText>;
  private weaponText!: ReturnType<typeof pixelText>;
  private fragText!: ReturnType<typeof pixelText>;
  private feedText!: ReturnType<typeof pixelText>;
  private banner!: ReturnType<typeof pixelText>;
  private sub!: ReturnType<typeof pixelText>;
  private bar!: Phaser.GameObjects.Graphics;

  constructor() {
    super('arena');
  }

  create(): void {
    this.controls = new Controls(this);
    Object.assign(this, { acc: 0, frame: 0, phase: 'pick', overT: 0, mouseDX: 0, mouseFire: false });
    if (this.textures.exists('arena_view')) this.textures.remove('arena_view');
    this.tex = this.textures.createCanvas('arena_view', W, H)!;
    this.ctx = this.tex.getContext();
    this.img = this.ctx.createImageData(W, H);
    this.buf = new Uint32Array(this.img.data.buffer);
    this.add.image(0, 0, 'arena_view').setOrigin(0);
    this.flats = THEMES.map((t) => ({ floor: flatTex(t.floor), ceil: t.ceil ? flatTex(t.ceil) : null }));
    for (const [key] of BOTS) {
      const t = this.textures.get(key) as Phaser.Textures.CanvasTexture;
      const w = t.width, h = t.height;
      const d = t.getContext().getImageData(0, 0, w, h);
      this.spr[key] = { w, h, px: new Uint32Array(d.data.buffer.slice(0)) };
    }
    // The status bar under the view.
    this.bar = this.add.graphics().setDepth(5);
    this.bar.fillStyle(0x0a0812).fillRect(0, H, VIEW_W, VIEW_H - H);
    this.bar.fillStyle(0x55607a).fillRect(0, H, VIEW_W, 1);
    const txt = (x: number, color: string) => pixelText(this, x, H + 5, '', { color, stroke: '#000000' }).setDepth(6);
    this.hpText = txt(18, '#fff1e0');
    this.weaponText = txt(64, '#5ef0c8');
    this.fragText = txt(250, '#ffe14a');
    pixelText(this, VIEW_W - 6, H + 5, 'ULTRA ARENA', { color: '#8a8fa8', stroke: '#000000' }).setOrigin(1, 0).setDepth(6);
    this.feedText = pixelText(this, 6, 6, '', { color: '#fff1e0', stroke: '#000000' }).setDepth(6);
    this.banner = pixelText(this, VIEW_W / 2, H / 2 - 22, '', { fontSize: '16px', color: '#ffe14a', stroke: '#1a1428' }).setOrigin(0.5).setDepth(7);
    this.sub = pixelText(this, VIEW_W / 2, H / 2 + 2, '', { color: '#fff1e0', stroke: '#1a1428', align: 'center' }).setOrigin(0.5, 0).setDepth(7);
    // Mouse: click to capture it and turn with it; hold the button to fire.
    // (Touches are the on-screen controls' business, not a mouse click.)
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (ptr.wasTouch || touchEnabled()) return;
      if (this.phase === 'play' && !this.input.mouse?.locked) this.input.mouse?.requestPointerLock();
      this.mouseFire = true;
    });
    this.input.on('pointerup', () => (this.mouseFire = false));
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (this.input.mouse?.locked) this.mouseDX += ptr.movementX;
    });
    setTouchMode('fps');
    this.events.once('shutdown', () => {
      this.input.mouse?.releasePointerLock();
      setTouchMode('pad');
    });
    this.reset();
    stopMusic();
    pixelateIn(this, 700);
    this.time.delayedCall(300, () => playMusic(this, 'boss'));
  }

  private spawnBot(i: number): Bot {
    const [key, name, col] = BOTS[i % BOTS.length];
    const sp = SPAWNS[(i * 3 + this.frame) % SPAWNS.length];
    return { key, name, col, x: sp[0], y: sp[1], a: 0, hp: 6, cool: 60 + i * 20, tx: sp[0], ty: sp[1], flash: 0, dead: 0, frags: 0, strafe: i % 2 ? 1 : -1, idx: i };
  }

  private reset(): void {
    Object.assign(this.p, { x: 1.5, y: 1.5, a: 0.8, hp: 100, frags: 0, weapon: 0, ammo: [Infinity, 0, 0, 0, 0], cool: 0, recoil: 0, hurt: 0, dead: 0 });
    // Four of the eight bosses, a different four each match.
    const start = Math.floor(Math.random() * 8);
    this.bots = [0, 2, 4, 6].map((k) => this.spawnBot((start + k) % 8));
    this.shots = [];
    this.sparks = [];
    this.feedLines = [];
    this.pickups = PICKUPS.map((k) => ({ ...k, t: 0 }));
  }

  // --- the loop ---------------------------------------------------------------------

  update(_t: number, delta: number): void {
    this.acc += Math.min(delta, 100);
    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS;
      this.frame++;
      this.controls.poll();
      this.step();
    }
    this.render3d();
  }

  private step(): void {
    const c = this.controls;
    if (this.phase === 'pick') {
      // Pick the arena, then go.
      const d = (c.justPressed('right') ? 1 : 0) - (c.justPressed('left') ? 1 : 0);
      if (d) {
        this.theme = (this.theme + d + THEMES.length) % THEMES.length;
        sfx.tick();
      }
      this.banner.setText('ULTRA ARENA');
      this.sub.setText(`< ${THEMES[this.theme].name} >\n\nFIRST TO ${FRAG_LIMIT} FRAGS\n${touchEnabled() ? 'FIRE TO FIGHT   START TO LEAVE' : 'JUMP TO FIGHT   START TO LEAVE'}`);
      if (c.justPressed('jump') || c.justPressed('fire')) {
        this.phase = 'play';
        this.banner.setText('FIGHT!');
        this.sub.setText(
          touchEnabled()
            ? 'LEFT THUMB MOVE   DRAG RIGHT TO LOOK\nFIRE SHOOTS (DRAG IT TO AIM)   WPN SWITCHES'
            : 'UP/DOWN MOVE  LEFT/RIGHT TURN  Q/E STRAFE\nFIRE SHOOT  JUMP SWITCH WEAPON  CLICK FOR MOUSE',
        );
        this.time.delayedCall(2200, () => this.phase === 'play' && (this.banner.setText(''), this.sub.setText('')));
        sfx.ready();
      } else if (c.justPressed('start')) this.leave();
      return;
    }
    if (this.phase === 'paused') {
      if (c.justPressed('jump') || c.justPressed('fire')) {
        this.phase = 'play';
        this.banner.setText('');
        this.sub.setText('');
      } else if (c.justPressed('start')) this.leave();
      return;
    }
    if (this.phase === 'over') {
      if (++this.overT > 90 && (c.justPressed('jump') || c.justPressed('start') || c.justPressed('fire'))) this.leave();
      return;
    }
    if (c.justPressed('start')) {
      this.phase = 'paused';
      this.banner.setText('PAUSED');
      this.sub.setText(touchEnabled() ? 'FIRE TO RESUME   START TO LEAVE' : 'JUMP TO RESUME   START TO LEAVE');
      return;
    }
    this.stepPlayer();
    this.stepBots();
    this.stepShots();
    this.stepPickups();
    for (const f of this.sparks) {
      f.x += f.dx;
      f.y += f.dy;
      f.z += f.dz;
      f.dz -= 0.004;
      f.t--;
    }
    this.sparks = this.sparks.filter((f) => f.t > 0);
    for (const f of this.feedLines) f.t--;
    this.feedLines = this.feedLines.filter((f) => f.t > 0);
  }

  private leave(): void {
    this.phase = 'over';
    this.overT = 1000;
    stopMusic();
    this.input.mouse?.releasePointerLock();
    pixelateOut(this, 700, () => this.scene.start('title'));
  }

  private finish(won: boolean): void {
    this.phase = 'over';
    this.overT = 0;
    stopMusic();
    if (won) sfx.victory();
    else sfx.die();
    this.input.mouse?.releasePointerLock();
    const best = [...this.bots].sort((a, b) => b.frags - a.frags)[0];
    this.banner.setText(won ? 'YOU WIN THE MATCH!' : `${best.name} WINS THE MATCH`);
    this.sub.setText(`ULTRAGUY ${this.p.frags} FRAGS\n${this.bots.map((b) => `${b.name} ${b.frags}`).join('   ')}\n\nPRESS JUMP`);
  }

  private feed(text: string): void {
    this.feedLines.unshift({ text, t: 220 });
    this.feedLines = this.feedLines.slice(0, 4);
  }

  private move(o: { x: number; y: number }, dx: number, dy: number, r = 0.22): void {
    if (free(o.x + dx, o.y, r)) o.x += dx;
    if (free(o.x, o.y + dy, r)) o.y += dy;
  }

  private los(ax: number, ay: number, bx: number, by: number): boolean {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 6);
    for (let i = 1; i < n; i++) if (solid(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n)) return false;
    return true;
  }

  private fire(from: { x: number; y: number }, a: number, w: Weapon, owner: Bot | null): void {
    const n = w.spread ?? 0;
    for (let k = -n / 2; k <= n / 2; k++) {
      const aa = a + k * 0.08;
      this.shots.push({ x: from.x + Math.cos(aa) * 0.3, y: from.y + Math.sin(aa) * 0.3, dx: Math.cos(aa) * w.speed, dy: Math.sin(aa) * w.speed, col: w.col, dmg: w.dmg, owner, life: w.short ?? 140, bounces: w.bounces ?? 0 });
    }
  }

  private burst(x: number, y: number, col: number, n = 8): void {
    for (let i = 0; i < n; i++) this.sparks.push({ x, y, z: 0, dx: (Math.random() - 0.5) * 0.06, dy: (Math.random() - 0.5) * 0.06, dz: 0.02 + Math.random() * 0.03, col, t: 20 + Math.random() * 10 });
  }

  private stepPlayer(): void {
    const c = this.controls;
    const p = this.p;
    if (p.recoil > 0) p.recoil--;
    if (p.hurt > 0) p.hurt--;
    if (p.dead > 0) {
      if (--p.dead === 0) {
        const sp = SPAWNS[this.frame % SPAWNS.length];
        Object.assign(p, { x: sp[0], y: sp[1], hp: 100, weapon: 0 });
      }
      return;
    }
    // The touch stick moves and strafes (analog); otherwise UP/DOWN move, LEFT/RIGHT turn, PREV/NEXT strafe.
    const stick = c.stick();
    const turn = stick ? 0 : (c.isDown('right') ? 1 : 0) - (c.isDown('left') ? 1 : 0);
    const fwd = stick ? -stick.y : (c.isDown('up') ? 1 : 0) - (c.isDown('down') ? 1 : 0);
    const side = stick ? stick.x : (c.isDown('next') ? 1 : 0) - (c.isDown('prev') ? 1 : 0);
    const firing = c.isDown('fire') || this.mouseFire;
    let aim = turn * 0.045 + this.mouseDX * 0.004 + c.look() * LOOK_SENS;
    this.mouseDX = 0;
    // Aim assist: with a bot near the crosshair, turning slows over it and, while
    // you're moving, aiming or shooting, the view leans onto it.
    const off = this.assistTarget();
    if (off !== null) {
      aim *= 0.6;
      if (aim || fwd || side || firing) p.a += off * (firing ? 0.1 : 0.06);
    }
    p.a += aim;
    const sp = 0.055;
    this.move(p, Math.cos(p.a) * fwd * sp + Math.cos(p.a + Math.PI / 2) * side * sp, Math.sin(p.a) * fwd * sp + Math.sin(p.a + Math.PI / 2) * side * sp);
    if (fwd || side) p.bob += 0.18;
    // JUMP cycles through the weapons you have ammo for.
    if (c.justPressed('jump')) {
      for (let k = 1; k <= WEAPONS.length; k++) {
        const n = (p.weapon + k) % WEAPONS.length;
        if (p.ammo[n] > 0) {
          p.weapon = n;
          sfx.tick();
          break;
        }
      }
    }
    if (p.cool > 0) p.cool--;
    const w = WEAPONS[p.weapon];
    if (firing && p.cool === 0 && p.ammo[p.weapon] > 0) {
      this.fire(p, p.a, w, null);
      p.cool = w.rate;
      p.recoil = 6;
      sfx.shoot();
      if (p.weapon !== 0 && --p.ammo[p.weapon] <= 0) p.weapon = 0;
    }
  }

  /** How far (radians) the nearest bot in sight is off the crosshair, if one is close to it. */
  private assistTarget(): number | null {
    const p = this.p;
    let best: number | null = null;
    for (const b of this.bots) {
      if (b.dead > 0) continue;
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (d > 12 || d < 0.3) continue;
      const off = Phaser.Math.Angle.Wrap(Math.atan2(b.y - p.y, b.x - p.x) - p.a);
      // (A wider cone up close, where a bot fills more of the view.)
      const cone = ASSIST_CONE * Math.min(2, Math.max(1, 3 / d));
      if (Math.abs(off) > cone || (best !== null && Math.abs(off) >= Math.abs(best))) continue;
      if (this.los(p.x, p.y, b.x, b.y)) best = off;
    }
    return best;
  }

  private stepBots(): void {
    const p = this.p;
    for (const b of this.bots) {
      if (b.flash > 0) b.flash--;
      if (b.dead > 0) {
        if (--b.dead === 0) Object.assign(b, this.spawnBot(b.idx + 8), { frags: b.frags, idx: b.idx });
        continue;
      }
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      const sees = p.dead === 0 && d < 12 && this.los(b.x, b.y, p.x, p.y);
      if (sees) {
        // Close in to a few paces, circle, shoot.
        b.a = Math.atan2(p.y - b.y, p.x - b.x);
        const want = d > 4 ? 1 : d < 2.5 ? -1 : 0;
        if (this.frame % 90 === (b.idx * 7) % 90) b.strafe = -b.strafe;
        this.move(b, Math.cos(b.a) * want * 0.03 + Math.cos(b.a + Math.PI / 2) * b.strafe * 0.025, Math.sin(b.a) * want * 0.03 + Math.sin(b.a + Math.PI / 2) * b.strafe * 0.025, 0.25);
        if (--b.cool <= 0) {
          this.fire(b, b.a + (Math.random() - 0.5) * 0.12, { name: '', speed: 0.16, dmg: 8, col: b.col, rate: 0 }, b);
          b.cool = 70 + Math.floor(Math.random() * 50);
          if (d < 7) sfx.enemyShot();
        }
      } else {
        // Patrol between the spawn points.
        if (Math.hypot(b.tx - b.x, b.ty - b.y) < 0.4 || this.frame % 240 === (b.idx * 11) % 240) {
          const sp = SPAWNS[Math.floor(Math.random() * SPAWNS.length)];
          b.tx = sp[0] + (Math.random() - 0.5);
          b.ty = sp[1] + (Math.random() - 0.5);
        }
        b.a = Math.atan2(b.ty - b.y, b.tx - b.x);
        const ox = b.x, oy = b.y;
        this.move(b, Math.cos(b.a) * 0.035, Math.sin(b.a) * 0.035, 0.25);
        if (ox === b.x && oy === b.y) {
          b.tx = b.x + (Math.random() - 0.5) * 6;
          b.ty = b.y + (Math.random() - 0.5) * 6;
        }
      }
    }
  }

  private stepShots(): void {
    const p = this.p;
    for (const s of this.shots) {
      s.life--;
      let nx = s.x + s.dx, ny = s.y + s.dy;
      if (solid(nx, ny)) {
        if (s.bounces > 0) {
          s.bounces--;
          if (solid(nx, s.y)) s.dx = -s.dx;
          if (solid(s.x, ny)) s.dy = -s.dy;
          nx = s.x + s.dx;
          ny = s.y + s.dy;
        } else {
          this.burst(s.x, s.y, s.col, 5);
          s.life = 0;
          continue;
        }
      }
      s.x = nx;
      s.y = ny;
      if (!s.owner) {
        for (const b of this.bots) {
          if (b.dead || Math.hypot(b.x - s.x, b.y - s.y) > 0.38) continue;
          b.hp -= s.dmg;
          b.flash = 6;
          s.life = 0;
          this.burst(s.x, s.y, s.col, 6);
          sfx.hit();
          if (b.hp <= 0) {
            b.dead = 150;
            this.burst(b.x, b.y, b.col, 24);
            sfx.enemyDie();
            p.frags++;
            this.feed(`ULTRAGUY FRAGGED ${b.name}`);
            if (p.frags >= FRAG_LIMIT) this.finish(true);
          }
          break;
        }
      } else if (p.dead === 0 && Math.hypot(p.x - s.x, p.y - s.y) < 0.3) {
        p.hp -= s.dmg;
        p.hurt = 14;
        s.life = 0;
        sfx.hurt();
        if (p.hp <= 0) {
          p.dead = 120;
          s.owner.frags++;
          sfx.explode();
          this.feed(`${s.owner.name} FRAGGED ULTRAGUY`);
          if (s.owner.frags >= FRAG_LIMIT) this.finish(false);
        }
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
  }

  private stepPickups(): void {
    const p = this.p;
    for (const k of this.pickups) {
      if (k.t > 0) {
        k.t--;
        continue;
      }
      if (p.dead > 0 || Math.hypot(k.x - p.x, k.y - p.y) > 0.5) continue;
      if (k.kind === 'hp') {
        if (p.hp >= 100) continue;
        p.hp = Math.min(100, p.hp + 30);
      } else {
        p.ammo[k.kind] += 15;
        p.weapon = k.kind;
        this.feed(`GOT ${WEAPONS[k.kind].name}`);
      }
      k.t = 600;
      sfx.pickup();
    }
  }

  // --- drawing ----------------------------------------------------------------------

  private wall(kind: string): Uint32Array {
    return (this.walls[kind] ??= wallTex(kind));
  }

  private render3d(): void {
    const th = THEMES[this.theme];
    const flat = this.flats[this.theme];
    const p = this.p;
    const buf = this.buf;
    const fog = th.fog;
    const dirX = Math.cos(p.a), dirY = Math.sin(p.a);
    // A field of view that fills the wide screen without stretching (the plane's length sets it).
    const plane = 0.66 * (W / H) / (320 / 180);
    const plX = -dirY * plane, plY = dirX * plane;
    const bob = Math.sin(p.bob) * 1.5;
    const horizon = (H >> 1) + Math.round(bob);
    const shadeK = (c: number, k: number) => rgb((c & 255) * k + fog[0] * (1 - k), ((c >> 8) & 255) * k + fog[1] * (1 - k), ((c >> 16) & 255) * k + fog[2] * (1 - k));
    // Sky or ceiling above, floor below: cast row by row.
    for (let y = 0; y < H; y++) {
      const floor = y > horizon;
      if (!floor && th.sky) {
        const k = y / Math.max(1, horizon);
        const s = th.sky;
        const a = k < 0.6 ? s[0] : s[1], b = k < 0.6 ? s[1] : s[2];
        const kk = k < 0.6 ? k / 0.6 : (k - 0.6) / 0.4;
        for (let x = 0; x < W; x++) {
          const v = kk + (bayer(x, y) - 0.5) * 0.08;
          const ang = (p.a + (x / W - 0.5) * 1.15) * 60;
          const cx = Math.floor(ang / 14), cyy = Math.floor(y / 9);
          const fx = ang / 14 - cx, fy = y / 9 - cyy;
          const puff = hash(cx, cyy, 2) < 0.22 && y < horizon * 0.75 ? Math.max(0, 1 - Math.hypot(fx - 0.5, (fy - 0.5) * 1.6) * 2.2) : 0;
          const cl = puff > bayer(x, y) * 0.5 ? 0.55 * Math.min(1, puff * 2) : 0;
          const r0 = a[0] + (b[0] - a[0]) * v, g0 = a[1] + (b[1] - a[1]) * v, b0 = a[2] + (b[2] - a[2]) * v;
          buf[y * W + x] = rgb(r0 + (255 - r0) * cl, g0 + (250 - g0) * cl, b0 + (245 - b0) * cl);
        }
        continue;
      }
      const src = floor ? flat.floor : flat.ceil!;
      const rowDist = (0.5 * H) / Math.max(1, floor ? y - horizon : horizon - y);
      const rx0 = dirX - plX, ry0 = dirY - plY, rx1 = dirX + plX, ry1 = dirY + plY;
      let fx = p.x + rowDist * rx0, fy = p.y + rowDist * ry0;
      const sx = (rowDist * (rx1 - rx0)) / W, sy = (rowDist * (ry1 - ry0)) / W;
      const k = Math.max(0.08, Math.min(1, 1 - rowDist / 11));
      for (let x = 0; x < W; x++, fx += sx, fy += sy) {
        const tx = Math.floor(fx * TS) & 63, ty = Math.floor(fy * TS) & 63;
        buf[y * W + x] = shadeK(src[ty * 64 + tx], k);
      }
    }
    // Walls: one ray per column.
    for (let x = 0; x < W; x++) {
      const cam = (2 * x) / W - 1;
      const rdx = dirX + plX * cam, rdy = dirY + plY * cam;
      let mx = Math.floor(p.x), my = Math.floor(p.y);
      const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy);
      const stx = rdx < 0 ? -1 : 1, sty = rdy < 0 ? -1 : 1;
      let sdx = rdx < 0 ? (p.x - mx) * ddx : (mx + 1 - p.x) * ddx;
      let sdy = rdy < 0 ? (p.y - my) * ddy : (my + 1 - p.y) * ddy;
      let side = 0, hit = 0;
      for (let i = 0; i < 64 && !hit; i++) {
        if (sdx < sdy) { sdx += ddx; mx += stx; side = 0; } else { sdy += ddy; my += sty; side = 1; }
        hit = cell(mx, my);
      }
      const dist = Math.max(0.05, side === 0 ? sdx - ddx : sdy - ddy);
      this.zbuf[x] = dist;
      const lh = Math.floor(H / dist);
      const y0 = Math.max(0, horizon - (lh >> 1)), y1 = Math.min(H - 1, horizon + (lh >> 1));
      let wx = side === 0 ? p.y + dist * rdy : p.x + dist * rdx;
      wx -= Math.floor(wx);
      let tx = Math.floor(wx * TS);
      if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) tx = TS - tx - 1;
      const kind = th.walls[hit] ?? th.walls[1];
      const t = this.wall(kind);
      const k = Math.max(0.1, Math.min(1, 1 - dist / 12)) * (side ? 0.78 : 1);
      const glow = kind === 'torch' || kind === 'glow';
      for (let y = y0; y <= y1; y++) {
        const ty = Math.floor(((y - horizon + lh / 2) / lh) * TS) & (TS - 1);
        const c = t[ty * TS + tx];
        buf[y * W + x] = glow && ((c & 255) > 200 || ((c >> 8) & 255) > 200) ? c : shadeK(c, k);
      }
    }
    this.drawBillboards(dirX, dirY, plX, plY, horizon, shadeK);
    this.ctx.putImageData(this.img, 0, 0);
    this.drawOverlay(bob);
    this.tex.refresh();
    this.drawHud();
  }

  /** Bots, pickups, shots and sparks, far to near, each column against the depth buffer. */
  private drawBillboards(dirX: number, dirY: number, plX: number, plY: number, horizon: number, shadeK: (c: number, k: number) => number): void {
    const p = this.p;
    const buf = this.buf;
    type Item = { x: number; y: number; d: number; bot?: Bot; pick?: Pickup; shot?: Shot; spark?: Spark };
    const list: Item[] = [];
    for (const b of this.bots) if (!b.dead) list.push({ x: b.x, y: b.y, d: 0, bot: b });
    for (const k of this.pickups) if (k.t === 0) list.push({ x: k.x, y: k.y, d: 0, pick: k });
    for (const s of this.shots) list.push({ x: s.x, y: s.y, d: 0, shot: s });
    for (const f of this.sparks) list.push({ x: f.x, y: f.y, d: 0, spark: f });
    for (const o of list) o.d = (o.x - p.x) ** 2 + (o.y - p.y) ** 2;
    list.sort((a, b) => b.d - a.d);
    const inv = 1 / (plX * dirY - dirX * plY);
    for (const o of list) {
      const rx = o.x - p.x, ry = o.y - p.y;
      const tx = inv * (dirY * rx - dirX * ry);
      const ty = inv * (-plY * rx + plX * ry);
      if (ty <= 0.1) continue;
      const scrX = Math.floor((W / 2) * (1 + tx / ty));
      const k = Math.max(0.12, Math.min(1, 1 - ty / 12));
      if (o.bot) {
        const s = this.spr[o.bot.key];
        if (!s) continue;
        const hgt = Math.floor((H / ty) * 0.9), wdt = Math.floor(hgt * (s.w / s.h));
        const bottom = horizon + Math.floor((H / ty) * 0.5);
        const top = bottom - hgt;
        const flip = Math.cos(o.bot.a - p.a) > 0;
        for (let sx = Math.max(0, scrX - (wdt >> 1)); sx < Math.min(W, scrX + (wdt >> 1)); sx++) {
          if (ty >= this.zbuf[sx]) continue;
          let u = Math.floor(((sx - (scrX - wdt / 2)) / wdt) * s.w);
          if (flip) u = s.w - 1 - u;
          for (let sy = Math.max(0, top); sy < Math.min(H, bottom); sy++) {
            const c = s.px[Math.floor(((sy - top) / hgt) * s.h) * s.w + u];
            if (c >>> 24 < 128) continue;
            buf[sy * W + sx] = o.bot.flash > 0 ? 0xffffffff : shadeK(c, k);
          }
        }
        continue;
      }
      // Glowing billboards: pickups float and bob; shots fly at chest height; sparks fall.
      const isPick = !!o.pick;
      const col = isPick ? (o.pick!.kind === 'hp' ? 0xff5a6a : WEAPONS[o.pick!.kind as number].col) : o.shot ? o.shot.col : o.spark!.col;
      const size = isPick ? 0.22 : o.shot ? 0.12 : 0.04;
      const z = isPick ? -0.15 + Math.sin(this.frame / 15 + o.x) * 0.05 : o.spark ? -o.spark.z : 0;
      const r = Math.max(1, (H / ty) * size);
      const cy = horizon + (H / ty) * z;
      const [cr, cg, cb] = hexRgb(col);
      for (let sx = Math.max(0, Math.floor(scrX - r * 2)); sx < Math.min(W, Math.ceil(scrX + r * 2)); sx++) {
        if (ty >= this.zbuf[sx]) continue;
        for (let sy = Math.max(0, Math.floor(cy - r * 2)); sy < Math.min(H, Math.ceil(cy + r * 2)); sy++) {
          const dd = Math.hypot(sx - scrX, sy - cy) / r;
          if (dd > 2) continue;
          const i = sy * W + sx;
          const o0 = buf[i];
          const a = dd < 0.7 ? 1 : ((2 - dd) / 1.3) * 0.6;
          const core = dd < 0.45;
          buf[i] = rgb((o0 & 255) * (1 - a) + (core ? 255 : cr * 1.3) * a, ((o0 >> 8) & 255) * (1 - a) + (core ? 255 : cg) * a, ((o0 >> 16) & 255) * (1 - a) + (core ? 255 : cb) * a);
        }
      }
      if (isPick && o.pick!.kind === 'hp')
        for (const [ox, oy, w, h] of [[-0.25, -0.75, 0.5, 1.5], [-0.75, -0.25, 1.5, 0.5]])
          for (let sx = Math.floor(scrX + ox * r); sx < scrX + (ox + w) * r; sx++)
            for (let sy = Math.floor(cy + oy * r); sy < cy + (oy + h) * r; sy++) if (sx >= 0 && sx < W && sy >= 0 && sy < H && ty < this.zbuf[sx]) buf[sy * W + sx] = 0xffffffff;
    }
  }

  /** UltraGuy's arm cannon, the crosshair, the hurt flash and the map, over the view. */
  private drawOverlay(bob: number): void {
    const ctx = this.ctx;
    const p = this.p;
    const [cr, cg, cb] = hexRgb(WEAPONS[p.weapon].col);
    const gx = W - 104 + Math.cos(p.bob * 0.5) * 3, gy = H - 52 + Math.abs(Math.sin(p.bob * 0.5)) * 3 + p.recoil;
    if (p.dead === 0) {
      const R = (x: number, y: number, w: number, h: number, c: string) => {
        ctx.fillStyle = c;
        ctx.fillRect(Math.round(gx + x), Math.round(gy + y), w, h);
      };
      R(18, 8, 90, 52, '#1a1428'); R(20, 10, 86, 48, '#b8501a'); R(20, 10, 86, 12, '#f28c28'); R(20, 10, 86, 3, '#ffc070');
      R(4, 0, 50, 34, '#1a1428'); R(6, 2, 46, 30, '#8a8fa8'); R(6, 2, 46, 7, '#c8ccd8'); R(6, 25, 46, 7, '#55607a');
      R(0, 6, 10, 22, '#1a1428'); R(2, 8, 8, 18, '#55607a');
      R(16, 12, 22, 9, `rgb(${cr},${cg},${cb})`); R(18, 13, 9, 3, '#ffffff');
      if (p.recoil > 2) {
        ctx.fillStyle = `rgba(${cr},${cg},${cb},0.6)`;
        ctx.beginPath();
        ctx.arc(gx + 2, gy + 15, 12 + p.recoil, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.arc(gx + 2, gy + 15, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#ffffff';
    const cy = H / 2 + Math.round(bob);
    for (const [x, y, w, h] of [[W / 2 - 6, cy, 4, 1], [W / 2 + 3, cy, 4, 1], [W / 2, cy - 6, 1, 4], [W / 2, cy + 3, 1, 4]]) ctx.fillRect(x, y, w, h);
    if (p.hurt > 0) {
      ctx.fillStyle = `rgba(232,72,78,${p.hurt / 40})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (p.dead > 0) {
      ctx.fillStyle = 'rgba(140,20,30,0.35)';
      ctx.fillRect(0, 0, W, H);
    }
    // The map, top right.
    const s = 3, ox = W - MW * s - 6, oy = 6;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(ox - 1, oy - 1, MW * s + 2, MH * s + 2);
    ctx.fillStyle = 'rgba(138,143,168,0.8)';
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (cell(x, y)) ctx.fillRect(ox + x * s, oy + y * s, s, s);
    for (const b of this.bots) if (!b.dead) {
      ctx.fillStyle = `rgb(${hexRgb(b.col).join(',')})`;
      ctx.fillRect(ox + b.x * s - 1, oy + b.y * s - 1, 2, 2);
    }
    ctx.fillStyle = '#5ef0c8';
    ctx.fillRect(ox + p.x * s - 1, oy + p.y * s - 1, 3, 3);
    ctx.fillRect(ox + (p.x + Math.cos(p.a) * 0.9) * s, oy + (p.y + Math.sin(p.a) * 0.9) * s, 1, 1);
  }

  private drawHud(): void {
    const p = this.p;
    const w = WEAPONS[p.weapon];
    const g = this.bar;
    g.clear();
    g.fillStyle(0x0a0812).fillRect(0, H, VIEW_W, VIEW_H - H);
    g.fillStyle(0x55607a).fillRect(0, H, VIEW_W, 1);
    g.fillStyle(0x1a1428).fillRect(5, H + 4, 9, 9);
    g.fillStyle(p.hp > 30 ? 0xe8484e : this.frame % 20 < 10 ? 0xff8a8a : 0xe8484e).fillRect(6, H + 5, 7, 7);
    g.fillStyle(0xffffff).fillRect(9, H + 6, 1, 5).fillRect(7, H + 8, 5, 1);
    this.hpText.setText(String(Math.max(0, p.hp)));
    this.weaponText.setText(w.name + (p.weapon === 0 ? '' : `  ${p.ammo[p.weapon]}`)).setColor(`#${w.col.toString(16).padStart(6, '0')}`);
    this.fragText.setText(`FRAGS ${p.frags}/${FRAG_LIMIT}`);
    this.feedText.setText(this.feedLines.map((f) => f.text).join('\n'));
    if (p.dead > 0 && this.phase === 'play') {
      this.banner.setText('FRAGGED!');
      this.sub.setText('RESPAWNING...');
    } else if (this.phase === 'play' && this.banner.text === 'FRAGGED!') {
      this.banner.setText('');
      this.sub.setText('');
    }
  }
}
