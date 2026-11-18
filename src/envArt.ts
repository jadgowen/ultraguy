import Phaser from 'phaser';
import { TILE, VIEW_H } from './constants';
import type { ThemeId } from './level/Level';
import { THEMES, Theme } from './level/themes';
import { bgPainters } from './envBackgrounds';

/**
 * 16-bit era environment art, drawn at boot with Canvas 2D:
 *  - auto-tiled blocks: each block's frame depends on which of its four
 *    neighbors are blocks (a lip on exposed tops, bevels and outlines on
 *    exposed sides), drawn in the theme's material (metal plates, stone or
 *    brick) with interior variants so walls don't repeat;
 *  - the special tiles (ladders, spikes, doors, conveyors...) redrawn with
 *    shading, over the flat tileset from textures.ts;
 *  - three parallax background layers per theme (see envBackgrounds.ts).
 */

/** First tile index of the auto-tile set (its own tileset in the map). */
export const AUTO_GID = 1000;
/** Interior variants per neighbor mask. */
export const AUTO_VARIANTS = 3;
/** Frame for a block buried on all sides (used to cover secret rooms). */
export const AUTO_FULL = AUTO_GID + 15 * AUTO_VARIANTS;

/** Parallax layers back to front: texture key suffix and scroll factor. */
export const PARALLAX = [
  { layer: 0, factor: 0.06 },
  { layer: 1, factor: 0.22 },
  { layer: 2, factor: 0.5 },
];

export interface Ramp {
  ink: string;
  shadow: string;
  dark: string;
  base: string;
  light: string;
  shine: string;
}

type Material = 'metal' | 'stone' | 'brick';

interface EnvArt {
  material: Material;
  /** The lit lip on exposed tops: highlight row, body rows, and an accent. */
  lip: { top: string; mid: string; low?: string; accent?: string; ragged?: boolean };
}

/** Every theme's material and lip. */
export const ENV_ART: Record<ThemeId, EnvArt> = {
  foundry: { material: 'metal', lip: { top: '#c8d8ec', mid: '#7d97b6', accent: '#e8b33a' } },
  jungle: { material: 'stone', lip: { top: '#9ae06a', mid: '#4ca04a', low: '#2e7a34', ragged: true } },
  ice: { material: 'stone', lip: { top: '#ffffff', mid: '#dceaf8', low: '#a8c4e4', ragged: true } },
  sky: { material: 'metal', lip: { top: '#ffffff', mid: '#c8d4ec', accent: '#ffd84a' } },
  power: { material: 'metal', lip: { top: '#b8f0ff', mid: '#4e7a8e', accent: '#f8e040' } },
  volcano: { material: 'stone', lip: { top: '#c87a5a', mid: '#7a4a3a', accent: '#ff7a2a' } },
  scrap: { material: 'metal', lip: { top: '#e8c08a', mid: '#9a7a5a', accent: '#d8d0c0' } },
  water: { material: 'stone', lip: { top: '#f4e8b8', mid: '#c8b078', low: '#8a7a50', accent: '#ff8aa8', ragged: true } },
  fortress: { material: 'brick', lip: { top: '#b89ae0', mid: '#6a4a8a', accent: '#ff5050' } },
  city: { material: 'brick', lip: { top: '#ffffff', mid: '#d6d2ca', low: '#a8a49c' } },
};

export function hasEnvArt(id: ThemeId): boolean {
  return id in ENV_ART;
}

// --- color helpers ------------------------------------------------------------------

export function hex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

