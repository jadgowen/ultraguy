// GALE, "Storm Harpy" design (picked from art/mockups/gale.html).
// A robot harpy: a sleek silver body, fans of steel feather-blades for wings, a
// gold crest plume, tail feathers and golden eyes. Wings fold back for the dive.
// galeFrames() returns { frames, anchors } (anchors from bottom-center, facing right).

import { Buf, capsule, ellipse, poly, rrect, ramp as R, relTo } from './shadedParts.mjs';

const PAL = {
  K: 0x1a1428, W: 0xffffff, x: 0x1e1a30,
  Y: 0xffe14a, y: 0xd8a020, S: 0xc8d4e8, s: 0x8a9ab8, t: 0x5a6a88,
};
const BODY = R('W', 'S', 'S', 's');
const BAND = R('Y', 'Y', 'y', 'y');
const WING = R('W', 'S', 's', 't');
const WINGB = R('S', 's', 't', 'x');
export const GALE_W = 48;
export const GALE_H = 44;

/** P: flap (-1..1), dive (wings tucked), aim (tilted back). */
function draw(P) {
  const W = GALE_W, H = GALE_H;
  const b = new Buf(W, H, PAL);
  const cx = 24, cy = 24;
  const tilt = P.dive ? 4 : P.aim ? -2 : 0;
  const flap = P.flap ?? 0;
  const wing = (side) => {
    const up = flap * 6 * (P.dive ? 0.3 : 1);
    const root = [cx + side * 7, cy - 1 + tilt * 0.3];
    for (let i = 0; i < 4; i++) {
      const a = (side < 0 ? Math.PI : 0) + side * (-0.5 + i * 0.32) - side * up * 0.05 + (P.dive ? side * 0.9 : 0);
      const len = 15 - i * 2;
      b.part(capsule(root[0], root[1], root[0] + Math.cos(a) * len, root[1] + Math.sin(a) * len - up, 1.6), side < 0 ? WINGB : WING);
    }
  };
  wing(-1);
  b.part(ellipse(cx, cy + tilt * 0.2, 9, 10), BODY);
  b.part(rrect(cx - 9, cy - 1, cx + 9, cy + 2, 1), BAND, { shine: false });
  b.part(poly([[cx - 2, cy - 9], [cx - 10, cy - 16], [cx - 6, cy - 9], [cx - 12, cy - 12], [cx - 3, cy - 6]]), BAND);
  b.part(poly([[cx - 6, cy + 6], [cx - 16, cy + 14], [cx - 9, cy + 13], [cx - 13, cy + 18], [cx - 4, cy + 9]]), WINGB);
  b.part(ellipse(cx + 4, cy - 3, 2, 1.6), R('W', 'Y', 'Y', 'y'));
  b.px(cx + 5, cy - 3, 'K');
  for (const fx of [-3, 3]) b.part(rrect(cx + fx - 1.5, cy + 9, cx + fx + 1.5, cy + 12, 0.5), BAND);
  wing(1);
  b.outline();
  const rel = relTo(W, H);
  return { bmp: b.toBitmap(), anchor: { eye: rel([cx + 4, cy - 2.5]), mouth: rel([cx + 10, cy + 2]) } };
}

const POSES = {
  idle1: { flap: 1 }, idle2: { flap: 0.3 }, idle3: { flap: -1 }, idle4: { flap: 0.3 },
  blow1: { flap: 1 }, blow2: { flap: -0.6 },
  aim: { aim: 1, flap: 0.8 },
  dive: { dive: 1, flap: -0.6 },
};

export function galeFrames() {
  const frames = {}, anchors = {};
  for (const [n, P] of Object.entries(POSES)) {
    const { bmp, anchor } = draw(P);
    frames[`gale_${n}`] = bmp;
    anchors[`gale_${n}`] = anchor;
  }
  for (const [old, now] of [['idle', 'idle1'], ['blow', 'blow1']]) {
    frames[`gale_${old}`] = frames[`gale_${now}`];
    anchors[`gale_${old}`] = anchors[`gale_${now}`];
  }
  return { frames, anchors };
}
