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

import { Bitmap, encodePNG, write } from './lib.mjs';

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
  // Fighting poses (Shade's duel).
  armPunch: ['KKKKKKK.', 'KOOOOOLK', 'KoOOOOOK', 'KKKKKKK.'],
  legsKick: [
    '.KSXK.' + 'K'.repeat(11) + '.',
    '.KsSKK' + 'SSSSSSSXZOO' + 'K',
    '.KZLK.' + 'K'.repeat(11) + '.',
    'KZLOOK' + '.'.repeat(12),
    'KLOOoK' + '.'.repeat(12),
    'KDooDK' + '.'.repeat(12),
    'KKKKKK' + '.'.repeat(12),
  ],
  legsCrouch: ['.KZLK..KZLK.', 'KZLOOKKZLOOK', 'KDooDKKDooDK', 'KKKKKKKKKKKK'],
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

// Classic+ body parts (hand-drawn): a slimmer chest plate over an undersuit
// belly, front and back views. The limbs are drawn by the rig below.
P.chest = [
  '.KKKKKKK.',
  'KZLLLOOoK',
  'KLOOOVOoK',
  'KoOOVWVoK',
  'KDooDvDDK',
  'KXSSsSSXK',
  'KSSSGGSXK',
  '.KKKKKKK.',
];
P.chestBack = [
  '.KKKKKKK.',
  'KZLLLOOoK',
  'KLOOOOOoK',
  'KoOOOOOoK',
  'KDooooDDK',
  'KXSSsSSXK',
  'KSSSSSSXK',
  '.KKKKKKK.',
];

// --- the rig ---------------------------------------------------------------------------
// Frames are posed by a small skeleton (hips, knees, ankles, shoulders, elbows,
// hands) and drawn into a character buffer: the hand-drawn head and chest ride
// on the body, and the limbs are filled shapes, shaded top-light/bottom-dark
// and outlined against whatever is behind them. Everything uses the palette
// characters above, so weapon recolors still work.

const RAMP = {
  armor: { shine: 'Z', light: 'L', base: 'O', dark: 'o' },
  armorBack: { shine: 'L', light: 'O', base: 'o', dark: 'D' },
  suit: { shine: 's', light: 's', base: 'S', dark: 'X' },
  suitBack: { shine: 'S', light: 'S', base: 'X', dark: 'X' },
  metal: { shine: 'W', light: 'G', base: 'G', dark: 'g' },
};

class CharBuf {
  constructor() {
    this.c = new Array(FRAME * FRAME).fill('.');
  }
  get(x, y) {
    return x < 0 || y < 0 || x >= FRAME || y >= FRAME ? '.' : this.c[y * FRAME + x];
  }
  set(x, y, ch) {
    if (x >= 0 && y >= 0 && x < FRAME && y < FRAME) this.c[y * FRAME + x] = ch;
  }
  /** A filled shape, shaded, outlined on the side of anything already drawn behind it. */
  shape(inside, ramp, { shine = true } = {}) {
    const m = new Uint8Array(FRAME * FRAME);
    for (let y = 0; y < FRAME; y++) for (let x = 0; x < FRAME; x++) if (inside(x + 0.5, y + 0.5)) m[y * FRAME + x] = 1;
    const at = (x, y) => x >= 0 && y >= 0 && x < FRAME && y < FRAME && m[y * FRAME + x] === 1;
    for (let y = 0; y < FRAME; y++)
      for (let x = 0; x < FRAME; x++) {
        if (!at(x, y)) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (!at(nx, ny) && this.get(nx, ny) !== '.') this.set(nx, ny, 'K');
        }
      }
    for (let y = 0; y < FRAME; y++)
      for (let x = 0; x < FRAME; x++) {
        if (!at(x, y)) continue;
        let ch = ramp.base;
        if (!at(x, y - 1)) ch = shine && !at(x - 1, y) ? ramp.shine : ramp.light;
        else if (!at(x, y + 1)) ch = ramp.dark;
        else if (!at(x, y + 2) && (x + y) % 2 === 0) ch = ramp.dark;
        this.set(x, y, ch);
      }
  }
  /** A hand-drawn part (its own outline included), top-left at (x, y). */
  grid(name, x, y, map) {
    const rows = P[name];
    rows.forEach((row, ry) =>
      [...row].forEach((ch, rx) => {
        if (ch !== '.') this.set(Math.round(x) + rx, Math.round(y) + ry, map?.[ch] ?? ch);
      }),
    );
  }
  /** Close the silhouette with an outline. */
  outline() {
    const out = this.c.slice();
    for (let y = 0; y < FRAME; y++)
      for (let x = 0; x < FRAME; x++) {
        if (this.get(x, y) !== '.') continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !'.K'.includes(this.get(x + dx, y + dy)))) out[y * FRAME + x] = 'K';
      }
    this.c = out;
  }
}

