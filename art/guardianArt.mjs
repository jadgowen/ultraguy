// The fortress guardians, redrawn on the shaded-parts rig (like the stage bosses)
// with the frames their redesigned fights need.
//
//  GATEKEEPER: an armored golem with crenellated shoulders and a portcullis tower
//    shield. The shield blocks from the front; he raises it overhead to slam
//    (front open), bashes with it, and drops it when he's dazed after a bash
//    into the wall.
//  ABYSS EYE: a great eye in an iron casing whose lids shut tight (shots bounce
//    off) and open to attack. Its wall pods are separate little eyes.
//  SPIRE WARDEN: a winged knight with a sword who leaps between the tiers of
//    his tower.
//
// guardianFrames() returns { frames, anchors } (anchors from bottom-center, facing right).

import { Buf, capsule, ellipse, poly, rrect, ramp as R, relTo } from './shadedParts.mjs';

const PAL = {
  K: 0x1a1428, W: 0xfff1e0, w: 0xc8ccd8, G: 0x8a8fa8, g: 0x55607a, d: 0x2b2540, x: 0x141226,
  P: 0xc8a0ff, p: 0x8c4ad8, q: 0x5a2a9a, Q: 0x34185a,
  R: 0xe8484e, r: 0x8c2030, Y: 0xffe14a, y: 0xd8a020, O: 0xf28c28,
  C: 0xe6fbff, c: 0x9ee8ff, V: 0x4ac8f0, v: 0x2a78b8,
  S: 0xfff4e0, s: 0xe0d0c0, t: 0xb8a898,
};
const STEEL = R('W', 'w', 'G', 'g');
const STEELB = R('w', 'G', 'g', 'd');
const ARMOR = R('P', 'p', 'p', 'q');
const ARMORB = R('p', 'q', 'q', 'Q');
const GOLD = R('W', 'Y', 'Y', 'y');
const VISOR = R('C', 'c', 'V', 'v');
const RED = R('W', 'R', 'R', 'r');
const DARK = R('d', 'd', 'x', 'x');
const SCLERA = R('W', 'S', 's', 't');

// --- GATEKEEPER ------------------------------------------------------------------
export const GATE_W = 52;
export const GATE_H = 52;

/** The portcullis: a dark frame, a grid of steel bars, spikes along the bottom. */
function portcullis(b, x0, y0, x1, y1, spikes = true) {
  b.part(rrect(x0, y0, x1, y1, 1), ARMORB);
  b.part(rrect(x0 + 1.5, y0 + 1.5, x1 - 1.5, y1 - 1.5, 0.5), DARK, { shine: false });
  for (let x = Math.ceil(x0 + 2); x < x1 - 1.5; x += 3) for (let y = Math.ceil(y0 + 2); y < y1 - 1.5; y++) b.px(x, y, y % 4 === 0 ? 'W' : 'G');
  for (let y = Math.ceil(y0 + 4); y < y1 - 1.5; y += 4) for (let x = Math.ceil(x0 + 2); x < x1 - 1.5; x++) b.px(x, y, 'w');
  if (spikes) for (let x = Math.ceil(x0 + 2); x < x1 - 1.5; x += 3) b.px(x, y1, 'G');
}

