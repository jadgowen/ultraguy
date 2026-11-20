import type Phaser from 'phaser';

/**
 * Art for the lane-crossing hop (HopScene), drawn once with Canvas 2D in the
 * game's 16-bit style. Everything is top-down, 16 px to a tile.
 *
 *  - hop_grass0/1, hop_trail0..2, hop_water0..3 (animated), hop_bramble: ground tiles
 *  - hop_goalpad, hop_goalpad_done: the three lily pads at the top (empty / claimed)
 *  - hop_log_l/m/r, hop_pad, hop_pad_sink: what you ride on the river
 *  - hop_beetle0/1, hop_boulder, hop_vine_l/m/r, hop_boar0/1, hop_rollog0/1: trail traffic (facing right)
 *  - hop_hero0/1: UltraGuy from above (standing / mid-hop), facing up
 *  - hop_jungle: the leafy margin either side of the field
 */

type Ctx = CanvasRenderingContext2D;

const INK = '#1a1428';

function canvas(scene: Phaser.Scene, key: string, w: number, h: number, paint: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, w, h)!;
  paint(t.getContext());
  t.refresh();
}

const px = (c: Ctx, col: string, x: number, y: number, w = 1, h = 1) => {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), w, h);
};
const bayer = (x: number, y: number) => [0, 0.5, 0.75, 0.25][(x & 1) + ((y & 1) << 1)];
const hash = (x: number, y: number, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const pick = (ramp: string[], k: number, x: number, y: number) => {
  const v = Math.min(ramp.length - 1, Math.max(0, k * (ramp.length - 1)));
  const lo = Math.floor(v);
  return ramp[Math.min(ramp.length - 1, lo + (v - lo > bayer(x, y) ? 1 : 0))];
};
/** Paint pixel rows ('.' is clear). */
function rows(c: Ctx, art: string[], pal: Record<string, string>, ox = 0, oy = 0): void {
  art.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && pal[ch] && px(c, pal[ch], ox + x, oy + y)));
}

const GRASS = ['#1e5a2a', '#2e7a34', '#3e9a44', '#5aba5a'];
const DIRT = ['#4a3220', '#6a4a30', '#8a6440', '#a8804e'];
const WATER = ['#0e3a6a', '#1a5a8a', '#2a7ab0', '#5aaad8'];
const BARK = ['#3a2614', '#5a3e22', '#7a5a34', '#9a7a4a'];
const LEAF = ['#1e5a2a', '#2e7a34', '#4ca04a', '#7ad06a'];

/** A lily pad (a disc with a notch and veins); sinking ones are smaller and darker. */
function pad(c: Ctx, sinking: boolean): void {
  const r = sinking ? 5.5 : 7.2;
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const dx = x - 7.5, dy = y - 7.5;
      const d = Math.hypot(dx, dy);
      if (d > r) continue;
      const a = Math.atan2(dy, dx);
      if (a > -0.25 && a < 0.35 && d > 1.5) continue; // the notch
      const k = 0.75 - (dx + dy) / 20 + bayer(x, y) * 0.12 - (sinking ? 0.3 : 0);
      px(c, d > r - 1 ? INK : (Math.round(a * 4) % 2 === 0 && d > 2.5 ? pick(LEAF, k - 0.15, x, y) : pick(LEAF, k, x, y)), x, y);
    }
  if (sinking) for (let a = 0; a < Math.PI * 2; a += 0.3) px(c, '#9ad8ff', 7.5 + Math.cos(a) * 7, 7.5 + Math.sin(a) * 7);
}

function log(c: Ctx, part: 'l' | 'm' | 'r'): void {
  for (let y = 2; y < 14; y++)
    for (let x = 0; x < 16; x++) {
      if (part === 'l' && x < 2) continue;
      if (part === 'r' && x > 13) continue;
      const k = 0.85 - Math.abs(y - 6) / 9 - (hash(x >> 2, y, 3) < 0.25 ? 0.15 : 0);
      const edge = y === 2 || y === 13 || (part === 'l' && x === 2) || (part === 'r' && x === 13);
      px(c, edge ? INK : pick(BARK, k, x, y), x, y);
    }
  // Bark grain, and the cut rings on the ends.
  for (let x = 1; x < 15; x += 5) px(c, BARK[0], x + (part === 'm' ? 2 : 0), 7, 3, 1);
  if (part !== 'm') {
    const ex = part === 'l' ? 3 : 10;
    for (let y = 3; y < 13; y++) px(c, y % 3 ? '#c8a070' : '#a07a4a', ex, y, 3, 1);
    px(c, '#7a5a34', ex + 1, 7, 1, 2);
  }
}

function water(c: Ctx, k: number): void {
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const wave = Math.sin(((x + k * 4) / 16) * Math.PI * 2 + y * 0.6) * 0.15;
      px(c, pick(WATER, 0.4 + wave + (y / 16) * 0.1, x, y), x, y);
    }
  // Glints that slide along.
  for (const [gx, gy] of [[2, 4], [10, 11]]) px(c, '#bfe6ff', (gx + k * 4) % 16, gy, 3, 1);
}

