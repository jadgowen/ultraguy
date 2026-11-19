// SCRAP, "Junk Golem" design (picked from art/mockups/scrap.html, with the
// "Fist Up" ceiling pull).
//
// A floating giant made of the junk held in his magnet's field: a chest of
// bolted-on plates around a red horseshoe electromagnet with a glowing eye,
// stacked shoulders, a pelvis of brass and steel (no legs), and two huge fists
// of compacted car on columns of scrap. The pieces jostle as he idles. For the
// ceiling pull he raises his front fist overhead and a horseshoe opens in its
// palm, poles up (the tell: he's about to bring the roof down).
//
// scrapFrames() returns { frames, anchors } (anchors from bottom-center, facing right).

import { Buf, ellipse, rrect, ramp as R, relTo } from './shadedParts.mjs';

const PAL = {
  K: 0x1a1428, W: 0xfff1e0, w: 0xc8ccd8, G: 0x8a8fa8, g: 0x55607a, d: 0x2b2540,
  T: 0xe8b07a, M: 0xb8703a, m: 0x7a4220, u: 0x4a2814, B: 0xe8c060, b: 0xa87a30,
  R: 0xe8484e, r: 0x8c2030, Y: 0xffe14a, O: 0xf28c28,
};
const RUST = R('T', 'M', 'M', 'm');
const RUSTB = R('M', 'm', 'm', 'u');
const STEEL = R('W', 'w', 'G', 'g');
const STEELB = R('w', 'G', 'g', 'd');
const MAG = R('W', 'R', 'R', 'r');
const BRASS = R('W', 'B', 'B', 'b');
const EYE = R('W', 'Y', 'Y', 'O');

export const SCRAP_W = 48;
export const SCRAP_H = 44;

/** The horseshoe electromagnet around the eye (poles down). */
function core(b, cx, cy, r) {
  b.part((x, y) => ellipse(cx, cy, r, r)(x, y) && !ellipse(cx, cy, r / 2, r / 2)(x, y) && y < cy + r * 0.6, MAG);
  b.rect(cx - r, cy + r * 0.4, Math.max(2, r * 0.4), 3, 'w');
  b.rect(cx + r * 0.6, cy + r * 0.4, Math.max(2, r * 0.4), 3, 'w');
  b.part(ellipse(cx, cy, r * 0.38, r * 0.38), EYE, { shine: false });
  b.px(cx - 0.5, cy - 0.5, 'W');
}

/**
 * P: ph (jostle phase), bob (-1..1), armUp (back fist raised to throw, 0..1),
 * magnet (front fist out, 0..1), up (front fist overhead, 0..1), crouch (0..1),
 * strain (pieces shake harder).
 */
