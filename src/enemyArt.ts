import type Phaser from 'phaser';
import { px } from './envArt';

/**
 * Art for each stage's signature enemy, two frames apiece, drawn at boot in
 * the shaded 16-bit style (outlined shapes lit from the top-left).
 */

type Ctx = CanvasRenderingContext2D;
type Ramp = [string, string, string, string]; // dark, mid, light, shine
const K = '#1a1428';

const STEEL: Ramp = ['#3a3f56', '#5a5f78', '#8a8fa8', '#c8ccd8'];
const ORANGE: Ramp = ['#7a3410', '#b85a1a', '#f28c28', '#ffc070'];
const LEAF: Ramp = ['#1c4a20', '#2e7a34', '#5ab84a', '#9ae06a'];
const PETAL: Ramp = ['#7a1a3a', '#c83a6a', '#ff7aa8', '#ffc0d8'];
const SNOW: Ramp = ['#7a9ac8', '#a8c4e4', '#dceaf8', '#ffffff'];
const SKY: Ramp = ['#2a5a9a', '#4a90e0', '#9ad0ff', '#e6f8ff'];
const VOLT: Ramp = ['#7a6a10', '#c8a820', '#f8e040', '#fffbc8'];
const LAVA: Ramp = ['#7a1a10', '#d84a1a', '#ff8a2a', '#ffe14a'];
const RUST: Ramp = ['#5a3418', '#8a5428', '#b8703a', '#e8b07a'];
const JELLY: Ramp = ['#6a3a8a', '#9a5ac8', '#d0a8f0', '#f4e4ff'];

function canvas(scene: Phaser.Scene, key: string, w: number, h: number, paint: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h)!;
  paint(tex.getContext());
  tex.refresh();
}

