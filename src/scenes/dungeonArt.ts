import type Phaser from 'phaser';

/**
 * Art for SCRAP'S JUNK MAZE (DungeonScene), drawn once with Canvas 2D in the
 * game's 16-bit style: a top-down scrapyard dungeon seen from a little above,
 * so walls show a lit top and, where they meet the floor, a shaded front face.
 *
 *  - dg_wall_top0..2, dg_wall_face0..2: heaped scrap (plates, tyres, pipes)
 *  - dg_floor0..3: rusted floor plates; dg_pit, dg_pit_lip: the drop
 *  - dg_post: a magnet bollard; dg_door_lock, dg_door_boss: shutters
 *  - dg_key, dg_bigkey, dg_heart: pickups; dg_hud_heart0..2 (empty / half / full), dg_hud_key, dg_hud_bigkey
 *  - dg_beetle0/1 (facing up), dg_sprout0/1, dg_saw, dg_hook
 *  - dg_lamp: an amber warning lamp; dg_vignette: the room's dark edges
 */

type Ctx = CanvasRenderingContext2D;

const INK = '#1a1428';
const STEEL = ['#2b2540', '#55607a', '#8a8fa8', '#c8ccd8', '#eef2fa'];
const RUST = ['#4a2814', '#7a4220', '#b8703a', '#e8b07a'];
const PLATE = ['#2e2a24', '#3e382e', '#4e463a', '#5e5646'];

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
function rows(c: Ctx, art: string[], pal: Record<string, string>, ox = 0, oy = 0): void {
  art.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && pal[ch] && px(c, pal[ch], ox + x, oy + y)));
}

/** The top of a scrap heap: overlapping plates and a tyre or pipe, lit from the top left. */
function wallTop(c: Ctx, v: number, h = 16): void {
  for (let y = 0; y < h; y++) for (let x = 0; x < 16; x++) px(c, pick(STEEL, 0.3 + hash(x >> 2, y >> 2, v) * 0.25, x, y), x, y);
  // Plates.
  for (let i = 0; i < 3; i++) {
    const x0 = Math.floor(hash(i, v, 1) * 10), y0 = Math.floor(hash(i, v, 2) * (h - 6));
    const w = 5 + Math.floor(hash(i, v, 3) * 5), hh = 4 + Math.floor(hash(i, v, 4) * 3);
    const ramp = i === 1 ? RUST : STEEL;
    px(c, INK, x0, y0, w + 1, hh + 1);
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) px(c, pick(ramp, 0.75 - (x + y) / (w + hh) * 0.6, x0 + x, y0 + y), x0 + x, y0 + y);
    px(c, ramp[ramp.length - 1], x0, y0, w, 1);
    px(c, '#eef2fa', x0 + 1, y0 + 1, 1, 1);
  }
  if (v === 1) {
    // A tyre.
    for (let y = 0; y < 10; y++)
      for (let x = 0; x < 10; x++) {
        const d = Math.hypot(x - 4.5, y - 4.5);
        if (d > 4.8 || d < 1.8) continue;
        px(c, d > 4 || d < 2.4 ? INK : d < 3.2 ? '#3a3a44' : '#2a2a32', x + 5, y + Math.min(4, h - 10));
      }
  }
  if (v === 2) {
    // A pipe end.
    px(c, INK, 2, 3, 12, 5);
    for (let x = 3; x < 13; x++) px(c, pick(STEEL, 0.85 - Math.abs(x - 6) / 12, x, 4), x, 4, 1, 3);
    px(c, '#2b2540', 12, 4, 1, 3);
  }
}

function floor(c: Ctx, v: number): void {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(c, pick(PLATE, 0.5 + hash(x >> 1, y >> 1, v + 7) * 0.25 - (y === 15 || x === 15 ? 0.4 : 0) + (y === 0 || x === 0 ? 0.2 : 0), x, y), x, y);
  // Rivets in the corners, rust bloom, an oil stain on some.
  for (const [x, y] of v === 1 ? [[2, 2], [13, 13]] : v === 2 ? [[13, 2]] : [[2, 13]]) {
    px(c, '#7a7468', x, y);
    px(c, '#1e1a16', x + 1, y + 1);
  }
  for (let i = 0; i < 2 + v; i++) {
    const x = 3 + Math.floor(hash(i, v, 5) * 10), y = 3 + Math.floor(hash(i, v, 6) * 10);
    px(c, RUST[1], x, y, 2, 1);
    px(c, RUST[2], x + 1, y, 1, 1);
  }
  if (v === 3)
    for (let y = 0; y < 6; y++)
      for (let x = 0; x < 8; x++) if ((x - 3.5) ** 2 / 16 + (y - 2.5) ** 2 / 7 < 1) px(c, bayer(x, y) > 0.4 ? '#1a1814' : '#24201a', x + 5, y + 6);
}

