// Shared drawing tools for bosses drawn on shaded parts (Anvil, Magma, ...), the
// same approach as the hero: each shape is filled with a light-to-dark ramp
// (lit top and left, shaded bottom and right) and outlined against what's behind.

import { Bitmap } from './lib.mjs';

export class Buf {
  /** `pal` maps the palette characters used in ramps to colors. */
  constructor(w, h, pal) {
    this.w = w;
    this.h = h;
    this.pal = pal;
    this.c = new Array(w * h).fill('');
  }
  part(inside, ramp, { shine = true } = {}) {
    const { w, h } = this;
    const m = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x + 0.5, y + 0.5)) m[y * w + x] = 1;
    const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (!at(x, y)) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || at(nx, ny)) continue;
          if (this.c[ny * w + nx]) this.c[ny * w + nx] = 'K';
        }
      }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (!at(x, y)) continue;
        let c = ramp.base;
        if (!at(x, y - 1)) c = shine && !at(x - 1, y) ? ramp.shine : ramp.light;
        else if (!at(x - 1, y) && at(x, y + 1)) c = ramp.light;
        else if (!at(x, y + 1)) c = ramp.dark;
        else if (!at(x + 1, y)) c = ramp.dark;
        this.c[y * w + x] = c;
      }
  }
  px(x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y * this.w + x] = c;
  }
  rect(x0, y0, w, h, c) {
    for (let y = Math.round(y0); y < Math.round(y0) + h; y++) for (let x = Math.round(x0); x < Math.round(x0) + w; x++) this.px(x, y, c);
  }
  /** A 1px line through the points. */
  line(pts, c) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
      for (let k = 0; k <= n; k++) this.px(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, c);
    }
  }
  outline() {
    const { w, h } = this;
    const out = this.c.slice();
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (this.c[y * w + x]) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && this.c[ny * w + nx] && this.c[ny * w + nx] !== 'K') {
            out[y * w + x] = 'K';
            break;
          }
        }
      }
    this.c = out;
  }
  toBitmap() {
    const bmp = new Bitmap(this.w, this.h);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = this.c[y * this.w + x];
        if (c) bmp.set(x, y, this.pal[c]);
      }
    return bmp;
  }
}

export const capsule = (ax, ay, bx, by, r) => (x, y) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - ax - dx * t, y - ay - dy * t) <= r;
};
export const ellipse = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
export const rrect = (x0, y0, x1, y1, rad = 1) => (x, y) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.max(x0 + rad, Math.min(x1 - rad, x));
  const cy = Math.max(y0 + rad, Math.min(y1 - rad, y));
  return Math.hypot(x - cx, y - cy) <= rad + 0.01;
};
export const poly = (pts) => (x, y) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};


/** A color ramp from four palette characters. */
export const ramp = (shine, light, base, dark) => ({ shine, light, base, dark });

/** Offsets from a frame's bottom-center (for the game's glow anchors). */
export const relTo = (W, H) => (p) => [Math.round((p[0] - W / 2) * 10) / 10, Math.round((p[1] - H) * 10) / 10];
