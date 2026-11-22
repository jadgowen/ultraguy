import Phaser from 'phaser';
import { TILE } from './constants';
import { hash, hex, mix, px } from './envArt';
import { Level, Tile, isWaterTile } from './level/Level';
import { THEMES } from './level/themes';
import type { ThemeId } from './level/Level';

/**
 * Living tiles: an animation layer over the static tilemap.
 *  - lava: the crest rolls, bubbles rise and pop, the bands churn, embers drift up
 *  - ice (and frozen blocks): a glint sweeps across now and then, travelling along the floor
 *  - water: the surface shimmers
 *  - springs: they breathe (the jungle bounce flower's petals pulse), chevrons float up
 *    above them, and they squash and flash when bounced on
 *  - conveyor belts: the chevrons actually move
 * Frames are drawn per theme the first time a stage needs them.
 */

type Ctx = CanvasRenderingContext2D;
const FRAMES = 8;
const K = '#1a1428';

function canvas(scene: Phaser.Scene, key: string, w: number, h: number, paint: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h)!;
  paint(tex.getContext());
  tex.refresh();
}

/** Draw a theme's living-tile frames (lava crest and body, glow, embers...); safe to call again. */
export function makeFrames(scene: Phaser.Scene, theme: ThemeId): void {
  const t = THEMES[theme];
  const lb = hex(t.lava.base);
  const ll = hex(t.lava.light);
  const ld = hex(t.lava.dark);
  const ib = hex(t.ice.light);
  for (let k = 0; k < FRAMES; k++) {
    const ph = (k / FRAMES) * Math.PI * 2;
    // Lava surface: a rolling crest over churning bands, with a bubble rising and popping.
    canvas(scene, `lava_top_${theme}_${k}`, TILE, TILE, (ctx) => {
      for (let x = 0; x < TILE; x++) {
        const crest = 2 + Math.round(Math.sin((x / TILE) * Math.PI * 2 + ph) * 1.2);
        for (let y = 0; y < TILE; y++) {
          if (y < crest - 1) continue;
          // Soft blotches that drift down a pixel every other frame.
          const n = hash(x >> 1, ((y + Math.floor(k / 2)) % TILE) >> 1, 11);
          const c = y < crest ? '#fff0a0' : y < crest + 2 ? ll : n < 0.12 ? mix(lb, ll, 0.5) : n > 0.9 ? ld : lb;
          px(ctx, c, x, y);
        }
      }
      // The bubble: rises over five frames, pops on the sixth.
      const bx = 3 + Math.floor(hash(theme.length, 1, 7) * 9);
      if (k < 5) {
        const by = 12 - k * 2;
        px(ctx, ll, bx, by, 3, 3);
        px(ctx, '#fff0a0', bx, by, 1, 1);
      } else if (k === 5) {
        px(ctx, '#fff0a0', bx - 1, 2, 1, 1);
        px(ctx, '#fff0a0', bx + 3, 2, 1, 1);
        px(ctx, '#fff0a0', bx + 1, 0, 1, 1);
      }
    });
    // Lava below the surface: glowing veins that drift.
    canvas(scene, `lava_body_${theme}_${k}`, TILE, TILE, (ctx) => {
      for (let y = 0; y < TILE; y++)
        for (let x = 0; x < TILE; x++) {
          // Glowing veins and dark crust in soft 2x2 blotches, churning slowly.
          const n = hash(x >> 1, ((y + Math.floor(k / 2)) % TILE) >> 1, 4);
          px(ctx, n < 0.08 ? ll : n < 0.22 ? mix(lb, ll, 0.4) : n > 0.88 ? ld : lb, x, y);
        }
    });
    // Ice glint: a bright diagonal streak crossing the slab.
    canvas(scene, `ice_glint_${k}`, TILE, TILE, (ctx) => {
      const x0 = -6 + k * 3;
      for (let y = 2; y < 12; y++)
        for (let w = 0; w < 3; w++) {
          const x = x0 + Math.floor((12 - y) * 0.6) + w;
          if (x < 1 || x > 14) continue;
          ctx.globalAlpha = w === 1 ? 0.9 : 0.45;
          px(ctx, w === 1 ? '#ffffff' : ib, x, y);
        }
      ctx.globalAlpha = 1;
    });
    // Water surface shimmer.
    canvas(scene, `water_shine_${k}`, TILE, 4, (ctx) => {
      for (let x = 0; x < TILE; x++) {
        const w = (x + k * 2) % 8;
        ctx.globalAlpha = 0.7;
        if (w < 3) px(ctx, '#e6f8ff', x, 0);
        ctx.globalAlpha = 0.35;
        if (w > 1 && w < 5) px(ctx, '#9ad0ff', x, 1);
      }
      ctx.globalAlpha = 1;
    });
    // Chevrons floating up off a spring.
    canvas(scene, `spring_up_${k}`, TILE, TILE, (ctx) => {
      for (const off of [0, 8]) {
        const y = 14 - ((k * 2 + off) % 16);
        ctx.globalAlpha = Math.max(0, Math.min(1, y / 10));
        for (let i = 0; i < 4; i++) {
          px(ctx, '#ffe14a', 4 + i, y + 3 - i, 1, 1);
          px(ctx, '#ffe14a', 11 - i, y + 3 - i, 1, 1);
        }
      }
      ctx.globalAlpha = 1;
    });
  }
  // Springs, two poses each (rest, squashed) and a breathing in-between for the flower.
  for (const [k, squash] of [[0, 0], [1, 3], [2, 1]] as const) {
    if (theme === 'jungle') {
      // The bounce flower: a stem with two leaves, a scalloped bowl of petals, and a
      // glowing nectar pad on top (what you bounce on). Squashing flattens the bowl.
      canvas(scene, `spring_${theme}_${k}`, TILE, TILE, (ctx) => {
        const top = 3 + squash; // top of the petals
        const ry = 4 - squash * 0.6;
        const bowl = (x: number, y: number) =>
          (((x - 8) / 7.4) ** 2 + ((y - (top + 3)) / ry) ** 2 <= 1 && y >= top + 1) ||
          [2.5, 8, 13.5].some((cx) => (x - cx) ** 2 + (y - (top + 1.5)) ** 2 <= 5);
        const leaf = (x: number, y: number) => ((x - 3.8) / 3.8) ** 2 + ((y - 12.5) / 2.3) ** 2 <= 1 || ((x - 12.2) / 3.8) ** 2 + ((y - 11.5) / 2.3) ** 2 <= 1;
        const stem = (x: number, y: number) => x >= 6 && x <= 10 && y >= top + 5;
        const fill = (inside: (x: number, y: number) => boolean, ramp: [string, string, string, string]) => {
          const at = (x: number, y: number) => x >= 0 && y >= 0 && x < TILE && y < TILE && inside(x + 0.5, y + 0.5);
          for (let y = 0; y < TILE; y++)
            for (let x = 0; x < TILE; x++) {
              if (!at(x, y)) continue;
              const edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
              px(ctx, edge ? K : !at(x, y - 2) ? ramp[3] : !at(x, y + 2) ? ramp[0] : y < (top + 3) ? ramp[2] : ramp[1], x, y);
            }
        };
        fill(stem, ['#1c4a20', '#2e7a34', '#5ab84a', '#9ae06a']);
        fill(leaf, ['#1c4a20', '#2e7a34', '#5ab84a', '#9ae06a']);
        fill(bowl, ['#7a1a3a', '#c83a6a', '#ff7aa8', '#ffc0d8']);
        // Petal seams, and the glowing nectar pad.
        for (const x of [5, 11]) px(ctx, '#982030', x, top + 3, 1, Math.max(1, 2 - squash));
        px(ctx, K, 4, top + 1, 8, 2);
        px(ctx, '#ffe14a', 5, top + 1, 6, 1);
        px(ctx, '#fff1a0', 6, top + 1, 2, 1);
        px(ctx, '#f8c020', 5, top + 2, 6, 1);
      });
    } else {
      // A coil spring that compresses.
      canvas(scene, `spring_${theme}_${k}`, TILE, TILE, (ctx) => {
        px(ctx, K, 0, 11, TILE, 5);
        px(ctx, '#3a3f56', 1, 12, TILE - 2, 3);
        px(ctx, '#8a8fa8', 1, 12, TILE - 2, 1);
        const top = squash * 2;
        for (const y of [5 + squash, 8 + Math.floor(squash / 2)]) {
          px(ctx, K, 3, y, 10, 3);
          px(ctx, '#e8eef8', 4, y, 8, 1);
          px(ctx, '#8a98b8', 4, y + 1, 8, 1);
        }
        px(ctx, K, 0, top, TILE, 5);
        px(ctx, '#d83a4a', 1, top + 1, TILE - 2, 3);
        px(ctx, '#ff8aa8', 1, top + 1, TILE - 2, 1);
        px(ctx, '#ffffff', 3, top + 1, 3, 1);
      });
    }
  }
  // Conveyor chevrons on the moving belt (4 frames, both directions).
  for (const dir of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      canvas(scene, `belt_${dir}_${k}`, TILE, 6, (ctx) => {
        px(ctx, K, 0, 0, TILE, 1);
        px(ctx, '#3a3a44', 0, 1, TILE, 5);
        px(ctx, '#5a5a66', 0, 1, TILE, 1);
        for (let i = -1; i < 3; i++) {
          const cx = ((i * 7 + dir * k * 2) % 14 + 14) % 14;
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
      });
    }
  }
  // Heat glow over a lava surface: clear at the top, warm at the bottom.
  canvas(scene, `lava_glow_${theme}`, TILE, TILE, (ctx) => {
    for (let y = 0; y < TILE; y++) {
      ctx.globalAlpha = (y / TILE) ** 2 * 0.45;
      px(ctx, ll, 0, y, TILE, 1);
    }
    ctx.globalAlpha = 1;
  });
  canvas(scene, 'ember', 3, 3, (ctx) => {
    px(ctx, '#ff8a2a', 0, 0, 3, 3);
    px(ctx, '#fff0a0', 1, 1, 1, 1);
  });
}

