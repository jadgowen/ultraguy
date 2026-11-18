// ANVIL, "Molten" design (picked from art/mockups/anvil.html).
//
// Drawn on the same shaded-parts approach as the hero: shapes are filled with a
// light-to-dark ramp and outlined, in a 3/4 view (far arm and leg in shadow).
// Every pose comes cool and white-hot ("_h"): hot means glowing seams, a
// blazing furnace and fists/cannon glowing from the forge. The game picks the
// hot frame as Anvil heats up (firing, slamming) and lets him cool.
//
// anvilFrames() returns { frames: { name: Bitmap }, anchors: { name: {...} } }.
// Anchors (furnace, visor, fists, muzzle) are offsets from the sprite's
// bottom-center, facing right, for the game's glow effects.

import { Buf, capsule, ellipse, poly, rrect } from './shadedParts.mjs';

const PAL = {
  K: 0x1a1428, W: 0xfff1e0, w: 0xc8ccd8, G: 0x8a8fa8, g: 0x55607a, d: 0x2b2540, x: 0x1e1a30,
  P: 0xff8a7a, R: 0xd83a4a, r: 0x8c2030, q: 0x5a1424,
  Y: 0xffe14a, y: 0xd8a020, O: 0xf28c28, o: 0xb85a1a, H: 0xfff4c0,
  B: 0xe8c060, b: 0xa87a30,
};
const RAMP = {
  steel: { shine: 'W', light: 'w', base: 'G', dark: 'g' },
  steelBack: { shine: 'w', light: 'G', base: 'g', dark: 'd' },
  armor: { shine: 'P', light: 'R', base: 'R', dark: 'r' },
  armorBack: { shine: 'R', light: 'r', base: 'r', dark: 'q' },
  hot: { shine: 'H', light: 'Y', base: 'O', dark: 'o' },
  warm: { shine: 'Y', light: 'O', base: 'o', dark: 'r' },
  dark: { shine: 'd', light: 'd', base: 'x', dark: 'x' },
};

export const ANVIL_W = 48;
export const ANVIL_H = 44;

/**
 * One frame. P: drop (crouch/squash), air (feet tucked), stretch, lean (into the
 * dash), fistUp, fistOut, shoot, recoil, breath (0..1), heat (0 or 1), angry.
 */
