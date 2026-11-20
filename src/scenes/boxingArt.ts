import type Phaser from 'phaser';

/**
 * The boxing arena (BoxingScene), painted once with Canvas 2D in the game's
 * 16-bit style: a lighting rig, a crowd of spectators in the dark, a hanging
 * banner (hung at y 30-46), the far ropes (sagging between padded turnbuckles), and the ring mat
 * in perspective with a lit center and the fortress keyhole painted on it.
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

/** Where the far ropes sit (y at x), sagging toward the middle. */
export const ropeY = (base: number, x: number, W: number) => base + Math.sin((x / W) * Math.PI) * 4;

function arena(c: Ctx, W: number, H: number): void {
  // The dark hall.
  for (let y = 0; y < 140; y++) for (let x = 0; x < W; x++) px(c, pick(['#05040a', '#0a0812', '#120e1e'], 0.2 + (y / 140) * 0.5, x, y), x, y);
  // The crowd: rows of heads and shoulders, dimmer toward the back.
  const shirts = ['#3a2a4a', '#4a3a5a', '#2a3a5a', '#5a3a4a', '#3a4a3a', '#5a4a2a'];
  const skins = ['#c8906a', '#8a5a3a', '#e8b08a', '#5a3a2a', '#d8a078'];
  for (let row = 0; row < 11; row++) {
    const y = 22 + row * 7;
    const dim = 0.45 + row * 0.05;
    for (let x = (row % 2) * 4 - 4; x < W + 4; x += 8) {
      const k = hash(x, row, 3);
      if (k < 0.08) continue;
      const sx = x + Math.floor(hash(x, row, 4) * 3);
      const shirt = shirts[Math.floor(k * shirts.length)];
      const skin = skins[Math.floor(hash(x, row, 5) * skins.length)];
      c.globalAlpha = dim;
      px(c, INK, sx - 1, y + 2, 8, 6);
      px(c, shirt, sx, y + 3, 6, 5);
      px(c, INK, sx + 1, y - 2, 4, 5);
      px(c, skin, sx + 1, y - 1, 3, 3);
      if (k > 0.85) px(c, '#ffe14a', sx + 6, y - 3, 2, 3); // a raised sign / glove
      c.globalAlpha = 1;
    }
  }
  // The lighting rig: a truss across the top with lamps.
  for (let x = 0; x < W; x++) {
    px(c, INK, x, 0, 1, 7);
    px(c, x % 8 < 4 ? '#55607a' : '#3a3f56', x, 1, 1, 2);
    px(c, '#55607a', x, 5, 1, 1);
    if (x % 8 === 0) for (let y = 1; y < 6; y++) px(c, '#8a8fa8', x + (y % 2), y);
  }
  for (const lx of [60, 160, 270, 370]) {
    px(c, INK, lx - 6, 6, 12, 6);
    px(c, '#8a8fa8', lx - 5, 7, 10, 3);
    px(c, '#fff4d0', lx - 4, 10, 8, 2);
  }
  // A banner over the ring.
  const by = 30;
  px(c, INK, W / 2 - 62, by, 124, 16);
  for (let y = by + 1; y < by + 15; y++) for (let x = W / 2 - 61; x < W / 2 + 61; x++) px(c, pick(['#5a2a9a', '#8c4ad8', '#a87ae8'], 0.6 - (y - by - 1) / 30, x, y), x, y);
  px(c, '#ffe14a', W / 2 - 61, by + 1, 122, 1);
  px(c, '#d8a020', W / 2 - 61, by + 14, 122, 1);
  for (const sx of [W / 2 - 50, W / 2 + 50]) px(c, '#55607a', sx, 7, 1, by - 7); // hung from the rig
  // The mat, in perspective: wider toward you, a lit center, the keyhole emblem.
  for (let y = 136; y < H; y++) {
    const k = (y - 136) / (H - 136);
    for (let x = 0; x < W; x++) {
      const dx = (x - W / 2) / (W * (0.35 + k * 0.3));
      const dy = (y - 200) / 60;
      const lit = Math.max(0, 1 - Math.hypot(dx, dy));
      px(c, pick(['#1a2444', '#24345a', '#2e4472', '#3a5488', '#4a64a0'], 0.25 + lit * 0.7, x, y), x, y);
    }
  }
  // Keyhole emblem on the canvas, squashed by the perspective.
  for (let y = -14; y <= 22; y++)
    for (let x = -14; x <= 14; x++) {
      const inHead = x * x + (y + 4) ** 2 <= 100;
      const inFoot = y > 2 && y < 20 && Math.abs(x) < 4 + (y - 2) * 0.35;
      if (!(inHead || inFoot)) continue;
      px(c, '#2a3a6a', W / 2 + x * 2.4, 196 + y * 0.9, 3, 1);
    }
  // The apron edge at the far side of the mat.
  for (let x = 0; x < W; x++) {
    px(c, INK, x, 136, 1, 1);
    px(c, Math.floor(x / 20) % 2 ? '#8c4ad8' : '#5a2a9a', x, 137, 1, 3);
    px(c, '#c8a0ff', x, 137, 1, 1);
  }
  // Far ropes, sagging between the posts (red, white, blue), then the posts with their pads.
  for (const [base, col, hi] of [[96, '#e8484e', '#ff8a8a'], [112, '#f2ead8', '#ffffff'], [128, '#3a78d8', '#8ac0ff']] as const)
    for (let x = 0; x < W; x++) {
      const y = ropeY(base, x, W);
      px(c, INK, x, y + 2, 1, 2);
      px(c, col, x, y, 1, 2);
      px(c, hi, x, y, 1, 1);
    }
  for (const [x, pad] of [[24, '#e8484e'], [W - 34, '#3a78d8']] as const) {
    px(c, INK, x - 1, 84, 12, 56);
    for (let y = 85; y < 139; y++) px(c, pick(['#55607a', '#8a8fa8', '#c8ccd8'], 0.7 - (y - 85) / 160, x, y), x, y, 10, 1);
    px(c, '#eef2fa', x, 85, 2, 54);
    for (const py of [94, 110, 126]) {
      px(c, INK, x - 3, py - 1, 16, 8);
      px(c, pad, x - 2, py, 14, 6);
      px(c, '#ffffff', x - 2, py, 14, 1);
    }
  }
}

export function makeBoxingArt(scene: Phaser.Scene, W: number, H: number): void {
  if (scene.textures.exists('bx_arena')) return;
  const t = scene.textures.createCanvas('bx_arena', W, H)!;
  arena(t.getContext(), W, H);
  t.refresh();
}
