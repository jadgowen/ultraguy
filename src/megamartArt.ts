import type Phaser from 'phaser';
import { hash, px } from './envArt';

/**
 * MEGAMART (the secret stage): the Bargain Baron's flagship store and the
 * rooftops around it, in the stage art's 16-bit style (shaded ramps, ordered
 * dither, ink outlines). Drawn at boot with Canvas 2D; placed as stage decor.
 *
 *  - mega_facade: the megastore's front (sign board, striped awning, sale windows, sliding doors)
 *  - mega_billboard: a lit rooftop billboard on a steel frame (text laid on by the stage)
 *  - mega_tower: a water tower painted in store colors
 *  - mega_ac: a rooftop air conditioner
 *  - mega_cart / mega_pallet: an abandoned shopping cart, a pallet of boxed stock with price tags
 *  - mega_banner: a SALE banner strung between posts
 *  - mega_neon: an OPEN 24/7 neon sign (62x16)
 */

type Ctx = CanvasRenderingContext2D;

const INK = '#1a1428';
const RED = ['#7a1a28', '#b82838', '#e8484e', '#ff8a8a'];
const GOLD = ['#8a5a10', '#d8a020', '#ffd040', '#fff4b0'];
const TEAL = ['#14485a', '#20788a', '#3aa8b8', '#8ae0e8'];
const CREAM = ['#a8a08a', '#d0c8b0', '#ece6d4', '#fffaf0'];
const STEEL = ['#3a3f56', '#5a5f78', '#8a8fa8', '#c8ccd8', '#eef2fa'];
const GLASS = ['#1e3a5a', '#2a5a8a', '#4a90c8', '#9ad0f0'];
const BOX = ['#7a4a20', '#a86a30', '#c88a48', '#e8b47a'];

function canvas(scene: Phaser.Scene, key: string, w: number, h: number, paint: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h)!;
  paint(tex.getContext());
  tex.refresh();
}

/** One step of a ramp for brightness k (0..1), ordered-dithered so gradients band. */
function step(ramp: string[], k: number, x: number, y: number): string {
  const v = Math.min(ramp.length - 1, Math.max(0, k * (ramp.length - 1)));
  const lo = Math.floor(v);
  const bayer = [0, 0.5, 0.75, 0.25][(x & 1) + ((y & 1) << 1)];
  return ramp[Math.min(ramp.length - 1, lo + (v - lo > bayer ? 1 : 0))];
}

/** A shaded box: ink outline, lit top-left, shaded bottom-right. */
function block(ctx: Ctx, x: number, y: number, w: number, h: number, ramp: string[], k = 0.55): void {
  px(ctx, INK, x, y, w, h);
  for (let j = 1; j < h - 1; j++)
    for (let i = 1; i < w - 1; i++) {
      const light = k + 0.25 * (1 - j / h) - 0.2 * (i / w);
      px(ctx, step(ramp, light, i + x, j + y), x + i, y + j);
    }
  px(ctx, ramp[ramp.length - 1], x + 1, y + 1, w - 2, 1);
}

/** A price tag: a little yellow card with a red slash. */
function tag(ctx: Ctx, x: number, y: number): void {
  px(ctx, INK, x, y, 7, 5);
  px(ctx, GOLD[2], x + 1, y + 1, 5, 3);
  px(ctx, GOLD[3], x + 1, y + 1, 5, 1);
  px(ctx, RED[2], x + 2, y + 2, 3, 1);
}

