import type Phaser from 'phaser';
import { px } from './envArt';

/**
 * RIVET, who runs the parts shop: a stout teal robot in a red cap and a shop
 * apron, two round amber eye-lenses and a little nut on the antenna. Drawn at
 * boot in the same shaded 16-bit style as the stages.
 *
 *   rivet0      eyes open, mouth shut
 *   rivet1      blinking
 *   rivet_talk  mouth open
 *   shop_counter the counter Rivet stands behind (160 x 40)
 */

type Ctx = CanvasRenderingContext2D;
const K = '#1a1428';
const TEAL = ['#1e5a5a', '#2e8a84', '#4ab8a8', '#8ae8d0'];
const RED = ['#7a1a2a', '#b82a3a', '#e8505a', '#ff9a9a'];
const CREAM = ['#a8987a', '#d8c8a0', '#f4ead0', '#ffffff'];

function canvas(scene: Phaser.Scene, key: string, w: number, h: number, paint: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h)!;
  paint(tex.getContext());
  tex.refresh();
}

/** Fill a shape with a ramp lit from the top-left, outlined. */
function shape(ctx: Ctx, w: number, h: number, inside: (x: number, y: number) => boolean, ramp: string[], light = 0): void {
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && inside(x + 0.5, y + 0.5);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!at(x, y)) continue;
      if (!at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1)) {
        px(ctx, K, x, y);
        continue;
      }
      let k = 2 + light;
      if (!at(x, y - 2) || !at(x - 2, y)) k = 3;
      else if (!at(x, y + 2) || !at(x + 2, y)) k = 0;
      else if (!at(x, y + 4) && (x + y) % 2 === 0) k = 1;
      px(ctx, ramp[Math.max(0, Math.min(3, k))], x, y);
    }
}

const ellipse = (cx: number, cy: number, rx: number, ry: number) => (x: number, y: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const rrect = (x0: number, y0: number, x1: number, y1: number, r: number) => (x: number, y: number) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.max(x0 + r, Math.min(x1 - r, x));
  const cy = Math.max(y0 + r, Math.min(y1 - r, y));
  return Math.hypot(x - cx, y - cy) <= r + 0.01;
};

function rivet(ctx: Ctx, pose: 'open' | 'blink' | 'talk'): void {
  const W = 48;
  const H = 52;
  // Arms (behind the body), resting forward on the counter.
  shape(ctx, W, H, rrect(2, 32, 12, 52, 4), TEAL, -1);
  shape(ctx, W, H, rrect(36, 32, 46, 52, 4), TEAL, -1);
  // Body and apron.
  shape(ctx, W, H, rrect(8, 26, 40, 54, 7), TEAL);
  shape(ctx, W, H, rrect(13, 32, 35, 54, 3), CREAM);
  // Apron badge: a bolt.
  for (const [x, y, c] of [[22, 38, K], [23, 37, K], [24, 37, K], [25, 38, K], [25, 40, K], [24, 41, K], [23, 41, K], [22, 40, K]] as const) px(ctx, c, x, y);
  px(ctx, '#b8c0d0', 23, 38, 2, 3);
  px(ctx, '#eef2fa', 23, 38, 2, 1);
  px(ctx, '#55607a', 23, 39, 2, 1);
  // Antenna with a nut on top.
  px(ctx, K, 23, 0, 3, 3);
  px(ctx, '#ffe14a', 24, 1, 1, 1);
  px(ctx, K, 24, 3, 1, 4);
  // Head.
  shape(ctx, W, H, ellipse(24, 17, 14, 11), TEAL);
  // Cap: a red dome with a brim out front.
  shape(ctx, W, H, (x, y) => ellipse(24, 10, 14, 6)(x, y) && y < 12, RED);
  shape(ctx, W, H, rrect(26, 10, 42, 13, 1.5), RED, -1);
  // Eyes: round amber lenses (shut for the blink).
  for (const ex of [18, 30]) {
    if (pose === 'blink') {
      px(ctx, K, ex - 3, 18, 7, 2);
      continue;
    }
    shape(ctx, W, H, ellipse(ex, 18, 4, 4), ['#7a4a10', '#c88a20', '#ffc040', '#fff1a0'], 1);
    px(ctx, '#ffffff', ex - 1, 16, 2, 2);
  }
  // Mouth grille (open when talking).
  if (pose === 'talk') {
    px(ctx, K, 19, 23, 10, 4);
    px(ctx, '#7a2a3a', 20, 24, 8, 2);
  } else {
    px(ctx, K, 19, 24, 10, 1);
    for (let x = 20; x < 28; x += 2) px(ctx, '#1e5a5a', x, 23, 1, 1);
  }
  // Cheek lights.
  px(ctx, '#ff8aa8', 12, 21, 2, 1);
  px(ctx, '#ff8aa8', 34, 21, 2, 1);
}

