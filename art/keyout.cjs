// Cut the flat magenta background out of Krea art (flood-filled from the edges and from
// enclosed near-pure magenta, so darker purples inside the figure, like Jared's veins, are kept), soften
// the edge, take the magenta fringe off it, and crop to the figure.
//   node art/keyout.cjs in.png out.png
const { decodePNG, encodePNG } = require('./mockups/img.cjs');
const [, , src, dst] = process.argv;
const im = decodePNG(src);
const { w, h, px } = im;
const mag = (i) => { const r = px[i], g = px[i + 1], b = px[i + 2]; return Math.min(r, b) - g; };
const bg = new Uint8Array(w * h);
const stack = [];
for (let x = 0; x < w; x++) stack.push([x, 0], [x, h - 1]);
for (let y = 0; y < h; y++) stack.push([0, y], [w - 1, y]);
// Pockets of background enclosed by the figure (between legs, under wings): seed from any
// near-pure magenta, which the art itself never uses (Jared's veins are a darker purple).
for (let k = 0; k < w * h; k++) { const i = k * 4; if (px[i] > 225 && px[i + 2] > 225 && px[i + 1] < 50 && Math.abs(px[i] - px[i + 2]) < 30) stack.push([k % w, Math.floor(k / w)]); }
while (stack.length) {
  const [x, y] = stack.pop();
  if (x < 0 || y < 0 || x >= w || y >= h) continue;
  const k = y * w + x;
  if (bg[k] || mag(k * 4) < 70) continue;
  bg[k] = 1;
  stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
}
const out = Buffer.from(px);
let x0 = w, y0 = h, x1 = 0, y1 = 0;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const k = y * w + x, i = k * 4;
  if (bg[k]) { out[i + 3] = 0; continue; }
  // Next to the background: fade by how magenta it still is, and pull the magenta out.
  const edge = (x > 0 && bg[k - 1]) || (x < w - 1 && bg[k + 1]) || (y > 0 && bg[k - w]) || (y < h - 1 && bg[k + w]);
  if (edge) {
    const m = Math.max(0, mag(i));
    out[i + 3] = Math.max(0, 255 - m * 2);
    const g = out[i + 1];
    out[i] = Math.min(out[i], g + 40); out[i + 2] = Math.min(out[i + 2], g + 40);
  }
  if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
}
const cw = x1 - x0 + 1, ch = y1 - y0 + 1, crop = Buffer.alloc(cw * ch * 4);
for (let y = 0; y < ch; y++) out.copy(crop, y * cw * 4, ((y0 + y) * w + x0) * 4, ((y0 + y) * w + x1 + 1) * 4);
encodePNG(cw, ch, crop, dst);
console.log(`${dst}: ${cw}x${ch}`);
