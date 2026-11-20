// The regular stage enemies, redrawn on the shaded-parts rig (like the bosses):
// same sizes and frame names as before (walker0/1, hopper0/1, ...), so the game
// code is unchanged; each keeps its look and colors, with real form and light.
//
// enemyFrames() returns { name: Bitmap }.

import { Buf, capsule, ellipse, poly, rrect, ramp as R } from './shadedParts.mjs';

const PAL = {
  K: 0x1a1428, W: 0xfff1e0, w: 0xc8ccd8, G: 0x8a8fa8, g: 0x55607a, d: 0x2b2540, x: 0x141226,
  R: 0xff8a8a, r: 0xe8484e, s: 0x8c2030,
  E: 0x9ae06a, e: 0x5ab84a, f: 0x2e7a34, F: 0x1c4a20,
  P: 0xd0a8f0, p: 0x9a5ac8, q: 0x6a3a8a,
  Y: 0xfff4b0, y: 0xffe14a, o: 0xd8a020,
  O: 0xffc070, n: 0xf28c28, m: 0xb85a1a,
  C: 0xe6fbff, c: 0x9ee8ff, V: 0x4ac8f0, v: 0x2a78b8,
  T: 0xe8b07a, t: 0xb8703a, u: 0x7a4220,
  A: 0xffd0e0, a: 0xff8ab8, b: 0xc8506a,
  L: 0xffe14a, l: 0xff8a2a, k: 0xd84a1a, j: 0x7a1a10,
  I: 0xffffff, i: 0xdceaf8, h: 0xa8c4e4, H: 0x7a9ac8,
};
const RED = R('W', 'R', 'r', 's');
const LEAF = R('E', 'E', 'e', 'f');
const LEAFB = R('e', 'e', 'f', 'F');
const STEEL = R('W', 'w', 'G', 'g');
const STEELB = R('w', 'G', 'g', 'd');
const PURP = R('P', 'P', 'p', 'q');
const GOLD = R('Y', 'y', 'y', 'o');
const ORANGE = R('O', 'O', 'n', 'm');
const ICE = R('I', 'C', 'c', 'V');
const RUST = R('T', 'T', 't', 'u');
const PINK = R('A', 'A', 'a', 'b');
const LAVA = R('L', 'L', 'l', 'k');
const DARK = R('d', 'd', 'x', 'x');
const SNOW = R('I', 'i', 'h', 'H');
const EYE = R('W', 'W', 'W', 'w');

/** An eye: a white ball and a dark pupil (looking toward lx). */
function eye(b, x, y, r = 1.6, lx = 0.6) {
  b.part(ellipse(x, y, r, r), EYE, { shine: false });
  b.px(x + lx, y, 'x');
}

