// Put real UltraGuy boss-fight shots (art/final/shots/<stage>.png, 427x240 captures from
// the game) onto the CRT screens around THE CREATOR, then cut the result out.
//   node art/crt.cjs
// Each screen is a quad (corners TL, TR, BR, BL, in the Krea image's pixels). The shot is
// warped onto it with scanlines and a glassy tint, only over the screen's cool glass pixels,
// so beard hair hanging over a screen (warm browns) stays on top.
const path = require('path');
const { execFileSync } = require('child_process');
const { decodePNG, encodePNG } = require('./mockups/img.cjs');
const ART = __dirname;
const SRC = path.join(ART, 'mockups/krea/creator_202.png');
const TMP = path.join(ART, 'mockups/krea/creator_202_crt.png');
const SCREENS = [
  { shot: 'foundry', quad: [[750, 580], [793, 593], [783, 650], [739, 632]] },
  { shot: 'reef', quad: [[700, 710], [756, 722], [750, 783], [672, 780]] },
  { shot: 'intro', quad: [[562, 817], [620, 802], [625, 855], [567, 875]] },
  { shot: 'canopy', quad: [[320, 880], [387, 887], [390, 917], [322, 910]], beard: true },
  { shot: 'caldera', quad: [[213, 705], [245, 712], [250, 768], [222, 765]], beard: true },
];

const im = decodePNG(SRC);
/** Inverse bilinear: the (u, v) in [0,1]^2 of point p inside quad q (Newton steps). */
function uv(q, x, y) {
  let u = 0.5, v = 0.5;
  for (let i = 0; i < 12; i++) {
    const px = (1 - u) * (1 - v) * q[0][0] + u * (1 - v) * q[1][0] + u * v * q[2][0] + (1 - u) * v * q[3][0];
    const py = (1 - u) * (1 - v) * q[0][1] + u * (1 - v) * q[1][1] + u * v * q[2][1] + (1 - u) * v * q[3][1];
    const dxu = (1 - v) * (q[1][0] - q[0][0]) + v * (q[2][0] - q[3][0]), dyu = (1 - v) * (q[1][1] - q[0][1]) + v * (q[2][1] - q[3][1]);
    const dxv = (1 - u) * (q[3][0] - q[0][0]) + u * (q[2][0] - q[1][0]), dyv = (1 - u) * (q[3][1] - q[0][1]) + u * (q[2][1] - q[1][1]);
    const det = dxu * dyv - dxv * dyu;
    if (Math.abs(det) < 1e-9) break;
    const ex = x - px, ey = y - py;
    u += (ex * dyv - ey * dxv) / det;
    v += (ey * dxu - ex * dyu) / det;
  }
  return [u, v];
}
for (const s of SCREENS) {
  const shot = decodePNG(path.join(ART, 'final/shots', `${s.shot}.png`));
  const xs = s.quad.map((p) => p[0]), ys = s.quad.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y++) for (let x = Math.floor(Math.min(...xs)); x <= Math.max(...xs); x++) {
    const [u, v] = uv(s.quad, x + 0.5, y + 0.5);
    if (u < 0 || u > 1 || v < 0 || v > 1) continue;
    const i = (y * im.w + x) * 4;
    const [r, g, b] = [im.px[i], im.px[i + 1], im.px[i + 2]];
    const lum = 0.3 * r + 0.59 * g + 0.11 * b;
    // The screen's own pixels are cool (blue/white glass); beard hanging over it is warm brown.
    // Keep warm pixels, replace cool ones, and feather the in-between.
    const warm = r - b;
    // (Screens with no beard over them are replaced outright, painted figures and all.)
    const k = s.beard ? Math.max(0, Math.min(1, (14 - warm) / 22)) * (lum < 40 ? 0.5 : 1) : 1;
    if (k <= 0 || Math.min(r, b) - g > 70) continue;
    // Sample the shot (crop a touch so the HUD bars sit at the edge), CRT-style.
    const sx = Math.min(shot.w - 1, Math.floor((0.04 + u * 0.92) * shot.w)), sy = Math.min(shot.h - 1, Math.floor((0.04 + v * 0.92) * shot.h));
    const si = (sy * shot.w + sx) * 4;
    const scan = Math.floor(v * 40) % 2 === 0 ? 1 : 0.82;
    const edge = Math.min(u, 1 - u, v, 1 - v);
    const vign = Math.min(1, 0.55 + edge * 4);
    for (let c = 0; c < 3; c++) {
      const tint = c === 2 ? 1.08 : c === 1 ? 1.02 : 0.95;
      const val = Math.min(255, shot.px[si + c] * scan * vign * tint * 1.08 + 18);
      im.px[i + c] = Math.round(im.px[i + c] * (1 - k * 0.88) + val * k * 0.88);
    }
  }
}
encodePNG(im.w, im.h, im.px, TMP);
execFileSync('node', [path.join(ART, 'keyout.cjs'), TMP, path.join(ART, 'final/creator.png')], { stdio: 'inherit' });