function jungle(c: Ctx, w: number, h: number): void {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px(c, pick(['#06140c', '#0a1e12', '#0e2a18'], 0.3 + hash(x >> 3, y >> 3, 9) * 0.4, x, y), x, y);
  // Leaf clusters: overlapping ovals, lit from the top left.
  for (let i = 0; i < 70; i++) {
    const cx = hash(i, 1, 4) * w, cy = hash(i, 2, 4) * h;
    const r = 5 + hash(i, 3, 4) * 7;
    for (let y = -r; y <= r; y++)
      for (let x = -r * 1.6; x <= r * 1.6; x++) {
        if ((x / 1.6) ** 2 + y * y > r * r) continue;
        const k = 0.75 - (x + y) / (r * 3) + bayer(x, y) * 0.15;
        px(c, pick(LEAF, k * (0.6 + hash(i, 4, 4) * 0.5), x, y), cx + x, cy + y);
      }
    px(c, '#1e5a2a', cx - r, cy, r * 2, 1); // the vein
  }
  // A few flowers.
  for (let i = 0; i < 8; i++) {
    const x = hash(i, 5, 2) * w, y = hash(i, 6, 2) * h;
    px(c, '#ff8ab8', x - 1, y, 3, 1);
    px(c, '#ff8ab8', x, y - 1, 1, 3);
    px(c, '#ffe14a', x, y, 1, 1);
  }
}

