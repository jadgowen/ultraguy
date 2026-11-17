import type Phaser from 'phaser';
import { hash, px } from './envArt';

/**
 * Animated frames for the two weapons that move along the world: Anvil's
 * Quake Wave (a crest of rock and energy rolling along the floor) and Gale's
 * Cyclone (a funnel whose bands scroll, so it spins). Drawn at boot.
 *
 *   quake0..3   8 x 12
 *   cyclonef0..3 18 x 22 (four frames; the old two-frame cyclone stays for Shade)
 */

type Ctx = CanvasRenderingContext2D;
const K = '#1a1428';

function canvas(scene: Phaser.Scene, key: string, w: number, h: number, paint: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h)!;
  paint(tex.getContext());
  tex.refresh();
}

/** Quake Wave frame k: the crest rises and falls, the core flickers, pebbles fly off the top. */
function quake(ctx: Ctx, k: number): void {
  const W = 8;
  const H = 12;
  const top = [3, 1, 0, 2][k];
  const rock = ['#5a3418', '#8a5428', '#b8703a', '#e8b07a'];
  for (let y = top; y < H; y++) {
    const half = Math.min(3.6, 1 + (y - top) * 0.45);
    const x0 = Math.round(W / 2 - half);
    const x1 = Math.round(W / 2 + half) - 1;
    for (let x = x0; x <= x1; x++) {
      const edge = x === x0 || x === x1 || y === top;
      const shade = Math.min(3, Math.max(0, 3 - Math.floor(((y - top) / (H - top)) * 3) - (x > W / 2 ? 1 : 0)));
      px(ctx, edge ? K : rock[shade], x, y);
    }
  }
  // The energy core: a bright seam up the middle.
  for (let y = top + 1; y < H - 2; y++) if ((y + k) % 3 !== 0) px(ctx, y < top + 4 ? '#ffffff' : '#ffe14a', 3 + ((y + k) % 2), y);
  // Pebbles thrown up off the crest.
  for (let i = 0; i < 2; i++) {
    const x = Math.floor(hash(k, i, 3) * W);
    const y = Math.max(0, top - 1 - Math.floor(hash(i, k, 5) * 2));
    if (y < top) px(ctx, '#b8703a', x, y);
  }
  // Ground glow along the bottom.
  px(ctx, '#ffe14a', 1, H - 1, W - 2, 1);
}

/** Cyclone frame k: a funnel, wide on top; its bands scroll down a step each frame. */
function cyclone(ctx: Ctx, k: number): void {
  const W = 18;
  const H = 22;
  const ramp = ['#5a8ab8', '#9ad0ea', '#e6f8ff'];
  for (let y = 0; y < H; y++) {
    const wob = Math.sin(y * 0.55 + k * 1.6) * 1.2;
    const r = 8.2 - y * 0.27;
    const cx = W / 2 + wob;
    const x0 = Math.round(cx - r);
    const x1 = Math.round(cx + r) - 1;
    for (let x = x0; x <= x1; x++) {
      if (x < 0 || x >= W) continue;
      if (x === x0 || x === x1) {
        px(ctx, K, x, y);
        continue;
      }
      const band = (y + k * 2) % 6 < 3 ? 2 : 1;
      const side = x < cx - r * 0.45 ? 1 : x > cx + r * 0.45 ? -1 : 0;
      px(ctx, ramp[Math.max(0, Math.min(2, band + (side < 0 ? -1 : 0)))], x, y);
    }
    // A streak of wind whipping around the funnel.
    const sx = Math.round(cx - r + ((k * 4 + y * 3) % Math.max(1, Math.floor(r * 2))));
    if ((y + k) % 4 === 0 && sx > x0 && sx < x1) px(ctx, '#ffffff', sx, y, 2, 1);
  }
}

export function makeWeaponFx(scene: Phaser.Scene): void {
  for (let k = 0; k < 4; k++) {
    canvas(scene, `quake${k}`, 8, 12, (ctx) => quake(ctx, k));
    canvas(scene, `cyclonef${k}`, 18, 22, (ctx) => cyclone(ctx, k));
  }
}
