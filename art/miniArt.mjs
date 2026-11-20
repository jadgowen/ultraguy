// The stage minibosses, redrawn on the shaded-parts rig (like the bosses),
// with real animation frames for their moves.
//
//  PRESS TITAN (Foundry): a hazard-striped hydraulic walker with a steel press
//    plate for a head. Crouches before it jumps, tucks its pistons in the air,
//    squashes on landing, and flattens when a press comes down on it.
//  TUSK MAMMOTH (Glacier): an ice-plated robot mammoth with ivory tusks. Lowers
//    its head and paws before a charge, gallops, skids, flails as it falls in.
//  STORM KITE (Stratos): a delta-winged kite drone with lightning-striped sails
//    and streamers. Flaps, raises its wings to call down rain, tilts to swoop.
//  ANGLER (Reef): a riveted deep-sea anglerfish bot with a lure on a stalk. Its
//    jaw gapes before it lunges.
//
// miniFrames() returns { frames, anchors } (anchors from bottom-center, facing right).

import { Buf, capsule, ellipse, poly, rrect, ramp as R, relTo } from './shadedParts.mjs';

const PAL = {
  K: 0x1a1428, W: 0xfff1e0, w: 0xc8ccd8, G: 0x8a8fa8, g: 0x55607a, d: 0x2b2540, x: 0x141226,
  O: 0xf28c28, o: 0xb8501a, n: 0x7a3010, Y: 0xffe14a, y: 0xd8a020,
  R: 0xe8484e, r: 0x8c2030,
  I: 0xf4fbff, i: 0xc8e8f8, J: 0x8ac0e8, j: 0x4a80b8, k: 0x2a4a80,
  T: 0xfff4e0, t: 0xd8c8a8,
  C: 0xe6fbff, c: 0x9ee8ff, V: 0x4ac8f0, v: 0x2a78b8,
  P: 0xc8a0ff, p: 0x8c4ad8, q: 0x5a2a9a, Q: 0x34185a,
  N: 0x4a6a9a, m: 0x2e4468, M: 0x1c2a44, L: 0x5ef0c8,
};
const STEEL = R('W', 'w', 'G', 'g');
const STEELB = R('w', 'G', 'g', 'd');
const HAZ = R('Y', 'O', 'O', 'o');
const HAZB = R('O', 'o', 'o', 'n');
const ICE = R('I', 'i', 'J', 'j');
const ICEB = R('i', 'J', 'j', 'k');
const IVORY = R('W', 'T', 'T', 't');
const SAIL = R('P', 'p', 'p', 'q');
const SAILB = R('p', 'q', 'q', 'Q');
const DEEP = R('N', 'N', 'm', 'M');
const DEEPB = R('m', 'm', 'M', 'x');
const GOLD = R('W', 'Y', 'Y', 'y');
const RED = R('W', 'R', 'R', 'r');
const DARK = R('d', 'd', 'x', 'x');
const GLOW = R('W', 'C', 'c', 'V');