function facade(ctx: Ctx): void {
  const W = 176;
  const H = 192;
  // Wall: cream panels with teal pilasters.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const seam = x % 44 === 0 || y % 32 === 31;
      px(ctx, seam ? CREAM[1] : step(CREAM, 0.7 - (y / H) * 0.3 + hash(x >> 3, y >> 3, 5) * 0.08, x, y), x, y);
    }
  for (const x of [0, 86, 168]) block(ctx, x, 0, 8, H, TEAL, 0.5);
  // Roof edge and the big sign board with a gold neon border (the stage writes MEGAMART on it).
  block(ctx, 0, 0, W, 8, STEEL, 0.6);
  block(ctx, 12, 12, W - 24, 40, RED, 0.45);
  for (let x = 16; x < W - 16; x += 4) {
    px(ctx, GOLD[3], x, 15, 2, 1);
    px(ctx, GOLD[3], x, 47, 2, 1);
  }
  for (let y = 16; y < 48; y += 4) {
    px(ctx, GOLD[3], 15, y, 1, 2);
    px(ctx, GOLD[3], W - 16, y, 1, 2);
  }
  // Striped awning with a scalloped edge.
  const ay = 88;
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < W; x++) {
      const stripe = Math.floor(x / 11) % 2 === 0;
      const ramp = stripe ? RED : CREAM;
      px(ctx, step(ramp, 0.75 - y / 24, x, y), x, ay + y);
    }
  px(ctx, INK, 0, ay - 1, W, 1);
  for (let x = 0; x < W; x += 11) {
    for (let i = 0; i < 11; i++) {
      const d = Math.round(Math.sin((i / 10) * Math.PI) * 3);
      px(ctx, Math.floor(x / 11) % 2 === 0 ? RED[1] : CREAM[1], x + i, ay + 16, 1, d);
      px(ctx, INK, x + i, ay + 16 + d, 1, 1);
    }
  }
  // Display windows: glass with a glare, a sale poster, and stacked stock behind.
  const window = (x0: number) => {
    const y0 = 112;
    px(ctx, INK, x0, y0, 64, 52);
    for (let y = 1; y < 51; y++)
      for (let x = 1; x < 63; x++) px(ctx, step(GLASS, 0.35 + (1 - y / 52) * 0.35 + (x + y < 30 && x + y > 22 ? 0.5 : 0), x, y), x0 + x, y0 + y);
    for (let i = 0; i < 4; i++) block(ctx, x0 + 6 + i * 13, y0 + 36, 12, 15, BOX, 0.5 + (i % 2) * 0.1);
    for (let i = 0; i < 3; i++) block(ctx, x0 + 12 + i * 13, y0 + 23, 12, 14, BOX, 0.6);
    // The poster: a red burst with a gold %.
    block(ctx, x0 + 30, y0 + 4, 28, 18, GOLD, 0.7);
    px(ctx, RED[2], x0 + 36, y0 + 8, 3, 3);
    px(ctx, RED[2], x0 + 48, y0 + 15, 3, 3);
    for (let i = 0; i < 10; i++) px(ctx, RED[1], x0 + 38 + i, y0 + 17 - i, 2, 1);
    px(ctx, STEEL[2], x0, y0 + 51, 64, 1);
  };
  window(12);
  window(100);
  // Sliding doors in the middle, under a little EXIT light.
  block(ctx, 76, 116, 24, 76, STEEL, 0.5);
  for (const dx of [78, 89]) {
    for (let y = 120; y < 190; y++) for (let x = 0; x < 9; x++) px(ctx, step(GLASS, 0.4 + (1 - (y - 120) / 70) * 0.4 + (x === 2 ? 0.4 : 0), x, y), dx + x, y);
  }
  px(ctx, '#7ad04a', 84, 110, 8, 3);
  // Base: dark kick plate.
  block(ctx, 0, H - 12, 76, 12, STEEL, 0.35);
  block(ctx, 100, H - 12, 76, 12, STEEL, 0.35);
}

function billboard(ctx: Ctx): void {
  // Steel legs and a catwalk, then the board with lamps over it.
  for (const x of [14, 78]) {
    block(ctx, x, 40, 5, 16, STEEL, 0.5);
    for (let y = 42; y < 56; y += 4) px(ctx, STEEL[1], x + 5, y, 4, 1);
  }
  block(ctx, 6, 38, 84, 4, STEEL, 0.6);
  block(ctx, 0, 6, 96, 32, GOLD, 0.6);
  block(ctx, 3, 9, 90, 26, RED, 0.5);
  for (const x of [16, 48, 80]) {
    px(ctx, INK, x - 3, 0, 7, 4);
    px(ctx, STEEL[3], x - 2, 1, 5, 2);
    px(ctx, GOLD[3], x - 1, 3, 3, 2);
  }
}

function tower(ctx: Ctx): void {
  // Legs with cross-bracing.
  for (const x of [6, 31]) block(ctx, x, 36, 4, 28, STEEL, 0.45);
  for (let i = 0; i < 2; i++) {
    for (let k = 0; k < 21; k++) {
      px(ctx, STEEL[1], 10 + k, 40 + i * 12 + Math.round(k * 0.5), 1, 1);
      px(ctx, STEEL[1], 30 - k, 40 + i * 12 + Math.round(k * 0.5), 1, 1);
    }
  }
  // The tank: wooden staves with steel hoops, a red band with the store's gold stripe, a cone roof.
  px(ctx, INK, 2, 10, 36, 28);
  for (let y = 11; y < 37; y++)
    for (let x = 3; x < 37; x++) {
      const k = 0.75 - Math.abs(x - 14) / 30 - (x % 4 === 0 ? 0.12 : 0);
      px(ctx, step(BOX, k, x, y), x, y);
    }
  for (const y of [14, 33]) px(ctx, STEEL[2], 3, y, 34, 2);
  for (let y = 21; y < 28; y++) for (let x = 3; x < 37; x++) px(ctx, step(RED, 0.8 - Math.abs(x - 14) / 26, x, y), x, y);
  px(ctx, GOLD[2], 3, 24, 34, 1);
  for (let y = 0; y < 11; y++) {
    const half = Math.round((y / 10) * 19);
    px(ctx, INK, 20 - half - 1, y, half * 2 + 2, 1);
    for (let x = 20 - half; x < 20 + half; x++) px(ctx, step(STEEL, 0.8 - (x - 20 + half) / 50, x, y), x, y);
  }
}

