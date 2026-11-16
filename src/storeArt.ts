import type Phaser from 'phaser';
import { hash, px } from './envArt';

/**
 * The QUIK MART (the intro stage's convenience store), in the same 16-bit
 * style as the stage art: shaded ramps, dithered light, outlines and rims.
 * Drawn at boot with Canvas 2D.
 *
 *  - storefront: the facade over the door (lit sign box, awning, window, brick base)
 *  - store_wall / store_ceiling / store_floor: the interior, laid over the tiles
 *  - store_sign: the board behind the QUIK MART sign inside
 *  - store_shelf, store_cooler, store_counter: the fixtures
 */

type Ctx = CanvasRenderingContext2D;

const INK = '#1a1428';
const CREAM = { shine: '#fffaf0', light: '#f6f1e4', base: '#e8e1cf', dark: '#cfc6b0', shadow: '#aaa18a' };
const GREEN = { light: '#6ad07a', base: '#2e9a4a', dark: '#1c6a30', ink: '#0e3a1a' };
const ORANGE = { light: '#ffb060', base: '#f07a28', dark: '#b8501a' };
const RED = { light: '#ff7a8a', base: '#d83a4a', dark: '#982030' };
const METAL = { shine: '#eef2fa', light: '#c8ccd8', base: '#8a8fa8', dark: '#5a5f78', shadow: '#3a3f56' };
const PRODUCT = [
  [RED.dark, RED.base, RED.light],
  [ORANGE.dark, ORANGE.base, ORANGE.light],
  [GREEN.dark, GREEN.base, GREEN.light],
  ['#b88a10', '#ffd040', '#fff1a0'],
  ['#2a5a9a', '#4a90e0', '#9ad0ff'],
  ['#6a3a8a', '#9a5ac8', '#d0a8f0'],
];

/** Fluorescent lights along the store's ceiling (local x, every 128 px). */
const LIGHTS = [64, 192, 320, 448];

function canvas(scene: Phaser.Scene, key: string, w: number, h: number, paint: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h)!;
  paint(tex.getContext());
  tex.refresh();
}

/** Light from the ceiling fixtures at (x, y): 0 to 1. */
function glow(x: number, y: number): number {
  let best = 0;
  for (const lx of LIGHTS) best = Math.max(best, 1 - Math.hypot((x - lx) * 0.8, y * 1.6) / 120);
  return Math.max(0, best);
}

/** Pick one of a ramp's steps with an ordered dither, so gradients come out banded. */
function step(ramp: string[], k: number, x: number, y: number): string {
  const v = Math.min(ramp.length - 1, Math.max(0, k * (ramp.length - 1)));
  const lo = Math.floor(v);
  const bayer = [0, 0.5, 0.75, 0.25][(x & 1) + ((y & 1) << 1)];
  return ramp[Math.min(ramp.length - 1, lo + (v - lo > bayer ? 1 : 0))];
}