// --- PRESS TITAN -----------------------------------------------------------------
/** P: drop (body lowered), air (pistons tucked), squash (0..1 flattened), port (cannon lit), breath. */
function press(P) {
  const W = 48, H = 44;
  const b = new Buf(W, H, PAL);
  const ground = H - 1;
  const cx = 24;
  const sq = P.squash ?? 0;
  const drop = (P.drop ?? 0) + sq * 14 + (P.breath ?? 0);
  const top = 8 + drop;
  const tuck = P.air ? 5 : 0;
  // Pistons and feet (the back one darker).
  for (const [x, back] of [[cx - 10, true], [cx + 10, false]]) {
    const footY = ground - tuck;
    const hipY = top + 22 - sq * 6;
    b.part(rrect(x - 3, hipY, x + 3, footY - 3, 1), back ? STEELB : STEEL);
    b.part(rrect(x - 2, hipY, x + 2, hipY + 3, 0.5), back ? DARK : R('G', 'g', 'g', 'd'));
    b.part(rrect(x - 6, footY - 4, x + 6, footY, 1), back ? HAZB : HAZ);
  }
  // Body: a hazard-orange block with a striped band and a dark visor with the eye.
  const bodyH = 20 - sq * 8;
  b.part(rrect(cx - 16, top + 4, cx + 16, top + 4 + bodyH, 2), HAZ);
  for (let x = cx - 15; x < cx + 15; x++) for (let y = top + 4 + bodyH - 5; y < top + 4 + bodyH - 1; y++) if (((x + y) >> 1) % 3 === 0) b.px(x, y, 'K');
  b.part(rrect(cx - 4, top + 8, cx + 13, top + 12 - sq * 2, 1), DARK, { shine: false });
  b.rect(cx + 5, top + 9, 6, 2 - sq, 'R');
  b.px(cx + 9, top + 9, 'W');
  // Front cannon port.
  b.part(ellipse(cx + 15, top + 14 - sq * 4, 3, 3), P.port ? GOLD : STEELB);
  // The press plate: a heavy steel slab with rivets, and pistons up into it.
  b.part(rrect(cx - 20, top - 3, cx + 20, top + 4, 1), STEEL);
  for (const x of [cx - 17, cx - 6, cx + 6, cx + 17]) b.px(x, top, 'W');
  for (const x of [cx - 11, cx + 11]) b.part(rrect(x - 1.5, top + 3, x + 1.5, top + 6, 0.3), STEELB);
  b.outline();
  const rel = relTo(W, H);
  return { bmp: b.toBitmap(), anchor: { eye: rel([cx + 8, top + 10]), mouth: rel([cx + 16, top + 14 - sq * 4]) } };
}
const PRESS_POSES = {
  idle1: {}, idle2: { breath: 1 },
  crouch: { drop: 5 },
  jump: { air: true },
  land: { drop: 6 },
  shoot: { port: true },
  squash: { squash: 1 },
};

// --- TUSK MAMMOTH ----------------------------------------------------------------
/** P: legs (-1..1 stride), head (0 up .. 1 lowered), lean, trunk (-1..1), fall (tilt), brace. */
function mammoth(P) {
  const W = 54, H = 40;
  const b = new Buf(W, H, PAL);
  const ground = H - 1;
  const cx = 24 + (P.lean ?? 0);
  const fall = P.fall ?? 0;
  const top = 10 + fall * 2;
  const head = P.head ?? 0;
  const stride = P.legs ?? 0;
  // Legs: four pillars, back pair darker, stepping in a gallop.
  const leg = (x, back, s) => {
    const lift = Math.max(0, s) * 3;
    const fx = x + s * 3 + (P.brace ? (x > cx ? 3 : -3) : 0);
    b.part(capsule(x, top + 18, fx, ground - 2 - lift - fall * 6, 3.4), back ? ICEB : ICE);
    b.part(rrect(fx - 4, ground - 4 - lift - fall * 6, fx + 4, ground - lift - fall * 6, 1.2), back ? DARK : STEELB);
  };
  leg(cx - 12, true, -stride);
  leg(cx + 8, true, stride);
  // Body: a shaggy plated mass with ice crystals along the back.
  b.part(ellipse(cx - 2, top + 13, 18, 11), ICE);
  for (let i = 0; i < 5; i++) {
    const x = cx - 14 + i * 6;
    b.part(poly([[x - 2.5, top + 4 - (i % 2)], [x, top - 4 - (i % 2) * 2], [x + 2.5, top + 4]]), R('W', 'C', 'c', 'V'));
  }
  // Shag: plate seams.
  for (let i = 0; i < 4; i++) for (let y = top + 9; y < top + 22; y++) if ((y + i) % 3) b.px(cx - 12 + i * 7, y, 'j');
  leg(cx - 8, false, stride);
  leg(cx + 12, false, -stride);
  // Head: low and forward when charging; tusks and a curling trunk.
  const hx = cx + 16 + head * 3;
  const hy = top + 9 + head * 7;
  b.part(ellipse(hx, hy, 8, 7), ICE);
  b.part(ellipse(hx - 4, hy - 1, 4, 5), ICEB);
  const tr = P.trunk ?? 0;
  b.part(capsule(hx + 6, hy + 2, hx + 9 + head * 3, hy + 9 - head * 2, 2.4), ICE);
  b.part(capsule(hx + 9 + head * 3, hy + 9 - head * 2, hx + 7 + tr * 3 + head * 6, hy + 14 - head * 5, 2), ICE);
  // Tusks: curving forward (and up, unless the head's down).
  b.part(capsule(hx + 3, hy + 4, hx + 12, hy + 6 - head * 1, 1.6), IVORY);
  b.part(capsule(hx + 12, hy + 6 - head, hx + 15, hy + 2 - head * 3, 1.3), IVORY);
  // Eye.
  b.part(ellipse(hx + 3, hy - 2, 1.6, 1.6), GLOW, { shine: false });
  b.outline();
  const rel = relTo(W, H);
  return { bmp: b.toBitmap(), anchor: { eye: rel([hx + 3, hy - 2]), mouth: rel([hx + 8, hy + 6]), tip: rel([hx + 15, hy + 2 - head * 3]) } };
}
const MAMMOTH_POSES = {
  idle1: { trunk: -1 }, idle2: { trunk: 1 },
  windup: { head: 1, lean: -2, legs: 0.6, trunk: 0 },
  run1: { head: 1, legs: 1, lean: 1 },
  run2: { head: 1, legs: -1, lean: 1 },
  skid: { head: 0.4, brace: true, lean: -2 },
  fall: { fall: 1, legs: 1, head: 0.2, trunk: 1 },
};

