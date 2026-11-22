// Renders THE CREATOR mockup sheet from creator.html's drawing code: node art/mockups/creator-sheet.cjs
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const root = path.join(__dirname, '/');
const kit = fs.readFileSync(root + 'kit.js', 'utf8').split('const Kit =')[0];
const html = fs.readFileSync(root + 'creator.html', 'utf8');
const script = html.split('<script>')[1].split('const designs =')[0];
const fn = new Function(kit + script + '; return { head, poseAt, PAL, W, H };');
const { head, poseAt, PAL, W, H } = fn();
const S = 4, pad = 8;
const styles = ['smile', 'talk', 'menace'];
const OW = styles.length * (W * S + pad) + pad, OH = H * S + pad * 2;
const buf = Buffer.alloc(OW * OH * 4);
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
for (let i = 0; i < OW * OH; i++) { buf[i * 4] = 0x1c; buf[i * 4 + 1] = 0x2a; buf[i * 4 + 2] = 0x44; buf[i * 4 + 3] = 255; }
styles.forEach((st, k) => {
  const P = poseAt(st, 5); P.talk = st === 'talk' ? 0.8 : 0; P.glint = st === 'smile' ? 0.4 : -1;
  const b = head(P);
  const ox = pad + k * (W * S + pad);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = b.c[y * W + x]; if (!c) continue;
    const [r, g, bl] = hex(PAL[c]);
    for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) {
      const i = ((pad + y * S + dy) * OW + ox + x * S + dx) * 4;
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = bl; buf[i + 3] = 255;
    }
  }
});
const raw = Buffer.alloc((OW * 4 + 1) * OH);
for (let y = 0; y < OH; y++) { raw[y * (OW * 4 + 1)] = 0; buf.copy(raw, y * (OW * 4 + 1) + 1, y * OW * 4, (y + 1) * OW * 4); }
const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(OW, 0); ihdr.writeUInt32BE(OH, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
fs.writeFileSync(process.argv[2] ?? path.join(__dirname, 'creator-sheet.png'), png);
console.log('ok', OW, OH);
