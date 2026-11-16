// Hero sprite sheet generator.
//
//   npm run sprites
//
// Writes:
//   public/assets/hero.png   one row of 24x24 frames, in the arm-cannon colors
//   public/assets/hero.json  frame name -> index
//   art/hero-preview.png     every frame, 6x, in every weapon palette (for looking at)
//
// The art is built from parts (head, torso, arms, legs) drawn as text grids,
// then layered into frames, so every frame stays consistent. The game recolors
// the sheet per weapon at load (see BootScene), swapping the armor and suit
// colors below, so keep those exact RGB values in sync with src/weapons.ts.
//
// Palette characters:
//   .  transparent        K  outline
//   Z  armor shine        L  armor light    O  armor     o  armor shade   D  armor deep
//   X  suit dark
//   S  suit               s  suit light
//   V  visor              v  visor shade    W  white glint
//   G  metal              g  metal shade

import { Bitmap, drawGrid, encodePNG, write } from './lib.mjs';

const FRAME = 24;

const PALETTE = {
  K: 0x1a1428,
  Z: 0xffe4b0, // armor shine
  L: 0xffc070,
  O: 0xf28c28,
  o: 0xb85a1a,
  S: 0x2b2540,
  s: 0x4a4068,
  X: 0x1e1a30, // suit dark
  D: 0x7a3410, // armor deep shadow
  V: 0x5ef0c8,
  v: 0x2aa088,
  W: 0xfff1e0,
  G: 0x8a8fa8,
  g: 0x55607a,
};

// Weapon palettes, only for the preview image (the game reads src/weapons.ts).
const PREVIEW_PALETTES = {
  buster: {},
  quake: { L: 0xf4f6fb, O: 0xc8ccd8, o: 0x8a8fa8, S: 0x9c2f3f, s: 0xc8505f },
};

// --- parts -------------------------------------------------------------------

const P = {
  // Helmet facing right: shine streak, round ear disc, two-tone visor with a glint.
  head: [
    '....KKKKK...',
    '..KKZLLOOKK.',
    '.KZLLOOOOOoK',
    'KZLOOOOOOOoK',
    'KLOOOKKKKKKK',
    'KOGgOKWVVVVK',
    'KoggOKVVVVvK',
    'KoOOKKvvvvvK',
    '.KDooooKKKK.',
    '..KKKKKSSK..',
  ],
  headBack: [
    '....KKKKK...',
    '..KKZLLOOKK.',
    '.KZLLOOOOOoK',
    'KZLOOOOOOOoK',
    'KLOOOOOOOOoK',
    'KOOOOOOOOOoK',
    'KoOOOKKOOOoK',
    'KoOOOOOOOooK',
    '.KDooooooDK.',
    '..KKKKKKKK..',
  ],
  // Chest plate with a diamond core gem; belt with a buckle.
  torso: [
    '.KKKKKKKKKK.',
    'KZLLOOOOOOoK',
    'KLOOOOVOOOoK',
    'KoOOOVWVOOoK',
    'KDooooVoooDK',
    'KSSsSGGSSSXK',
    '.KKKKKKKKKK.',
  ],
  torsoBack: [
    '.KKKKKKKKKK.',
    'KZLLOOOOOOoK',
    'KLOOOOOOOOoK',
    'KoOOOOOOOOoK',
    'KDooooooooDK',
    'KSSsSSSSSSXK',
    '.KKKKKKKKKK.',
  ],
  armBack: ['KKK.', 'KoDK', 'KDDK', 'KXXK', 'KoDK', 'KDDK', 'KKK.'],
  armFront: ['.KK.', 'KZLK', 'KOoK', 'KSXK', 'KLOK', 'KZOK', 'KOoK', '.KK.'],
  armUp: ['.KK.', 'KLOK', 'KZoK', 'KOoK', 'KSXK', 'KLOK', 'KOoK', 'KOoK', '.KK.'],
  // Ringed barrel with a bright top edge.
  cannon: [
    '.....KKKKKK.',
    'KKKKKGWWGGGK',
    'KZLOKGGGgGgK',
    'KoODKgGgggKK',
    'KKKKKgggggK.',
    '.....KKKKK..',
  ],
  legsIdle: [
    '.KSXK..KSXK.',
    '.KsSK..KsSK.',
    '.KZLK..KZLK.',
    'KZLOOKKZLOOK',
    'KLOOoKKLOOoK',
    'KDooDKKDooDK',
    'KKKKKKKKKKKK',
  ],
  legsRunA: [
    '...KSXK.KSXK....',
    '..KsSK...KsSK...',
    '.KZLK.....KZLK..',
    'KZLOK.....KZLOOK',
    'KLOoK.....KLOOoK',
    'KDoDK.....KDooDK',
    'KKKKK.....KKKKKK',
  ],
  legsRunB: [
    '.....KSXKSXK....',
    '.....KsSKsSK....',
    '......KZLLOK....',
    '.....KZLOOOK....',
    '.....KLOOOoK....',
    '.....KDoooDK....',
    '.....KKKKKKK....',
  ],
  legsRunC: [
    '....KSXKKSXK....',
    '...KsSK..KsSK...',
    '..KZLK....KZLK..',
    '.KZOK.....KZLOOK',
    'KOoK......KLOOoK',
    'KKKK......KDooDK',
    '..........KKKKKK',
  ],
  legsJump: [
    '..KSXK.KSXK..',
    '.KsSK...KsSK.',
    'KZLK....KZLK.',
    'KLOOK...KLOOK',
    'KDooK...KDooK',
    'KKKKK...KKKKK',
  ],
  legsClimb: [
    '.KSXK..KSXK.',
    '.KsSK..KsSK.',
    '.KSXK..KZLK.',
    '.KZLK..KDoK.',
    'KZLOK..KKKK.',
    'KDooK.......',
    'KKKKK.......',
  ],
};