function counter(ctx: Ctx): void {
  const W = 160;
  const H = 40;
  px(ctx, K, 0, 0, W, H);
  px(ctx, '#d8a060', 1, 1, W - 2, 2); // worn wooden top
  px(ctx, '#a8743a', 1, 3, W - 2, 4);
  px(ctx, '#7a4a22', 1, 7, W - 2, 1);
  for (let y = 8; y < H - 1; y++) for (let x = 1; x < W - 1; x++) px(ctx, (x % 20 === 0) ? '#5a3418' : y < 10 ? '#8a5428' : (x + y) % 9 === 0 ? '#6a4020' : '#7a4a22', x, y);
  // A sign on the front.
  px(ctx, K, 50, 16, 60, 16);
  px(ctx, '#2e8a84', 51, 17, 58, 14);
  px(ctx, '#4ab8a8', 51, 17, 58, 1);
}

/** A plain filled rect with a dark outline. */
function box(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string, top?: string, bottom?: string): void {
  px(ctx, K, x, y, w, h);
  px(ctx, fill, x + 1, y + 1, w - 2, h - 2);
  if (top) px(ctx, top, x + 1, y + 1, w - 2, 1);
  if (bottom) px(ctx, bottom, x + 1, y + h - 2, w - 2, 1);
}

/** Shelf ledges in the shop room (y of each shelf's top surface), shared with ShopScene. */
export const SHELF_Y = [40, 74];
export const SHELF_X0 = 12;
export const SHELF_X1 = 200;

/**
 * The inside of Rivet's shop (427 x 240): a warm wooden back wall with two
 * shelves of wares (the wares themselves are separate sprites), a hanging
 * plank sign, lamps, a window onto the night city, and a tiled floor. The
 * right side is left plainer: the menu panel sits there.
 */
