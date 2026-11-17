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

export function makeShopArt(scene: Phaser.Scene): void {
  canvas(scene, 'rivet0', 48, 52, (ctx) => rivet(ctx, 'open'));
  canvas(scene, 'rivet1', 48, 52, (ctx) => rivet(ctx, 'blink'));
  canvas(scene, 'rivet_talk', 48, 52, (ctx) => rivet(ctx, 'talk'));
  canvas(scene, 'shop_counter', 160, 40, counter);
}
