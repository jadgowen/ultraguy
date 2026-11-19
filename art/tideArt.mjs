// TIDE, "Leviathan" design (picked from art/mockups/tide.html).
// A great sea eel: a long segmented body rippling in a travelling wave, glowing
// teal lights down its back, a fin crest and a wide jaw.
// tideFrames() returns { frames, anchors } (anchors from bottom-center, facing right).

import { Buf, ellipse, poly, ramp as R, relTo } from './shadedParts.mjs';

const PAL = {
  K: 0x1a1428, W: 0xffffff, x: 0x141226,
  R: 0xe8484e, r: 0x8c2030, Y: 0xffe14a, V: 0x5ef0c8, v: 0x2aa088,
  E: 0x8ae8c8, e: 0x3aa888, f: 0x1e6a5a,
};
export const TIDE_W = 48;
export const TIDE_H = 44;

/** P: phase (0..1 of the swim wave), open (jaw), dash (stretched straight). */
function draw(P) {
  const W = TIDE_W, H = TIDE_H;
  const b = new Buf(W, H, PAL);
  const cy = 34;
  const n = 9;
  const ph = (P.phase ?? 0) * Math.PI * 2;
  const seg = (i) => {
    const k = i / (n - 1);
    const x = 42 - k * (34 + (P.dash ? 4 : 0));
    const y = cy + Math.sin(ph - k * 4) * (P.dash ? 1 : 3.5) * k;
    return [x, y, 5.5 - k * 3];
  };
  for (let i = n - 1; i >= 1; i--) {
    const [x, y, r] = seg(i);
    b.part(ellipse(x, y, r + 1, r), i % 2 ? R('E', 'e', 'e', 'f') : R('E', 'E', 'e', 'f'));
    b.px(x, y - r + 1, 'V');
  }
  const [hx, hy] = seg(0);
  b.part(ellipse(hx, hy, 7, 5.5), R('E', 'E', 'e', 'f'));
  b.part(poly([[hx - 3, hy - 4], [hx - 8, hy - 10], [hx - 6, hy - 4]]), R('V', 'V', 'v', 'v'));
  b.part(ellipse(hx + 2, hy - 2, 1.8, 1.8), R('W', 'Y', 'Y', 'Y'));
  const jo = (P.open ?? 0) * 3;
  b.part(poly([[hx + 2, hy + 1], [hx + 8, hy + 0.5 - jo * 0.3], [hx + 7, hy + 3 + jo], [hx + 1, hy + 4]]), jo > 0.5 ? R('R', 'R', 'r', 'r') : R('E', 'e', 'e', 'f'), { shine: false });
  if (jo > 0.5) for (let i = 0; i < 2; i++) { b.px(hx + 3 + i * 2, hy + 1, 'W'); b.px(hx + 4 + i * 2, hy + 3 + jo, 'W'); }
  b.outline();
  const rel = relTo(W, H);
  return { bmp: b.toBitmap(), anchor: { eye: rel([hx + 2, hy - 2]), mouth: rel([hx + 8, hy + 2]), lights: [1, 3, 5, 7].map((i) => rel([seg(i)[0], seg(i)[1] - seg(i)[2] + 1])) } };
}

const POSES = {
  swim1: { phase: 0 }, swim2: { phase: 0.25 }, swim3: { phase: 0.5 }, swim4: { phase: 0.75 },
  dash1: { dash: 1, open: 1, phase: 0 }, dash2: { dash: 1, open: 1, phase: 0.5 },
  open1: { open: 0.6, phase: 0.1 }, open2: { open: 1, phase: 0.35 },
};

export function tideFrames() {
  const frames = {}, anchors = {};
  for (const [n, P] of Object.entries(POSES)) {
    const { bmp, anchor } = draw(P);
    frames[`tide_${n}`] = bmp;
    anchors[`tide_${n}`] = anchor;
  }
  for (const [old, now] of [['idle', 'swim1'], ['swim', 'swim2'], ['dash', 'dash1'], ['open', 'open2']]) {
    frames[`tide_${old}`] = frames[`tide_${now}`];
    anchors[`tide_${old}`] = anchors[`tide_${now}`];
  }
  return { frames, anchors };
}
