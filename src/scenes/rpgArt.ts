import type Phaser from 'phaser';

/**
 * Art for the armor-part guardian battles (RpgScene), drawn once with Canvas
 * 2D in the game's 16-bit style.
 *
 *  - rpg_bg_<id>: a battle backdrop behind each guardian (212 x 112):
 *    beard: his forge workshop; juck: the woods at dusk; hydro: a waterfall
 *    cave; ceej: a war-room classroom
 *  - rpgWindow(): a 16-bit RPG window (a blue gradient, a silver bevel, gold corners)
 */

type Ctx = CanvasRenderingContext2D;
const INK = '#1a1428';

const px = (c: Ctx, col: string, x: number, y: number, w = 1, h = 1) => {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), w, h);
};
const bayer = (x: number, y: number) => [0, 0.5, 0.75, 0.25][(x & 1) + ((y & 1) << 1)];
const hash = (x: number, y: number, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const pick = (ramp: string[], k: number, x: number, y: number) => {
  const v = Math.min(ramp.length - 1, Math.max(0, k * (ramp.length - 1)));
  const lo = Math.floor(v);
  return ramp[Math.min(ramp.length - 1, lo + (v - lo > bayer(x, y) ? 1 : 0))];
};

const W = 212;
const H = 112;

function forge(c: Ctx): void {
  // Brick wall lit orange from the forge on the left, a plank floor, tools on a rack, the anvil.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const glow = Math.max(0, 1 - Math.hypot(x - 30, y - 70) / 140);
      if (y < 78) {
        const row = y >> 3, off = (row & 1) * 8;
        const mortar = y % 8 === 7 || (x + off) % 16 === 15;
        px(c, mortar ? '#1e1418' : pick(['#3a2224', '#5a3028', '#7a4630', '#a86a3a'], 0.2 + glow * 0.7 + hash(x >> 3, row, 2) * 0.12, x, y), x, y);
      } else px(c, pick(['#2a1810', '#4a2c1a', '#6a4426', '#8a5c34'], 0.35 + glow * 0.5 - (x % 24 === 0 ? 0.2 : 0), x, y), x, y);
    }
  // The forge mouth.
  px(c, INK, 8, 44, 44, 34);
  for (let y = 46; y < 76; y++) for (let x = 10; x < 50; x++) px(c, pick(['#7a1a10', '#d84a1a', '#ff8a2a', '#ffe14a'], 1 - Math.hypot(x - 30, y - 70) / 30 + hash(x >> 1, y >> 1, 5) * 0.2, x, y), x, y);
  // Tool rack.
  px(c, '#2a1810', 140, 22, 60, 3);
  for (const [x, h, col] of [[146, 22, '#8a8fa8'], [158, 18, '#c8a070'], [170, 26, '#8a8fa8'], [184, 20, '#c8ccd8']] as const) {
    px(c, INK, x - 1, 24, 3, h);
    px(c, col, x, 25, 1, h - 2);
  }
}

function woods(c: Ctx): void {
  // Dusk sky, two rows of pine silhouettes, a grassy clearing.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (y < 70) px(c, pick(['#2a1a3a', '#5a2a4a', '#b8503a', '#f2a050'], y / 70, x, y), x, y);
      else px(c, pick(['#1c3a20', '#2e5a30', '#4a7a3a', '#6a9a4a'], 0.3 + (y - 70) / 80 + hash(x >> 2, y >> 1, 3) * 0.2, x, y), x, y);
    }
  // Sun low on the horizon.
  for (let y = 0; y < 18; y++) for (let x = 0; x < 30; x++) if ((x - 15) ** 2 + (y - 18) ** 2 < 180) px(c, y < 9 ? '#ffe0a0' : '#ffc070', 150 + x, 52 + y);
  const pines = (base: number, col: string, step: number, s: number) => {
    for (let i = 0; i * step < W + step; i++) {
      const x0 = i * step + hash(i, s, 1) * step * 0.6, h = 30 + hash(i, s, 2) * 26;
      for (let y = 0; y < h; y++) {
        const w = (y / h) * 9 + 1;
        px(c, col, x0 - w / 2, base - h + y, w, 1);
      }
    }
  };
  pines(74, '#3a1e3a', 18, 1);
  pines(80, '#1a1028', 24, 2);
  // A deer stand at the edge of the clearing.
  px(c, '#2a160e', 20, 30, 2, 50);
  px(c, '#2a160e', 34, 30, 2, 50);
  px(c, '#4a2c1a', 16, 28, 24, 6);
}

