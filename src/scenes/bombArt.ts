import type Phaser from 'phaser';

/**
 * Art for MAGMA'S BOMB ARENA (BombScene), top-down, 16 px tiles, drawn once
 * with Canvas 2D in the game's 16-bit style.
 *
 *  - bm_floor0/1: basalt flagstones (the second with a glowing crack)
 *  - bm_pillar_top / bm_pillar_face: basalt pillars (a lit top; a front face where floor is below)
 *  - bm_crate: a scorched crate (blown open by bombs)
 *  - bm_bomb0/1: a bomb (the second frame swells), bm_fire0..2: a blast tile flickering
 *  - bm_pw_bomb / bm_pw_fire / bm_pw_speed: power-up badges
 *  - bm_magma0/1: Magma from above, his plates parting over the molten core
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
function rows(c: Ctx, art: string[], pal: Record<string, string>, ox = 0, oy = 0): void {
  art.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && pal[ch] && px(c, pal[ch], ox + x, oy + y)));
}

const BASALT = ['#1e1214', '#2e1c1a', '#3e2622', '#52322a'];
const STONE = ['#2a1a1a', '#4a3030', '#6a4640', '#8a5e52', '#b07a68'];

function floor(c: Ctx, v: number): void {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(c, pick(BASALT, 0.45 + hash(x >> 1, y >> 1, v + 3) * 0.3 - (x === 15 || y === 15 ? 0.35 : 0) + (x === 0 || y === 0 ? 0.15 : 0), x, y), x, y);
  // Only the second kind has a glowing crack wandering across (the first is plain stone).
  if (!v) return;
  let x = 2, y = 3;
  for (let i = 0; i < 9; i++) {
    px(c, i % 3 === 1 ? '#ffe14a' : '#f28c28', x, y);
    x += hash(i, v, 5) < 0.5 ? 1 : 0;
    y += 1;
    if (x > 14) x = 14;
  }
}

export function makeBombArt(scene: Phaser.Scene): void {
  for (const v of [0, 1]) canvas(scene, `bm_floor${v}`, 16, 16, (c) => floor(c, v));
  canvas(scene, 'bm_pillar_top', 16, 16, (c) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(c, x === 0 || y === 0 || x === 15 || y === 15 ? INK : pick(STONE, 0.65 - (x + y) / 50 + hash(x >> 2, y >> 2, 1) * 0.15, x, y), x, y);
    px(c, STONE[4], 1, 1, 14, 1);
    px(c, STONE[4], 1, 1, 1, 14);
  });
  canvas(scene, 'bm_pillar_face', 16, 16, (c) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const top = y < 7;
        const k = top ? 0.68 - (x + y) / 50 : 0.32 - (y - 7) / 40 - (y % 4 === 3 ? 0.12 : 0);
        px(c, x === 0 || x === 15 || y === 0 ? INK : pick(STONE, k + hash(x >> 2, y >> 2, 2) * 0.12, x, y), x, y);
      }
    px(c, STONE[4], 1, 1, 14, 1);
    px(c, INK, 0, 7, 16, 1);
    px(c, '#ff7a2a', 4, 11, 2, 1); // lava seeping from a seam
  });
  canvas(scene, 'bm_crate', 16, 16, (c) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const plank = Math.floor(y / 5);
        const edge = x === 0 || y === 0 || x === 15 || y === 15;
        px(c, edge ? INK : pick(['#3a2016', '#5a3422', '#7a4a2e', '#9a6640'], 0.55 - (y % 5 === 4 ? 0.3 : 0) + (plank % 2) * 0.08 - hash(x >> 1, y, 4) * 0.12, x, y), x, y);
      }
    // Cross brace and char marks.
    for (let i = 1; i < 15; i++) {
      px(c, '#2a160e', i, i, 1, 1);
      px(c, '#2a160e', 15 - i, i, 1, 1);
    }
    px(c, '#1a1010', 11, 3, 3, 2);
    px(c, '#ff7a2a', 12, 12, 2, 1);
  });
  for (const f of [0, 1])
    canvas(scene, `bm_bomb${f}`, 16, 16, (c) => {
      const r = f ? 6.4 : 5.8;
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const d = Math.hypot(x - 7.5, y - 9);
          if (d > r) continue;
          const k = 1 - Math.hypot(x - 5.5, y - 7) / 9 + bayer(x, y) * 0.12;
          px(c, d > r - 1 ? INK : k > 0.75 ? '#8a8fa8' : k > 0.5 ? '#3a3a50' : '#1e1e2e', x, y);
        }
      px(c, '#55607a', 6, 2, 4, 3);
      px(c, INK, 6, 2, 4, 1);
      px(c, '#c8a070', 9, 0, 1, 3);
    });
  for (const f of [0, 1, 2])
    canvas(scene, `bm_fire${f}`, 16, 16, (c) => {
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const d = Math.hypot(x - 7.5, y - 7.5) / 8;
          const n = hash(x >> 1, (y + f * 3) >> 1, 7) * 0.35;
          const k = 1 - d + n;
          if (k < 0.15) continue;
          px(c, k > 0.85 ? '#fff4c0' : k > 0.6 ? '#ffe14a' : k > 0.38 ? '#ff8a2a' : '#d83a1a', x, y);
        }
    });
  const badge = (key: string, fill: string, icon: string[]) =>
    canvas(scene, key, 14, 14, (c) => {
      px(c, INK, 1, 0, 12, 14);
      px(c, INK, 0, 1, 14, 12);
      for (let y = 1; y < 13; y++) px(c, y < 4 ? '#ffffff' : fill, 1, y, 12, 1);
      px(c, '#00000055', 1, 11, 12, 2);
      rows(c, icon, { W: '#fff1e0', K: INK }, 3, 3);
    });
  badge('bm_pw_bomb', '#3a78d8', ['..WW....', '...WW...', '.WWWWW..', 'WWWWWWW.', 'WWWWWWW.', 'WWWWWWW.', '.WWWWW..']);
  badge('bm_pw_fire', '#ff7a2a', ['...W....', '..WWW...', '..WWW...', '.WWWWW..', 'WWWKWWW.', 'WWKKKWW.', '.WWWWW..']);
  badge('bm_pw_speed', '#2aa088', ['........', 'W..W....', '.W..W...', '..W..W..', '.W..W...', 'W..W....', '........']);
  // Magma from above: four basalt plates around a molten core that brightens as they part.
  for (const f of [0, 1])
    canvas(scene, `bm_magma${f}`, 18, 18, (c) => {
      for (let y = 0; y < 18; y++)
        for (let x = 0; x < 18; x++) {
          const dx = x - 8.5, dy = y - 8.5;
          const d = Math.hypot(dx, dy);
          if (d > 8.4) continue;
          const seam = Math.abs(dx) < (f ? 1.6 : 0.9) || Math.abs(dy) < (f ? 1.6 : 0.9);
          if (d > 7.6) px(c, INK, x, y);
          else if (seam) px(c, d < 3 ? '#fff4c0' : '#ffb040', x, y);
          else px(c, pick(['#2a2a48', '#464a78', '#6a70a8', '#b8c4f0'], 0.7 - (dx + dy) / 22, x, y), x, y);
        }
      px(c, '#ffe14a', 5, 5, 2, 2);
      px(c, '#ffe14a', 11, 5, 2, 2);
    });
}