export function makeHopArt(scene: Phaser.Scene): void {
  for (const v of [0, 1])
    canvas(scene, `hop_grass${v}`, 16, 16, (c) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(c, pick(GRASS, 0.45 + hash(x, y, v) * 0.25, x, y), x, y);
      for (let i = 0; i < 4; i++) {
        const x = Math.floor(hash(i, v, 7) * 14), y = Math.floor(hash(i, v, 8) * 13);
        px(c, GRASS[3], x, y, 1, 2);
        px(c, GRASS[3], x + 1, y + 1, 1, 2);
      }
      if (v) {
        px(c, '#ffe14a', 11, 4);
        px(c, '#fff1e0', 4, 11);
      }
    });
  for (const v of [0, 1, 2])
    canvas(scene, `hop_trail${v}`, 16, 16, (c) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(c, pick(DIRT, 0.5 + hash(x >> 1, (y >> 1) + v * 9, 2) * 0.2 - (y === 4 || y === 11 ? 0.12 : 0), x, y), x, y);
      // A pebble or two, different on each variant.
      const n = v === 2 ? 0 : v + 1;
      for (let i = 0; i < n; i++) {
        const x = 2 + Math.floor(hash(i, v, 11) * 12), y = 2 + Math.floor(hash(i, v, 12) * 12);
        px(c, DIRT[0], x, y + 1, 2, 1);
        px(c, '#a8a090', x, y, 2, 1);
      }
    });
  for (let k = 0; k < 4; k++) canvas(scene, `hop_water${k}`, 16, 16, (c) => water(c, k));
  canvas(scene, 'hop_bramble', 16, 16, (c) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(c, pick(['#0e2a18', '#1e4a2a', '#2e6a34'], 0.3 + hash(x >> 1, y >> 1, 5) * 0.5, x, y), x, y);
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(hash(i, 1, 6) * 14) + 1, y = Math.floor(hash(i, 2, 6) * 14) + 1;
      px(c, '#c8a070', x, y, 1, 1);
      px(c, '#7a5a34', x + 1, y + 1, 1, 1);
    }
    px(c, '#e8484e', 5, 6, 2, 2);
    px(c, '#e8484e', 11, 11, 2, 2);
  });
  canvas(scene, 'hop_goalpad', 16, 16, (c) => {
    water(c, 0);
    pad(c, false);
    rows(c, ['.P.', 'PYP', '.P.'], { P: '#ff8ab8', Y: '#ffe14a' }, 5, 4);
  });
  canvas(scene, 'hop_goalpad_done', 16, 16, (c) => {
    water(c, 0);
    pad(c, false);
    // A little orange flag planted on it.
    rows(c, ['.K.....', '.KOOO..', '.KOOOO.', '.KOO...', '.K.....', '.K.....', 'KKK....'], { K: INK, O: '#f28c28' }, 5, 3);
  });
  for (const p of ['l', 'm', 'r'] as const) canvas(scene, `hop_log_${p}`, 16, 16, (c) => log(c, p));
  canvas(scene, 'hop_pad', 16, 16, (c) => pad(c, false));
  canvas(scene, 'hop_pad_sink', 16, 16, (c) => pad(c, true));
  // Trail traffic, facing right.
  for (const f of [0, 1])
    canvas(scene, `hop_beetle${f}`, 16, 16, (c) =>
      rows(
        c,
        f
          ? ['................', '...K.....K......', '....K...K.......', '...KKKKKKKK.....', '..KRRRRKRRWK....', '.KRRWRRKRRRYK...', 'KRRRRRRKRRRYKK..', 'KRRRRRRKRRRYYKK.', 'KrRRRRRKRRRYKK..', '.KrrRRRKRRrYK...', '..KrrrrKrrrK....', '...KKKKKKKK.....', '....K...K.......', '...K.....K......']
          : ['................', '....K...K.......', '....K...K.......', '...KKKKKKKK.....', '..KRRRRKRRWK....', '.KRRWRRKRRRYK...', 'KRRRRRRKRRRYKK..', 'KRRRRRRKRRRYYKK.', 'KrRRRRRKRRRYKK..', '.KrrRRRKRRrYK...', '..KrrrrKrrrK....', '...KKKKKKKK.....', '....K...K.......', '....K...K.......'],
        { K: INK, R: '#e8484e', r: '#8c2030', W: '#ffffff', Y: '#1a1428' },
      ),
    );
  canvas(scene, 'hop_boulder', 16, 16, (c) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x - 7.5, y - 7.5);
        if (d > 7.3) continue;
        const k = 0.8 - (x + y) / 26 + (hash(x >> 1, y >> 1, 1) < 0.2 ? -0.2 : 0) + bayer(x, y) * 0.1;
        px(c, d > 6.4 ? INK : k > 0.62 ? '#c8ccd8' : k > 0.4 ? '#8a8fa8' : '#55607a', x, y);
      }
    px(c, '#55607a', 6, 4, 4, 1);
    px(c, '#55607a', 9, 9, 1, 3);
  });
  for (const p of ['l', 'm', 'r'] as const)
    canvas(scene, `hop_vine_${p}`, 16, 16, (c) => {
      for (let x = 0; x < 16; x++) {
        if ((p === 'l' && x < 3) || (p === 'r' && x > 12)) continue;
        const y = 8 + Math.round(Math.sin(x / 2.5) * 2);
        px(c, INK, x, y - 2, 1, 5);
        px(c, '#2e7a34', x, y - 1, 1, 3);
        px(c, '#5aba5a', x, y - 1, 1, 1);
        if (x % 4 === 1) {
          px(c, '#c8a070', x, y - 3, 1, 1);
          px(c, '#c8a070', x + 1, y + 3, 1, 1);
        }
        if (x % 6 === 3) {
          px(c, '#4ca04a', x - 1, y - 5, 3, 2);
          px(c, INK, x - 2, y - 5, 1, 2);
        }
      }
    });
  for (const f of [0, 1])
    canvas(scene, `hop_boar${f}`, 16, 16, (c) =>
      rows(
        c,
        [
          '................',
          f ? '..K.......K.....' : '...K.....K......',
          f ? '..KB.....KB.....' : '...KB...KB......',
          '.KKBBBBBBBBKK...',
          'KbBBBBBBBBBBBK..',
          'KbBBBBBBBBBBWBKK',
          'KbBBBBBBBBBBBBPK',
          'KbBBBBBBBBBBBBPK',
          'KbBBBBBBBBBBWBKK',
          'KbBBBBBBBBBBBK..',
          '.KKBBBBBBBBKK...',
          f ? '..KB.....KB.....' : '...KB...KB......',
          f ? '..K.......K.....' : '...K.....K......',
        ],
        { K: INK, B: '#5a4a5a', b: '#3a2e3a', W: '#fff1e0', P: '#e8a8a8' },
        0,
        1,
      ),
    );
  for (const f of [0, 1])
    canvas(scene, `hop_rollog${f}`, 32, 16, (c) => {
      for (let y = 2; y < 14; y++)
        for (let x = 1; x < 31; x++) {
          const band = Math.floor((x + f * 3) / 6) % 2;
          const k = 0.85 - Math.abs(y - 6) / 9 - band * 0.12;
          px(c, y === 2 || y === 13 || x === 1 || x === 30 ? INK : pick(BARK, k, x, y), x, y);
        }
      for (const ex of [2, 27]) for (let y = 3; y < 13; y++) px(c, y % 3 ? '#c8a070' : '#a07a4a', ex, y, 3, 1);
    });
  // UltraGuy from above, facing up: helmet, visor, shoulders, arms.
  for (const f of [0, 1])
    canvas(scene, `hop_hero${f}`, 16, 16, (c) =>
      rows(
        c,
        f
          ? ['.....KKKKK......', '....KCCCCCK.....', '...KOCWCCCOK....', 'KK.KOOOOOOOK.KK.', 'KOKKOYOOOOoKKOK.', 'KOOKOOOOOOoKOOK.', '.KOKoOOOOOoKOK..', '..KKKoooooKKK...', '....KOOKOOK.....', '...KOOK.KOOK....', '...KKK...KKK....']
          : ['.....KKKKK......', '....KCCCCCK.....', '...KOCWCCCOK....', '...KOOOOOOOK....', '..KKOYOOOOoKK...', '.KOKOOOOOOoKOK..', '.KOKoOOOOOoKOK..', '..KKKoooooKKK...', '....KOOKOOK.....', '....KOOKOOK.....', '....KKK.KKK.....'],
        { K: INK, O: '#f28c28', o: '#b8501a', Y: '#ffc070', C: '#5ef0c8', W: '#ffffff' },
        0,
        2,
      ),
    );
  canvas(scene, 'hop_jungle', 86, 240, (c) => jungle(c, 86, 240));
}