// Visor goes white when hit.
const HURT_FACE = { V: 'W', v: 'W' };

// --- frames ------------------------------------------------------------------
// Each frame is a list of [part, x, y, charMap?], drawn in order (back to front).
// Frames face right; the game flips them for facing left.

function body(legs, { shoot = false, front = ['armFront', 15, 12], legsAt = [6, 17], head = 'head', torso = 'torso', face } = {}) {
  return [
    ['armBack', 4, 12],
    [legs, ...legsAt],
    [head, 6, 2, face],
    [torso, 6, 11],
    shoot ? ['cannon', 12, 12] : front,
  ];
}

const run = (legs, shoot) => body(legs, { shoot, legsAt: [4, 17] });
const jump = (shoot) => body('legsJump', { shoot, legsAt: [5, 16], front: ['armUp', 17, 5] });

const FRAMES = {
  idle: body('legsIdle'),
  idle_s: body('legsIdle', { shoot: true }),
  run1: run('legsRunA'),
  run2: run('legsRunB'),
  run3: run('legsRunC'),
  run1_s: run('legsRunA', true),
  run2_s: run('legsRunB', true),
  run3_s: run('legsRunC', true),
  jump: jump(false),
  jump_s: jump(true),
  climb: [
    ['armUp', 3, 5],
    ['legsClimb', 6, 17],
    ['headBack', 6, 2],
    ['torsoBack', 6, 11],
    ['armFront', 15, 12],
  ],
  climb_s: body('legsClimb', { shoot: true }),
  hurt: [
    ['armUp', 3, 5],
    ['legsRunA', 4, 17],
    ['head', 6, 2, HURT_FACE],
    ['torso', 6, 11],
    ['armUp', 17, 5],
  ],
};

// --- rendering -----------------------------------------------------------------

function drawPart(bmp, name, ox, oy, charMap, palette) {
  const rows = P[name];
  if (!rows) throw new Error(`Unknown part "${name}"`);
  drawGrid(bmp, `Part "${name}"`, rows, ox, oy, (c) => palette[c] ?? PALETTE[c], { map: charMap });
}

/**
 * 16-bit finish for the hero, using only colors already in the palette (the
 * game swaps them per weapon, so no new colors may appear): armor gets lit
 * top edges and a dithered shade toward its lower edge; the suit gets lit top
 * edges; metal and visor get shaded bottoms.
 */
function heroShade(bmp, palette) {
  const col = (ch) => palette[ch] ?? PALETTE[ch];
  const [K, L, O, o, S, s, G, g, V, v] = ['K', 'L', 'O', 'o', 'S', 's', 'G', 'g', 'V', 'v'].map(col);
  const src = new Bitmap(bmp.w, bmp.h);
  bmp.data.copy(src.data);
  const at = (x, y) => (x < 0 || y < 0 || x >= bmp.w || y >= bmp.h ? null : src.get(x, y));
  const edge = (c) => c === null || c === K;
  for (let y = 0; y < bmp.h; y++) {
    for (let x = 0; x < bmp.w; x++) {
      const c = at(x, y);
      if (c === null || c === K) continue;
      const up = at(x, y - 1);
      const down = at(x, y + 1);
      if (c === O) {
        if (edge(up)) bmp.set(x, y, L);
        else if (edge(down)) bmp.set(x, y, o);
        else if (edge(at(x, y + 2)) && (x + y) % 2 === 0) bmp.set(x, y, o);
      } else if (c === S && edge(up)) bmp.set(x, y, s);
      else if (c === G && edge(down)) bmp.set(x, y, g);
      else if (c === V && edge(down)) bmp.set(x, y, v);
    }
  }
}

function drawFrame(bmp, frame, fx, fy, palette, scale = 1) {
  const tmp = new Bitmap(FRAME, FRAME);
  for (const [part, x, y, map] of frame) drawPart(tmp, part, x, y, map, palette);
  for (let y = 0; y < FRAME; y++) {
    for (let x = 0; x < FRAME; x++) {
      const i = (y * FRAME + x) * 4;
      if (!tmp.data[i + 3]) continue;
      const rgb = (tmp.data[i] << 16) | (tmp.data[i + 1] << 8) | tmp.data[i + 2];
      for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) bmp.set(fx + x * scale + sx, fy + y * scale + sy, rgb);
    }
  }
}

// --- outputs -----------------------------------------------------------------

const names = Object.keys(FRAMES);

const sheet = new Bitmap(FRAME * names.length, FRAME);
names.forEach((n, i) => drawFrame(sheet, FRAMES[n], i * FRAME, 0, {}));
write('public/assets/hero.png', encodePNG(sheet));
write(
  'public/assets/hero.json',
  Buffer.from(JSON.stringify({ frameWidth: FRAME, frameHeight: FRAME, frames: Object.fromEntries(names.map((n, i) => [n, i])) }, null, 2) + '\n'),
);

const SCALE = 6;
const GAP = 6;
const cell = FRAME * SCALE + GAP;
const palettes = Object.entries(PREVIEW_PALETTES);
const preview = new Bitmap(cell * names.length + GAP, cell * palettes.length + GAP);
preview.fill(0x4a5578);
palettes.forEach(([, pal], row) => {
  names.forEach((n, i) => drawFrame(preview, FRAMES[n], GAP + i * cell, GAP + row * cell, pal, SCALE));
});
write('art/hero-preview.png', encodePNG(preview));
