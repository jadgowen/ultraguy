// MANTIS, "Orchid Assassin" design (picked from art/mockups/mantis.html).
// An orchid mantis: soft pink and white like a flower, petal wings, green eyes,
// blades like petals. Upright stance: a slanted thorax over a long abdomen,
// thin legs with high knees, a triangle head, scythe arms folded in front.
// mantisFrames() returns { frames, anchors } (anchors from bottom-center, facing right).

import { Buf, capsule, ellipse, poly, ramp as R, relTo } from './shadedParts.mjs';

const PAL = {
  K: 0x1a1428, W: 0xfff1e0, x: 0x141226,
  P: 0xfff0f8, p: 0xffc0dc, Q: 0xe080b0, q: 0x9a4a78,
  E: 0x7ad04a, e: 0x3a9a34, f: 0x1e5a24,
};
const BODY = R('P', 'p', 'Q', 'q');
const BACK = R('p', 'Q', 'q', 'x');
const WING = R('P', 'P', 'p', 'Q');
const EYE = R('W', 'E', 'e', 'f');
const BLADE = R('P', 'P', 'p', 'Q');
export const MANTIS_W = 48;
export const MANTIS_H = 44;

function draw(P) {
  const W = MANTIS_W, H = MANTIS_H;
  const b = new Buf(W, H, PAL);
  const ground = H - 1;
  const cx = 22;
  const crouch = P.crouch ?? 0, air = P.air ?? 0, breath = P.breath ?? 0;
  const hip = [cx, ground - 14 + crouch * 3 - air * 3];
  const leg = (fx, kx, bk) => {
    const foot = [hip[0] + fx * (air ? 0.6 : 1), ground - (air ? 5 : 0)];
    const knee = [hip[0] + kx, hip[1] - 4 + (air ? 3 : 0)];
    b.part(capsule(hip[0], hip[1], knee[0], knee[1], 0.7), bk ? BACK : BODY);
    b.part(capsule(knee[0], knee[1], foot[0], foot[1], 0.6), bk ? BACK : BODY);
  };
  leg(-12, -6, true);
  leg(9, 5, true);
  b.part(ellipse(hip[0] - 7, hip[1] + 1, 8, 3.5 + breath * 0.3), BODY);
  for (let i = -12; i <= -3; i += 3) b.px(hip[0] + i, hip[1] + 1, 'p');
  if (P.wing) {
    b.part(poly([[hip[0] - 1, hip[1] - 4], [hip[0] - 18, hip[1] - 14], [hip[0] - 20, hip[1] - 6], [hip[0] - 4, hip[1]]]), WING);
    b.part(poly([[hip[0] - 1, hip[1] - 2], [hip[0] - 14, hip[1] - 6], [hip[0] - 16, hip[1] + 1], [hip[0] - 4, hip[1] + 1]]), WING);
  } else b.part(ellipse(hip[0] - 6, hip[1] - 1.5, 7, 1.8), WING);
  leg(-8, -3, false);
  leg(12, 7, false);
  const sh = [hip[0] + 4, hip[1] - 12 - breath * 0.6 + crouch * 1.5];
  b.part(capsule(hip[0], hip[1], sh[0], sh[1], 1.8), BODY);
  const hx = sh[0] + 2, hy = sh[1] - 4;
  b.part(poly([[hx - 4.5, hy - 1.5], [hx + 5.5, hy - 1.5], [hx + 1, hy + 4]]), BODY);
  b.part(ellipse(hx - 3.5, hy - 1.5, 2.2, 2.2), EYE);
  b.part(ellipse(hx + 4.5, hy - 1.5, 2.2, 2.2), EYE);
  b.px(hx - 3.5, hy - 2.5, 'W');
  b.px(hx + 4.5, hy - 2.5, 'W');
  b.line([[hx - 1, hy - 3], [hx - 4, hy - 9]], 'q');
  b.line([[hx + 2, hy - 3], [hx + 6, hy - 9]], 'q');
  const arm = (bk) => {
    const base = [sh[0] + (bk ? 0 : 1), sh[1] + 2];
    const up = P.armUp ?? 0, out = P.armOut ?? 0;
    const el = [base[0] + 4 + out * 6, base[1] + 4 - up * 9 - out * 3];
    const wrist = [el[0] + 1 + out * 5, el[1] - 6 - up * 4 + out * 3];
    const tip = [wrist[0] + 3 + out * 3, wrist[1] + 5 - up * 7 - out * 3];
    b.part(capsule(base[0], base[1], el[0], el[1], 1.1), bk ? BACK : BODY);
    b.part(capsule(el[0], el[1], wrist[0], wrist[1], 1.3), bk ? BACK : BODY);
    b.part(poly([[wrist[0] - 0.5, wrist[1] - 0.5], [tip[0] + 0.5, tip[1]], [wrist[0] + 1.5, wrist[1] + 1]]), BLADE);
    return tip;
  };
  arm(true);
  const tip = arm(false);
  b.outline();
  const rel = relTo(W, H);
  return { bmp: b.toBitmap(), anchor: { eye: rel([hx, hy - 1.5]), tip: rel(tip) } };
}

const POSES = {
  idle1: { breath: 0 }, idle2: { breath: 0.5 }, idle3: { breath: 1 }, idle4: { breath: 0.5 },
  jump_up: { air: 1, wing: 1, armUp: 0.4 },
  jump_top: { air: 1, wing: 1, armUp: 1 },
  land: { crouch: 1 },
  throw1: { armOut: 0.5 },
  throw2: { armOut: 1 },
};

export function mantisFrames() {
  const frames = {}, anchors = {};
  for (const [n, P] of Object.entries(POSES)) {
    const { bmp, anchor } = draw(P);
    frames[`mantis_${n}`] = bmp;
    anchors[`mantis_${n}`] = anchor;
  }
  for (const [old, now] of [['idle', 'idle1'], ['jump', 'jump_top'], ['throw', 'throw2']]) {
    frames[`mantis_${old}`] = frames[`mantis_${now}`];
    anchors[`mantis_${old}`] = anchors[`mantis_${now}`];
  }
  return { frames, anchors };
}