function shopRoom(ctx: Ctx): void {
  const W = 427;
  const H = 240;
  // Back wall: vertical planks.
  for (let x = 0; x < W; x++) {
    const plank = Math.floor(x / 18);
    const base = plank % 2 ? '#4a2e22' : '#54342a';
    for (let y = 0; y < H; y++) px(ctx, (x % 18 === 0) ? '#2a1812' : (x * 7 + y * 3 + plank * 13) % 47 === 0 ? '#3e261c' : base, x, y);
  }
  // Wainscot: a darker teal lower wall with a rail.
  px(ctx, '#1e3a3a', 0, 140, W, 66);
  for (let x = 0; x < W; x += 24) px(ctx, '#173030', x, 142, 1, 64);
  px(ctx, K, 0, 138, W, 3);
  px(ctx, '#8a5a3a', 0, 138, W, 1);
  // Window on the right wall, the night city outside (behind the menu, partly).
  box(ctx, 300, 36, 112, 72, '#141c3a');
  for (let i = 0; i < 40; i++) px(ctx, '#e8e4ff', 302 + ((i * 37) % 108), 38 + ((i * 23) % 30), 1, 1);
  for (const [bx, bw, bh] of [[302, 14, 30], [318, 10, 44], [330, 18, 24], [350, 12, 38], [364, 16, 28], [382, 10, 46], [394, 16, 20]] as const) {
    px(ctx, '#232a4e', bx, 106 - bh, bw, bh);
    for (let wy = 108 - bh; wy < 104; wy += 5) for (let wx = bx + 2; wx < bx + bw - 2; wx += 4) if ((wx + wy) % 3) px(ctx, '#ffd870', wx, wy, 2, 2);
  }
  px(ctx, '#5a3a28', 355, 36, 2, 72);
  px(ctx, '#5a3a28', 300, 70, 112, 2);
  box(ctx, 296, 106, 120, 6, '#8a5a3a', '#b8805a');
  // Floor: checker tiles.
  for (let y = 206; y < H; y++) for (let x = 0; x < W; x++) {
    const t = (Math.floor(x / 16) + Math.floor((y - 206) / 8)) % 2;
    px(ctx, t ? '#3a3448' : '#2c2838', x, y);
  }
  px(ctx, K, 0, 205, W, 1);
  // Shelves behind the counter, with brackets.
  for (const sy of SHELF_Y) {
    box(ctx, SHELF_X0, sy, SHELF_X1 - SHELF_X0, 6, '#a8743a', '#d8a060', '#7a4a22');
    px(ctx, 'rgba(0,0,0,0.35)', SHELF_X0 + 1, sy + 6, SHELF_X1 - SHELF_X0 - 2, 3);
    for (const bx of [SHELF_X0 + 10, SHELF_X1 - 16]) {
      box(ctx, bx, sy + 6, 6, 8, '#6a6a7a', '#9a9aaa');
    }
  }
  // The shop's sign: a plank hung on two chains (its words are drawn by the scene).
  for (const cx of [30, 182]) for (let y = 0; y < 5; y += 2) px(ctx, '#8a8fa8', cx, y, 2, 1);
  box(ctx, 14, 4, 184, 17, '#a8743a', '#d8a060', '#6a4020');
  // Warm light from above, over the shelves and the counter.
  for (const lx of [110]) {
    for (let y = 22; y < 150; y++) {
      const half = (y - 22) * 0.55;
      const a = 0.07 * (1 - (y - 22) / 128);
      ctx.fillStyle = `rgba(255, 216, 112, ${a.toFixed(3)})`;
      ctx.fillRect(Math.round(lx - half), y, Math.round(half * 2), 1);
    }
  }
}

/**
 * The shop counter (204 x 44): a wooden counter top, a panelled front with a
 * teal OPEN sign, a cash register on the right end and a jar of bolts on the left.
 */
function counter2(ctx: Ctx): void {
  const W = 204;
  // Jar of bolts (left end, on the top).
  box(ctx, 14, 0, 16, 16, '#9ad8e8', '#e0f8ff');
  px(ctx, 'rgba(255,255,255,0.4)', 16, 2, 2, 12);
  for (let i = 0; i < 18; i++) px(ctx, i % 3 ? '#b8c0d0' : '#ffe14a', 16 + ((i * 5) % 12), 7 + ((i * 3) % 7), 2, 2);
  box(ctx, 13, 0, 18, 3, '#b82a3a', '#e8505a');
  // Cash register (right end).
  box(ctx, 160, 0, 34, 16, '#b8c0d0', '#eef2fa', '#55607a');
  box(ctx, 164, 3, 14, 6, '#1a3a2a');
  px(ctx, '#5ef0c8', 166, 5, 8, 2);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) px(ctx, '#55607a', 181 + c * 4, 3 + r * 5, 3, 3);
  // Counter top.
  box(ctx, 0, 14, W, 7, '#c08850', '#e8b070', '#7a4a22');
  // Front: panels.
  box(ctx, 4, 20, W - 8, 24, '#6a4020');
  for (let p = 0; p < 4; p++) {
    const x = 8 + p * 48;
    box(ctx, x, 23, 44, 18, '#7a4a22', '#5a3418', '#8a5428');
  }
  // OPEN sign over the middle two panels.
  box(ctx, 70, 24, 64, 16, '#2e8a84', '#4ab8a8', '#1e5a5a');
}