/** P: shield ('front' | 'raised' | 'slam' | 'down'), lean, crouch, step (-1..1), daze, glow. */
function gate(P) {
  const W = GATE_W, H = GATE_H;
  const b = new Buf(W, H, PAL);
  const ground = H - 1;
  const cx = 22 + (P.lean ?? 0);
  const top = 16 + (P.crouch ?? 0);
  const step = P.step ?? 0;
  // Legs (stubby pillars) and feet.
  for (const [x, back, lift] of [[cx - 6, true, Math.max(0, step) * 2], [cx + 5, false, Math.max(0, -step) * 2]]) {
    b.part(rrect(x - 3.5, top + 26, x + 3.5, ground - 2 - lift, 1), back ? STEELB : STEEL);
    b.part(rrect(x - 5, ground - 3 - lift, x + 5, ground - lift, 1), back ? ARMORB : ARMOR);
  }
  // Back arm.
  b.part(rrect(cx - 18, top + 10, cx - 12, top + 22, 1.5), ARMORB);
  // Torso: purple armor with a steel belt and a gold keyhole.
  b.part(rrect(cx - 13, top + 4, cx + 11, top + 28, 3), ARMOR);
  b.part(rrect(cx - 14, top + 24, cx + 12, top + 28, 1), STEEL);
  b.part(ellipse(cx - 1, top + 14, 3, 3), GOLD);
  b.part(poly([[cx - 2.5, top + 15], [cx + 0.5, top + 15], [cx + 1.5, top + 20], [cx - 3.5, top + 20]]), GOLD);
  b.px(cx - 1, top + 14, 'x');
  // Crenellated shoulders.
  for (const [x, back] of [[cx - 12, true], [cx + 9, false]]) {
    b.part(rrect(x - 6, top, x + 6, top + 9, 1), back ? STEELB : STEEL);
    for (const k of [-5, -1, 3]) b.part(rrect(x + k, top - 3, x + k + 2, top + 1, 0.3), back ? STEELB : STEEL);
  }
  // Helm with a visor slit.
  const hy = top - 6 + (P.daze ? 2 : 0);
  b.part(rrect(cx - 6, hy, cx + 6, hy + 10, 2.5), STEEL);
  b.part(rrect(cx - 3, hy + 3, cx + 6, hy + 5, 0.5), P.daze ? DARK : VISOR);
  if (P.glow) b.rect(cx - 2, hy + 3, 7, 1, 'R');
  // The shield.
  const s = P.shield ?? 'front';
  let shieldAt;
  if (s === 'front' || s === 'slam') {
    const sx = cx + 17 + (s === 'slam' ? 3 : 0);
    const y0 = s === 'slam' ? top + 8 : top - 2;
    b.part(rrect(cx + 8, top + 12, sx - 3, top + 18, 1.5), ARMOR); // arm to the grip
    portcullis(b, sx - 5, y0, sx + 5, ground - 1);
    shieldAt = [sx, (y0 + ground) / 2];
  } else if (s === 'raised') {
    b.part(capsule(cx + 9, top + 6, cx + 6, top - 4, 2.5), ARMOR);
    b.part(capsule(cx - 12, top + 6, cx - 9, top - 4, 2.5), ARMORB);
    portcullis(b, cx - 18, 1, cx + 16, 11);
    shieldAt = [cx - 1, 6];
  } else {
    // Dropped: lying tilted on the ground in front, the arm hanging.
    b.part(capsule(cx + 9, top + 10, cx + 13, top + 22, 2.5), ARMOR);
    portcullis(b, cx + 12, ground - 7, cx + 29, ground - 1, false);
    shieldAt = [cx + 20, ground - 4];
  }
  b.outline();
  const rel = relTo(W, H);
  return { bmp: b.toBitmap(), anchor: { eye: rel([cx + 2, hy + 4]), core: rel([cx - 1, top + 16]), tip: rel(shieldAt) } };
}

const GATE_POSES = {
  idle1: {}, idle2: { crouch: 1 },
  walk1: { step: 1 }, walk2: { step: -1 },
  bash: { lean: 4, crouch: 2, glow: true },
  raise: { shield: 'raised', crouch: -1, glow: true },
  slam: { shield: 'slam', crouch: 4, glow: true },
  daze: { shield: 'down', crouch: 4, daze: true },
  shoot: { glow: true },
};

// --- ABYSS EYE -------------------------------------------------------------------
export const ABYSS_W = 46;
export const ABYSS_H = 46;

