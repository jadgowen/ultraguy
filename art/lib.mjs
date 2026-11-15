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
