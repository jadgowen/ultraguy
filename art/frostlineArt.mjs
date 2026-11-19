// FROSTLINE, "Crystal Bird" design (picked from art/mockups/frostline.html).
// Made of ice: a translucent, faceted crystal bird with white facet lines,
// glowing faintly from inside. Belly-slides flat across the ice.
// frostlineFrames() returns { frames, anchors } (anchors from bottom-center, facing right).

import { Buf, ellipse, poly, ramp as R, relTo } from './shadedParts.mjs';

const PAL = {
  K: 0x1a1428, W: 0xffffff, w: 0xe6f4ff, x: 0x141226,
  C: 0xe6f8ff, B: 0x9ee0f8, b: 0x4aa8d8, n: 0x2a6aa8, m: 0x1a3a6a,
  V: 0xc8fbff, v: 0x7ae8f8, u: 0x3ab0d8,
};
const BODY = R('V', 'v', 'u', 'n');
const BACK = R('v', 'u', 'n', 'm');
const BELLY = R('V', 'V', 'v', 'u');
const BEAK = R('C', 'C', 'B', 'b');
const FEET = R('v', 'u', 'n', 'm');
const CREST = R('V', 'V', 'v', 'u');
export const FROST_W = 48;
export const FROST_H = 44;

function draw(P) {
  const W = FROST_W, H = FROST_H;
  const b = new Buf(W, H, PAL);
  const ground = H - 1;
  const cx = 24;
  const rel = relTo(W, H);
  if (P.slide) {
    const y = ground - 6;
    b.part(ellipse(cx - 13, y + 2, 3, 1.5), BACK);
    b.part(ellipse(cx, y, 15, 6), BODY);
    b.part(ellipse(cx + 1, y + 2.5, 12, 3), BELLY, { shine: false });
    for (const [x0, y0, x1, y1] of [[-9, -3, -3, 2], [2, -4, 7, 1]]) b.line([[cx + x0, y + y0], [cx + x1, y + y1]], 'C');
    b.part(poly([[cx + 14, y - 2], [cx + 21, y], [cx + 14, y + 1]]), BEAK);
    b.px(cx + 10, y - 3, 'K');
    b.px(cx + 10, y - 4, 'W');
    for (let i = 0; i < 3; i++) b.part(poly([[cx - 2 + i * 4, y - 5], [cx - 4 + i * 4, y - 10], [cx + i * 4, y - 5]]), CREST);
    b.outline();
    return { bmp: b.toBitmap(), anchor: { eye: rel([cx + 10, y - 3]), core: rel([cx, y]), hand: rel([cx + 14, y - 2]) } };
  }
  const drop = (P.crouch ?? 0) * 2;
  const top = 14 + drop + (P.breath ?? 0) * 0.4;
  const by = top + 13;
  const fl = P.flap ?? 0, look = P.look ?? 0;
  b.part(ellipse(cx - 5, ground - 1, 4, 1.8), FEET);
  b.part(ellipse(cx + 5, ground - 1, 4, 1.8), FEET);
  b.part(poly([[cx - 10, by - 4], [cx - 17 - fl * 3, by + 3 - fl * 10], [cx - 11, by + 6]]), BACK);
  b.part(ellipse(cx, by, 13, 13), BODY);
  b.part(ellipse(cx + 2, by + 3, 9, 9), BELLY, { shine: false });
  for (const [x0, y0, x1, y1] of [[-8, -6, -2, 4], [3, -9, 9, -1], [-5, 6, 4, 10], [6, 2, 10, 8]]) b.line([[cx + x0, by + y0], [cx + x1, by + y1]], 'C');
  const hx = cx + 5, hy = top + 5 - look * 2;
  b.part(ellipse(hx, hy, 2.4, 2.4), R('W', 'W', 'W', 'w'));
  b.px(hx + 0.6, hy, 'K');
  b.px(hx + 0.6, hy + 1, 'K');
  const ba = -look * 0.9;
  const bx0 = hx + 4, by0 = hy + 2;
  b.part(poly([[bx0, by0 - 1.5], [bx0 + Math.cos(ba) * 7, by0 + Math.sin(ba) * 7], [bx0, by0 + 1.5]]), BEAK);
  for (let i = 0; i < 3; i++) b.part(poly([[cx - 6 + i * 4, top], [cx - 7 + i * 4, top - 5 - (i === 1 ? 2 : 0)], [cx - 3 + i * 4, top]]), CREST);
  const flipTip = [cx + 15 + fl * 3, by + 4 - fl * 11];
  b.part(poly([[cx + 6, by - 3], flipTip, [cx + 9, by + 7]]), BODY);
  b.outline();
  return { bmp: b.toBitmap(), anchor: { eye: rel([hx, hy]), core: rel([cx, by]), hand: rel(flipTip) } };
}

const POSES = {
  idle1: { breath: 0 }, idle2: { breath: 0.5 }, idle3: { breath: 1 }, idle4: { breath: 0.5 },
  windup: { crouch: 1 },
  slide: { slide: 1 },
  shoot1: { flap: 0.5 },
  shoot2: { flap: 1 },
  hail: { look: 1, flap: 0.3 },
};

export function frostlineFrames() {
  const frames = {}, anchors = {};
  for (const [n, P] of Object.entries(POSES)) {
    const { bmp, anchor } = draw(P);
    frames[`frostline_${n}`] = bmp;
    anchors[`frostline_${n}`] = anchor;
  }
  frames.frostline_idle = frames.frostline_idle1;
  anchors.frostline_idle = anchors.frostline_idle1;
  frames.frostline_shoot = frames.frostline_shoot2;
  anchors.frostline_shoot = anchors.frostline_shoot2;
  return { frames, anchors };
}