/** Small wares for the shelves, each about 16 x 16. */
function ware(ctx: Ctx, kind: string): void {
  const S = 16;
  switch (kind) {
    case 'wtank':
      box(ctx, 2, 2, 12, 13, '#2e6ad8', '#8ab8ff', '#1a3a8a');
      box(ctx, 4, 0, 8, 3, '#b8c0d0');
      px(ctx, '#fff1e0', 6, 6, 4, 1); px(ctx, '#fff1e0', 5, 7, 1, 4); px(ctx, '#fff1e0', 10, 7, 1, 4); px(ctx, '#fff1e0', 7, 9, 2, 2);
      break;
    case 'guard':
      // A shield with a spike crossed out.
      shape(ctx, S, S, (x, y) => y >= 1 && y <= 15 && Math.abs(x - 8) <= (y < 9 ? 7 : 7 - (y - 9) * 1.1), ['#1e5a5a', '#2e8a84', '#4ab8a8', '#8ae8d0']);
      for (let y = 4; y < 11; y++) px(ctx, '#b8c0d0', 8 - Math.floor((y - 4) / 2), y, 1 + Math.floor((y - 4) / 2) * 2, 1);
      for (let k = 0; k < 9; k++) px(ctx, '#e8505a', 3 + k, 3 + k, 2, 1);
      break;
    case 'magnet':
      shape(ctx, S, S, (x, y) => { const d = Math.hypot(x - 8, y - 7); return (y <= 7 && d <= 7 && d >= 3) || (y > 7 && y <= 15 && ((x >= 1 && x <= 5) || (x >= 11 && x <= 15))); }, RED);
      px(ctx, '#eef2fa', 2, 12, 3, 3); px(ctx, '#eef2fa', 12, 12, 3, 3);
      break;
    case 'paint':
      box(ctx, 2, 4, 12, 12, '#b8c0d0', '#eef2fa', '#55607a');
      px(ctx, '#e8505a', 3, 8, 10, 4); px(ctx, '#ffe14a', 3, 8, 3, 4); px(ctx, '#4ab8a8', 10, 8, 3, 4);
      px(ctx, K, 4, 1, 8, 1); px(ctx, K, 3, 2, 1, 2); px(ctx, K, 12, 2, 1, 2);
      px(ctx, '#e8505a', 6, 3, 3, 2); px(ctx, '#e8505a', 7, 5, 1, 3);
      break;
    case 'jukebox':
      shape(ctx, S, S, rrect(1, 0, 15, 16, 6), RED);
      box(ctx, 4, 5, 8, 5, '#ffe14a', '#fff1a0');
      for (let x = 4; x < 12; x += 2) px(ctx, '#7a1a2a', x, 11, 1, 4);
      break;
    case 'key':
      shape(ctx, S, S, (x, y) => { const d = Math.hypot(x - 5, y - 5); return d <= 4.5 && d >= 1.8; }, ['#7a5a10', '#c8a020', '#ffe14a', '#fff1a0']);
      px(ctx, K, 7, 7, 8, 3); px(ctx, '#ffe14a', 8, 8, 7, 1);
      px(ctx, K, 11, 9, 2, 4); px(ctx, '#ffe14a', 11, 10, 1, 2);
      px(ctx, K, 14, 9, 2, 3);
      break;
    case 'pip':
      // Pip, boxed up: a little round teal drone with one big eye, in a crate.
      box(ctx, 0, 9, 16, 7, '#a8743a', '#d8a060', '#6a4020');
      shape(ctx, S, S, ellipse(8, 6, 6, 5.5), TEAL);
      shape(ctx, S, S, ellipse(8, 6, 2.6, 2.6), ['#1a1428', '#1a1428', '#5ef0c8', '#ffffff']);
      px(ctx, K, 7, 0, 2, 1);
      break;
  }
}

export function makeShopArt(scene: Phaser.Scene): void {
  canvas(scene, 'shop_room', 427, 240, shopRoom);
  canvas(scene, 'shop_counter2', 204, 44, counter2);
  for (const k of ['wtank', 'guard', 'magnet', 'paint', 'jukebox', 'key', 'pip']) canvas(scene, `ware_${k}`, 16, 16, (ctx) => ware(ctx, k));
  canvas(scene, 'rivet0', 48, 52, (ctx) => rivet(ctx, 'open'));
  canvas(scene, 'rivet1', 48, 52, (ctx) => rivet(ctx, 'blink'));
  canvas(scene, 'rivet_talk', 48, 52, (ctx) => rivet(ctx, 'talk'));
  canvas(scene, 'shop_counter', 160, 40, counter);
}