/** A product on a shelf, standing on `base`. */
function product(ctx: Ctx, x: number, base: number, kind: number, c: string[]): number {
  const [dark, mid, light] = c;
  switch (kind) {
    case 0: {
      // Chip bag: crimped top, puffy body.
      const w = 7;
      const h = 12;
      px(ctx, INK, x, base - h, w, h);
      px(ctx, dark, x + 1, base - h + 1, w - 2, h - 1);
      px(ctx, mid, x + 1, base - h + 3, w - 3, h - 4);
      px(ctx, light, x + 2, base - h + 4, 1, h - 7);
      px(ctx, '#fff1e0', x + 2, base - h + 6, 3, 2);
      px(ctx, METAL.light, x + 1, base - h + 1, w - 2, 1);
      return w + 1;
    }
    case 1: {
      // Cereal-style box: tall, label stripe.
      const w = 6;
      const h = 13;
      px(ctx, INK, x, base - h, w, h);
      px(ctx, mid, x + 1, base - h + 1, w - 2, h - 1);
      px(ctx, light, x + 1, base - h + 1, w - 2, 1);
      px(ctx, dark, x + w - 2, base - h + 2, 1, h - 2);
      px(ctx, '#fff1e0', x + 1, base - h + 5, w - 2, 2);
      return w + 1;
    }
    case 2: {
      // Two stacked cans.
      for (const y of [base - 5, base - 10]) {
        px(ctx, INK, x, y, 5, 5);
        px(ctx, mid, x + 1, y + 1, 3, 3);
        px(ctx, light, x + 1, y + 1, 1, 3);
        px(ctx, METAL.light, x + 1, y, 3, 1);
      }
      return 6;
    }
    default: {
      // Bottle: neck and cap.
      px(ctx, INK, x, base - 9, 5, 9);
      px(ctx, INK, x + 1, base - 13, 3, 4);
      px(ctx, mid, x + 1, base - 8, 3, 7);
      px(ctx, light, x + 1, base - 8, 1, 6);
      px(ctx, dark, x + 2, base - 12, 1, 3);
      px(ctx, '#fff1e0', x + 1, base - 6, 3, 2);
      return 6;
    }
  }
}

/** A row of products across [x0, x1), standing on `base`. */
function stock(ctx: Ctx, x0: number, x1: number, base: number, seed: number): void {
  let x = x0;
  let i = 0;
  while (x < x1 - 6) {
    const kind = Math.floor(hash(i, base, seed) * 4);
    const color = PRODUCT[Math.floor(hash(i, base, seed + 7) * PRODUCT.length)];
    const run = 2 + Math.floor(hash(i, base, seed + 3) * 2); // a few of the same in a row
    for (let k = 0; k < run && x < x1 - 6; k++) x += product(ctx, x, base, kind, color);
    i++;
  }
}

// --- the facade -------------------------------------------------------------------