// --- STORM KITE ------------------------------------------------------------------
/** P: flap (-1..1 wingtips up/down), charge (wings raised, red eye), tilt (swoop). */
function kite(P) {
  const W = 52, H = 32;
  const b = new Buf(W, H, PAL);
  const cx = 26, cy = 13;
  const flap = P.flap ?? 0;
  const tilt = P.tilt ?? 0;
  const up = P.charge ? -5 : 0;
  // Streamers trailing below, with little bows.
  for (const [x0, ph] of [[cx - 4, 0], [cx + 4, 1.5]]) {
    let x = x0, y = cy + 8;
    for (let i = 0; i < 6; i++) {
      const nx = x + Math.sin(ph + i * 0.9 + flap) * 1.5 - tilt * 0.6;
      const ny = y + 2.4;
      b.part(capsule(x, y, nx, ny, 0.7), i % 2 ? GOLD : RED);
      x = nx;
      y = ny;
    }
    b.part(poly([[x - 2, y], [x + 2, y - 1.5], [x + 2, y + 1.5]]), RED);
  }
  // Sails: two triangles from the pod out to the tips, lightning stripes across.
  const tipY = cy - 2 + flap * 5 + up;
  const tips = [];
  for (const side of [-1, 1]) {
    const tx = cx + side * 25;
    const ty = tipY + side * tilt * 4;
    tips.push([tx, ty]);
    const ramp = side < 0 ? SAILB : SAIL;
    b.part(poly([[cx + side * 3, cy - 6 + tilt * side], [tx, ty], [cx + side * 4, cy + 7 + tilt * side]]), ramp);
    // A zigzag bolt along the sail.
    const pts = [[cx + side * 6, cy - 1], [cx + side * 12, ty * 0.3 + cy * 0.7 - 2], [cx + side * 14, cy + 1], [cx + side * 21, ty + 1]];
    b.line(pts, 'Y');
    b.px(tx, ty, 'W');
  }
  // Pod: a dark capsule with the eye.
  b.part(rrect(cx - 5, cy - 8 + tilt, cx + 5, cy + 8 + tilt, 4), DARK);
  b.part(rrect(cx - 4, cy - 7 + tilt, cx + 4, cy - 4 + tilt, 1.5), SAIL);
  b.part(ellipse(cx, cy + 1 + tilt, 3.2, 3.2), R('W', 'T', 't', 't'));
  b.part(ellipse(cx + 0.5, cy + 1 + tilt, 1.7, 1.7), P.charge ? RED : R('C', 'V', 'V', 'v'), { shine: false });
  b.outline();
  const rel = relTo(W, H);
  return { bmp: b.toBitmap(), anchor: { eye: rel([cx + 0.5, cy + 1 + tilt]), lights: tips.map(rel) } };
}
const KITE_POSES = {
  fly1: { flap: -1 }, fly2: { flap: 0 }, fly3: { flap: 1 },
  charge: { charge: true, flap: -0.5 },
  dive: { tilt: 2, flap: 0.5 },
};