const capsule = (ax, ay, bx, by, r) => (x, y) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - ax - dx * t, y - ay - dy * t) <= r;
};
const ellipse = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const rrect = (x0, y0, x1, y1, rad = 1) => (x, y) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.max(x0 + rad, Math.min(x1 - rad, x));
  const cy = Math.max(y0 + rad, Math.min(y1 - rad, y));
  return Math.hypot(x - cx, y - cy) <= rad + 0.01;
};

/** Two-bone IK: the middle joint, bending toward +x (bend 1) or -x (bend -1). */
function ik(hx, hy, fx, fy, a, b, bend) {
  const d = Math.min(Math.hypot(fx - hx, fy - hy), a + b - 0.01);
  const base = Math.atan2(fy - hy, fx - hx);
  const alpha = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
  const ang = base - bend * alpha;
  return [hx + Math.cos(ang) * a, hy + Math.sin(ang) * a];
}

// Body measurements (pixels), facing right.
const B = { ground: 23, hipX: 11, thigh: 2.9, shin: 2.9, legR: 1.5, bootH: 3, footLen: 3, torsoH: 6, upper: 3.2, fore: 3, armR: 1.3, padR: 1.9 };
const ANKLE = B.ground - B.bootH + 1;
const LEG = B.thigh + B.shin;
const STAND_HIP = B.ground - B.bootH - LEG * 0.95;

/**
 * A pose: hip height offset (`bob`, + is down), lean, head lag, each foot's
 * ankle position, each arm's swing angle (0 = hanging, + = forward) and elbow bend.
 */
function pose({ bob = 0, lean = 0, headLag = 0, feet, arms, bends = [0.35, 0.35], shoot = false, face, back = false, armUp = null, armBehind = false }) {
  const b = new CharBuf();
  const hipX = B.hipX;
  const hipY = STAND_HIP + bob;
  const shoulderX = hipX + lean;
  const shoulderY = hipY - B.torsoH + 1;

  // Three-quarter view: the hips and shoulders sit apart, so limbs move beside the body, not across it.
  const leg = ([fx, fy], isBack) => {
    const hx = hipX + (isBack ? -1.2 : 1.2);
    const [kx, ky] = ik(hx, hipY, fx, fy, B.thigh, B.shin, 1);
    b.shape(capsule(hx, hipY, kx, ky, B.legR), isBack ? RAMP.suitBack : RAMP.suit);
    b.shape(capsule(kx, ky, fx, fy, B.legR + 0.3), isBack ? RAMP.armorBack : RAMP.armor);
    b.shape(rrect(fx - B.legR - 0.6, fy - 1, fx + B.footLen, fy + B.bootH - 1, 1), isBack ? RAMP.armorBack : RAMP.armor);
  };
  const arm = (swing, bend, isBack) => {
    const sx = shoulderX + (isBack ? -3.2 : 3.4);
    const sy = shoulderY + 1.5;
    const ramp = isBack ? RAMP.armorBack : RAMP.armor;
    if (shoot && !isBack) {
      // Arm cannon straight out (the hand-drawn barrel).
      b.grid('cannon', Math.round(sx) - 3, Math.round(sy) - 2);
      return;
    }
    const ex = sx + Math.sin(swing) * B.upper;
    const ey = sy + Math.cos(swing) * B.upper;
    const hx = ex + Math.sin(swing + bend) * B.fore;
    const hy = ey + Math.cos(swing + bend) * B.fore;
    b.shape(capsule(sx, sy, ex, ey, B.armR), isBack ? RAMP.suitBack : RAMP.suit);
    b.shape(capsule(ex, ey, hx, hy, B.armR + 0.4), ramp);
    b.shape(ellipse(sx, sy - 0.5, B.padR, B.padR * 0.85), ramp);
  };

  arm(arms[1], bends[1], true);
  leg(feet[1], true);
  leg(feet[0], false);
  if (armBehind) arm(arms[0], bends[0], false);
  b.grid(back ? 'chestBack' : 'chest', Math.round(hipX - 4 + lean * 0.5), Math.round(shoulderY - 1));
  b.grid(back ? 'headBack' : 'head', Math.round(shoulderX - 6 + (back ? 0 : 1)), Math.max(0, Math.round(shoulderY - 9 + headLag)), face);
  if (armUp !== null) arm(armUp, 0.3, false);
  else if (!armBehind) arm(arms[0], bends[0], false);
  b.outline();
  return b;
}

// --- the animations -------------------------------------------------------------------

const RUN_FRAMES = 8;
const STRIDE = 3.6;
const LIFT = 2.6;

/** Run cycle at phase t (0..1): legs on a stride loop, arms opposite, a bob on each footfall, the head a beat behind. */
function runPose(t, shoot) {
  const p = t * Math.PI * 2;
  const bob = (Math.cos(2 * p) + 1) / 2;
  const headBob = (Math.cos(2 * (p - 0.7)) + 1) / 2;
  const feet = [p, p + Math.PI].map((q) => [B.hipX + STRIDE * Math.sin(q) - 0.5, Math.cos(q) < 0 ? ANKLE : ANKLE - LIFT * Math.cos(q)]);
  const arms = [p + Math.PI, p].map((q) => 0.8 * Math.sin(q));
  return pose({ bob, lean: 1, headLag: Math.round(headBob - bob), feet, arms, bends: [0.75, 0.7], shoot });
}