function rgb(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(a: string, b: string, k: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const f = (x: number, y: number) => Math.round(x + (y - x) * k);
  return `#${[f(r1, r2), f(g1, g2), f(b1, b2)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** A six-step ramp from a theme's solid colors. */
export function rampOf(t: Theme): Ramp {
  const base = hex(t.solid.base);
  const light = hex(t.solid.light);
  const dark = hex(t.solid.dark);
  return { ink: mix(dark, '#000000', 0.55), shadow: mix(dark, '#000000', 0.2), dark, base, light, shine: mix(light, '#ffffff', 0.45) };
}

export function px(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w = 1, h = 1): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Deterministic noise in [0, 1). */
export function hash(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// --- auto-tiles -------------------------------------------------------------------

function dither(ctx: CanvasRenderingContext2D, ox: number, r: Ramp, seed: number, lo = 0.08, hi = 0.95): void {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = hash(x, y, seed);
      if (n < lo) px(ctx, r.dark, ox + x, y);
      else if (n > hi) px(ctx, r.light, ox + x, y);
    }
  }
}

function metalBody(ctx: CanvasRenderingContext2D, ox: number, v: number, r: Ramp, seed: number): void {
  px(ctx, r.base, ox, 0, TILE, TILE);
  dither(ctx, ox, r, seed);
  px(ctx, r.light, ox, 0, TILE, 1);
  px(ctx, r.light, ox, 0, 1, TILE);
  px(ctx, r.dark, ox, TILE - 1, TILE, 1);
  px(ctx, r.dark, ox + TILE - 1, 0, 1, TILE);
  if (v === 0) {
    for (const [x, y] of [[3, 3], [11, 3], [3, 11], [11, 11]]) {
      px(ctx, r.shine, ox + x, y);
      px(ctx, r.light, ox + x + 1, y);
      px(ctx, r.shadow, ox + x + 1, y + 1);
      px(ctx, r.dark, ox + x, y + 1);
    }
  } else if (v === 1) {
    px(ctx, r.shadow, ox + 1, 7, TILE - 2, 1);
    px(ctx, r.light, ox + 1, 8, TILE - 2, 1);
    px(ctx, r.dark, ox + 7, 1, 1, 6);
    px(ctx, r.light, ox + 8, 1, 1, 6);
  } else {
    for (const y of [4, 7, 10]) {
      px(ctx, r.ink, ox + 4, y, 8, 1);
      px(ctx, r.shadow, ox + 4, y + 1, 8, 1);
      px(ctx, r.light, ox + 4, y + 2, 8, 1);
    }
  }
}

/** Big rounded stones in soft mortar: lit along the top, shaded along the bottom. */
function stoneBody(ctx: CanvasRenderingContext2D, ox: number, v: number, r: Ramp, seed: number, accent?: string): void {
  px(ctx, mix(r.dark, r.base, 0.35), ox, 0, TILE, TILE);
  const layouts = [
    [[0, 0, 10, 8], [10, 0, 6, 9], [0, 8, 7, 8], [7, 9, 9, 7]],
    [[0, 0, 7, 9], [7, 0, 9, 7], [7, 7, 9, 9], [0, 9, 7, 7]],
    [[0, 0, 16, 7], [0, 7, 11, 9], [11, 7, 5, 9]],
  ][v];
  for (const [x, y, w, h] of layouts) {
    px(ctx, r.base, ox + x + 1, y + 1, w - 2, h - 2);
    px(ctx, mix(r.base, r.light, 0.6), ox + x + 2, y + 1, w - 4, 1);
    px(ctx, mix(r.base, r.dark, 0.5), ox + x + 2, y + h - 2, w - 4, 1);
    // A little texture: a couple of darker pits per stone.
    for (let k = 0; k < 2; k++) {
      const sx = x + 2 + Math.floor(hash(k, x + y, seed) * Math.max(1, w - 4));
      const sy = y + 2 + Math.floor(hash(y + k, x, seed + 1) * Math.max(1, h - 4));
      px(ctx, mix(r.base, r.dark, 0.6), ox + sx, sy);
    }
  }
  if (accent && v === 2) {
    // A glowing crack / bit of coral through the big stone.
    px(ctx, accent, ox + 4, 10, 3, 1);
    px(ctx, accent, ox + 6, 11, 1, 2);
    px(ctx, accent, ox + 7, 13, 2, 1);
  }
}

/** Staggered brick courses. */
function brickBody(ctx: CanvasRenderingContext2D, ox: number, v: number, r: Ramp, seed: number, accent?: string): void {
  px(ctx, r.shadow, ox, 0, TILE, TILE);
  for (let row = 0; row < 2; row++) {
    const y = row * 8;
    const off = row % 2 === 0 ? 0 : -4;
    for (let x = off; x < TILE; x += 8) {
      const bx = Math.max(0, x);
      const bw = Math.min(TILE, x + 8) - bx - 1;
      if (bw <= 0) continue;
      const shade = hash(bx, y, seed + v) < 0.3 ? r.dark : r.base;
      px(ctx, shade, ox + bx, y, bw, 7);
      px(ctx, r.light, ox + bx, y, bw, 1);
      px(ctx, r.dark, ox + bx, y + 6, bw, 1);
    }
  }
  if (accent && v === 2) {
    // A narrow lit window / rune.
    px(ctx, r.ink, ox + 6, 3, 4, 10);
    px(ctx, accent, ox + 7, 4, 2, 8);
    px(ctx, mix(accent, '#ffffff', 0.5), ox + 7, 4, 1, 3);
  }
}

function drawAutoTile(ctx: CanvasRenderingContext2D, ox: number, mask: number, v: number, a: EnvArt, r: Ramp): void {
  const up = (mask & 1) !== 0;
  const right = (mask & 2) !== 0;
  const down = (mask & 4) !== 0;
  const left = (mask & 8) !== 0;
  const seed = mask * 7 + v;
  if (a.material === 'metal') metalBody(ctx, ox, v, r, seed);
  else if (a.material === 'stone') stoneBody(ctx, ox, v, r, seed, a.lip.accent);
  else brickBody(ctx, ox, v, r, seed, a.lip.accent);

  if (!left) {
    px(ctx, r.ink, ox, 0, 1, TILE);
    px(ctx, r.light, ox + 1, 0, 1, TILE);
  }
  if (!right) {
    px(ctx, r.ink, ox + TILE - 1, 0, 1, TILE);
    px(ctx, r.shadow, ox + TILE - 2, 0, 1, TILE);
  }
  if (!down) {
    px(ctx, r.ink, ox, TILE - 1, TILE, 1);
    px(ctx, r.shadow, ox, TILE - 2, TILE, 1);
  }
  if (!up) {
    const L = a.lip;
    px(ctx, r.ink, ox, 0, TILE, 1);
    px(ctx, L.top, ox, 1, TILE, 1);
    px(ctx, L.mid, ox, 2, TILE, 2);
    if (L.ragged) {
      // Grass / snow / sand hanging over the edge in an uneven line.
      for (let x = 0; x < TILE; x++) {
        const d = Math.floor(hash(x, mask, v) * 3);
        px(ctx, L.mid, ox + x, 4, 1, d);
        px(ctx, L.low ?? r.shadow, ox + x, 4 + d, 1, 1);
        if (hash(x, v, 9) < 0.25) px(ctx, L.top, ox + x, 0, 1, 1); // blades / sparkle on top
      }
    } else {
      px(ctx, L.low ?? r.shadow, ox, 4, TILE, 1);
      if (L.accent) for (let x = 0; x < TILE; x += 4) px(ctx, L.accent, ox + x + ((v * 2) % 4), 2, 2, 1);
    }
    if (!left) px(ctx, r.ink, ox, 1, 1, 4);
    if (!right) px(ctx, r.ink, ox + TILE - 1, 1, 1, 4);
  }
}

function makeAutoTiles(scene: Phaser.Scene, id: ThemeId, a: EnvArt, r: Ramp): void {
  const tex = scene.textures.createCanvas(`auto_${id}`, 16 * AUTO_VARIANTS * TILE, TILE)!;
  const ctx = tex.getContext();
  for (let mask = 0; mask < 16; mask++) for (let v = 0; v < AUTO_VARIANTS; v++) drawAutoTile(ctx, (mask * AUTO_VARIANTS + v) * TILE, mask, v, a, r);
  tex.refresh();
}

/** Tile index (in the auto-tile set) for a block. */
export function autoIndex(mask: number, c: number, r: number): number {
  const n = hash(c, r, 7);
  const variant = n < 0.6 ? 0 : n < 0.85 ? 1 : 2;
  return AUTO_GID + mask * AUTO_VARIANTS + variant;
}

// --- special tiles ---------------------------------------------------------------

/** Redraw the shared tileset's special frames with shading. */
function upgradeTileset(scene: Phaser.Scene, id: ThemeId, t: Theme, a: EnvArt, r: Ramp): void {
  const key = `tiles_${id}`;
  const old = scene.textures.get(key).getSourceImage() as HTMLCanvasElement | HTMLImageElement;
  const w = old.width;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = TILE;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(old, 0, 0);
  const clear = (f: number) => ctx.clearRect(f * TILE, 0, TILE, TILE);
  const K = r.ink;

  // 1: ladder: round rails, three-tone rungs.
  clear(1);
  const rail = hex(t.ladder.rail);
  const rung = hex(t.ladder.rung);
  for (const x of [17, 28]) {
    px(ctx, K, x, 0, 4, TILE);
    px(ctx, rail, x + 1, 0, 2, TILE);
    px(ctx, mix(rail, '#ffffff', 0.4), x + 1, 0, 1, TILE);
  }
  for (let y = 1; y < TILE; y += 5) {
    px(ctx, K, 20, y, 9, 3);
    px(ctx, rung, 20, y, 9, 1);
    px(ctx, mix(rung, '#000000', 0.3), 20, y + 1, 9, 1);
  }

  // 2: spikes: shaded cones on a plate.
  clear(2);
  const sl = hex(t.spike.light);
  const sd = hex(t.spike.dark);
  for (const cx of [36, 44]) {
    for (let y = 1; y < 13; y++) {
      const hw = Math.round(((y - 1) / 11) * 3.5);
      px(ctx, K, cx - hw - 1, y, 2 * hw + 2, 1);
      if (hw > 0) {
        px(ctx, mix(sl, '#ffffff', 0.3), cx - hw, y, 1, 1);
        px(ctx, sl, cx - hw + 1, y, Math.max(0, hw - 1), 1);
        px(ctx, sd, cx, y, hw, 1);
      }
    }
  }
  px(ctx, K, 32, 12, TILE, 4);
  px(ctx, r.dark, 33, 13, TILE - 2, 2);
  px(ctx, r.light, 33, 13, TILE - 2, 1);

  // 3: boss door: a heavy shutter.
  clear(3);
  px(ctx, K, 48, 0, TILE, TILE);
  for (let y = 0; y < TILE; y += 4) {
    px(ctx, r.base, 50, y, 12, 3);
    px(ctx, r.light, 50, y, 12, 1);
    px(ctx, r.shadow, 50, y + 2, 12, 1);
  }
  px(ctx, hex(t.solid.accent), 55, 0, 2, TILE);
  px(ctx, '#ffffff', 55, 0, 1, TILE);

  // 4: ice: glossy slab with a bright rim and glints.
  clear(4);
  const ib = hex(t.ice.base);
  const il = hex(t.ice.light);
  const id2 = hex(t.ice.dark);
  px(ctx, ib, 64, 0, TILE, TILE);
  px(ctx, il, 64, 0, TILE, 2);
  px(ctx, '#ffffff', 64, 0, TILE, 1);
  px(ctx, id2, 64, 13, TILE, 3);
  px(ctx, mix(id2, '#000000', 0.3), 64, 15, TILE, 1);
  for (let k = 0; k < 4; k++) px(ctx, il, 67 + k, 8 - k, 1, 1);
  px(ctx, il, 74, 5, 2, 1);
  px(ctx, mix(ib, id2, 0.5), 70, 10, 5, 1);

  // 5: cloud: outlined puff, three shades.
  clear(5);
  const cb = hex(t.cloud.base);
  const cs = hex(t.cloud.shade);
  px(ctx, K, 80, 2, 16, 10);
  px(ctx, K, 82, 0, 6, 3);
  px(ctx, K, 88, 0, 6, 3);
  px(ctx, cb, 81, 3, 14, 7);
  px(ctx, cb, 83, 1, 4, 2);
  px(ctx, cb, 89, 1, 4, 2);
  px(ctx, cs, 81, 8, 14, 2);
  px(ctx, mix(cs, '#000000', 0.15), 82, 10, 12, 1);
  px(ctx, '#ffffff', 84, 4, 4, 1);
  if (id === 'jungle') {
    // In the jungle, one-way platforms are sturdy branches with a tuft of leaves.
    clear(5);
    px(ctx, K, 80, 2, 16, 8);
    px(ctx, '#7a5a3a', 80, 3, 16, 5);
    px(ctx, '#a07c50', 80, 3, 16, 1);
    px(ctx, '#4a321e', 80, 7, 16, 2);
    px(ctx, '#4a321e', 85, 4, 1, 2);
    px(ctx, '#4a321e', 91, 5, 2, 1);
    px(ctx, K, 82, 0, 6, 3);
    px(ctx, '#4ca04a', 83, 0, 4, 2);
    px(ctx, '#7ad06a', 84, 0, 2, 1);
  }

  // 7: lava: bright crest, glowing bands, a bubble.
  clear(7);
  const lb = hex(t.lava.base);
  const ll = hex(t.lava.light);
  const ld = hex(t.lava.dark);
  px(ctx, lb, 112, 0, TILE, TILE);
  px(ctx, '#fff0a0', 112, 0, TILE, 1);
  px(ctx, ll, 112, 1, TILE, 2);
  for (let x = 0; x < TILE; x++) if (hash(x, 3, 1) < 0.5) px(ctx, ll, 112 + x, 3);
  px(ctx, ld, 112, 9, TILE, 1);
  px(ctx, ld, 114, 12, 6, 2);
  px(ctx, ll, 121, 6, 3, 3);
  px(ctx, '#fff0a0', 121, 6, 1, 1);

  // 8, 9: conveyors: a belt over rollers, chevrons on top.
  for (const [ox, dir] of [[128, -1], [144, 1]] as const) {
    ctx.clearRect(ox, 0, TILE, TILE);
    px(ctx, K, ox, 0, TILE, TILE);
    px(ctx, '#3a3a44', ox, 1, TILE, 6);
    px(ctx, '#5a5a66', ox, 1, TILE, 1);
    for (const cx of [ox + 2, ox + 9]) {
      const a1 = '#ffc040';
      if (dir > 0) {
        px(ctx, a1, cx, 2, 2, 1);
        px(ctx, a1, cx + 2, 3, 2, 1);
        px(ctx, a1, cx, 4, 2, 1);
      } else {
        px(ctx, a1, cx + 2, 2, 2, 1);
        px(ctx, a1, cx, 3, 2, 1);
        px(ctx, a1, cx + 2, 4, 2, 1);
      }
    }
    for (const rx of [ox + 1, ox + 9]) {
      px(ctx, r.dark, rx, 8, 6, 6);
      px(ctx, r.light, rx + 1, 9, 4, 1);
      px(ctx, r.shine, rx + 2, 10, 2, 2);
      px(ctx, r.shadow, rx + 1, 12, 4, 1);
    }
    px(ctx, r.shadow, ox, 14, TILE, 2);
  }

  // 13: crumbling tile, in the theme's material, visibly cracked.
  if (id !== 'sky' && id !== 'jungle') {
    clear(13);
    const ox = 208;
    if (a.material === 'stone') stoneBody(ctx, ox, 1, r, 3);
    else if (a.material === 'brick') brickBody(ctx, ox, 0, r, 3);
    else metalBody(ctx, ox, 1, r, 3);
    if (id === 'ice') {
      px(ctx, ib, ox, 0, TILE, 12);
      px(ctx, il, ox, 0, TILE, 2);
      px(ctx, id2, ox, 10, TILE, 2);
    }
    for (const [x, y, w, h] of [[3, 2, 1, 4], [4, 5, 3, 1], [7, 6, 1, 4], [11, 1, 1, 3], [12, 3, 2, 1], [9, 10, 4, 1]]) px(ctx, K, ox + x, y, w, h);
    px(ctx, K, ox, 0, TILE, 1);
    ctx.clearRect(ox, 12, TILE, 4);
    px(ctx, r.dark, ox + 1, 12, 3, 2);
    px(ctx, r.dark, ox + 9, 12, 4, 2);
  }

  // 15: spring (not the jungle flower): shaded coil and pad.
  if (id !== 'jungle') {
    clear(15);
    const ox = 240;
    px(ctx, K, ox, 11, TILE, 5);
    px(ctx, r.dark, ox + 1, 12, TILE - 2, 3);
    px(ctx, r.light, ox + 1, 12, TILE - 2, 1);
    for (const y of [5, 8]) {
      px(ctx, K, ox + 3, y, 10, 3);
      px(ctx, '#e8eef8', ox + 4, y, 8, 1);
      px(ctx, '#8a98b8', ox + 4, y + 1, 8, 1);
    }
    px(ctx, K, ox, 0, TILE, 5);
    px(ctx, '#d83a4a', ox + 1, 1, TILE - 2, 3);
    px(ctx, '#ff8aa8', ox + 1, 1, TILE - 2, 1);
    px(ctx, '#ffffff', ox + 3, 1, 3, 1);
  }

  // 16, 17: switch blocks: beveled and glowing.
  for (const [ox, col] of [[256, '#f28c28'], [272, '#2aa88a']] as const) {
    ctx.clearRect(ox, 0, TILE, TILE);
    px(ctx, K, ox, 0, TILE, TILE);
    px(ctx, col, ox + 1, 1, 14, 14);
    px(ctx, mix(col, '#ffffff', 0.5), ox + 1, 1, 14, 2);
    px(ctx, mix(col, '#ffffff', 0.5), ox + 1, 1, 2, 14);
    px(ctx, mix(col, '#000000', 0.35), ox + 1, 13, 14, 2);
    px(ctx, mix(col, '#000000', 0.35), ox + 13, 1, 2, 14);
    px(ctx, K, ox + 5, 5, 6, 6);
    px(ctx, mix(col, '#ffffff', 0.7), ox + 6, 6, 4, 4);
    px(ctx, '#ffffff', ox + 6, 6, 2, 2);
  }

  scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

// --- backgrounds ------------------------------------------------------------------

function makeParallax(scene: Phaser.Scene, id: ThemeId, t: Theme): void {
  const painter = bgPainters[id];
  for (const { layer } of PARALLAX) {
    const w = painter.width[layer];
    const tex = scene.textures.createCanvas(`bgl_${id}_${layer}`, w, VIEW_H)!;
    painter.paint(layer, tex.getContext(), w, VIEW_H, new Phaser.Math.RandomDataGenerator([`${id}${layer}`]), t);
    tex.refresh();
  }
}

/** Build the art for every theme. Runs after textures.ts has made the flat tilesets. */
export function makeEnvArt(scene: Phaser.Scene): void {
  for (const [id, a] of Object.entries(ENV_ART) as [ThemeId, EnvArt][]) {
    const t = THEMES[id];
    const r = rampOf(t);
    makeAutoTiles(scene, id, a, r);
    upgradeTileset(scene, id, t, a, r);
    makeParallax(scene, id, t);
  }
}
