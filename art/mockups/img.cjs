const fs = require('fs'), zlib = require('zlib');
function decodePNG(file) {
  const d = fs.readFileSync(file);
  let p = 8, w = 0, h = 0, idat = [], ct = 6;
  while (p < d.length) {
    const len = d.readUInt32BE(p), type = d.toString('ascii', p + 4, p + 8), data = d.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(w * h * 4);
  const stride = w * bpp;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[i] = v & 255;
    }
    for (let x = 0; x < w; x++) { out[(y * w + x) * 4] = line[x * bpp]; out[(y * w + x) * 4 + 1] = line[x * bpp + 1]; out[(y * w + x) * 4 + 2] = line[x * bpp + 2]; out[(y * w + x) * 4 + 3] = bpp === 4 ? line[x * bpp + 3] : 255; }
    prev = line;
  }
  return { w, h, px: out };
}
function encodePNG(w, h, px, file) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const T = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
/** A pixel canvas: blit sprites, fill, and write out scaled. */
class Canvas {
  constructor(w, h, bg = [0, 0, 0, 0]) { this.w = w; this.h = h; this.px = Buffer.alloc(w * h * 4); for (let i = 0; i < w * h; i++) this.px.set(bg, i * 4); }
  get(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null; const i = (y * this.w + x) * 4; return [this.px[i], this.px[i + 1], this.px[i + 2], this.px[i + 3]]; }
  set(x, y, c) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = (y * this.w + x) * 4; const a = (c[3] ?? 255) / 255; for (let k = 0; k < 3; k++) this.px[i + k] = Math.round(this.px[i + k] * (1 - a) + c[k] * a); this.px[i + 3] = Math.max(this.px[i + 3], c[3] ?? 255); }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  /** Draw a sprite region; opts: scale, flip, map(rgba)->rgba. */
  blit(src, sx, sy, sw, sh, dx, dy, o = {}) {
    const s = o.scale ?? 1;
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const i = ((sy + y) * src.w + sx + (o.flip ? sw - 1 - x : x)) * 4;
      let c = [src.px[i], src.px[i + 1], src.px[i + 2], src.px[i + 3]];
      if (c[3] < 128) continue;
      if (o.map) c = o.map(c, x, y);
      if (!c) continue;
      for (let j = 0; j < s; j++) for (let k = 0; k < s; k++) this.set(dx + x * s + k, dy + y * s + j, c);
    }
  }
  write(file, scale = 1, bg = [20, 22, 38]) {
    const W = this.w * scale, H = this.h * scale, out = Buffer.alloc(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (Math.floor(y / scale) * this.w + Math.floor(x / scale)) * 4, o = (y * W + x) * 4;
      const a = this.px[i + 3] / 255;
      for (let k = 0; k < 3; k++) out[o + k] = Math.round(this.px[i + k] * a + bg[k] * (1 - a));
      out[o + 3] = 255;
    }
    encodePNG(W, H, out, file);
  }
}
module.exports = { decodePNG, encodePNG, Canvas };