/** Idle: a slow breath (the body sinks a pixel, the head follows a beat later). */
function idlePose(t, shoot) {
  const p = t * Math.PI * 2;
  const bob = Math.round((Math.sin(p) + 1) / 2);
  const head = Math.round((Math.sin(p - 0.9) + 1) / 2);
  return pose({ bob, headLag: head - bob, feet: [[B.hipX + 2.2, ANKLE], [B.hipX - 2.2, ANKLE]], arms: [0.08, -0.08], bends: [0.12, 0.12], shoot });
}

const FRAMES = {};
for (let i = 0; i < 4; i++) {
  FRAMES[`idle${i + 1}`] = idlePose(i / 4, false);
  FRAMES[`idle${i + 1}_s`] = idlePose(i / 4, true);
}
for (let i = 0; i < RUN_FRAMES; i++) {
  FRAMES[`run${i + 1}`] = runPose(i / RUN_FRAMES, false);
  FRAMES[`run${i + 1}_s`] = runPose(i / RUN_FRAMES, true);
}
// Rising: front knee up, back leg trailing, arms thrown up. Falling: legs reach down, arms out.
const jumpPose = (shoot) => pose({ bob: -0.5, lean: 0.5, feet: [[B.hipX + 2.5, ANKLE - 5], [B.hipX - 2.5, ANKLE - 2]], arms: [1.6, -1.1], bends: [0.6, 0.9], shoot });
const fallPose = (shoot) => pose({ bob: -0.5, headLag: 1, feet: [[B.hipX + 1.8, ANKLE - 1], [B.hipX - 1.8, ANKLE - 2.5]], arms: [2.2, -2.0], bends: [0.4, -0.4], shoot });
// Landing: knees give, head comes down after the body.
const landPose = (shoot) => pose({ bob: 2, headLag: 1, feet: [[B.hipX + 3, ANKLE], [B.hipX - 3, ANKLE]], arms: [0.6, -0.5], bends: [0.8, 0.8], shoot });
FRAMES.jump = jumpPose(false);
FRAMES.jump_s = jumpPose(true);
FRAMES.fall = fallPose(false);
FRAMES.fall_s = fallPose(true);
FRAMES.land = landPose(false);
FRAMES.land_s = landPose(true);
// Sliding: dropped low (the body is 14px tall in the game), head tucked into the chest,
// front leg kicked out ahead, back leg folded under, arms trailing.
FRAMES.slide = pose({ bob: 4.6, lean: 1.5, headLag: 2, feet: [[B.hipX + 6.5, ANKLE], [B.hipX - 2.5, ANKLE]], arms: [-1.3, -1.6], bends: [0.5, 0.4], armBehind: true });

// Climbing (from behind): one hand and the opposite knee up, then the other side.
const climbPose = (side) =>
  pose({ back: true, feet: [[B.hipX + side * 1.5, ANKLE - (side > 0 ? 3 : 0)], [B.hipX - side * 1.5, ANKLE - (side > 0 ? 0 : 3)]], arms: [side > 0 ? 3.0 : 2.5, side > 0 ? -2.5 : -3.0], bends: [0.1, -0.1] });
FRAMES.climb = climbPose(1);
FRAMES.climb2 = climbPose(-1);
FRAMES.climb_s = pose({ back: false, feet: [[B.hipX + 1.5, ANKLE - 3], [B.hipX - 1.5, ANKLE]], arms: [0, 2.6], shoot: true });
// Hurt: thrown back, arms up, visor flashing white.
FRAMES.hurt = pose({ bob: 0.5, lean: -1.5, headLag: 0, feet: [[B.hipX + 3, ANKLE - 1], [B.hipX - 2, ANKLE]], arms: [2.6, 2.9], bends: [0.3, 0.3], face: HURT_FACE });
FRAMES.win = pose({ feet: [[B.hipX + 2.2, ANKLE], [B.hipX - 2.2, ANKLE]], arms: [0.08, -0.08], bends: [0.12, 0.12], armUp: Math.PI });

// The old fighting poses (Shade's scrapped duel; kept so nothing that names them breaks).
FRAMES.punch = FRAMES.idle1_s;
FRAMES.kick = FRAMES.run3;
FRAMES.crouch = FRAMES.land;
FRAMES.crouchPunch = FRAMES.land_s;
FRAMES.block = FRAMES.idle1;
// Names the menus use.
FRAMES.idle = FRAMES.idle1;
FRAMES.idle_s = FRAMES.idle1_s;

// --- rendering -----------------------------------------------------------------

function drawFrame(bmp, frame, fx, fy, palette, scale = 1) {
  for (let y = 0; y < FRAME; y++)
    for (let x = 0; x < FRAME; x++) {
      const ch = frame.c[y * FRAME + x];
      if (ch === '.') continue;
      const rgb = palette[ch] ?? PALETTE[ch];
      for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) bmp.set(fx + x * scale + sx, fy + y * scale + sy, rgb);
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