/** P: open (0..1), glare (red iris), look (-1..1). */
function abyss(P) {
  const W = ABYSS_W, H = ABYSS_H;
  const b = new Buf(W, H, PAL);
  const c = 23;
  const open = P.open ?? 1;
  // Spikes and the iron casing.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = c + Math.cos(a) * 21, y = c + Math.sin(a) * 21;
    b.part(poly([[c + Math.cos(a - 0.18) * 17, c + Math.sin(a - 0.18) * 17], [x, y], [c + Math.cos(a + 0.18) * 17, c + Math.sin(a + 0.18) * 17]]), ARMORB);
  }
  b.part(ellipse(c, c, 19, 19), STEELB);
  b.part(ellipse(c, c, 17, 17), ARMOR);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    b.px(c + Math.cos(a) * 18, c + Math.sin(a) * 18, 'W');
  }
  // The eye: sclera, iris, pupil.
  b.part(ellipse(c, c, 14, 14), SCLERA);
  const ix = c + (P.look ?? 0) * 3;
  b.part(ellipse(ix, c, 7.5, 7.5), P.glare ? RED : ARMOR);
  b.part(ellipse(ix, c, 3.5, 3.5), DARK, { shine: false });
  b.px(ix - 3, c - 3, 'W');
  b.px(ix - 2, c - 3, 'W');
  // Veins.
  for (const [x0, y0, x1, y1] of [[c - 12, c - 4, c - 8, c - 2], [c + 12, c + 5, c + 8, c + 3], [c - 3, c + 13, c - 2, c + 9]]) b.line([[x0, y0], [x1, y1]], 'r');
  // Lids: steel plates closing from top and bottom, curved edges, rivets.
  const gap = 14 * open;
  if (open < 1) {
    const lid = (x, y) => ellipse(c, c, 15, 15)(x, y) && (y < c - gap + Math.abs(x - c) * 0.25 * (1 - open) || y > c + gap - Math.abs(x - c) * 0.25 * (1 - open));
    b.part(lid, STEEL);
    if (open < 0.1) b.line([[c - 14, c], [c + 14, c]], 'g');
    for (const x of [c - 8, c, c + 8]) {
      b.px(x, c - Math.max(3, gap) - 3, 'G');
      b.px(x, c + Math.max(3, gap) + 3, 'G');
    }
  }
  b.outline();
  const rel = relTo(W, H);
  return { bmp: b.toBitmap(), anchor: { eye: rel([ix, c]), core: rel([c, c]) } };
}

const ABYSS_POSES = {
  shut: { open: 0 },
  crack: { open: 0.25, glare: true },
  half: { open: 0.55 },
  open: { open: 1 },
  glare: { open: 1, glare: true },
};

/** A wall pod: a small eye in an armored housing (hot = about to fire). */
function pod(hot) {
  const b = new Buf(14, 14, PAL);
  b.part(rrect(0.5, 0.5, 13.5, 13.5, 2), ARMORB);
  b.part(ellipse(7, 7, 4.5, 4.5), SCLERA);
  b.part(ellipse(7, 7, 2.5, 2.5), hot ? RED : ARMOR);
  b.px(7, 7, 'x');
  for (const [x, y] of [[2, 2], [11, 2], [2, 11], [11, 11]]) b.px(x, y, 'W');
  b.outline();
  return b.toBitmap();
}

// --- SPIRE WARDEN ------------------------------------------------------------------
export const WARDEN_W = 48;
export const WARDEN_H = 58;

