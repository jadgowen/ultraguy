// MAGMA, "Magma Core" design (picked from art/mockups/magma.html).
//
// Four glassy obsidian plates around a molten core. They breathe apart a
// little at rest and split wide on the wind-up and the landing, so the core
// blazes through: the tell that something is coming. Floating rock fists (no
// arms) bob on their own; the front one goes molten when he throws.
//
// magmaFrames() returns { frames: { name: Bitmap }, anchors: { name: {...} } };
// anchors are offsets from the sprite's bottom-center, facing right.

import { Buf, ellipse, poly, rrect } from './shadedParts.mjs';

const PAL = {
  K: 0x1a1428, W: 0xfff1e0, d: 0x2b2540, x: 0x1e1a30,
  N: 0xb8c4f0, n: 0x6a70a8, m: 0x464a78, M: 0x2a2a48,
  H: 0xfff4c0, Y: 0xffe14a, O: 0xf28c28, o: 0xc85a1a, r: 0x8c2030,
};
const RAMP = {
  glass: { shine: 'N', light: 'n', base: 'm', dark: 'M' },
  glassBack: { shine: 'n', light: 'm', base: 'M', dark: 'x' },
  lava: { shine: 'H', light: 'Y', base: 'O', dark: 'o' },
  core: { shine: 'H', light: 'H', base: 'Y', dark: 'O' },
};

export const MAGMA_W = 48;
export const MAGMA_H = 44;

/** P: drop, air, stretch, lean, fistUp, fistOut, throwing, open (0..1), breath (0..1), bob (front fist), bobBack. */
function draw(P) {
  const W = MAGMA_W;
  const H = MAGMA_H;
  const b = new Buf(W, H, PAL);
  const ground = H - 1;
  const drop = P.drop ?? 0;
  const lean = P.lean ?? 0;
  const open = P.open ?? 0;
  const top = 14 - (P.stretch ?? 0) + drop + (P.breath ?? 0) * 0.5;
  const cx = 24 + lean;
  const gap = 1 + open * 3 + (P.breath ?? 0) * 0.5;
  const fistOut = P.fistOut ?? 0;
  const fistUp = P.fistUp ?? 0;
  const fist = (back) => {
    const bob = back ? (P.bobBack ?? 0) : (P.bob ?? 0);
    const x = back ? 10 - fistOut * 0.4 : 38 + fistOut + lean * 0.5;
    const y = 29 + drop * 0.5 - (back ? fistUp * 0.3 : fistUp) + bob - (P.air ? 4 : 0);
    return [x, y];
  };

  // Back fist, feet.
  const [bfx, bfy] = fist(true);
  b.part(rrect(bfx - 3.5, bfy - 3.5, bfx + 3.5, bfy + 3.5, 1.5), RAMP.glassBack);
  const footY = ground - (P.air ? 2 : 0);
  b.part(ellipse(19 + lean * 0.3, footY - 2, 4, 2.5), RAMP.glassBack);
  b.part(ellipse(29 + lean * 0.6, footY - 2, 4.5, 2.5), RAMP.glass);
  for (const x of [17, 20, 27, 30]) b.px(x + lean * 0.5, footY - 1, 'O');

  // The core.
  b.part(ellipse(cx, top + 13, 9 + open * 1.5, 9 + open), RAMP.core, { shine: false });
  // Four plates around it, each pulled out along its own direction.
  const plate = (pts, dx, dy) => b.part(poly(pts.map(([x, y]) => [cx + x + dx * gap, top + y + dy * gap])), RAMP.glass);
  plate([[-1, 2], [-10, 5], [-12, 13], [-1, 12]], -0.8, -0.5);
  plate([[1, 3], [10, 5], [12, 13], [1, 12]], 0.8, -0.4);
  plate([[-12, 14], [-1, 14], [-1, 24], [-8, 23]], -0.8, 0.5);
  plate([[1, 14], [12, 14], [8, 23], [1, 24]], 0.8, 0.5);
  // Glints, and the eye: a bright slit on the upper-right plate.
  b.px(cx - 8 - gap, top + 7, 'N');
  b.px(cx + 9 + gap, top + 8, 'N');
  const ex = cx + 4 + gap * 0.8;
  const ey = top + 7 - gap * 0.4;
  b.rect(ex, ey, 5, 2, 'x');
  for (let i = 0; i < 4; i++) b.px(ex + 0.5 + i, ey, open > 0.5 ? 'H' : 'Y');

  // Front fist (molten while it throws).
  const [ffx, ffy] = fist(false);
  b.part(rrect(ffx - 4, ffy - 4, ffx + 4, ffy + 4, 1.5), P.throwing ? RAMP.lava : RAMP.glass);
  if (!P.throwing) {
    b.px(ffx - 1, ffy, 'O');
    b.px(ffx + 1, ffy + 2, 'O');
  }
  b.outline();

  const rel = (p) => [Math.round((p[0] - W / 2) * 10) / 10, Math.round((p[1] - H) * 10) / 10];
  return {
    bmp: b.toBitmap(),
    anchor: {
      core: rel([cx, top + 13]),
      eye: rel([ex + 2.5, ey + 0.5]),
      fist: rel([ffx, ffy]),
      // Where a fireball forms (over the raised fist).
      hand: rel([ffx, ffy - 7]),
      open: Math.round(open * 100) / 100,
    },
  };
}

const POSES = {
  idle1: { breath: 0, bob: 0, bobBack: 1 },
  idle2: { breath: 0.5, bob: -1, bobBack: 0 },
  idle3: { breath: 1, bob: 0, bobBack: -1 },
  idle4: { breath: 0.5, bob: 1, bobBack: 0 },
  windup: { drop: 3, open: 1, fistOut: -2 },
  charge: { drop: 1, lean: 4, fistOut: 4, open: 0.7 },
  jump_up: { air: true, stretch: 3, fistUp: 8 },
  jump_top: { air: true, fistUp: 8, open: 0.2 },
  land1: { drop: 5, fistOut: 3, open: 1 },
  land2: { drop: 2.5, fistOut: 1.5, open: 0.5 },
  throw: { throwing: true, fistUp: 14, open: 0.4 },
  erupt: { drop: 2, fistUp: 6, open: 1 },
};

export function magmaFrames() {
  const frames = {};
  const anchors = {};
  for (const [name, P] of Object.entries(POSES)) {
    const { bmp, anchor } = draw(P);
    frames[`magma_${name}`] = bmp;
    anchors[`magma_${name}`] = anchor;
  }
  // The old pose names (intro, cast roll, rematch rooms) point at the new art.
  for (const [old, now] of [['idle', 'idle1'], ['jump', 'jump_top']]) {
    frames[`magma_${old}`] = frames[`magma_${now}`];
    anchors[`magma_${old}`] = anchors[`magma_${now}`];
  }
  return { frames, anchors };
}
