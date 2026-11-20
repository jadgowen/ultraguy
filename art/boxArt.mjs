// Boxing mode art (BoxingScene), redrawn on the shaded-parts rig.
//
//  gbox_*: the GATEKEEPER from the front, 48 x 60, in his ring colors: the
//    crenellated shoulders and visor of his fortress armor, purple trunks with
//    a gold band, and big red gloves (they grow as they come at you).
//  ubox_*: ULTRAGUY from behind, 28 x 40: orange helmet and shoulders, red
//    gloves; his punches reach up and away into the screen.
//
// The Gatekeeper's eye sits at (24.5, 12.5) on every frame (the scene flashes
// it white at the start of a wind-up).
//
// boxFrames() returns { name: Bitmap }.

import { Buf, capsule, ellipse, poly, rrect, ramp as R } from './shadedParts.mjs';

const PAL = {
  K: 0x1a1428, W: 0xfff1e0, w: 0xc8ccd8, G: 0x8a8fa8, g: 0x55607a, d: 0x2b2540, x: 0x141226,
  P: 0xc8a0ff, p: 0x8c4ad8, q: 0x5a2a9a, Q: 0x34185a,
  R: 0xff8a8a, r: 0xe8484e, s: 0x8c2030,
  Y: 0xffe14a, y: 0xd8a020,
  C: 0xe6fbff, c: 0x9ee8ff, V: 0x4ac8f0, v: 0x2a78b8,
  O: 0xffc070, o: 0xf28c28, n: 0xb8501a, m: 0x7a3010,
  T: 0x5ef0c8, t: 0x2aa088,
};
const STEEL = R('W', 'w', 'G', 'g');
const STEELB = R('w', 'G', 'g', 'd');
const ARMOR = R('P', 'p', 'p', 'q');
const ARMORB = R('p', 'q', 'q', 'Q');
const GLOVE = R('W', 'R', 'r', 's');
const GOLD = R('W', 'Y', 'Y', 'y');
const VISOR = R('C', 'c', 'V', 'v');
const HERO = R('O', 'o', 'o', 'n');
const HEROB = R('o', 'n', 'n', 'm');

// --- the Gatekeeper, front ------------------------------------------------------
/**
 * P: l / r (gloves: [x, y, radius]), lean (body shift), head ([dx, dy]),
 * crouch, dizzy (stars), down (slumped on the canvas).
 */
function gate(P) {
  const W = 48, H = 60;
  const b = new Buf(W, H, PAL);
  const cx = 24 + (P.lean ?? 0);
  const cr = P.crouch ?? 0;
  const [hx, hy] = P.head ?? [0, 0];
  const top = 6 + cr;
  // Legs and boots (hidden by the slump when he's down).
  if (!P.down)
    for (const [x, back] of [[cx - 7, true], [cx + 7, false]]) {
      b.part(rrect(x - 3.5, top + 38, x + 3.5, H - 4, 1), back ? STEELB : STEEL);
      b.part(rrect(x - 5, H - 5, x + 5, H - 1, 1), ARMORB);
    }
  // Trunks: purple with a gold waistband.
  b.part(rrect(cx - 12, top + 30, cx + 12, top + 40, 2), ARMOR);
  b.part(rrect(cx - 12.5, top + 29, cx + 12.5, top + 32, 1), GOLD);
  b.rect(cx - 0.5, top + 33, 1, 7, 'q');
  // Torso: armored chest with the keyhole.
  b.part(rrect(cx - 13, top + 12, cx + 13, top + 30, 4), ARMOR);
  b.part(ellipse(cx, top + 19, 2.6, 2.6), GOLD);
  b.part(poly([[cx - 2, top + 20], [cx + 2, top + 20], [cx + 3, top + 25], [cx - 3, top + 25]]), GOLD);
  b.px(cx, top + 19, 'x');
  // Crenellated shoulders.
  for (const side of [-1, 1]) {
    const sx = cx + side * 14;
    b.part(rrect(sx - 6, top + 9, sx + 6, top + 17, 1.5), side < 0 ? STEELB : STEEL);
    for (const k of [-5, -1, 3]) b.part(rrect(sx + k, top + 6, sx + k + 2, top + 10, 0.3), side < 0 ? STEELB : STEEL);
  }
  // Helm and visor; the eye at (24.5, 12.5) when the head's square.
  // (When he's down the head drops with him; otherwise it stays put so the eye flash lines up.)
  const ex = 24.5 + hx, ey = 12.5 + hy + (P.down ? cr : 0);
  b.part(rrect(ex - 7.5, ey - 9, ex + 6.5, ey + 5, 3), STEEL);
  b.part(rrect(ex - 5.5, ey - 1.5, ex + 4.5, ey + 1.5, 0.8), VISOR);
  b.rect(ex - 0.5, ey - 0.5, 2, 1, 'C');
  // Arms to the gloves, then the gloves (the near one drawn last).
  const glove = ([gx, gy, r], side) => {
    const sx = cx + side * 12, sy = top + 15;
    b.part(capsule(sx, sy, gx, gy, 3), side < 0 ? ARMORB : ARMOR);
    b.part(ellipse(gx, gy, r, r * 0.95), GLOVE);
    b.part(rrect(gx - r * 0.6, gy + r * 0.55, gx + r * 0.6, gy + r * 0.95, 0.5), STEEL);
  };
  const L = P.l ?? [14, 30, 5];
  const Rr = P.r ?? [34, 30, 5];
  if (L[2] >= Rr[2]) {
    glove(Rr, 1);
    glove(L, -1);
  } else {
    glove(L, -1);
    glove(Rr, 1);
  }
  if (P.dizzy) for (const [sx, sy] of [[ex - 9, ey - 11], [ex + 8, ey - 12], [ex, ey - 14]]) b.part(poly([[sx, sy - 2], [sx + 1, sy], [sx, sy + 2], [sx - 1, sy]]), GOLD);
  b.outline();
  return b.toBitmap();
}