function storefront(ctx: Ctx): void {
  const W = 96;
  // Wall panel behind everything.
  for (let y = 0; y < 128; y++) for (let x = 0; x < W; x++) px(ctx, step([CREAM.dark, CREAM.base, CREAM.light], 0.75 - x / 400, x, y), x, y);
  // Lit sign box.
  px(ctx, INK, 0, 0, W, 22);
  for (let y = 1; y < 21; y++) for (let x = 1; x < W - 1; x++) px(ctx, step([GREEN.ink, GREEN.dark, GREEN.base], 0.9 - Math.abs(y - 9) / 14, x, y), x, y);
  px(ctx, GREEN.light, 1, 1, W - 2, 1);
  px(ctx, GREEN.ink, 1, 20, W - 2, 1);
  // Awning: orange and cream stripes with a scalloped edge and shade.
  for (let x = 0; x < W; x++) {
    const orange = Math.floor(x / 8) % 2 === 0;
    const ramp = orange ? [ORANGE.dark, ORANGE.base, ORANGE.light] : [CREAM.dark, CREAM.base, CREAM.shine];
    const scallop = 3 - Math.round(Math.abs((x % 8) - 3.5) * 0.8);
    for (let y = 22; y < 31 + scallop; y++) px(ctx, step(ramp, 1 - (y - 22) / 12 - ((x % 8) === 7 ? 0.3 : 0), x, y), x, y);
    px(ctx, INK, x, 31 + scallop, 1, 1);
    px(ctx, CREAM.shadow, x, 32 + scallop, 1, 3);
  }
  // Big window with stocked shelves inside and a reflection.
  px(ctx, INK, 5, 40, 72, 64);
  px(ctx, METAL.light, 6, 41, 70, 1);
  px(ctx, METAL.base, 6, 42, 2, 61);
  px(ctx, METAL.base, 74, 42, 2, 61);
  for (let y = 43; y < 102; y++) for (let x = 8; x < 74; x++) px(ctx, step(['#5a88a8', '#7ab0cc', '#a8d4ea'], 0.9 - (y - 43) / 70, x, y), x, y);
  for (const base of [60, 78, 96]) {
    stock(ctx, 10, 72, base - 1, base);
    px(ctx, METAL.dark, 9, base - 1, 64, 2);
    px(ctx, METAL.light, 9, base - 1, 64, 1);
  }
  // Glass glare: two diagonal streaks.
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 60; i++) {
    px(ctx, '#ffffff', 14 + i * 0.5, 43 + i, 4, 1);
    px(ctx, '#ffffff', 40 + i * 0.5, 43 + i, 2, 1);
  }
  ctx.globalAlpha = 1;
  // A sale poster taped in the window.
  px(ctx, INK, 50, 46, 20, 24);
  px(ctx, RED.base, 51, 47, 18, 22);
  px(ctx, RED.light, 51, 47, 18, 1);
  px(ctx, '#fff1e0', 53, 50, 14, 3);
  px(ctx, '#ffd040', 54, 56, 12, 8);
  px(ctx, RED.dark, 56, 58, 8, 1);
  px(ctx, RED.dark, 56, 61, 8, 1);
  // Brick base under the window.
  for (let y = 104; y < 128; y++)
    for (let x = 0; x < 78; x++) {
      const row = Math.floor((y - 104) / 5);
      const mortar = (y - 104) % 5 === 4 || (x + (row % 2) * 6) % 12 === 0;
      const k = hash(Math.floor((x + (row % 2) * 6) / 12), row, 9);
      px(ctx, mortar ? '#b8a890' : step(['#7a3a2a', '#9a4a32', '#b86040'], 0.35 + k * 0.4 + ((y - 104) % 5 === 0 ? 0.3 : 0), x, y), x, y);
    }
  px(ctx, CREAM.shadow, 0, 104, 78, 1);
  // Over the door: a transom with a neon OPEN sign.
  px(ctx, INK, 78, 96, 18, 32);
  for (let y = 97; y < 128; y++) for (let x = 79; x < 96; x++) px(ctx, step(['#1a2a3a', '#2a3f56'], 0.6 - (y - 97) / 60, x, y), x, y);
  px(ctx, RED.base, 80, 104, 14, 7);
  px(ctx, RED.light, 81, 105, 12, 5);
  px(ctx, '#ffffff', 82, 107, 10, 1);
  ctx.globalAlpha = 0.3;
  px(ctx, RED.light, 79, 102, 16, 11);
  ctx.globalAlpha = 1;
  // Pillar between the window and the door.
  px(ctx, CREAM.shadow, 76, 40, 2, 88);
}

// --- the interior -----------------------------------------------------------------