function ac(ctx: Ctx): void {
  block(ctx, 0, 4, 32, 20, STEEL, 0.55);
  // Fan grille.
  px(ctx, INK, 15, 7, 14, 14);
  for (let y = 8; y < 20; y++) for (let x = 16; x < 28; x++) px(ctx, (x + y) % 3 === 0 ? STEEL[1] : STEEL[0], x, y);
  px(ctx, STEEL[3], 21, 13, 2, 2);
  for (let y = 9; y < 20; y += 2) px(ctx, STEEL[1], 3, y, 10, 1);
  block(ctx, 4, 0, 8, 5, STEEL, 0.4);
}

function cart(ctx: Ctx): void {
  // Wire basket (a grid), handle, frame, wheels.
  px(ctx, INK, 2, 3, 20, 10);
  for (let y = 4; y < 12; y++)
    for (let x = 3; x < 21; x++) {
      if (x % 3 === 0 || y % 3 === 0) px(ctx, STEEL[3], x, y);
      else ctx.clearRect(x, y, 1, 1);
    }
  px(ctx, RED[2], 20, 0, 4, 2);
  px(ctx, STEEL[2], 21, 2, 1, 4);
  px(ctx, STEEL[2], 4, 13, 17, 1);
  px(ctx, STEEL[1], 5, 14, 1, 2);
  px(ctx, STEEL[1], 18, 14, 1, 2);
  for (const x of [4, 17]) {
    px(ctx, INK, x, 16, 4, 4);
    px(ctx, STEEL[1], x + 1, 17, 2, 2);
  }
}

function pallet(ctx: Ctx): void {
  block(ctx, 0, 20, 32, 4, BOX, 0.3);
  block(ctx, 1, 8, 15, 13, BOX, 0.55);
  block(ctx, 15, 8, 16, 13, BOX, 0.45);
  block(ctx, 7, 0, 16, 9, BOX, 0.65);
  for (const [x, y] of [[4, 12], [20, 12], [12, 2]] as const) tag(ctx, x, y);
  // Packing tape.
  px(ctx, CREAM[2], 8, 9, 1, 11);
  px(ctx, CREAM[2], 23, 9, 1, 11);
}

function banner(ctx: Ctx): void {
  for (const x of [0, 62]) block(ctx, x, 0, 2, 28, STEEL, 0.5);
  for (let x = 2; x < 62; x++) px(ctx, STEEL[1], x, 2 + Math.round(Math.sin(((x - 2) / 60) * Math.PI) * 3), 1, 1);
  // The cloth (the stage writes SALE on it).
  px(ctx, INK, 6, 4, 52, 16);
  for (let y = 5; y < 19; y++) for (let x = 7; x < 57; x++) px(ctx, step(GOLD, 0.8 - (y - 5) / 30 + Math.sin(x * 0.3) * 0.08, x, y), x, y);
  for (let x = 7; x < 57; x += 6) px(ctx, RED[2], x, 19, 3, 2);
}

function neon(ctx: Ctx): void {
  px(ctx, INK, 0, 0, 62, 16);
  px(ctx, '#2a2238', 1, 1, 60, 14);
  // A glowing tube around the edge; the stage lays OPEN 24/7 over it.
  for (let x = 3; x < 59; x++) {
    px(ctx, '#ff6ac8', x, 2, 1, 1);
    px(ctx, '#ff6ac8', x, 13, 1, 1);
  }
  for (let y = 3; y < 13; y++) {
    px(ctx, '#ff6ac8', 2, y, 1, 1);
    px(ctx, '#ff6ac8', 59, y, 1, 1);
  }
  px(ctx, STEEL[2], 10, 15, 1, 1);
  px(ctx, STEEL[2], 51, 15, 1, 1);
}

/** Build the MEGAMART art. */
export function makeMegamartArt(scene: Phaser.Scene): void {
  canvas(scene, 'mega_facade', 176, 192, facade);
  canvas(scene, 'mega_billboard', 96, 56, billboard);
  canvas(scene, 'mega_tower', 40, 64, tower);
  canvas(scene, 'mega_ac', 32, 24, ac);
  canvas(scene, 'mega_cart', 24, 20, cart);
  canvas(scene, 'mega_pallet', 32, 24, pallet);
  canvas(scene, 'mega_banner', 64, 28, banner);
  canvas(scene, 'mega_neon', 62, 16, neon);
}