interface Cell {
  c: number;
  r: number;
  img: Phaser.GameObjects.Image;
}

export class TileFx {
  private lava: (Cell & { top: boolean; glow: Phaser.GameObjects.Image | null })[] = [];
  private ice: Cell[] = [];
  private water: Cell[] = [];
  private springs: (Cell & { up: Phaser.GameObjects.Image; squashT: number })[] = [];
  private belts: (Cell & { dir: number })[] = [];
  private embers: { img: Phaser.GameObjects.Image; vx: number; vy: number; life: number }[] = [];

  constructor(
    private scene: Phaser.Scene,
    private level: Level,
    private theme: ThemeId,
    /** Hide the static tile under an overlay that replaces it (lava, springs). */
    hideTile: (c: number, r: number) => void,
  ) {
    makeFrames(scene, theme);
    const L = level;
    const add = (c: number, r: number, key: string, depth: number, h = TILE) => scene.add.image(c * TILE, r * TILE, key).setOrigin(0, 0).setDepth(depth).setDisplaySize(TILE, h);
    for (let r = 0; r < L.rows; r++)
      for (let c = 0; c < L.cols; c++) {
        const t = L.tileAt(c, r);
        if (t === Tile.Lava) {
          const top = L.tileAt(c, r - 1) !== Tile.Lava;
          const glow = top && L.tileAt(c, r - 1) === Tile.Empty ? add(c, r - 1, `lava_glow_${theme}`, 0.15).setBlendMode(Phaser.BlendModes.ADD) : null;
          this.lava.push({ c, r, top, glow, img: add(c, r, `lava_body_${theme}_0`, 0.2) });
          hideTile(c, r);
        } else if (t === Tile.Ice || t === Tile.Melt) {
          this.ice.push({ c, r, img: add(c, r, 'ice_glint_0', 0.2).setVisible(false) });
        } else if (isWaterTile(t) && !isWaterTile(L.tileAt(c, r - 1)) && L.tileAt(c, r - 1) !== Tile.Solid) {
          this.water.push({ c, r, img: add(c, r, 'water_shine_0', 15.2, 4) });
        } else if (t === Tile.Spring) {
          this.springs.push({ c, r, img: add(c, r, `spring_${theme}_0`, 0.2), up: add(c, r - 1, 'spring_up_0', 3).setAlpha(0.8), squashT: 0 });
          hideTile(c, r);
        } else if (t === Tile.ConveyorL || t === Tile.ConveyorR) {
          this.belts.push({ c, r, dir: t === Tile.ConveyorR ? 1 : -1, img: add(c, r, 'belt_1_0', 0.2, 6) });
        }
      }
  }