function cave(c: Ctx): void {
  // Wet rock walls, a waterfall in the middle, a pool with ripples.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const wet = Math.max(0, 1 - Math.abs(x - 106) / 60);
      px(c, pick(['#0e1e2e', '#1a3046', '#2a4a66', '#4a7a9a'], 0.25 + wet * 0.35 + hash(x >> 3, y >> 3, 6) * 0.25, x, y), x, y);
    }
  for (let y = 0; y < 84; y++)
    for (let x = 90; x < 122; x++) {
      const k = 0.55 + Math.sin((y * 0.7 + x * 1.3 + hash(x, 0, 3) * 9)) * 0.25;
      px(c, k > 0.75 ? '#e6f8ff' : k > 0.5 ? '#9ad8ff' : '#5aa8e8', x, y);
    }
  for (let y = 84; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ripple = Math.sin(Math.hypot(x - 106, (y - 86) * 3) / 3) > 0.6;
      px(c, ripple ? '#9ad8ff' : pick(['#123a6a', '#1a5a8a', '#2a7ab8'], 0.5 + (y - 84) / 60, x, y), x, y);
    }
  // Glowing crystals.
  for (const [x, y, col] of [[24, 60, '#5ef0c8'], [180, 52, '#9ad8ff'], [40, 30, '#9ad8ff']] as const) {
    px(c, INK, x - 3, y - 8, 7, 12);
    px(c, col, x - 2, y - 7, 5, 10);
    px(c, '#ffffff', x - 1, y - 6, 1, 4);
  }
}

function warRoom(c: Ctx): void {
  // A classroom wall with a chalkboard map, flags, a wood floor.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (y < 80) px(c, pick(['#3a3a2a', '#5a5a3a', '#7a7a4e', '#9a9a62'], 0.45 + (y < 6 ? -0.2 : 0) + hash(x >> 4, y >> 4, 4) * 0.1, x, y), x, y);
      else px(c, pick(['#3a2414', '#5a3a20', '#7a5230', '#9a6a3e'], 0.4 + ((x + (y >> 2) * 7) % 22 === 0 ? -0.3 : 0) + hash(x >> 3, y >> 1, 2) * 0.15, x, y), x, y);
    }
  // Chalkboard with a campaign map.
  px(c, '#5a3a20', 50, 10, 112, 52);
  px(c, INK, 53, 13, 106, 46);
  for (let y = 14; y < 58; y++) for (let x = 54; x < 158; x++) px(c, pick(['#1a2a1e', '#22362a', '#2a4232'], 0.5 + hash(x >> 2, y >> 2, 8) * 0.3, x, y), x, y);
  for (let a = 0; a < 6.2; a += 0.05) px(c, '#e6e6d0', 90 + Math.cos(a) * 18 + Math.sin(a * 3) * 3, 36 + Math.sin(a) * 12, 1, 1);
  for (const [x0, y0, x1, y1] of [[70, 50, 92, 38], [140, 22, 112, 34]] as const)
    for (let i = 0; i <= 20; i++) px(c, '#ffe14a', x0 + ((x1 - x0) * i) / 20, y0 + ((y1 - y0) * i) / 20);
  px(c, '#e8484e', 120, 28, 4, 4);
  // Flags in a stand.
  for (const [x, col] of [[18, '#e8484e'], [26, '#4a90c8'], [186, '#a8b060']] as const) {
    px(c, '#c8a070', x, 20, 1, 60);
    px(c, INK, x + 1, 20, 13, 10);
    px(c, col, x + 1, 21, 12, 8);
  }
}

const PAINT: Record<string, (c: Ctx) => void> = { beard: forge, juck: woods, hydro: cave, ceej: warRoom };

export function makeRpgBackdrop(scene: Phaser.Scene, id: string): string {
  const key = `rpg_bg_${id}`;
  if (scene.textures.exists(key)) return key;
  const t = scene.textures.createCanvas(key, W, H)!;
  const c = t.getContext();
  (PAINT[id] ?? warRoom)(c);
  // Darken the edges so the guardian stands out.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = Math.max(0, Math.hypot((x - W / 2) / (W / 2), (y - H / 2) / (H / 2)) - 0.65);
      if (k > 0 && bayer(x, y) < k * 2.5) px(c, 'rgba(4,2,10,0.55)', x, y);
    }
  t.refresh();
  return key;
}

/** A 16-bit RPG window: a deep blue gradient, a silver bevel, gold corner studs. */
export function rpgWindow(scene: Phaser.Scene, w: number, h: number): string {
  const key = `rpg_win_${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const t = scene.textures.createCanvas(key, w, h)!;
  const c = t.getContext();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px(c, pick(['#0a0e2a', '#121a4a', '#1a2a6a', '#24408a'], 0.8 - y / h * 0.75, x, y), x, y);
  // Rounded corners: clear them.
  for (const [cx, cy] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) c.clearRect(cx, cy, 1, 1);
  // Bevel: outer ink, silver, a dark inner line.
  const frame = (i: number, col: string) => {
    px(c, col, 1 + i, i, w - 2 - i * 2, 1);
    px(c, col, 1 + i, h - 1 - i, w - 2 - i * 2, 1);
    px(c, col, i, 1 + i, 1, h - 2 - i * 2);
    px(c, col, w - 1 - i, 1 + i, 1, h - 2 - i * 2);
  };
  frame(0, INK);
  frame(1, '#e6eaf4');
  frame(2, '#8a8fa8');
  frame(3, '#0a0e2a');
  for (const [cx, cy] of [[1, 1], [w - 4, 1], [1, h - 4], [w - 4, h - 4]]) {
    px(c, '#ffe14a', cx, cy, 3, 3);
    px(c, '#fff4c0', cx, cy, 1, 1);
  }
  t.refresh();
  return key;
}