const GATE = {
  idle: {},
  guardHigh: { l: [19, 16, 5.5], r: [30, 16, 5.5] },
  guardLow: { l: [16, 35, 5.5], r: [32, 35, 5.5] },
  windL: { l: [36, 22, 4.5], r: [32, 30, 5], lean: 2, head: [1, 0] },
  windR: { l: [16, 30, 5], r: [12, 22, 4.5], lean: -2, head: [-1, 0] },
  punchL: { l: [27, 36, 8.5], r: [34, 28, 5], lean: 1 },
  punchR: { l: [14, 28, 5], r: [21, 36, 8.5], lean: -1 },
  upWind: { l: [15, 32, 5], r: [31, 45, 5.5], crouch: 4, head: [0, 2] },
  upper: { l: [15, 30, 5], r: [27, 9, 7.5], crouch: -2, lean: 1 },
  hitFace: { l: [9, 34, 5], r: [39, 32, 5], head: [3, -2], lean: 1 },
  hitBody: { l: [15, 39, 5], r: [33, 40, 5], crouch: 4, head: [0, 3] },
  dizzy: { l: [14, 42, 5], r: [35, 40, 5], head: [-2, 1], dizzy: true },
  down: { l: [8, 54, 5], r: [40, 55, 5], crouch: 16, head: [-3, 2], down: true, dizzy: true },
};

// --- UltraGuy, from behind ----------------------------------------------------------
/** P: l / r (gloves [x, y, radius]), drop (slumped), glow (star punch). */
function hero(P) {
  const W = 28, H = 40;
  const b = new Buf(W, H, PAL);
  const cx = 14;
  const top = 6 + (P.drop ?? 0);
  // Legs.
  for (const x of [cx - 4, cx + 4]) {
    b.part(rrect(x - 2.5, top + 24, x + 2.5, H - 3, 1), HEROB);
    b.part(rrect(x - 3, H - 4, x + 3, H - 1, 1), R('w', 'G', 'g', 'd'));
  }
  // Back and shoulders, a teal stripe down the spine, the helmet (seen from behind).
  b.part(rrect(cx - 8, top + 10, cx + 8, top + 26, 3), HEROB);
  b.rect(cx - 0.5, top + 12, 1, 12, 't');
  for (const side of [-1, 1]) b.part(ellipse(cx + side * 8, top + 11, 4, 3.5), HERO);
  b.part(ellipse(cx, top + 4, 6.5, 6), HERO);
  b.part(rrect(cx - 6, top + 6, cx + 6, top + 9, 1), HEROB);
  // Arms and gloves.
  const glove = ([gx, gy, r], side) => {
    b.part(capsule(cx + side * 8, top + 12, gx, gy, 2.2), HERO);
    b.part(ellipse(gx, gy, r, r), GLOVE);
  };
  const L = P.l ?? [5, top + 18, 3.6];
  const Rr = P.r ?? [23, top + 18, 3.6];
  glove(L, -1);
  glove(Rr, 1);
  if (P.glow) for (const [sx, sy] of [[Rr[0] - 4, Rr[1] - 3], [Rr[0] + 4, Rr[1] - 1], [Rr[0], Rr[1] - 6]]) b.part(poly([[sx, sy - 2], [sx + 1, sy], [sx, sy + 2], [sx - 1, sy]]), GOLD);
  b.outline();
  return b.toBitmap();
}

const HERO_POSES = {
  idle: {},
  block: { l: [9, 9, 4], r: [19, 9, 4] },
  punchL: { l: [12, 6, 3], r: [23, 22, 3.6] },
  punchR: { l: [5, 22, 3.6], r: [16, 6, 3] },
  punchHL: { l: [12, 2, 2.8], r: [23, 22, 3.6] },
  punchHR: { l: [5, 22, 3.6], r: [16, 2, 2.8] },
  star: { l: [5, 24, 3.6], r: [15, 4, 5], glow: true },
  down: { drop: 6, l: [4, 34, 3.6], r: [24, 34, 3.6] },
};

export function boxFrames() {
  const frames = {};
  for (const [n, P] of Object.entries(GATE)) frames[`gbox_${n}`] = gate(P);
  for (const [n, P] of Object.entries(HERO_POSES)) frames[`ubox_${n}`] = hero(P);
  return frames;
}