/** P: wings (-1 folded .. 1 spread up), crouch, air, sword ('rest' | 'slash' | 'up' | 'down'), lob, breath. */
function warden(P) {
  const W = WARDEN_W, H = WARDEN_H;
  const b = new Buf(W, H, PAL);
  const ground = H - 1;
  const cx = 22;
  const top = 18 + (P.crouch ?? 0) + (P.breath ?? 0) * 0.5 - (P.air ? 2 : 0);
  const wings = P.wings ?? 0;
  // Wings: fans of steel feather-blades from the shoulders, behind everything.
  for (const [side, ramp] of [[-1, STEELB], [1, STEEL]]) {
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 2 - side * (0.75 + i * 0.36) + side * wings * 0.3 - (wings < 0 ? side * 0.6 : 0);
      const len = 20 - i * 2 + wings * 3;
      const rx = cx + side * 3, ry = top + 6;
      b.part(capsule(rx, ry, rx + Math.cos(a) * len, ry + Math.sin(a) * len, 2 - i * 0.2), ramp);
      b.px(rx + Math.cos(a) * len, ry + Math.sin(a) * len, side > 0 ? 'W' : 'w');
    }
  }
  // Legs (tucked in the air).
  const tuck = P.air ? 5 : 0;
  for (const [x, back] of [[cx - 4, true], [cx + 4, false]]) {
    b.part(rrect(x - 2.5, top + 23, x + 2.5, ground - 3 - tuck, 1), back ? STEELB : STEEL);
    b.part(rrect(x - 3.5, ground - 4 - tuck, x + 4.5, ground - 1 - tuck, 1), back ? ARMORB : ARMOR);
  }
  // Tabard, breastplate, belt.
  b.part(poly([[cx - 5, top + 18], [cx + 5, top + 18], [cx + 3, top + 28], [cx - 3, top + 28]]), ARMOR);
  b.rect(cx - 0.5, top + 19, 1, 8, 'Y');
  b.part(rrect(cx - 8, top + 6, cx + 8, top + 19, 3), STEEL);
  b.part(rrect(cx - 8.5, top + 17, cx + 8.5, top + 20, 1), GOLD);
  // Back arm.
  b.part(capsule(cx - 8, top + 9, cx - 10, top + 19, 2.2), STEELB);
  // Helm, visor, plume.
  b.part(rrect(cx - 5, top - 3, cx + 6, top + 7, 2.5), STEEL);
  b.part(rrect(cx - 1, top + 1, cx + 6, top + 3, 0.5), VISOR);
  b.part(poly([[cx - 4, top - 2], [cx + 3, top - 3], [cx - 1, top - 10], [cx - 9, top - 7]]), RED);
  // Front arm and the sword.
  const sw = P.sword ?? 'rest';
  let hand, tip;
  if (sw === 'slash') {
    hand = [cx + 12, top + 11];
    tip = [cx + 25, top + 10];
  } else if (sw === 'up') {
    hand = [cx + 9, top - 3];
    tip = [cx + 11, top - 17];
  } else if (sw === 'down') {
    hand = [cx + 9, top + 16];
    tip = [cx + 11, top + 30];
  } else {
    hand = [cx + 10, top + 17];
    tip = [cx + 16, top + 4];
  }
  if (P.lob) hand = [cx + 6, top - 5];
  b.part(capsule(cx + 8, top + 9, hand[0], hand[1], 2.3), STEEL);
  if (!P.lob) {
    b.part(capsule(hand[0], hand[1], tip[0], tip[1], 1.3), R('W', 'C', 'c', 'V'));
    const nx = tip[1] - hand[1], ny = -(tip[0] - hand[0]);
    const nl = Math.hypot(nx, ny) || 1;
    b.part(capsule(hand[0] - (nx / nl) * 3, hand[1] - (ny / nl) * 3, hand[0] + (nx / nl) * 3, hand[1] + (ny / nl) * 3, 1), GOLD);
  }
  b.part(ellipse(hand[0], hand[1], 2.2, 2.2), ARMOR);
  b.part(ellipse(cx + 8, top + 8, 3.5, 3), ARMOR);
  b.outline();
  const rel = relTo(W, H);
  return { bmp: b.toBitmap(), anchor: { eye: rel([cx + 3, top + 2]), hand: rel([hand[0], hand[1] - (P.lob ? 5 : 0)]), tip: rel(tip) } };
}

const WARDEN_POSES = {
  idle1: { breath: 0 }, idle2: { breath: 1, wings: 0.2 },
  crouch: { crouch: 4, wings: -0.5 },
  leap: { air: true, wings: 1, sword: 'up' },
  slash: { sword: 'slash', wings: 0.4, crouch: 1 },
  lob: { lob: true, wings: 0.6 },
  dive: { air: true, wings: -1, sword: 'down' },
};

export function guardianFrames() {
  const frames = {}, anchors = {};
  const add = (prefix, fn, poses) => {
    for (const [n, P] of Object.entries(poses)) {
      const { bmp, anchor } = fn(P);
      frames[`${prefix}_${n}`] = bmp;
      anchors[`${prefix}_${n}`] = anchor;
    }
  };
  add('gatekeeper', gate, GATE_POSES);
  add('abyss', abyss, ABYSS_POSES);
  add('warden', warden, WARDEN_POSES);
  frames.abyss_pod = pod(false);
  frames.abyss_pod_hot = pod(true);
  // The old pose names (cast roll, portraits, rematch room) point at the new art.
  for (const [old, now] of [['gatekeeper_idle', 'gatekeeper_idle1'], ['gatekeeper_attack', 'gatekeeper_bash'], ['abyss_idle', 'abyss_open'], ['abyss_attack', 'abyss_glare'], ['warden_idle', 'warden_idle1'], ['warden_attack', 'warden_slash']]) {
    frames[old] = frames[now];
    anchors[old] = anchors[now];
  }
  return { frames, anchors };
}