function draw(P) {
  const W = SCRAP_W, H = SCRAP_H;
  const b = new Buf(W, H, PAL);
  const cx = 24;
  const up = P.up ?? 0;
  const armUp = P.armUp ?? 0;
  const magnet = P.magnet ?? 0;
  const cy = 17 + (P.crouch ?? 0) * 3 + up * 4 + (P.bob ?? 0);
  const amp = P.strain ? 1 : 0.5;
  const jit = (i) => Math.round(Math.sin((P.ph ?? 0) + i * 1.7) * amp);
  const lerp = (a, c, k) => [a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k];
  const column = (x0, y0, f, ramp, squeeze = 1) => {
    for (let i = 0; i < 3; i++) {
      const k = (i + 1) / 4;
      const x = x0 + (f[0] - x0) * k * squeeze, y = y0 + (f[1] - y0) * k;
      b.part(rrect(x - 2, y - 2, x + 2, y + 2, 0.5), ramp);
    }
  };

  // Back arm: a column of junk to a fist (raised to throw).
  const bf = [cx - 17, cy + 12 - armUp * 16];
  column(cx - 12, cy - 3, bf, RUSTB);
  b.part(rrect(bf[0] - 4, bf[1] - 4, bf[0] + 4, bf[1] + 4, 1), RUSTB);
  // Pelvis (floats under the chest).
  b.part(rrect(cx - 7, cy + 11 + jit(3), cx + 7, cy + 15 + jit(3), 1), BRASS);
  b.part(rrect(cx - 4, cy + 16 + jit(4), cx + 4, cy + 18 + jit(4), 0.5), STEELB);
  // Chest: one mass, then plates bolted over it.
  b.part(rrect(cx - 11, cy - 9, cx + 11, cy + 10, 3), RUST);
  for (const [dx, dy, w, h, ramp, i] of [[-11, -9, 9, 6, STEEL, 1], [3, -10, 8, 6, RUST, 2], [-11, 4, 7, 6, STEELB, 3], [5, 3, 6, 7, STEEL, 4]]) {
    const ox = jit(i), oy = jit(i + 5);
    b.part(rrect(cx + dx + ox, cy + dy + oy, cx + dx + w + ox, cy + dy + h + oy, 0.8), ramp);
  }
  b.part(rrect(cx - 16, cy - 11 + jit(6), cx - 8, cy - 4 + jit(6), 1), RUSTB);
  b.part(rrect(cx + 8, cy - 12 + jit(7), cx + 16, cy - 4 + jit(7), 1), STEEL);
  b.rect(cx + 9, cy - 9 + jit(7), 6, 1, 'R');
  core(b, cx, cy + 1, 7);

  // Front arm: junk column to a car-block fist (out on the pull, overhead on the ceiling pull).
  let ff = [cx + 17 + magnet * 4, cy + 9 - magnet * 5];
  ff = lerp(ff, [cx + 9, cy - 13], up);
  column(cx + 12, cy - 3, ff, RUST, 1 - magnet * 0.3);
  b.part(rrect(ff[0] - 5, ff[1] - 5, ff[0] + 5, ff[1] + 5, 1.2), STEEL);
  b.rect(ff[0] - 4, ff[1] - 1, 8, 1, 'R');
  b.rect(ff[0] - 3, ff[1] + 2, 2, 2, 'Y');
  b.rect(ff[0] + 1, ff[1] + 2, 2, 2, 'Y');
  let upAt = null;
  if (up > 0.4) {
    // A horseshoe opens in his palm, poles to the sky.
    const hx = ff[0], hy = ff[1] - 7.5;
    b.part((x, y) => ellipse(hx, hy, 4.5, 4.5)(x, y) && !ellipse(hx, hy, 2, 2)(x, y) && y > hy - 1.5, MAG);
    b.rect(hx - 4.5, hy - 3, 2, 2, 'w');
    b.rect(hx + 2.5, hy - 3, 2, 2, 'w');
    upAt = [hx, hy - 3];
  }
  b.outline();

  const rel = relTo(W, H);
  const anchor = {
    eye: rel([cx, cy + 1]),
    // Where a saw leaves (the raised back fist) and where the side pull comes from.
    hand: rel([bf[0], bf[1] - 4]),
    tip: rel([ff[0] + 6, ff[1]]),
  };
  if (upAt) anchor.up = rel(upAt);
  return { bmp: b.toBitmap(), anchor };
}

const POSES = {
  idle1: { ph: 0, bob: 0 },
  idle2: { ph: 1.6, bob: -0.5 },
  idle3: { ph: 3.2, bob: -1 },
  idle4: { ph: 4.8, bob: -0.5 },
  toss1: { ph: 1, armUp: 0.55 },
  toss2: { ph: 2, armUp: 1 },
  magnet1: { ph: 0, magnet: 1, strain: true },
  magnet2: { ph: 2.4, magnet: 1, strain: true },
  pull1: { ph: 1, up: 0.55, crouch: 0.3 },
  pull2: { ph: 0, up: 1, crouch: 0.6, strain: true },
  pull3: { ph: 2.4, up: 1, crouch: 0.6, strain: true },
};

export function scrapFrames() {
  const frames = {}, anchors = {};
  for (const [n, P] of Object.entries(POSES)) {
    const { bmp, anchor } = draw(P);
    frames[`scrap_${n}`] = bmp;
    anchors[`scrap_${n}`] = anchor;
  }
  // The old pose names (intro, dungeon, cast roll, rematch rooms) point at the new art.
  for (const [old, now] of [['idle', 'idle1'], ['toss', 'toss2'], ['magnet', 'magnet1']]) {
    frames[`scrap_${old}`] = frames[`scrap_${now}`];
    anchors[`scrap_${old}`] = anchors[`scrap_${now}`];
  }
  return { frames, anchors };
}