// --- ANGLER ----------------------------------------------------------------------
/** P: tail (-1..1), gape (jaw open 0..1), stretch (lunge). */
function angler(P) {
  const W = 50, H = 36;
  const b = new Buf(W, H, PAL);
  const cx = 22 - (P.stretch ?? 0), cy = 20;
  const gape = P.gape ?? 0;
  const tail = P.tail ?? 0;
  // Tail fin and the dorsal/pectoral fins.
  const tx = cx - 17 - (P.stretch ?? 0);
  b.part(poly([[tx + 4, cy - 1], [tx - 6, cy - 8 + tail * 3], [tx - 3, cy + tail], [tx - 6, cy + 8 + tail * 3], [tx + 4, cy + 3]]), DEEPB);
  b.part(poly([[cx - 6, cy - 9], [cx - 2, cy - 14], [cx + 4, cy - 10]]), DEEPB);
  // Body: a rounded riveted hull.
  b.part(ellipse(cx, cy, 16 + (P.stretch ?? 0) * 0.5, 11), DEEP);
  for (let i = 0; i < 5; i++) b.px(cx - 10 + i * 5, cy - 8 + Math.abs(i - 2), 'N');
  for (let i = 0; i < 4; i++) for (let y = cy - 4; y < cy + 9; y += 3) b.px(cx - 9 + i * 5, y, 'M');
  b.part(poly([[cx - 2, cy + 5], [cx - 9, cy + 11], [cx + 2, cy + 8]]), DEEPB);
  // The jaw: the lower one drops open; teeth on both.
  const jx = cx + 10;
  const jy = cy + 1;
  const open = gape * 7;
  b.part(poly([[jx - 6, jy - 6], [jx + 12, jy - 3], [jx + 11, jy], [jx - 6, jy]]), DEEP);
  b.part(poly([[jx - 6, jy + 1], [jx + 11, jy + 1 + open * 0.6], [jx + 12, jy + 4 + open], [jx - 6, jy + 6]]), DEEPB);
  if (gape > 0.2) b.part(poly([[jx - 4, jy], [jx + 10, jy], [jx + 10, jy + 1 + open * 0.6], [jx - 4, jy + 2]]), DARK, { shine: false });
  for (let i = 0; i < 5; i++) {
    const x = jx - 3 + i * 3;
    b.px(x, jy, 'T');
    b.px(x + 1, jy + 1 + open * 0.6 * (i / 4), 'T');
  }
  // Eye: small and yellow.
  b.part(ellipse(cx + 5, cy - 4, 2.2, 2.2), GOLD, { shine: false });
  b.px(cx + 5, cy - 4, 'x');
  // Lure stalk: up from the head, arching forward.
  const lx = cx + 20 + (P.stretch ?? 0) * 0.5, ly = cy - 15 + gape * 2;
  b.line([[cx + 4, cy - 9], [cx + 10, cy - 15], [cx + 16, cy - 17], [lx, ly]], 'G');
  b.part(ellipse(lx, ly + 1, 1.8, 1.8), R('W', 'Y', 'Y', 'y'), { shine: false });
  b.outline();
  const rel = relTo(W, H);
  return { bmp: b.toBitmap(), anchor: { eye: rel([cx + 5, cy - 4]), hand: rel([lx, ly + 1]), mouth: rel([jx + 8, jy + 2]) } };
}
const ANGLER_POSES = {
  swim1: { tail: -1 }, swim2: { tail: 0 }, swim3: { tail: 1 },
  gape: { gape: 0.7, tail: -0.5 },
  dash: { gape: 1, stretch: 3, tail: 1 },
  spit: { gape: 0.45, tail: 0 },
};

export function miniFrames() {
  const frames = {}, anchors = {};
  const add = (prefix, fn, poses) => {
    for (const [n, P] of Object.entries(poses)) {
      const { bmp, anchor } = fn(P);
      frames[`${prefix}_${n}`] = bmp;
      anchors[`${prefix}_${n}`] = anchor;
    }
  };
  add('press', press, PRESS_POSES);
  add('mammoth', mammoth, MAMMOTH_POSES);
  add('kite', kite, KITE_POSES);
  add('angler', angler, ANGLER_POSES);
  // The old pose names (cast roll, intro) point at the new art.
  for (const [old, now] of [['press_idle', 'press_idle1'], ['press_attack', 'press_shoot'], ['mammoth_idle', 'mammoth_idle1'], ['mammoth_attack', 'mammoth_run1'], ['kite_idle', 'kite_fly2'], ['kite_attack', 'kite_charge'], ['angler_idle', 'angler_swim2'], ['angler_attack', 'angler_gape']]) {
    frames[old] = frames[now];
    anchors[old] = anchors[now];
  }
  return { frames, anchors };
}
