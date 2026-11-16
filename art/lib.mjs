// Shared helpers for the art generators: an RGBA bitmap, text-grid drawing,
// and a dependency-free PNG encoder.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export class Bitmap {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = Buffer.alloc(w * h * 4);
  }
  set(x, y, rgb) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = (rgb >> 16) & 255;
    this.data[i + 1] = (rgb >> 8) & 255;
    this.data[i + 2] = rgb & 255;
    this.data[i + 3] = 255;
  }
  get(x, y) {
    const i = (y * this.w + x) * 4;
    return this.data[i + 3] ? (this.data[i] << 16) | (this.data[i + 1] << 8) | this.data[i + 2] : null;
  }
  fill(rgb) {
    for (let i = 0; i < this.w * this.h; i++) this.data.writeUInt32BE(((rgb << 8) | 0xff) >>> 0, i * 4);
  }
  /** Copy another bitmap in (transparent pixels skipped), optionally scaled up. */
  blit(src, dx, dy, scale = 1) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const rgb = src.get(x, y);
        if (rgb === null) continue;
        for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) this.set(dx + x * scale + sx, dy + y * scale + sy, rgb);
      }
    }
  }
}

/**
 * Draw a text grid. '.' is transparent; every other character is looked up
 * with `colorOf(ch)` (after an optional character remap). `flip` mirrors it.
 */
export function drawGrid(bmp, label, rows, ox, oy, colorOf, { map, flip } = {}) {
  const w = rows[0].length;
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`${label} row ${y} is ${row.length} wide, expected ${w}`);
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const c = map?.[ch] ?? ch;
      const rgb = colorOf(c);
      if (rgb === undefined) throw new Error(`${label}: unknown color "${ch}"`);
      bmp.set(ox + (flip ? w - 1 - x : x), oy + y, rgb);
    });
  });
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function encodePNG(bmp) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(bmp.w, 0);
  ihdr.writeUInt32BE(bmp.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = bmp.w * 4;
  const raw = Buffer.alloc((stride + 1) * bmp.h);
  for (let y = 0; y < bmp.h; y++) bmp.data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** Write a file under the project root and log it. */
export function write(relPath, buf) {
  const path = join(ROOT, relPath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
  console.log(`wrote ${relPath}`);
}

// --- 16-bit shading pass ------------------------------------------------------

const OUTLINE = 0x1a1428;

function split(c) {
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}
function join3(r, g, b) {
  const k = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return (k(r) << 16) | (k(g) << 8) | k(b);
}

/** Lighter, shifted warm (highlights lean yellow, the classic way). */
export function lighten(c, k) {
  const [r, g, b] = split(c);
  return join3(r + (255 - r) * k + 10 * k, g + (255 - g) * k + 6 * k, b + (255 - b) * k * 0.7);
}

/** Darker, shifted cool (shadows lean blue/purple). */
export function darken(c, k) {
  const [r, g, b] = split(c);
  return join3(r * (1 - k) - 6 * k, g * (1 - k * 1.05), b * (1 - k * 0.7) + 14 * k);
}

/**
 * Give flat-colored sprite art a 16-bit finish, in place:
 *  - each color region is lit along its top edge and shaded along its bottom
 *    edge (and a little on its right), so shapes read as rounded;
 *  - the outline above a lit edge takes a deep shade of that color instead of
 *    pure black ("selective outline"), which softens the silhouette.
 * Pixels in `keep` (exact colors, e.g. eye glints) are left alone.
 */
export function shade16(bmp, { keep = [], light = 0.28, dark = 0.26, selout = true } = {}) {
  const src = new Bitmap(bmp.w, bmp.h);
  bmp.data.copy(src.data);
  const at = (x, y) => (x < 0 || y < 0 || x >= bmp.w || y >= bmp.h ? null : src.get(x, y));
  const keepSet = new Set([OUTLINE, ...keep]);
  for (let y = 0; y < bmp.h; y++) {
    for (let x = 0; x < bmp.w; x++) {
      const c = at(x, y);
      if (c === null) continue;
      if (c === OUTLINE) {
        // Selective outline on the top side of a shape.
        const below = at(x, y + 1);
        if (selout && below !== null && below !== OUTLINE && at(x, y - 1) === null && !keepSet.has(below)) bmp.set(x, y, darken(below, 0.62));
        continue;
      }
      if (keepSet.has(c)) continue;
      const up = at(x, y - 1);
      const down = at(x, y + 1);
      const right = at(x + 1, y);
      const left = at(x - 1, y);
      // Tiny details (1px tall and wide) keep their color.
      if (up !== c && down !== c && left !== c && right !== c) continue;
      if (up !== c) {
        bmp.set(x, y, lighten(c, light));
        continue;
      }
      if (down !== c) {
        bmp.set(x, y, darken(c, dark));
        continue;
      }
      // Volume: where this color runs tall, light the upper part and shade the
      // lower part, with a checkerboard dither between the bands.
      let top = y;
      while (at(x, top - 1) === c) top--;
      let bottom = y;
      while (at(x, bottom + 1) === c) bottom++;
      const run = bottom - top + 1;
      const k = (y - top) / run;
      let out = c;
      if (run >= 6) {
        if (k < 0.22) out = lighten(c, light * 0.45);
        else if (k > 0.72) out = darken(c, dark * 0.75);
        else if (k > 0.58 && (x + y) % 2 === 0) out = darken(c, dark * 0.75);
      }
      // Right-hand side of a shape falls into shade; left-hand side catches light.
      if (right === null || right === OUTLINE) out = darken(out, dark * 0.45);
      else if (left === null || left === OUTLINE) out = lighten(out, light * 0.3);
      // A small glint near the top-left of big shapes.
      let lx = x;
      while (at(lx - 1, y) === c) lx--;
      if (run >= 10 && y - top === 2 && x - lx === 2) out = lighten(c, 0.75);
      bmp.set(x, y, out);
    }
  }
}