/** 512 x 176: the back wall, from under the ceiling to the floor. */
function wall(ctx: Ctx): void {
  const W = 512;
  const cream = [CREAM.shadow, CREAM.dark, CREAM.base, CREAM.light, CREAM.shine];
  for (let y = 0; y < 176; y++)
    for (let x = 0; x < W; x++) {
      // Lit by the fixtures overhead, darker into the corners.
      const k = 0.35 + glow(x, y) * 0.6 - (y < 8 ? (8 - y) * 0.04 : 0);
      px(ctx, step(cream, k, x, y), x, y);
    }
  // Green and orange stripe band.
  const band = (y0: number, r: { light: string; base: string; dark: string }, h: number) => {
    px(ctx, r.light, 0, y0, W, 1);
    px(ctx, r.base, 0, y0 + 1, W, h - 2);
    px(ctx, r.dark, 0, y0 + h - 1, W, 1);
  };
  band(64, GREEN, 6);
  band(70, ORANGE, 4);
  px(ctx, CREAM.shadow, 0, 74, W, 1);
  // Wainscot: small tiles under a chair rail.
  for (let y = 124; y < 170; y++)
    for (let x = 0; x < W; x++) {
      const gx = x % 8;
      const gy = (y - 124) % 8;
      if (gx === 7 || gy === 7) px(ctx, '#98b49c', x, y);
      else px(ctx, step(['#a8c8ac', '#c4dcc6', '#dcecdc', '#f0f8f0'], 0.35 + glow(x, y) * 0.5 + (gx === 0 || gy === 0 ? 0.25 : 0), x, y), x, y);
    }
  px(ctx, '#7a4a22', 0, 121, W, 4);
  px(ctx, '#d8a060', 0, 121, W, 1);
  px(ctx, '#a8743a', 0, 122, W, 2);
  px(ctx, METAL.shadow, 0, 170, W, 6);
  px(ctx, METAL.base, 0, 170, W, 1);
  // A convex security mirror in the corner.
  for (let y = -9; y <= 9; y++)
    for (let x = -9; x <= 9; x++) {
      const d = Math.hypot(x, y);
      if (d > 9) continue;
      px(ctx, d > 8 ? INK : d > 7 ? METAL.light : step(['#5a7a9a', '#8ab0d0', '#d8ecff'], 0.8 - (x + y + 9) / 24, x, y), 22 + x, 22 + y);
    }
  // Wall clock.
  for (let y = -8; y <= 8; y++)
    for (let x = -8; x <= 8; x++) {
      const d = Math.hypot(x, y);
      if (d > 8) continue;
      px(ctx, d > 7 ? INK : d > 6 ? RED.base : '#fffaf0', 490 + x, 22 + y);
    }
  px(ctx, INK, 490, 16, 1, 6);
  px(ctx, INK, 490, 22, 4, 1);
  // Posters: a hot dog deal and a slushie.
  const poster = (x: number, y: number, bg: { light: string; base: string; dark: string }, art: (x: number, y: number) => void) => {
    px(ctx, INK, x, y, 26, 34);
    px(ctx, bg.base, x + 1, y + 1, 24, 32);
    px(ctx, bg.light, x + 1, y + 1, 24, 1);
    px(ctx, bg.dark, x + 1, y + 32, 24, 1);
    px(ctx, '#d8d4cc', x + 11, y - 1, 4, 2); // tape
    art(x, y);
  };
  poster(232, 82, ORANGE, (x, y) => {
    px(ctx, '#e8b860', x + 4, y + 10, 18, 7); // bun
    px(ctx, '#fff1a0', x + 4, y + 10, 18, 1);
    px(ctx, '#b84a2a', x + 3, y + 12, 20, 3); // dog
    px(ctx, '#e87a4a', x + 3, y + 12, 20, 1);
    px(ctx, '#ffd040', x + 6, y + 13, 14, 1); // mustard
    px(ctx, '#fff1e0', x + 5, y + 22, 16, 2);
    px(ctx, '#fff1e0', x + 7, y + 26, 12, 2);
  });
  poster(372, 82, { light: '#9ad0ff', base: '#4a90e0', dark: '#2a5a9a' }, (x, y) => {
    px(ctx, INK, x + 8, y + 5, 10, 20);
    px(ctx, '#ffffff', x + 9, y + 6, 8, 18); // cup
    px(ctx, RED.base, x + 9, y + 6, 8, 7); // slush
    px(ctx, RED.light, x + 9, y + 6, 3, 2);
    px(ctx, RED.base, x + 9, y + 16, 8, 3); // stripe
    px(ctx, '#ffd040', x + 14, y + 1, 1, 6); // straw
    px(ctx, '#fff1e0', x + 5, y + 27, 16, 2);
  });
  // Lotto board behind the register.
  px(ctx, INK, 430, 80, 40, 24);
  for (let i = 0; i < 8; i++) {
    const c = PRODUCT[i % PRODUCT.length];
    const x = 432 + (i % 4) * 9;
    const y = 82 + Math.floor(i / 4) * 10;
    px(ctx, c[1], x, y, 8, 9);
    px(ctx, c[2], x, y, 8, 1);
    px(ctx, '#fff1e0', x + 2, y + 3, 4, 3);
  }
}

