import type Phaser from 'phaser';

/**
 * Art for FROSTLINE'S RINK (the top-down hockey game), drawn once with Canvas
 * 2D in the game's 16-bit style.
 *
 *  - hk_rink: the whole rink (boards with ad panels and glass, scuffed ice with
 *    reflections, red and blue lines, faceoff circles and dots, the creases, a
 *    snowflake logo at center ice)
 *  - hk_net: a net from above (red posts, white mesh), opening to the right
 *  - hk_you0/1: UltraGuy skating, from above, facing up, stick to his right
 *  - hk_frost0/1: Frostline skating, from above, facing up: crystal wings, beak, stick
 *  - hk_puck
 */

type Ctx = CanvasRenderingContext2D;

const INK = '#1a1428';

function canvas(scene: Phaser.Scene, key: string, w: number, h: number, paint: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
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

const ICE = ['#b8d8ee', '#d4ecfa', '#e6f6ff', '#f6fcff'];

/** The rink: B is the board thickness around the RW x RH ice; corners rounded. */
export function rink(c: Ctx, RW: number, RH: number, B: number, mouth: number): void {
  const W = RW + B * 2, H = RH + B * 2, rad = 18;
  const inRound = (x: number, y: number, x0: number, y0: number, w: number, h: number, r: number) => {
    const cx = Math.min(Math.max(x, x0 + r), x0 + w - r), cy = Math.min(Math.max(y, y0 + r), y0 + h - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!inRound(x, y, 0, 0, W, H, rad + B)) continue;
      const ice = inRound(x, y, B, B, RW, RH, rad);
      if (!ice) {
        // Boards: white kick plate, a yellow trim, glass above (seen from above, a pale band).
        const d = Math.min(x, y, W - 1 - x, H - 1 - y);
        px(c, d < 1 ? INK : d < 3 ? '#9ac8e8' : d < B - 2 ? (Math.floor((x + y) / 24) % 4 === 0 ? '#e8484e' : Math.floor((x + y) / 24) % 4 === 2 ? '#4a90c8' : '#f2f6fa') : d < B - 1 ? '#ffe14a' : INK, x, y);
        continue;
      }
      const ix = x - B, iy = y - B;
      // Ice: brighter in the middle, scuffed, with long soft reflections of the lights.
      const refl = Math.max(0, Math.sin(ix / 40 + 0.6) * Math.sin(iy / 30 + 0.3)) * 0.25;
      const scuff = hash(ix >> 2, iy >> 1, 4) < 0.06 ? -0.2 : 0;
      px(c, pick(ICE, 0.55 + refl + scuff - Math.abs(iy - RH / 2) / RH * 0.2, ix, iy), x, y);
    }
  const ox = B, oy = B;
  const line = (x: number, col: string, w = 2) => {
    for (let y = 0; y < RH; y++) if (inRound(ox + x, oy + y, B, B, RW, RH, rad)) px(c, col, ox + x, oy + y, w, 1);
  };
  line(RW / 2 - 1, '#e8484e', 3);
  line(RW / 3, '#4a90c8', 3);
  line((RW * 2) / 3, '#4a90c8', 3);
  line(10, '#e8484e', 1);
  line(RW - 11, '#e8484e', 1);
  const ring = (cx: number, cy: number, r: number, col: string) => {
    for (let a = 0; a < Math.PI * 2; a += 0.02) px(c, col, ox + cx + Math.cos(a) * r, oy + cy + Math.sin(a) * r);
  };
  ring(RW / 2, RH / 2, 22, '#4a90c8');
  ring(RW / 2, RH / 2, 21, '#4a90c8');
  // Snowflake logo at center ice.
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    for (let r = 2; r < 15; r++) {
      px(c, '#9ac8f0', ox + RW / 2 + Math.cos(a) * r, oy + RH / 2 + Math.sin(a) * r);
      if (r === 8 || r === 11)
        for (const b of [-0.6, 0.6]) for (let q = 1; q < 4; q++) px(c, '#9ac8f0', ox + RW / 2 + Math.cos(a) * r + Math.cos(a + b) * q, oy + RH / 2 + Math.sin(a) * r + Math.sin(a + b) * q);
    }
  }
  // End-zone faceoff circles and dots.
  for (const fx of [RW * 0.16, RW * 0.84])
    for (const fy of [RH * 0.28, RH * 0.72]) {
      ring(fx, fy, 14, '#e8484e');
      px(c, '#e8484e', ox + fx - 2, oy + fy - 2, 4, 4);
    }
  // Creases: blue half-discs in front of each net.
  for (const [x0, dir] of [[10, 1], [RW - 11, -1]] as const)
    for (let y = -mouth - 2; y <= mouth + 2; y++)
      for (let x = 0; x < 14; x++) if ((x / 14) ** 2 + (y / (mouth + 2)) ** 2 <= 1) px(c, x > 12 || Math.abs(y) > mouth ? '#e8484e' : bayer(x, y) > 0.3 ? '#9ac8f0' : '#b8d8ee', ox + x0 + dir * x, oy + RH / 2 + y);
}

