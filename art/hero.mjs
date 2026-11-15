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
//   L  armor light        O  armor          o  armor shade
//   S  suit               s  suit light
//   V  visor              v  visor shade    W  white glint
//   G  metal              g  metal shade

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FRAME = 24;

const PALETTE = {
  K: 0x1a1428,
  L: 0xffc070,
  O: 0xf28c28,
  o: 0xb85a1a,
  S: 0x2b2540,
  s: 0x4a4068,
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
  head: [
    '...KKKK.....',
    '..KLLOOKK...',
    '.KLLOOOOOKK.',
    '.KLOOOOOOOOK',
    'KLOOOOKKKKKK',
    'KOooOKVVVVVK',
    'KoLLoKVWVVvK',
    'KOooOKvvvvvK',
    '.KooooKKKKK.',
    '..KKKKSSK...',
  ],
  headBack: [
    '....KKKK....',
    '..KKLLOOKK..',
    '.KLLOOOOOOK.',
    '.KLOOOOOOoK.',
    'KLOOOOOOOOoK',
    'KOOOOOOOOOoK',
    'KOOOOOOOOOoK',
    'KoOOOOOOOooK',
    '.KooooooooK.',
    '..KKKKKKKK..',
  ],
  torso: [
    '.KKKKKKKKKK.',
    'KOOLLOOOOOoK',
    'KOOOOVVOOOoK',
    'KoOOOVvOOOoK',
    'KSSSSSSSSSSK',
    'KSsSGGSSSSsK',
    '.KKKKKKKKKK.',
  ],
  torsoBack: [
    '.KKKKKKKKKK.',
    'KOOLLOOOOOoK',
    'KOOOOOOOOOoK',
    'KoOOOOOOOOoK',
    'KSSSSSSSSSSK',
    'KSsSSSSSSSsK',
    '.KKKKKKKKKK.',
  ],
  armBack: [
    'KKK.',
    'KooK',
    'KooK',
    'KSSK',
    'KooK',
    'KooK',
    'KKK.',
  ],
  armFront: [
    '.KK.',
    'KOOK',
    'KOOK',
    'KSSK',
    'KOOK',
    'KLOK',
    'KOOK',
    '.KK.',
  ],
  armUp: [
    '.KK.',
    'KOOK',
    'KLOK',
    'KOOK',
    'KSSK',
    'KOOK',
    'KOOK',
    'KOOK',
    '.KK.',
  ],
  cannon: [
    '.....KKKKKK.',
    'KKKKKGGGGGGK',
    'KOOOKGWGGGgK',
    'KoOOKGGGGGgK',
    'KKKKKgggggKK',
    '.....KKKKK..',
  ],
  legsIdle: [
    '.KSSK..KSSK.',
    '.KSsK..KSsK.',
    '.KSSK..KSSK.',
    '.KLOK..KLOK.',
    'KLOOOKKLOOOK',
    'KoooOKKoooOK',
    'KKKKKKKKKKKK',
  ],
  legsRunA: [
    '...KSSK.KSSK....',
    '..KSsK...KSsK...',
    '.KSSK.....KSSK..',
    'KLOK.......KLOK.',
    'KOOOK.....KLOOOK',
    'KoooK.....KoooOK',
    'KKKKK.....KKKKKK',
  ],
  legsRunB: [
    '.....KSSKSSK....',
    '.....KSsKSsK....',
    '......KSSSSK....',
    '......KLOOK.....',
    '.....KLOOOOK....',
    '.....KoooOOK....',
    '.....KKKKKKK....',
  ],
  legsRunC: [
    '....KSSKKSSK....',
    '...KSsK..KSSK...',
    '..KSSK....KSSK..',
    '.KLOK.....KLOK..',
    'KOOK......KLOOOK',
    'KKKK......KoooOK',
    '..........KKKKKK',
  ],
  legsJump: [
    '..KSSK.KSSK..',
    '.KSsK...KSsK.',
    'KLOK....KLOK.',
    'KOOOK...KOOOK',
    'KoooK...KoooK',
    'KKKKK...KKKKK',
  ],
  legsClimb: [
    '.KSSK..KSSK.',
    '.KSsK..KSsK.',
    '.KSSK..KLOK.',
    '.KLOK..KOOK.',
    'KLOOK..KKKK.',
    'KoooK.......',
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

class Bitmap {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = Buffer.alloc(w * h * 4);
  }
  set(x, y, rgb) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = (rgb >> 16) & 255;
    this.data[i + 1] = (rgb >> 8) & 255;
    this.data[i + 2] = rgb & 255;
    this.data[i + 3] = 255;
  }
}

function drawPart(bmp, name, ox, oy, charMap, palette) {
  const rows = P[name];
  if (!rows) throw new Error(`Unknown part "${name}"`);
  const w = rows[0].length;
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`Part "${name}" row ${y} is ${row.length} wide, expected ${w}`);
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const c = charMap?.[ch] ?? ch;
      const rgb = palette[c] ?? PALETTE[c];
      if (rgb === undefined) throw new Error(`Part "${name}": unknown color "${ch}"`);
      bmp.set(ox + x, oy + y, rgb);
    });
  });
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

// --- PNG encoding (no dependencies) ------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(bmp) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(bmp.w, 0);
  ihdr.writeUInt32BE(bmp.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = bmp.w * 4;
  const raw = Buffer.alloc((stride + 1) * bmp.h);
  for (let y = 0; y < bmp.h; y++) bmp.data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function write(path, buf) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
  console.log(`wrote ${path.replace(ROOT + '/', '')}`);
}

// --- outputs -----------------------------------------------------------------

const names = Object.keys(FRAMES);

const sheet = new Bitmap(FRAME * names.length, FRAME);
names.forEach((n, i) => drawFrame(sheet, FRAMES[n], i * FRAME, 0, {}));
write(join(ROOT, 'public/assets/hero.png'), encodePNG(sheet));
write(
  join(ROOT, 'public/assets/hero.json'),
  Buffer.from(JSON.stringify({ frameWidth: FRAME, frameHeight: FRAME, frames: Object.fromEntries(names.map((n, i) => [n, i])) }, null, 2) + '\n'),
);

const SCALE = 6;
const GAP = 6;
const cell = FRAME * SCALE + GAP;
const palettes = Object.entries(PREVIEW_PALETTES);
const preview = new Bitmap(cell * names.length + GAP, cell * palettes.length + GAP);
for (let i = 0; i < preview.w * preview.h; i++) preview.data.writeUInt32BE(0x4a5578ff, i * 4);
palettes.forEach(([, pal], row) => {
  names.forEach((n, i) => drawFrame(preview, FRAMES[n], GAP + i * cell, GAP + row * cell, pal, SCALE));
});
write(join(ROOT, 'art/hero-preview.png'), encodePNG(preview));