/** Fill a shape (tested at pixel centers) with a lit ramp and an outline. */
function shape(ctx: Ctx, w: number, h: number, inside: (x: number, y: number) => boolean, r: Ramp): void {
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && inside(x + 0.5, y + 0.5);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!at(x, y)) continue;
      if (!at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1)) px(ctx, K, x, y);
      else if (!at(x, y - 2) || !at(x - 2, y)) px(ctx, r[3], x, y);
      else if (!at(x, y + 2) || !at(x + 2, y)) px(ctx, r[0], x, y);
      else px(ctx, (x + y) % 2 === 0 && !at(x, y + 3) ? r[0] : y < h / 2 ? r[2] : r[1], x, y);
    }
}
const ell = (cx: number, cy: number, rx: number, ry: number) => (x: number, y: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const box = (x0: number, y0: number, x1: number, y1: number) => (x: number, y: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const eye = (ctx: Ctx, x: number, y: number, c = '#ff3050') => {
  px(ctx, K, x - 1, y - 1, 4, 3);
  px(ctx, c, x, y, 2, 1);
};

const SUIT: Ramp = ['#3a1a5a', '#5a2a8a', '#8a4ab8', '#c08ae8'];
const GOLD: Ramp = ['#8a6008', '#c89a18', '#f8d040', '#fff4a0'];

/** The BARGAIN BARON: a portly robot tycoon in a purple suit and gold top hat, with a monocle and a cane. */
function baron(ctx: Ctx, pose: 'idle' | 'throw' | 'dash'): void {
  const W = 36;
  const H = 40;
  const lean = pose === 'dash' ? 3 : 0;
  // Legs.
  shape(ctx, W, H, box(11, 32, 15, 39), STEEL);
  shape(ctx, W, H, box(20, 32, 24, 39), STEEL);
  // Round body in a suit, a gold bow tie and buttons.
  shape(ctx, W, H, ell(18 + lean, 25, 12, 10), SUIT);
  shape(ctx, W, H, box(15 + lean, 18, 21 + lean, 20), GOLD);
  px(ctx, '#fff4a0', 18 + lean, 25, 1, 1);
  px(ctx, '#fff4a0', 18 + lean, 29, 1, 1);
  // Head with a monocle.
  shape(ctx, W, H, ell(19 + lean, 12, 7, 6), STEEL);
  shape(ctx, W, H, ell(22 + lean, 12, 3, 3), ['#7a1a2a', '#d83a4a', '#ff7a8a', '#ffffff']);
  px(ctx, '#ffe14a', 24 + lean, 15, 1, 4); // monocle chain
  eye(ctx, 15 + lean, 12, '#5ef0c8');
  // Gold top hat.
  shape(ctx, W, H, box(11 + lean, 6, 27 + lean, 8), GOLD);
  shape(ctx, W, H, box(14 + lean, 0, 24 + lean, 7), GOLD);
  px(ctx, '#3a1a5a', 14 + lean, 4, 11, 2); // hat band
  // Arm and cane, or a fistful of coins.
  if (pose === 'throw') {
    shape(ctx, W, H, box(28, 14, 35, 18), SUIT);
    shape(ctx, W, H, ell(33, 13, 3, 3), GOLD);
  } else {
    shape(ctx, W, H, box(28 + lean, 20, 31 + lean, 26), SUIT);
    shape(ctx, W, H, box(31 + lean, 18, 33 + lean, 39), GOLD); // cane
  }
  if (pose === 'dash') {
    // A SALE sign held out front like a blade.
    shape(ctx, W, H, box(0, 16, 9, 26), ['#982030', '#d83a4a', '#ff7a8a', '#ffffff']);
    px(ctx, '#fff1e0', 2, 19, 6, 1);
    px(ctx, '#fff1e0', 2, 22, 6, 1);
  }
}

export function makeEnemyArt(scene: Phaser.Scene): void {
  for (const pose of ['idle', 'throw', 'dash'] as const) canvas(scene, `baron_${pose}`, 36, 40, (ctx) => baron(ctx, pose));
  canvas(scene, 'coin', 8, 8, (ctx) => {
    shape(ctx, 8, 8, ell(4, 4, 3.6, 3.6), GOLD);
    px(ctx, '#8a6008', 3, 2, 2, 4);
  });
  // Foundry: HAMMERBOT, hammer down (0) and raised (1).
  for (const up of [0, 1]) {
    canvas(scene, `hammerbot${up}`, 20, 20, (ctx) => {
      shape(ctx, 20, 20, box(4, 8, 15, 17), STEEL);
      shape(ctx, 20, 20, box(5, 17, 8, 19), STEEL);
      shape(ctx, 20, 20, box(11, 17, 14, 19), STEEL);
      shape(ctx, 20, 20, ell(9.5, 7, 5, 4), ORANGE);
      eye(ctx, 10, 7);
      if (up) {
        shape(ctx, 20, 20, box(14, 0, 15, 9), STEEL);
        shape(ctx, 20, 20, box(11, 0, 19, 4), ORANGE);
      } else {
        shape(ctx, 20, 20, box(15, 9, 16, 15), STEEL);
        shape(ctx, 20, 20, box(13, 14, 19, 19), ORANGE);
      }
    });
  }
  // Canopy: SNAPPER, a closed bud (0) and open jaws (1).
  canvas(scene, 'snapper0', 16, 20, (ctx) => {
    shape(ctx, 16, 20, box(7, 12, 8, 19), LEAF);
    shape(ctx, 16, 20, ell(8, 12, 6, 7), PETAL);
    px(ctx, K, 8, 7, 1, 9);
  });
  canvas(scene, 'snapper1', 16, 20, (ctx) => {
    shape(ctx, 16, 20, box(7, 12, 8, 19), LEAF);
    shape(ctx, 16, 20, (x, y) => ell(8, 9, 7, 7)(x, y) && !(Math.abs(x - 8) < 4 - Math.abs(y - 9) * 0.5 && y > 5 && y < 13), PETAL);
    for (const x of [4, 7, 10]) px(ctx, '#fff1e0', x, 5, 1, 2);
    for (const x of [5, 8, 11]) px(ctx, '#fff1e0', x, 12, 1, 2);
    px(ctx, '#3a0a1a', 6, 8, 4, 3);
  });
  // Glacier: SNOW ROLLER (two turns of the roll).
  for (const k of [0, 1]) {
    canvas(scene, `snowball${k}`, 16, 16, (ctx) => {
      shape(ctx, 16, 16, ell(8, 8, 7.5, 7.5), SNOW);
      for (const [x, y] of k ? [[5, 6], [10, 10], [9, 4]] : [[6, 10], [10, 5], [4, 5]]) px(ctx, SNOW[0], x, y, 2, 1);
    });
  }
  // Stratos: GUST FAN, blades in two positions.
  for (const k of [0, 1]) {
    canvas(scene, `gustfan${k}`, 20, 16, (ctx) => {
      shape(ctx, 20, 16, ell(10, 8, 9, 7), SKY);
      shape(ctx, 20, 16, ell(10, 8, 6, 5), STEEL);
      if (k) {
        px(ctx, '#e6f8ff', 5, 7, 10, 2);
        px(ctx, '#e6f8ff', 9, 4, 2, 8);
      } else for (let i = -3; i <= 3; i++) px(ctx, '#e6f8ff', 10 + i, 8 + i, 2, 1), px(ctx, '#e6f8ff', 10 + i, 8 - i, 2, 1);
      px(ctx, K, 9, 7, 2, 2);
    });
  }
  // Power Plant: TESLA COIL, idle (0) and charged (1).
  for (const k of [0, 1]) {
    canvas(scene, `tesla${k}`, 14, 28, (ctx) => {
      shape(ctx, 14, 28, box(2, 22, 11, 27), STEEL);
      shape(ctx, 14, 28, box(4, 8, 9, 22), k ? VOLT : STEEL);
      for (let y = 10; y < 22; y += 3) px(ctx, K, 4, y, 6, 1);
      shape(ctx, 14, 28, ell(6.5, 5, 6, 5), k ? VOLT : SKY);
      if (k) px(ctx, '#ffffff', 4, 2, 3, 2);
    });
  }
  // Caldera: LAVA LEAPER, squashed (0) and stretched mid-leap (1).
  canvas(scene, 'leaper0', 16, 14, (ctx) => {
    shape(ctx, 16, 14, ell(8, 9, 7.5, 5), LAVA);
    eye(ctx, 5, 8, '#fff1e0');
    eye(ctx, 10, 8, '#fff1e0');
  });
  canvas(scene, 'leaper1', 16, 14, (ctx) => {
    shape(ctx, 16, 14, ell(8, 7, 5.5, 7), LAVA);
    eye(ctx, 5, 5, '#fff1e0');
    eye(ctx, 9, 5, '#fff1e0');
  });
  // Scrapyard: MAGNET DRONE, idle (0) and pulling (1).
  for (const k of [0, 1]) {
    canvas(scene, `magdrone${k}`, 20, 16, (ctx) => {
      shape(ctx, 20, 16, ell(10, 5, 8, 4), RUST);
      eye(ctx, 9, 5, '#5ef0c8');
      shape(ctx, 20, 16, box(6, 8, 13, 10), STEEL);
      shape(ctx, 20, 16, box(3, 9, 8, 15), k ? ['#7a1a2a', '#d83a4a', '#ff7a8a', '#ffc0c8'] : STEEL);
      shape(ctx, 20, 16, box(11, 9, 16, 15), k ? ['#2a3a7a', '#4a6ad8', '#8aa8ff', '#c8d8ff'] : STEEL);
    });
  }
  // Reef: JELLY, bell up (0) and pulsing (1).
  for (const k of [0, 1]) {
    canvas(scene, `jelly${k}`, 16, 20, (ctx) => {
      shape(ctx, 16, 20, (x, y) => ell(8, 7, k ? 7.5 : 6.5, k ? 5.5 : 6.5)(x, y) && y < 10, JELLY);
      for (const x of [3, 6, 9, 12]) for (let y = 10; y < 18; y++) if ((y + x + k) % 3 !== 0) px(ctx, JELLY[1], x + ((y + k) % 2), y);
      px(ctx, '#ffffff', 5, 4, 2, 1);
    });
  }
}