function draw(P) {
  const W = ANVIL_W;
  const H = ANVIL_H;
  const b = new Buf(W, H, PAL);
  const ground = H - 1;
  const drop = P.drop ?? 0;
  const st = P.stretch ?? 0;
  const tuck = P.air ? 4 : 0;
  const hipY = ground - 9 + drop - tuck;
  const bx = 10 + (P.lean ?? 0); // body centered in the frame (his hitbox is centered on it)
  const top = 12 - st + drop + (P.breath ?? 0) * 0.6;
  const hot = P.heat > 0.5;
  const steel = RAMP.steel;
  const steelB = RAMP.steelBack;
  const fistUp = P.fistUp ?? 0;
  const fistOut = P.fistOut ?? 0;

  const leg = (x, back) => {
    const footY = ground - (P.air ? 1 : 0);
    b.part(capsule(x, hipY, x - (back ? 0.5 : -0.5), footY - 3, 2.6), back ? steelB : steel);
    b.part(rrect(x - 2, hipY - 1, x + 2, hipY + 2, 1), RAMP.dark, { shine: false });
    b.part(rrect(x - 4.5, footY - 3, x + 4.5, footY, 1), back ? RAMP.armorBack : RAMP.armor);
  };
  const fist = (cx, cy, back) => {
    b.part(rrect(cx - 3.5, cy - 3.5, cx + 3.5, cy + 3.5, 1.5), hot ? (back ? RAMP.warm : RAMP.hot) : back ? steelB : steel);
    if (!back && !hot) for (let i = -1; i <= 1; i++) b.px(cx + 3, cy - 2 + i * 1.5, 'w');
  };

  // Back leg, back arm.
  leg(bx + 9, true);
  const backFist = [bx + 1 - fistOut * 0.5, top + 15 + drop * 0.2 - fistUp];
  b.part(capsule(bx + 5, top + 8, backFist[0], backFist[1] - 2, 2.2), steelB);
  fist(backFist[0], backFist[1], true);

  // Torso: red plating, steel belt with a buckle.
  const ty = top + 6;
  const sq = drop * 0.4;
  b.part(rrect(bx + 2, ty, bx + 26, ty + 15 - sq, 3), RAMP.armor);
  b.part(rrect(bx + 4, ty + 13 - sq, bx + 24, ty + 17 - sq, 1), steel);
  b.rect(bx + 12, ty + 14 - sq, 4, 2, hot ? 'Y' : 'O');
  // Furnace: a dark mouth with glowing bars; it opens wider when he fires.
  const open = P.shoot ? 1 : 0;
  const fx0 = Math.round(bx + 8);
  const fy0 = Math.round(ty + 4 - open);
  const fw = 12;
  const fh = 6 + open * 2;
  b.part(rrect(fx0, fy0, fx0 + fw, fy0 + fh, 1), RAMP.dark, { shine: false });
  for (let i = 0; i < 4; i++) {
    const x = fx0 + 2 + i * 3;
    for (let y = fy0 + 1; y < fy0 + fh; y++) b.px(x, y, y < fy0 + (hot ? 1 : 3) ? 'o' : (y + i) % 3 === 0 ? 'Y' : 'O');
  }
  b.rect(fx0 + 1, fy0 + fh - 1, fw - 1, 1, hot ? 'H' : 'Y');
  // Rivets, and the molten seams across the plating (brighter when hot).
  for (const [x, y] of [[bx + 4, ty + 3], [bx + 24, ty + 3], [bx + 4, ty + 10], [bx + 24, ty + 10]]) b.px(x, y, 'P');
  const seam = hot ? 'Y' : 'o';
  for (let x = bx + 3; x < bx + 8; x++) b.px(x, ty + 7 + (Math.round(x) % 2), seam);
  for (let x = bx + 21; x < bx + 26; x++) b.px(x, ty + 8 - (Math.round(x) % 2), seam);
  if (hot) {
    b.px(bx + 5, ty + 2, 'O');
    b.px(bx + 23, ty + 12 - sq, 'O');
  }

  // Head: the anvil. Face block, a waist with the visor slit, the wide top with the horn forward.
  const hy = top - 6;
  b.part(rrect(bx + 6, hy + 8, bx + 22, hy + 12, 1), steel);
  b.part(rrect(bx + 9, hy + 4, bx + 19, hy + 9, 0.5), steel);
  b.part(poly([[bx - 2, hy + 1], [bx + 22, hy + 1], [bx + 31, hy + 2.5], [bx + 22, hy + 4.5], [bx + 1, hy + 4.5]]), steel);
  b.rect(bx + 1, hy + 1, 21, 1, 'W');
  if (hot) for (const x of [bx + 3, bx + 12, bx + 20]) b.px(x, hy + 4, 'O'); // the face glowing from the forge
  b.rect(bx + 10, hy + 6, 9, 2, 'x');
  for (let i = 0; i < 7; i++) b.px(bx + 11 + i, hy + 6, P.angry ? (i % 3 === 0 ? 'Y' : 'R') : i % 3 === 0 ? 'W' : 'Y');

  // Front leg, front arm (fist or cannon).
  leg(bx + 19, false);
  const shoulder = [bx + 23, top + 9];
  let muzzle = null;
  let frontFist = null;
  if (P.shoot) {
    const cx = shoulder[0] + 3 - (P.recoil ?? 0);
    b.part(capsule(shoulder[0], shoulder[1], cx, shoulder[1] + 3, 2.4), steel);
    b.part(rrect(cx - 1, shoulder[1] + 0.5, cx + 10, shoulder[1] + 6.5, 1.5), hot ? RAMP.hot : steel);
    b.part(rrect(cx + 9, shoulder[1] + 1.5, cx + 12, shoulder[1] + 5.5, 0.5), RAMP.dark, { shine: false });
    b.rect(cx + 2, shoulder[1] + 2, 6, 1, hot ? 'H' : 'g');
    muzzle = [cx + 12, shoulder[1] + 3.5];
  } else {
    const fx = shoulder[0] + 4 + fistOut;
    const fy = top + 15 + drop * 0.2 - fistUp;
    b.part(capsule(shoulder[0], shoulder[1], fx, fy - 2, 2.4), steel);
    fist(fx, fy, false);
    frontFist = [fx, fy];
  }
  // Pauldrons in the armor's red, steel trim.
  b.part(ellipse(bx + 4, top + 8, 4, 3), RAMP.armorBack);
  b.part(ellipse(shoulder[0], shoulder[1] - 0.5, 4, 3), RAMP.armor);
  b.rect(shoulder[0] - 3, shoulder[1] + 2, 7, 1, 'w');
  b.outline();

  const rel = (p) => (p ? [Math.round((p[0] - W / 2) * 10) / 10, Math.round((p[1] - H) * 10) / 10] : null);
  return {
    bmp: b.toBitmap(),
    anchor: {
      furnace: rel([fx0 + fw / 2, fy0 + fh / 2]),
      visor: rel([bx + 14, hy + 6.5]),
      fists: [rel(backFist), frontFist ? rel(frontFist) : null].filter(Boolean),
      muzzle: rel(muzzle),
    },
  };
}

/** The poses the fight uses (see Anvil.ts), each cool and hot. */
const POSES = {
  idle1: { breath: 0 },
  idle2: { breath: 0.5 },
  idle3: { breath: 1 },
  idle4: { breath: 0.5 },
  crouch: { drop: 4, lean: 2, angry: true },
  dash: { drop: 2, lean: 4, fistOut: 3, angry: true },
  jump_up: { air: true, stretch: 3, fistUp: 10 },
  jump_top: { air: true, stretch: 1, fistUp: 10 },
  land1: { drop: 5, fistOut: 2, angry: true },
  land2: { drop: 2.5, fistOut: 1 },
  shoot: { shoot: true, angry: true },
  shoot_fire: { shoot: true, recoil: 2, angry: true },
};

export function anvilFrames() {
  const frames = {};
  const anchors = {};
  for (const [name, P] of Object.entries(POSES)) {
    for (const hot of [false, true]) {
      const key = `anvil_${name}${hot ? '_h' : ''}`;
      const { bmp, anchor } = draw({ ...P, heat: hot ? 1 : 0 });
      frames[key] = bmp;
      anchors[key] = anchor;
    }
  }
  // The old pose names (the intro, the ending's cast roll, the rematch rooms) point at the new art.
  for (const [old, now] of [['idle', 'idle1'], ['jump', 'jump_top'], ['shoot', 'shoot'], ['crouch', 'crouch']]) {
    frames[`anvil_${old}`] = frames[`anvil_${now}`];
    anchors[`anvil_${old}`] = anchors[`anvil_${now}`];
  }
  return { frames, anchors };
}