const DRAW = {
  // WALKER: a red dome bot with one big eye on two stomping legs.
  walker(f) {
    const b = new Buf(16, 16, PAL);
    // Two legs stepping (one lifts each frame), a steel hip band, a red dome with one big eye.
    for (const [x, back, lift] of [[4.5, true, f ? 2 : 0], [11.5, false, f ? 0 : 2]]) {
      b.part(capsule(x, 9, x, 13 - lift, 1.2), back ? STEELB : STEEL);
      b.part(rrect(x - 2.4, 13 - lift, x + 2.4, 15.5 - lift, 0.8), back ? DARK : STEELB);
    }
    b.part(rrect(2.5, 7.5, 13.5, 9.5, 0.8), R('w', 'G', 'g', 'd'));
    b.part((x, y) => ellipse(8, 7.5, 6, 6.5)(x, y) && y < 8, RED);
    eye(b, 9.5, 4.5, 2.2, 0.8);
    b.outline();
    return b.toBitmap();
  },


  // HOPPER: a green frog bot; squatting, then legs out mid-leap.
  hopper(f) {
    const b = new Buf(16, 14, PAL);
    const top = f ? 1 : 3;
    if (f) for (const s of [-1, 1]) b.part(capsule(8 + s * 3, 10, 8 + s * 6, 13, 1.3), LEAFB);
    else for (const s of [-1, 1]) b.part(ellipse(8 + s * 5, 11, 2.8, 2), LEAFB);
    b.part(ellipse(8, top + 6, 6, 4.5), LEAF);
    b.part(ellipse(8, top + 8, 4, 2), R('Y', 'y', 'y', 'o'), { shine: false });
    for (const s of [-1, 1]) {
      b.part(ellipse(8 + s * 3.2, top + 2, 2.2, 2.2), LEAF);
      eye(b, 8 + s * 3.2, top + 2, 1.2, s * 0.4);
    }
    b.rect(5, top + 6, 6, 1, 'F');
    b.outline();
    return b.toBitmap();
  },
  // TURRET: an armored dome on a riveted base; it lifts to show the red eye.
  turret(f) {
    const b = new Buf(16, 16, PAL);
    b.part(rrect(1, 11, 15, 15, 1), STEELB);
    for (const x of [3, 8, 13]) b.px(x, 13, 'W');
    const lift = f ? 3 : 0;
    if (f) {
      b.part(rrect(4, 7, 12, 11, 0.8), DARK, { shine: false });
      b.part(ellipse(8, 9, 2, 1.6), RED, { shine: false });
      b.px(7, 8, 'W');
    }
    b.part((x, y) => ellipse(8, 10 - lift, 6.5, 5)(x, y) && y < 10.5 - lift, STEEL);
    b.rect(3, 9 - lift, 10, 1, 'g');
    b.outline();
    return b.toBitmap();
  },
  // FLYER: a purple orb drone with bat wings, flapping.
  flyer(f) {
    const b = new Buf(16, 12, PAL);
    for (const s of [-1, 1]) {
      const tipY = f ? 1 : 10;
      b.part(poly([[8 + s * 2, 5], [8 + s * 8, tipY], [8 + s * 6, 6], [8 + s * 7, 8], [8 + s * 3, 8]]), R('P', 'p', 'q', 'q'));
    }
    b.part(ellipse(8, 6.5, 3.8, 3.8), PURP);
    b.part(ellipse(8, 6.5, 1.6, 1.6), R('W', 'y', 'y', 'o'), { shine: false });
    b.px(8, 6, 'x');
    b.outline();
    return b.toBitmap();
  },
  // LURKER: a green chameleon, tail curled, tongue flicking.
  lurker(f) {
    const b = new Buf(18, 12, PAL);
    b.part(capsule(2, 6, 3, 9, 1.5), LEAFB);
    b.part(ellipse(4, 9.5, 2.2, 1.5), LEAFB);
    for (const x of [6, 11]) b.part(capsule(x, 8, x - 1 + f, 11, 1), LEAFB);
    b.part(ellipse(9, 6.5, 6, 3.5), LEAF);
    for (let x = 5; x < 13; x += 2) b.px(x, 4, 'f');
    b.part(ellipse(14, 6, 3, 2.6), LEAF);
    eye(b, 14.5, 5, 1.3, 0.5);
    if (f) b.rect(16, 7, 2, 1, 'r');
    b.outline();
    return b.toBitmap();
  },
  // SPITTER: a red bulb on a leafy stem; closed, then open with teeth.
  spitter(f) {
    const b = new Buf(16, 16, PAL);
    b.part(capsule(8, 15, 8, 9, 1), LEAFB);
    for (const s of [-1, 1]) b.part(ellipse(8 + s * 4, 13, 3.5, 1.5), LEAF);
    if (f) {
      b.part(ellipse(8, 5, 6, 4.5), RED);
      b.part(ellipse(8, 5.5, 4, 2.6), DARK, { shine: false });
      for (const x of [5, 7, 9, 11]) {
        b.px(x, 3, 'W');
        b.px(x, 7, 'W');
      }
    } else {
      b.part(ellipse(8, 5.5, 4.5, 5), RED);
      b.rect(5, 5, 6, 1, 's');
      b.px(6, 3, 'R');
    }
    b.outline();
    return b.toBitmap();
  },
  // SLIDER: a penguin bot waddling (it belly-slides on ice).
  slider(f) {
    const b = new Buf(16, 14, PAL);
    b.part(ellipse(8, 8, 5, 5.5), R('g', 'G', 'g', 'd'));
    b.part(ellipse(8.5, 9, 3.4, 4), SNOW);
    b.part(ellipse(8, 3.5, 3.5, 3), R('g', 'G', 'g', 'd'));
    eye(b, 9.5, 3, 1.1, 0.5);
    b.part(poly([[11, 4], [14, 4.5], [11, 5.5]]), ORANGE);
    for (const s of [-1, 1]) b.part(ellipse(8 + s * 5, 8 + (f ? s : -s), 1.3, 3), R('g', 'g', 'd', 'd'));
    for (const x of [6, 10]) b.part(ellipse(x + (f ? 1 : -1) * (x === 6 ? 1 : -1) * 0.5, 13, 1.8, 0.9), ORANGE);
    b.outline();
    return b.toBitmap();
  },
  icicle() {
    const b = new Buf(10, 14, PAL);
    b.part(rrect(1, 0, 9, 3, 0.8), SNOW);
    b.part(poly([[1.5, 2], [8.5, 2], [5, 13.5]]), ICE);
    b.px(4, 4, 'I');
    b.px(4, 6, 'I');
    b.outline();
    return b.toBitmap();
  },
  // BOMBER: a red bird-plane, wings flapping, a bomb slung under it.
  bomber(f) {
    const b = new Buf(18, 12, PAL);
    b.part(ellipse(8, 9, 2.2, 2.2), DARK);
    b.part(capsule(3, 6, 14, 6, 2.8), RED);
    b.part(poly([[1, 4], [4, 6], [1, 8]]), RED);
    b.part(poly([[15, 5], [18, 6.5], [15, 7.5]]), GOLD);
    eye(b, 13, 5, 1, 0.5);
    const wy = f ? 0 : 10;
    b.part(poly([[6, 6], [10, 6], [8, wy]]), R('R', 'r', 's', 's'));
    b.outline();
    return b.toBitmap();
  },
  // SPARKER: a purple bot riding a storm cloud, sparking.
  sparker(f) {
    const b = new Buf(20, 18, PAL);
    b.part(ellipse(10, 3.5, 3.5, 3.5), PURP);
    eye(b, 11, 3.5, 1.2, 0.5);
    b.part(capsule(10, 6, 10, 9, 1.4), PURP);
    for (const [x, y, r] of [[4, 13, 4], [10, 12, 5], [16, 13, 4], [7, 15, 3.5], [13, 15, 3.5]]) b.part(ellipse(x, y, r, r * 0.75), R('I', 'I', 'h', 'H'));
    if (f) {
      b.line([[16, 6], [18, 3], [17, 3], [19, 0]], 'y');
      b.line([[3, 6], [1, 3], [2, 3], [0, 1]], 'y');
    }
    b.outline();
    return b.toBitmap();
  },
  // ZAPPER: a tesla coil on a post; the ball glows when charged.
  zapper(f) {
    const b = new Buf(16, 16, PAL);
    b.part(rrect(3, 13, 13, 16, 0.8), STEELB);
    b.part(rrect(6, 5, 10, 13, 0.5), GOLD);
    for (let y = 6; y < 13; y += 2) b.rect(5, y, 6, 1, 'o');
    b.part(ellipse(8, 3, 3, 3), f ? R('W', 'C', 'c', 'V') : STEEL);
    if (f) {
      b.px(3, 1, 'C');
      b.px(13, 2, 'C');
    }
    b.outline();
    return b.toBitmap();
  },
  roller() {
    const b = new Buf(14, 14, PAL);
    b.part(ellipse(7, 7, 6.4, 6.4), STEEL);
    for (const [x0, y0, x1, y1] of [[3, 3, 11, 11], [3, 11, 11, 3]]) b.line([[x0, y0], [x1, y1]], 'g');
    b.part(ellipse(7, 7, 2, 2), STEELB);
    b.outline();
    return b.toBitmap();
  },
  // EMBER: a fireball with a face, flickering.
  ember(f) {
    const b = new Buf(12, 12, PAL);
    // Flames licking up (they sway between frames), then a round hot core with a face.
    b.part(poly([[2, 7], [3 + f, 1], [5, 4], [6, 0], [7, 4], [9 - f, 1], [10, 7]]), LAVA);
    b.part(ellipse(6, 7.5, 4.6, 4.2), LAVA);
    b.part(ellipse(6, 8, 3, 2.8), R('Y', 'Y', 'L', 'l'), { shine: false });
    b.px(5, 7, 'j');
    b.px(7, 7, 'j');
    b.rect(5, 9, 3, 1, 'k');
    b.outline();
    return b.toBitmap();
  },

  // SLUG: a lava slug inching along, glowing spots on its back.
  slug(f) {
    const b = new Buf(18, 10, PAL);
    // A domed body (it bunches up, then stretches), glowing spots, eyes on stalks.
    const len = f ? 7.5 : 6.5, ht = f ? 4 : 5;
    b.part((x, y) => ellipse(8.5, 9.5, len, ht)(x, y) && y < 9.6, R('L', 'l', 'k', 'j'));
    b.part(rrect(1, 8, 16, 10, 0.5), R('k', 'j', 'j', 'j'));
    for (const [x, y] of [[5, 7], [8.5, 6], [12, 7]]) b.part(ellipse(x, y - (f ? 0 : 1), 1.2, 0.9), R('Y', 'L', 'L', 'l'), { shine: false });
    for (const dx of [0, 2]) {
      b.line([[14 + dx, 7], [15 + dx, 3]], 'k');
      b.px(15 + dx, 2, 'L');
    }
    b.outline();
    return b.toBitmap();
  },

  grinder() {
    const b = new Buf(14, 14, PAL);
    b.part((x, y) => {
      const a = Math.atan2(y - 7, x - 7);
      const r = 5.6 + ((a + Math.PI) * 8 / Math.PI) % 2 * 0.9;
      return Math.hypot(x - 7, y - 7) < r;
    }, STEEL);
    b.part(ellipse(7, 7, 2, 2), DARK, { shine: false });
    b.outline();
    return b.toBitmap();
  },
  // JUNKBOT: a boxy rust robot; throwing, its arm goes up with a scrap chunk.
  junkbot(f) {
    const b = new Buf(16, 18, PAL);
    for (const x of [5, 11]) b.part(rrect(x - 1.5, 13, x + 1.5, 17, 0.5), STEELB);
    b.part(rrect(2, 6, 14, 14, 1.2), RUST);
    b.part(rrect(4, 8, 12, 11, 0.5), DARK, { shine: false });
    b.rect(5, 9, 6, 1, 'y');
    b.part(rrect(4, 1, 12, 7, 1.2), STEEL);
    b.part(rrect(6, 3, 11, 5, 0.4), R('W', 'C', 'V', 'v'));
    if (f) {
      b.part(capsule(14, 8, 15, 2, 1.1), RUST);
      b.part(rrect(13, 0, 16, 3, 0.5), STEELB);
    } else b.part(capsule(14, 8, 15, 13, 1.1), RUST);
    b.part(capsule(2, 8, 1, 13, 1.1), RUST);
    b.outline();
    return b.toBitmap();
  },
  // PUFFER: a yellow pufferfish; it puffs up with its spikes out.
  puffer(f) {
    const b = new Buf(14, 12, PAL);
    const r = f ? 5.4 : 4.4;
    if (f) for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      b.px(7 + Math.cos(a) * 6, 6 + Math.sin(a) * 5.5, 'o');
    }
    b.part(poly([[1, 3], [3, 6], [1, 9]]), GOLD);
    b.part(ellipse(7.5, 6, r, r * 0.9), GOLD);
    b.part(ellipse(8, 7.5, r * 0.6, r * 0.35), R('Y', 'Y', 'Y', 'y'), { shine: false });
    eye(b, 10, 4.5, 1.2, 0.5);
    b.px(12, 7, 'm');
    b.outline();
    return b.toBitmap();
  },
  // CLAM: a pink clam; it opens to show its pearl (and fires it).
  clam(f) {
    const b = new Buf(16, 12, PAL);
    b.part((x, y) => ellipse(8, 9, 7.5, 3)(x, y) && y > 8, PINK);
    if (f) {
      b.part((x, y) => ellipse(8, 7, 7, 5.5)(x, y) && y < 6, PINK);
      b.part(rrect(2, 5, 14, 9, 1), DARK, { shine: false });
      b.part(ellipse(8, 7.5, 2, 2), R('W', 'W', 'i', 'h'));
    } else b.part((x, y) => ellipse(8, 9, 7.5, 4.5)(x, y) && y <= 8.5, PINK);
    for (const x of [4, 8, 12]) b.px(x, f ? 3 : 6, 'b');
    b.outline();
    return b.toBitmap();
  },
};

// (The walker and the lava slug read better at their size in their original art in art/sprites.mjs, so they
// keep it; their draw functions here are unused for now.)
const FRAMES = {
  hopper: 2, turret: 2, flyer: 2, lurker: 2, spitter: 2, slider: 2, icicle: 0, bomber: 2, sparker: 2, zapper: 2,
  roller: 1, ember: 2, grinder: 0, junkbot: 2, puffer: 2, clam: 2,
};

export function enemyFrames() {
  const out = {};
  for (const [kind, n] of Object.entries(FRAMES)) {
    if (n === 0) out[kind] = DRAW[kind](0);
    else for (let f = 0; f < n; f++) out[`${kind}${f}`] = DRAW[kind](f);
  }
  return out;
}