/** 512 x 32: drop-ceiling panels and four fluorescent fixtures. */
function ceiling(ctx: Ctx): void {
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 512; x++) {
      const grid = x % 32 === 0 || y % 16 === 0;
      const speck = hash(x, y, 4) < 0.08;
      px(ctx, grid ? METAL.base : speck ? CREAM.dark : step([CREAM.dark, CREAM.base, CREAM.light], 0.3 + glow(x, 32 - y) * 0.7, x, y), x, y);
    }
  px(ctx, METAL.dark, 0, 30, 512, 2);
  px(ctx, METAL.light, 0, 29, 512, 1);
  for (const lx of LIGHTS) {
    px(ctx, INK, lx - 26, 19, 52, 11);
    px(ctx, METAL.light, lx - 25, 20, 50, 9);
    px(ctx, '#e6f8ff', lx - 23, 22, 46, 6);
    px(ctx, '#ffffff', lx - 22, 23, 44, 2);
    px(ctx, '#ffffff', lx - 22, 26, 44, 1);
    for (let x = lx - 20; x < lx + 22; x += 6) px(ctx, METAL.light, x, 22, 1, 6); // diffuser grille
  }
}

/** 512 x 32: checkered linoleum with the lights reflected in it. */
function floor(ctx: Ctx): void {
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 512; x++) {
      const light = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0;
      const ramp = light ? [CREAM.dark, CREAM.base, CREAM.light, CREAM.shine] : ['#5a7462', '#7a947e', '#94ae98', '#b8ccbc'];
      let k = 0.45 - (y % 16) * 0.015;
      if (x % 16 === 0 || y % 16 === 0) k += 0.25;
      if (x % 16 === 15 || y % 16 === 15) k -= 0.25;
      // Reflections of the fixtures: bright smears straight under each light.
      for (const lx of LIGHTS) if (Math.abs(x - lx) < 20 - y * 0.4) k += 0.35;
      px(ctx, step(ramp, k, x, y), x, y);
    }
  px(ctx, METAL.shadow, 0, 0, 512, 1);
}

/** The board behind the QUIK MART sign inside. */
function sign(ctx: Ctx): void {
  const W = 212;
  const H = 40;
  px(ctx, INK, 0, 0, W, H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) px(ctx, step([GREEN.ink, GREEN.dark, GREEN.base], 0.85 - Math.abs(y - 14) / 30, x, y), x, y);
  px(ctx, GREEN.light, 1, 1, W - 2, 1);
  px(ctx, GREEN.ink, 1, H - 2, W - 2, 1);
  px(ctx, ORANGE.base, 4, 24, W - 8, 1);
  for (let x = 6; x < W - 6; x += 8) px(ctx, '#fff1a0', x, 3, 2, 1); // marquee bulbs
}

function shelf(ctx: Ctx): void {
  const W = 64;
  const H = 72;
  // Pegboard back.
  for (let y = 8; y < 66; y++) for (let x = 4; x < W - 4; x++) px(ctx, (x % 4 === 1 && y % 4 === 1) ? METAL.shadow : step([METAL.dark, METAL.base], 0.4 + (x - 4) / 120, x, y), x, y);
  // Header sign.
  px(ctx, INK, 0, 0, W, 9);
  px(ctx, ORANGE.base, 1, 1, W - 2, 7);
  px(ctx, ORANGE.light, 1, 1, W - 2, 1);
  px(ctx, ORANGE.dark, 1, 7, W - 2, 1);
  px(ctx, '#fff1e0', 18, 3, 28, 3);
  // Shelves, each stocked.
  for (const base of [26, 44, 62]) {
    stock(ctx, 6, W - 5, base, base * 3);
    px(ctx, INK, 3, base, W - 6, 3);
    px(ctx, METAL.shine, 4, base, W - 8, 1);
    px(ctx, METAL.light, 4, base + 1, W - 8, 1);
    for (let x = 8; x < W - 8; x += 14) px(ctx, '#ffd040', x, base + 1, 4, 1); // price tags
  }
  // Uprights and the kick plate.
  for (const x of [0, W - 4]) {
    px(ctx, INK, x, 0, 4, H);
    px(ctx, METAL.light, x + 1, 9, 1, H - 10);
    px(ctx, METAL.base, x + 2, 9, 1, H - 10);
  }
  px(ctx, INK, 0, 64, W, 8);
  px(ctx, METAL.dark, 1, 65, W - 2, 6);
  px(ctx, METAL.base, 1, 65, W - 2, 1);
}

