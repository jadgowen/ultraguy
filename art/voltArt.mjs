// VOLT, "Tesla Knight" design (picked from art/mockups/volt.html).
//
// Navy armor, a helm with a cyan visor, fat lightning-bolt antennae and coil
// hands. The battery in his chest is a meter: its bar fills as he charges up to
// cast. His warp comes apart in horizontal bands (warp1-3), so the game shows
// him dissolving rather than just fading. The current crackling between his
// antennae and to his hands is drawn by the game (bossFx arcs).
//
// voltFrames() returns { frames: { name: Bitmap }, anchors: { name: {...} } };
// anchors are offsets from the sprite's bottom-center, facing right.

import { Buf, capsule, ellipse, poly, rrect } from './shadedParts.mjs';

const PAL = {
  K: 0x1a1428, W: 0xfff1e0, w: 0xc8ccd8, G: 0x8a8fa8, g: 0x55607a, d: 0x2b2540, x: 0x141226,
  A: 0x9aaaf0, B: 0x5a6ac8, S: 0x34428a, s: 0x1e2858,
  H: 0xfffbe0, Y: 0xffe14a, y: 0xd8a020, o: 0x8a6410,
  C: 0xe6fbff, c: 0x9ee8ff, V: 0x4ac8f0, v: 0x2a78b8,
};
const RAMP = {
  armor: { shine: 'A', light: 'B', base: 'S', dark: 's' },
  armorBack: { shine: 'B', light: 'S', base: 's', dark: 'x' },
  steel: { shine: 'W', light: 'w', base: 'G', dark: 'g' },
  steelBack: { shine: 'w', light: 'G', base: 'g', dark: 'd' },
  battery: { shine: 'H', light: 'Y', base: 'Y', dark: 'y' },
  visor: { shine: 'C', light: 'c', base: 'V', dark: 'v' },
  dark: { shine: 'd', light: 'd', base: 'x', dark: 'x' },
};

export const VOLT_W = 48;
export const VOLT_H = 44;

/** P: cast (arms up, 0..1), point (front arm out and down, 0..1), charge (0..1), breath (0..1), bands (0..1 of rows dropped, for the warp). */
function draw(P) {
  const W = VOLT_W;
  const H = VOLT_H;
  const b = new Buf(W, H, PAL);
  const ground = H - 1;
  const cx = 24;
  const top = 10 + (P.breath ?? 0) * 0.5;
  const cast = P.cast ?? 0;
  const point = P.point ?? 0;
  const charge = P.charge ?? 0.3;

  for (const [x, back] of [[19, true], [29, false]]) {
    b.part(rrect(x - 2.5, top + 21, x + 2.5, ground - 3, 1), back ? RAMP.armorBack : RAMP.armor);
    b.rect(x - 2, top + 25, 5, 1, back ? 'y' : 'Y');
    b.part(rrect(x - 4, ground - 3, x + 4, ground, 1), back ? RAMP.steelBack : RAMP.steel);
  }
  const arm = (sx, back) => {
    const ex = sx + (back ? -2 : 2 + point * 4);
    const ey = top + 18 - cast * 16 + (back ? 0 : point * 1);
    b.part(capsule(sx, top + 10, ex, ey, 2.3), back ? RAMP.armorBack : RAMP.armor);
    b.part(rrect(ex - 2.5, ey - 2.5, ex + 2.5, ey + 2.5, 1), back ? RAMP.steelBack : RAMP.steel);
    b.rect(ex - 2, ey - 1, 5, 1, 'Y');
    return [ex, ey + (cast > 0.5 ? -3 : 3)];
  };
  const backHand = arm(cx - 10, true);
  // Breastplate with the battery meter.
  b.part(rrect(cx - 10, top + 8, cx + 10, top + 22, 3), RAMP.armor);
  b.part(rrect(cx - 7, top + 12, cx + 7, top + 18, 1), RAMP.dark, { shine: false });
  const fill = Math.round(1 + charge * 11);
  for (let i = 0; i < 12; i++) for (let y = top + 13; y < top + 18; y++) b.px(cx - 6 + i, y, i < fill ? (y === Math.round(top + 13) ? 'H' : 'Y') : 'o');
  b.part(rrect(cx - 11, top + 20, cx + 11, top + 23, 1), RAMP.steel);
  // Helm, visor, antennae.
  b.part(rrect(cx - 7, top - 1, cx + 7, top + 8, 3), RAMP.armor);
  b.part(rrect(cx - 4, top + 2, cx + 6, top + 5, 1), RAMP.visor);
  b.rect(cx - 3, top + 2, 3, 1, 'C');
  const bolt = (x0, dir) => b.part(poly([[x0 - dir, top + 1], [x0 + dir * 3, top - 4], [x0 + dir * 1, top - 4], [x0 + dir * 6, top - 10], [x0 + dir * 4, top - 3], [x0 + dir * 6, top - 3], [x0 + dir * 2, top + 2]]), RAMP.battery);
  bolt(cx - 5, -1);
  bolt(cx + 5, 1);
  const frontHand = arm(cx + 10, false);
  b.part(ellipse(cx - 10, top + 10, 4, 3), RAMP.armorBack);
  b.part(ellipse(cx + 10, top + 10, 4, 3), RAMP.armor);
  b.outline();
  // The warp: drop rows in a scattered band pattern.
  const bands = P.bands ?? 0;
  if (bands > 0) for (let y = 0; y < H; y++) if (((y * 7) % 10) / 10 < bands) for (let x = 0; x < W; x++) b.c[y * W + x] = '';

  const rel = (p) => [Math.round((p[0] - W / 2) * 10) / 10, Math.round((p[1] - H) * 10) / 10];
  return {
    bmp: b.toBitmap(),
    anchor: {
      core: rel([cx, top + 15]),
      eye: rel([cx + 1, top + 3.5]),
      antennae: [rel([cx - 10, top - 9]), rel([cx + 10, top - 9])],
      hands: [rel(backHand), rel(frontHand)],
      charge,
      casting: cast > 0.5 || point > 0.5,
    },
  };
}

const POSES = {
  idle1: { breath: 0 },
  idle2: { breath: 0.5 },
  idle3: { breath: 1 },
  idle4: { breath: 0.5 },
  cast1: { cast: 0.6, charge: 0.55 },
  cast2: { cast: 1, charge: 1 },
  point: { point: 1, charge: 0.7 },
  warp1: { charge: 1, bands: 0.3 },
  warp2: { charge: 1, bands: 0.6 },
  warp3: { charge: 1, bands: 0.85 },
};

export function voltFrames() {
  const frames = {};
  const anchors = {};
  for (const [name, P] of Object.entries(POSES)) {
    const { bmp, anchor } = draw(P);
    frames[`volt_${name}`] = bmp;
    anchors[`volt_${name}`] = anchor;
  }
  for (const [old, now] of [['idle', 'idle1'], ['cast', 'cast2']]) {
    frames[`volt_${old}`] = frames[`volt_${now}`];
    anchors[`volt_${old}`] = anchors[`volt_${now}`];
  }
  return { frames, anchors };
}