export function makeHockeyArt(scene: Phaser.Scene, RW: number, RH: number, B: number, mouth: number): void {
  canvas(scene, 'hk_rink', RW + B * 2, RH + B * 2, (c) => rink(c, RW, RH, B, mouth));
  // The net (left one; flip for the right): red frame, white mesh.
  canvas(scene, 'hk_net', 12, mouth * 2 + 4, (c) => {
    const h = mouth * 2 + 4;
    px(c, INK, 0, 0, 12, h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < 11; x++) px(c, (x + y) % 3 === 0 ? '#ffffff' : (x - y + 30) % 3 === 0 ? '#c8d8e8' : '#3a4a6a', x, y);
    px(c, '#e8484e', 9, 0, 3, h);
    px(c, '#ff8a8a', 9, 0, 1, h);
    px(c, '#e8484e', 0, 0, 12, 2);
    px(c, '#e8484e', 0, h - 2, 12, 2);
  });
  // UltraGuy on skates, from above, facing up; the stick angles off his right.
  for (const f of [0, 1])
    canvas(scene, `hk_you${f}`, 22, 22, (c) => {
      rows(
        c,
        [
          '.......KKKKK..........',
          '......KCCCCCK.........',
          '.....KOCWCCCOK........',
          '....KOOOOOOOOOK.......',
          '...KOYOOOOOOOoOK......',
          '..KROKOOOOOOOKoRK.....',
          '..KRRKOOOOOOOKRRK.....',
          '...KKKoooooooKKK......',
          '.....KOOOKOOOK........',
          f ? '.....KOOK.KOOK........' : '....KOOK...KOOK.......',
          f ? '.....KGGK.KGGK........' : '....KGGK...KGGK.......',
        ],
        { K: INK, O: '#f28c28', o: '#b8501a', Y: '#ffc070', C: '#5ef0c8', W: '#ffffff', R: '#e8484e', G: '#c8ccd8' },
        0,
        4,
      );
      // The stick: shaft out to the right, the blade at the end.
      for (let i = 0; i < 9; i++) {
        px(c, INK, 14 + i, 8 - i * 0.6, 2, 2);
        px(c, '#c8a070', 14 + i, 8 - i * 0.6, 1, 1);
      }
      px(c, INK, 20, 0, 3, 4);
      px(c, '#2b2540', 21, 1, 1, 2);
    });
  // Frostline: a crystal bird from above, wings swept, a stick in one wing.
  for (const f of [0, 1])
    canvas(scene, `hk_frost${f}`, 26, 24, (c) => {
      rows(
        c,
        [
          '...........KK.............',
          '..........KYYK............',
          '.........KCWCCK...........',
          '........KCCCCCCK..........',
          '..KK...KCcVCCcCCK...KK....',
          '.KCcK.KCCCCCCCCCK.KcCK....',
          'KCCccKCCCcCCCcCCCKccCCK...',
          'KCcccCKCCCCCCCCCKcccCcK...',
          '.KccccKcCCCCCCCcKccccK....',
          '..KKcccKcCCCCCcKcccKK.....',
          '....KKKKKcCCCcKKKKK.......',
          '........KcKKKcK...........',
          f ? '........KGK.KGK...........' : '.......KGK...KGK..........',
          '..........................',
        ],
        { K: INK, C: '#c8f0ff', c: '#6ab8e8', V: '#2a78b8', W: '#ffffff', Y: '#ffe14a', G: '#8a8fa8' },
        0,
        4,
      );
      for (let i = 0; i < 8; i++) {
        px(c, INK, 18 + i * 0.8, 10 - i * 1.0, 2, 2);
        px(c, '#c8a070', 18 + i * 0.8, 10 - i * 1.0, 1, 1);
      }
      px(c, INK, 23, 0, 3, 4);
      px(c, '#2b2540', 24, 1, 1, 2);
    });
  canvas(scene, 'hk_puck', 8, 6, (c) => rows(c, ['.KKKKKK.', 'KgGGGGgK', 'KGWGGGgK', 'KgggggdK', '.KKKKKK.'], { K: INK, G: '#55607a', g: '#3a3f56', d: '#2b2540', W: '#c8ccd8' }));
}