function cooler(ctx: Ctx): void {
  const W = 48;
  const H = 80;
  px(ctx, INK, 0, 0, W, H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) px(ctx, step([CREAM.dark, CREAM.base, CREAM.light], 0.7 - x / 90, x, y), x, y);
  // Lit header.
  px(ctx, INK, 2, 2, W - 4, 10);
  for (let y = 3; y < 11; y++) px(ctx, step(['#2a5a9a', '#4a90e0', '#9ad0ff'], 1 - (y - 3) / 10, 0, y), 3, y, W - 6, 1);
  px(ctx, '#ffffff', 10, 6, 28, 2);
  // Two glass doors onto a cold, bright inside.
  for (const dx of [3, 25]) {
    px(ctx, INK, dx, 13, 20, 61);
    for (let y = 14; y < 73; y++) for (let x = dx + 1; x < dx + 19; x++) px(ctx, step(['#6aa8cc', '#9ad0ea', '#d0f0ff'], 1 - (y - 14) / 70, x, y), x, y);
    for (const base of [28, 43, 58, 72]) {
      stock(ctx, dx + 2, dx + 19, base, dx + base);
      px(ctx, METAL.light, dx + 1, base, 18, 1);
    }
    // Frame, handle and glare.
    px(ctx, METAL.light, dx + 1, 14, 18, 1);
    px(ctx, METAL.base, dx + 1, 14, 1, 59);
    px(ctx, METAL.shine, dx === 3 ? dx + 17 : dx + 2, 34, 1, 16);
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < 40; i++) px(ctx, '#ffffff', dx + 3 + i * 0.3, 16 + i, 2, 1);
    ctx.globalAlpha = 1;
  }
  px(ctx, METAL.shadow, 1, 74, W - 2, 5);
  px(ctx, METAL.base, 1, 74, W - 2, 1);
}

/** 56 x 44: the checkout counter, with the register and the hot dog roller on top. */
function counter(ctx: Ctx): void {
  const W = 56;
  // Register.
  px(ctx, INK, 2, 0, 22, 13);
  px(ctx, METAL.dark, 3, 1, 20, 11);
  px(ctx, METAL.base, 3, 1, 20, 1);
  px(ctx, INK, 5, 2, 12, 5);
  px(ctx, '#2a8a6a', 6, 3, 10, 3);
  px(ctx, '#5ef0c8', 6, 3, 6, 1);
  for (let x = 5; x < 21; x += 3) px(ctx, METAL.light, x, 9, 2, 2); // keys
  // Hot dog roller under a sneeze guard.
  px(ctx, INK, 28, 2, 27, 11);
  px(ctx, METAL.base, 29, 3, 25, 9);
  for (let x = 31; x < 52; x += 5) {
    px(ctx, '#7a2a1a', x, 7, 4, 3);
    px(ctx, '#d8603a', x, 7, 4, 1);
  }
  ctx.globalAlpha = 0.45;
  px(ctx, '#d0f0ff', 29, 3, 25, 4);
  ctx.globalAlpha = 1;
  px(ctx, '#ffffff', 30, 3, 10, 1);
  // Counter top.
  px(ctx, INK, 0, 12, W, 5);
  px(ctx, '#d8a060', 0, 12, W, 1);
  px(ctx, '#a8743a', 0, 13, W, 3);
  // Front panel with the store stripes.
  for (let y = 17; y < 40; y++) for (let x = 0; x < W; x++) px(ctx, step([CREAM.dark, CREAM.base, CREAM.light], 0.75 - (y - 17) / 40, x, y), x, y);
  px(ctx, GREEN.light, 0, 22, W, 1);
  px(ctx, GREEN.base, 0, 23, W, 3);
  px(ctx, ORANGE.base, 0, 26, W, 2);
  px(ctx, ORANGE.dark, 0, 28, W, 1);
  // Candy rack on the front.
  px(ctx, INK, 6, 30, 22, 9);
  for (let i = 0; i < 6; i++) {
    const c = PRODUCT[(i * 5) % PRODUCT.length];
    px(ctx, c[1], 7 + i * 3 + Math.floor(i / 6), 31, 2, 7);
    px(ctx, c[2], 7 + i * 3, 31, 2, 1);
  }
  px(ctx, INK, 0, 40, W, 4);
  px(ctx, METAL.dark, 0, 40, W, 1);
  px(ctx, CREAM.shadow, 0, 17, W, 1);
}