export function makeDungeonArt(scene: Phaser.Scene): void {
  for (let v = 0; v < 3; v++) {
    canvas(scene, `dg_wall_top${v}`, 16, 16, (c) => wallTop(c, v));
    // With a front face: the top squeezed into the upper part, then a dark stacked face.
    canvas(scene, `dg_wall_face${v}`, 16, 16, (c) => {
      wallTop(c, v, 7);
      for (let y = 7; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const band = Math.floor((y - 7) / 3);
          const ramp = (band + v) % 3 === 1 ? RUST : STEEL;
          px(c, pick(ramp, 0.42 - (y - 7) / 30 - ((y - 7) % 3 === 2 ? 0.15 : 0), x, y), x, y);
        }
      px(c, INK, 0, 7, 16, 1);
      px(c, '#000000', 0, 15, 16, 1);
    });
  }
  for (let v = 0; v < 4; v++) canvas(scene, `dg_floor${v}`, 16, 16, (c) => floor(c, v));
  canvas(scene, 'dg_pit', 16, 16, (c) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(c, bayer(x, y) > 0.7 && hash(x, y, 1) < 0.15 ? '#141220' : '#050508', x, y);
  });
  canvas(scene, 'dg_pit_lip', 16, 16, (c) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(c, '#050508', x, y);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 16; x++) px(c, y < 2 ? RUST[1] : pick(['#050508', '#1a1410', '#2a2016'], 1 - y / 6, x, y), x, y);
    px(c, RUST[2], 0, 0, 16, 1);
  });
  canvas(scene, 'dg_post', 16, 16, (c) => {
    floor(c, 0);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x - 7.5, y - 8.5);
        if (d > 6.2) continue;
        const ring = d > 4.2;
        const stripe = Math.floor((Math.atan2(y - 8.5, x - 7.5) + Math.PI) * 2) % 2;
        px(c, d > 5.4 ? INK : ring ? (stripe ? '#ffe14a' : '#1a1428') : pick(STEEL, 0.9 - Math.hypot(x - 6, y - 7) / 8, x, y), x, y);
      }
    px(c, '#ffffff', 6, 6, 2, 1);
  });
  for (const boss of [false, true])
    canvas(scene, boss ? 'dg_door_boss' : 'dg_door_lock', 16, 16, (c) => {
      const ramp = boss ? ['#4a1018', '#8c2030', '#c83a4a', '#ff8a8a'] : RUST;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(c, x === 0 || x === 15 || y === 0 || y === 15 ? INK : pick(ramp, 0.65 - (y % 4 === 3 ? 0.3 : 0) - x / 40, x, y), x, y);
      if (boss) rows(c, ['.KKKK.', 'KWWWWK', 'KWKKWK', 'KWWWWK', '.KWWK.', '.K..K.'], { K: INK, W: '#fff1e0' }, 5, 4);
      else rows(c, ['..KK..', '.K..K.', 'KYYYYK', 'KYKKYK', 'KYYYYK', '.KKKK.'], { K: INK, Y: '#ffe14a' }, 5, 5);
    });
  canvas(scene, 'dg_key', 12, 8, (c) => rows(c, ['.KKK........', 'KYYYK.......', 'KYKYKKKKKKK.', 'KYYYYYYYYYYK', '.KKK.KKYKYK.', '.......K.K..'], { K: INK, Y: '#ffe14a' }, 0, 1));
  canvas(scene, 'dg_bigkey', 16, 10, (c) =>
    rows(c, ['..KKKK..........', '.KYYYYK.........', 'KYYKKYYKKKKKKKK.', 'KYKWWKYYYYYYYYYK', 'KYKWWKYYYYYYYYYK', 'KYYKKYYKKYKKYKK.', '.KYYYYK.KYK.KYK.', '..KKKK...K...K..'], { K: INK, Y: '#ffe14a', W: '#e8484e' }, 0, 1),
  );
  const heart = (c: Ctx, fill: number) =>
    rows(
      c,
      ['.KK.KK.', 'KRRKRRK', 'KRWRRRK', 'KRRRRRK', '.KRRRK.', '..KRK..', '...K...'].map((row) =>
        [...row].map((ch, x) => (ch === 'R' || ch === 'W' ? (fill === 0 || (fill === 1 && x > 3) ? 'e' : ch) : ch)).join(''),
      ),
      { K: INK, R: '#e8484e', W: '#ffffff', e: '#3a2030' },
    );
  canvas(scene, 'dg_heart', 7, 7, (c) => heart(c, 2));
  for (const f of [0, 1, 2]) canvas(scene, `dg_hud_heart${f}`, 7, 7, (c) => heart(c, f));
  canvas(scene, 'dg_hud_key', 12, 8, (c) => rows(c, ['.KKK........', 'KYYYK.......', 'KYKYKKKKKKK.', 'KYYYYYYYYYYK', '.KKK.KKYKYK.', '.......K.K..'], { K: INK, Y: '#ffe14a' }, 0, 1));
  canvas(scene, 'dg_hud_bigkey', 16, 10, (c) =>
    rows(c, ['..KKKK..........', '.KYYYYK.........', 'KYYKKYYKKKKKKKK.', 'KYKWWKYYYYYYYYYK', 'KYKWWKYYYYYYYYYK', 'KYYKKYYKKYKKYKK.', '.KYYYYK.KYK.KYK.', '..KKKK...K...K..'], { K: INK, Y: '#ffe14a', W: '#e8484e' }, 0, 1),
  );
  // A scrap beetle from above, facing up: steel shell split down the middle, legs.
  for (const f of [0, 1])
    canvas(scene, `dg_beetle${f}`, 14, 14, (c) =>
      rows(
        c,
        f
          ? ['....KKKK......', '...KYKKYK.....', 'K.KBBKKBBK.K..', '.KBbBKKBBbK...', 'K.KBBKKBBK.K..', '.KbBBKKBBbK...', 'K.KbBKKBbK.K..', '..KbbKKbbK....', '...KKKKKK.....']
          : ['....KKKK......', '...KYKKYK.....', '.KKBBKKBBKK...', 'K.KbBKKBBK.K..', '.KbBBKKBBbK...', 'K.KBBKKBBK.K..', '.KbbBKKBbbK...', '..KbbKKbbK....', '...KKKKKK.....'],
        { K: INK, B: '#4a90c8', b: '#2a5a8a', Y: '#ffe14a' },
        1,
        2,
      ),
    );
  // A sprout: a rusty junk-pot turret with a red lens, its petals open (1) or shut (0).
  for (const f of [0, 1])
    canvas(scene, `dg_sprout${f}`, 16, 16, (c) =>
      rows(
        c,
        f
          ? ['.K....KK....K...', 'KGK..KGGK..KGK..', '.KGK.KggK.KGK...', '..KKKKKKKKKK....', '..KTTMMMMTTK....', '.KTMMKRRKMMTK...', '.KMMKRWRRKMMK...', '.KMMKRRRRKMMK...', '.KmMMKRRKMMmK...', '..KmmMMMMmmK....', '...KKKKKKKK.....']
          : ['................', '......KK........', '.....KGGK.......', '...KKKggKKK.....', '..KTTMMMMTTK....', '.KTMMMMMMMMTK...', '.KMMMKKKKMMMK...', '.KMMKKRRKKMMK...', '.KmMMMMMMMMmK...', '..KmmMMMMmmK....', '...KKKKKKKK.....'],
        { K: INK, M: '#b8703a', m: '#7a4220', T: '#e8b07a', G: '#5aba5a', g: '#2e7a34', R: '#e8484e', W: '#ffffff' },
        0,
        3,
      ),
    );
  canvas(scene, 'dg_saw', 14, 14, (c) => {
    for (let y = 0; y < 14; y++)
      for (let x = 0; x < 14; x++) {
        const dx = x - 6.5, dy = y - 6.5;
        const d = Math.hypot(dx, dy);
        const a = Math.atan2(dy, dx);
        const tooth = 5.2 + ((a + Math.PI) * 8 / Math.PI) % 2 * 0.9;
        if (d > tooth) continue;
        px(c, d > tooth - 0.9 ? INK : d < 1.6 ? INK : d < 2.6 ? '#55607a' : pick(STEEL, 0.9 - (dx + dy) / 18, x, y), x, y);
      }
  });
  canvas(scene, 'dg_hook', 9, 9, (c) => rows(c, ['.KK...KK.', 'KYK...KYK', 'KYK...KYK', '.KYK.KYK.', '..KYYYK..', '...KYK...', '...KGK...', '...KGK...', '....K....'], { K: INK, Y: '#ffe14a', G: '#8a8fa8' }));
  canvas(scene, 'dg_lamp', 6, 6, (c) => rows(c, ['.KKKK.', 'KOYYOK', 'KYWYYK', 'KOYYOK', '.KKKK.', '..KK..'], { K: INK, O: '#f28c28', Y: '#ffe14a', W: '#ffffff' }));
  canvas(scene, 'dg_vignette', 256, 176, (c) => {
    for (let y = 0; y < 176; y += 2)
      for (let x = 0; x < 256; x += 2) {
        const dx = (x - 128) / 128, dy = (y - 88) / 88;
        const k = Math.max(0, Math.hypot(dx * 0.95, dy) - 0.7) / 0.6;
        if (k <= 0) continue;
        c.fillStyle = `rgba(4,2,10,${Math.min(0.6, k * 0.6)})`;
        c.fillRect(x, y, 2, 2);
      }
  });
}