  /** A spring at this cell was just bounced on: squash it and burst its chevrons. */
  springPop(c: number, r: number): void {
    const s = this.springs.find((x) => x.r === r && Math.abs(x.c - c) <= 1);
    if (s) s.squashT = 10;
  }

  /** One step: frames advance, embers drift. `frame` counts steps; the view is in world pixels. */
  step(frame: number, view: { x: number; y: number; w: number; h: number }): void {
    const near = (c: number, r: number) => c * TILE > view.x - TILE && c * TILE < view.x + view.w && r * TILE > view.y - TILE && r * TILE < view.y + view.h;
    if (frame % 5 === 0) {
      const k = Math.floor(frame / 5);
      for (const l of this.lava) {
        if (!near(l.c, l.r)) continue;
        const f = (k + l.c * 3 + l.r) % FRAMES;
        l.img.setTexture(l.top ? `lava_top_${this.theme}_${f}` : `lava_body_${this.theme}_${f}`);
        l.glow?.setAlpha(0.65 + Math.sin(k * 0.5 + l.c * 0.7) * 0.35);
      }
      for (const w of this.water) if (near(w.c, w.r)) w.img.setTexture(`water_shine_${(k + w.c) % FRAMES}`);
    }
    if (frame % 3 === 0) {
      // The glint travels along the ice: each slab catches it a beat after its neighbour.
      const k = Math.floor(frame / 3);
      for (const i of this.ice) {
        const t = this.level.tileAt(i.c, i.r);
        if (t !== Tile.Ice && t !== Tile.Melt) {
          i.img.setVisible(false); // melted
          continue;
        }
        const f = (k - i.c * 2 - i.r * 3 + 1000 * 48) % 48;
        i.img.setVisible(f < FRAMES && near(i.c, i.r));
        if (f < FRAMES) i.img.setTexture(`ice_glint_${f}`);
      }
      for (const b of this.belts) if (near(b.c, b.r)) b.img.setTexture(`belt_${b.dir}_${k % 4}`);
    }
    for (const s of this.springs) {
      if (s.squashT > 0) s.squashT--;
      const breathe = Math.floor(frame / 20) % 2 === 0 ? 0 : 2;
      s.img.setTexture(`spring_${this.theme}_${s.squashT > 0 ? 1 : breathe}`);
      s.up.setTexture(`spring_up_${Math.floor(frame / 4) % FRAMES}`).setAlpha(s.squashT > 0 ? 1 : 0.75);
    }
    // Embers rise off lava in view.
    if (frame % 5 === 0 && this.lava.length) {
      const tops = this.lava.filter((l) => l.top && near(l.c, l.r));
      if (tops.length) {
        const l = tops[Math.floor(Math.random() * tops.length)];
        const img = this.scene.add.image(l.c * TILE + Math.random() * TILE, l.r * TILE + 2, 'ember').setDepth(14);
        this.embers.push({ img, vx: (Math.random() - 0.5) * 0.3, vy: -0.4 - Math.random() * 0.5, life: 50 + Math.floor(Math.random() * 30) });
      }
    }
    for (const e of this.embers) {
      e.life--;
      e.img.x += e.vx + Math.sin((e.life + e.img.y) / 9) * 0.15;
      e.img.y += e.vy;
      e.img.setAlpha(Math.min(1, e.life / 25));
      if (e.life <= 0) e.img.destroy();
    }
    this.embers = this.embers.filter((e) => e.life > 0);
  }
}