/** 96 x 32: the parapet over the facade, level with the store's ceiling. */
function roof(ctx: Ctx): void {
  for (let y = 0; y < 32; y++) for (let x = 0; x < 96; x++) px(ctx, step([CREAM.dark, CREAM.base, CREAM.light], 0.8 - x / 300 - (y > 26 ? 0.3 : 0), x, y), x, y);
  px(ctx, INK, 0, 0, 96, 5);
  px(ctx, METAL.light, 0, 1, 96, 1);
  px(ctx, METAL.base, 0, 2, 96, 2);
  for (let x = 4; x < 96; x += 12) px(ctx, CREAM.dark, x, 8, 8, 14); // recessed panels
  for (let x = 4; x < 96; x += 12) px(ctx, CREAM.shine, x, 8, 8, 1);
}

/** 80 x 48: the wall under the window, down to the sidewalk, with an ice chest. */
function lowWall(ctx: Ctx): void {
  for (let y = 0; y < 48; y++)
    for (let x = 0; x < 80; x++) {
      const row = Math.floor(y / 5);
      const mortar = y % 5 === 4 || (x + (row % 2) * 6) % 12 === 0;
      const k = hash(Math.floor((x + (row % 2) * 6) / 12), row, 11);
      px(ctx, mortar ? '#b8a890' : step(['#6a3224', '#9a4a32', '#b86040'], 0.3 + k * 0.4 + (y % 5 === 0 ? 0.3 : 0), x, y), x, y);
    }
  // Ice chest.
  px(ctx, INK, 10, 18, 40, 30);
  for (let y = 19; y < 47; y++) px(ctx, step(['#c8d8e8', '#e8f2fa', '#ffffff'], 0.9 - (y - 19) / 40, 0, y), 11, y, 38, 1);
  px(ctx, '#4a90e0', 11, 26, 38, 8);
  px(ctx, '#9ad0ff', 11, 26, 38, 1);
  px(ctx, '#ffffff', 22, 28, 16, 4);
  px(ctx, METAL.base, 11, 22, 38, 1);
  px(ctx, METAL.dark, 26, 20, 8, 2);
}

/** Build all the store art (replaces the flat versions). */
export function makeStoreArt(scene: Phaser.Scene): void {
  canvas(scene, 'storefront', 96, 128, storefront);
  canvas(scene, 'store_roof', 96, 32, roof);
  canvas(scene, 'store_low', 80, 48, lowWall);
  canvas(scene, 'store_wall', 512, 176, wall);
  canvas(scene, 'store_ceiling', 512, 32, ceiling);
  canvas(scene, 'store_floor', 512, 32, floor);
  canvas(scene, 'store_sign', 212, 40, sign);
  canvas(scene, 'store_shelf', 64, 72, shelf);
  canvas(scene, 'store_cooler', 48, 80, cooler);
  canvas(scene, 'store_counter', 56, 44, counter);
}
