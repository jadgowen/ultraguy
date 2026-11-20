import type Phaser from 'phaser';

/**
 * Art for GALE'S SKIES (the sky shooter): drawn once with Canvas 2D in the
 * game's 16-bit style (ink outlines, three-step shading, ordered dither).
 *
 *  - sk_ship: UltraGuy's fighter (orange hull, teal canopy, swept wings); sk_flame0/1 its engine
 *  - sk_cloud0..2: shaded clouds (big, medium, small); sk_island0/1: floating islands far below the clouds
 *  - sk_kite0/1, sk_swoop0/1, sk_spin0/1, sk_balloon, sk_dart: the enemies
 *  - sk_feather, sk_blade, sk_seed, sk_bomb: enemy shots; sk_power: the P capsule
 *  - sk_glow: a soft round glow (tinted and added for shots, the laser and blasts)
 */

type Ctx = CanvasRenderingContext2D;

const INK = '#1a1428';

function canvas(scene: Phaser.Scene, key: string, w: number, h: number, paint: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, w, h)!;
  paint(t.getContext());
  t.refresh();
}

/** Paint pixel rows: each character is a palette key ('.' is clear). */
function rows(ctx: Ctx, art: string[], pal: Record<string, string>, ox = 0, oy = 0): void {
  art.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.' || !pal[ch]) return;
      ctx.fillStyle = pal[ch];
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }),
  );
}

const bayer = (x: number, y: number) => [0, 0.5, 0.75, 0.25][(x & 1) + ((y & 1) << 1)];

/** A puffy cloud: overlapping lobes, lit from above, a cool underside. */
function cloud(ctx: Ctx, w: number, h: number, seed: number): void {
  const lobes: [number, number, number][] = [];
  const n = Math.max(3, Math.round(w / 12));
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n;
    const r = h * (0.32 + 0.22 * Math.sin(k * Math.PI)) * (0.85 + ((seed * 7 + i * 13) % 5) * 0.05);
    lobes.push([w * (0.1 + 0.8 * k), h * 0.62 - r * 0.35, r]);
  }
  const inside = (x: number, y: number) => y < h * 0.86 && lobes.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      // Light: high and toward the top of each lobe; edges and the base go cool.
      const edge = !inside(x, y - 2) ? 1 : 0;
      const k = 1 - y / h + edge * 0.25 - (!inside(x, y + 2) ? 0.15 : 0);
      const v = k + bayer(x, y) * 0.18;
      ctx.fillStyle = v > 0.95 ? '#ffffff' : v > 0.62 ? '#f2f8ff' : v > 0.4 ? '#d4e8f8' : '#a8cce8';
      ctx.fillRect(x, y, 1, 1);
    }
}

/** A floating island far below: grass on top, a rock root, a thread of waterfall. */
function island(ctx: Ctx, w: number, h: number, flip: boolean): void {
  const top = 6;
  for (let y = top; y < h; y++) {
    const half = (w / 2) * (1 - ((y - top) / (h - top)) ** 1.4);
    for (let x = 0; x < w; x++) {
      const dx = x - w / 2 + (flip ? 3 : -3) * ((y - top) / h);
      if (Math.abs(dx) > half) continue;
      const shade = 0.75 - (y - top) / (h * 1.2) - (dx / w) * 0.4 + bayer(x, y) * 0.15;
      ctx.fillStyle = y < top + 3 ? (y === top ? '#9ae07a' : '#4aa04a') : shade > 0.55 ? '#a07858' : shade > 0.35 ? '#7a5840' : '#54402e';
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // Trees.
  for (const tx of [w * 0.3, w * 0.55, w * 0.72]) {
    ctx.fillStyle = '#2e7a3a';
    ctx.fillRect(Math.round(tx) - 2, top - 4, 5, 4);
    ctx.fillStyle = '#4aa04a';
    ctx.fillRect(Math.round(tx) - 1, top - 5, 3, 2);
  }
  // Waterfall off one edge.
  const fx = Math.round(flip ? w * 0.22 : w * 0.78);
  for (let y = top + 1; y < h; y++) {
    ctx.fillStyle = y % 3 === 0 ? '#ffffff' : '#bfe6ff';
    ctx.fillRect(fx, y, 2, 1);
  }
}

export function makeSkiesArt(scene: Phaser.Scene): void {
  // UltraGuy's fighter, 17 x 18.
  canvas(scene, 'sk_ship', 17, 18, (c) =>
    rows(
      c,
      [
        '........K........',
        '.......KWK.......',
        '.......KOK.......',
        '......KOOOK......',
        '......KCCOK......',
        '.....KOCcCOK.....',
        '.....KOOCOOK.....',
        '....KYOOOOOoK....',
        '...KKOOOOOOoKK...',
        '..KOOKOOOOOoKOOK.',
        '.KOOOOKOOOoKOOOoK',
        'KOOOOOOKOOoKOOooK',
        'KoooooKKOOoKKoooK',
        '.KKKKK.KoooK.KKK.',
        '.......KGgGK.....',
        '.......KKKKK.....',
      ],
      { K: INK, W: '#fff4c0', O: '#f28c28', o: '#b8501a', Y: '#ffc070', C: '#5ef0c8', c: '#2aa088', G: '#8a8fa8', g: '#55607a' },
    ),
  );
  for (const f of [0, 1])
    canvas(scene, `sk_flame${f}`, 5, 7, (c) =>
      rows(c, f ? ['.YWY.', '.YWY.', '..Y..', '..O..', '..O..'] : ['.YWY.', 'YYWYY', '.YWY.', '.OYO.', '..O..', '..O..', '..r..'], { W: '#ffffff', Y: '#ffe14a', O: '#f28c28', r: '#c83a2a' }),
    );
  canvas(scene, 'sk_cloud0', 72, 30, (c) => cloud(c, 72, 30, 1));
  canvas(scene, 'sk_cloud1', 48, 22, (c) => cloud(c, 48, 22, 2));
  canvas(scene, 'sk_cloud2', 30, 14, (c) => cloud(c, 30, 14, 3));
  canvas(scene, 'sk_island0', 56, 34, (c) => island(c, 56, 34, false));
  canvas(scene, 'sk_island1', 38, 26, (c) => island(c, 38, 26, true));

  // KITE (the old foe): a diamond kite with a tail, two sways.
  for (const f of [0, 1])
    canvas(scene, `sk_kite${f}`, 16, 22, (c) =>
      rows(
        c,
        [
          '.......K........',
          '......KRK.......',
          '.....KRRYK......',
          '....KRRRYYK.....',
          '...KRRRKYYYK....',
          '..KRRRRKYYYYK...',
          '...KrrrKyyyK....',
          '....KrrrKyK.....',
          '.....KrrKK......',
          '......KK........',
          f ? '.......K........' : '......K.........',
          f ? '......W.........' : '.......W........',
          f ? '.....K..........' : '........K.......',
          f ? '......R.........' : '........R.......',
          f ? '.......K........' : '.......K........',
        ],
        { K: INK, R: '#e8484e', r: '#8c2030', Y: '#ffe14a', y: '#d8a020', W: '#ffffff' },
      ),
    );
  // SWOOPER: a steel bird-drone with one yellow eye; wings up / down.
  for (const f of [0, 1])
    canvas(scene, `sk_swoop${f}`, 18, 12, (c) =>
      rows(
        c,
        f
          ? ['..................', '..................', 'KK..............KK', 'KwK....KKKK....KwK', '.KwKK.KwwwGK.KKwK.', '..KwwKwYwGGKKwwK..', '...KKGGGGGGGgKK...', '.....KgGGGgK......', '......KKKKK.......']
          : ['KK..............KK', 'KwK............KwK', '.KwK...KKKK...KwK.', '..KwK.KwwwGK.KwK..', '...KwKwYwGGKKwK...', '....KGGGGGGGgK....', '.....KgGGGgK......', '......KKKKK.......'],
        { K: INK, w: '#eef2fa', G: '#8a8fa8', g: '#55607a', Y: '#ffe14a' },
      ),
    );
  // SPINNER: a round fan-bot; blades at + and x.
  for (const f of [0, 1])
    canvas(scene, `sk_spin${f}`, 18, 18, (c) => {
      c.fillStyle = INK;
      const blade = (a: number) => {
        for (let r = 3; r < 9; r++) {
          c.fillStyle = r === 8 ? INK : r > 5 ? '#c8ccd8' : '#8a8fa8';
          c.fillRect(Math.round(9 + Math.cos(a) * r - 1), Math.round(9 + Math.sin(a) * r - 1), 2, 2);
        }
      };
      for (let i = 0; i < 4; i++) blade((i * Math.PI) / 2 + (f ? Math.PI / 4 : 0));
      rows(c, ['.KKKK.', 'KPPPpK', 'KPWYpK', 'KPYYpK', 'KpppqK', '.KKKK.'], { K: INK, P: '#c8a0ff', p: '#8c4ad8', q: '#5a2a9a', W: '#ffffff', Y: '#ffe14a' }, 6, 6);
    });
  // BALLOON BOMBER: a striped balloon carrying a little gondola-bot.
  canvas(scene, 'sk_balloon', 22, 32, (c) => {
    for (let y = 0; y < 20; y++)
      for (let x = 0; x < 22; x++) {
        const dx = (x - 10.5) / 10.5, dy = (y - 9.5) / 9.8;
        const d = dx * dx + dy * dy;
        if (d > 1) continue;
        const stripe = Math.floor((Math.asin(Math.max(-1, Math.min(1, dx))) / Math.PI + 0.5) * 6) % 2;
        const light = 0.75 - dx * 0.35 - dy * 0.3 + bayer(x, y) * 0.15;
        const ramp = stripe ? ['#8c2030', '#e8484e', '#ff8a8a'] : ['#b8a898', '#f2ead8', '#ffffff'];
        c.fillStyle = d > 0.86 ? INK : ramp[light > 0.8 ? 2 : light > 0.4 ? 1 : 0];
        c.fillRect(x, y, 1, 1);
      }
    c.fillStyle = INK;
    for (const x of [6, 15]) c.fillRect(x, 19, 1, 5);
    rows(c, ['KKKKKKKKKKK', 'KGwwGGGGGgK', 'KGYKGGGKYgK', 'KgggggggggK', '.KKKKKKKKK.', '...K...K...'], { K: INK, G: '#8a8fa8', g: '#55607a', w: '#eef2fa', Y: '#ffe14a' }, 5, 24);
  });
  // DART: a red missile pointing down.
  canvas(scene, 'sk_dart', 9, 18, (c) =>
    rows(
      c,
      ['.KKKKKKK.', 'KyKY.YKyK', '.K.YYY.K.', '...KRK...', '...KRK...', '..KRRrK..', '..KRWrK..', '..KRRrK..', '..KRRrK..', '..KRRrK..', '..KRRrK..', '...KRK...', '...KRK...', '....K....'],
      { K: INK, R: '#e8484e', r: '#8c2030', W: '#ffffff', Y: '#ffe14a', y: '#f28c28' },
    ),
  );
  // Shots.
  canvas(scene, 'sk_feather', 6, 12, (c) =>
    rows(c, ['..K...', '.KYK..', '.KYYK.', 'KYWYK.', 'KYWYYK', 'KYWYYK', '.KWYK.', '.KWYK.', '..KYK.', '..KK..', '..K...', '..K...'], { K: INK, Y: '#ffe14a', W: '#fff4c0' }),
  );
  canvas(scene, 'sk_blade', 10, 10, (c) =>
    rows(c, ['...KKKK...', '..KWWccK..', '.KWK..KcK.', 'KWK....KcK', 'KWK.....KK', 'KcK.......', 'KcK.......', '.KcK......', '..KK......', '..........'], { K: INK, W: '#ffffff', c: '#9ee8ff' }),
  );
  canvas(scene, 'sk_seed', 6, 6, (c) => rows(c, ['.KKKK.', 'KgGGgK', 'KGWGgK', 'KGGggK', 'KggggK', '.KKKK.'], { K: INK, G: '#a07858', g: '#6a4a30', W: '#e8c890' }));
  canvas(scene, 'sk_bomb', 8, 9, (c) => rows(c, ['...KY...', '..KKK...', '.KGGGK..', 'KGWGGgK.', 'KGGGGgK.', 'KGGGggK.', '.KgggK..', '..KKK...'], { K: INK, G: '#55607a', g: '#2b2540', W: '#c8ccd8', Y: '#ffe14a' }));
  canvas(scene, 'sk_power', 14, 14, (c) =>
    rows(
      c,
      ['...KKKKKKK....', '..KYYYYYYYK...', '.KYWWWWWYYyK..', 'KYWKKKKWYYyyK.', 'KYWKYYYKYYyyK.', 'KYWKYYYKYYyyK.', 'KYWKKKKWYYyyK.', 'KYWKYYYYYYyyK.', 'KYWKYYYYYYyyK.', 'KYYKYYYYYyyyK.', '.KyyyyyyyyyK..', '..KKKKKKKKK...'],
      { K: INK, Y: '#ffe14a', y: '#d8a020', W: '#fff4c0' },
    ),
  );
  canvas(scene, 'sk_glow', 32, 32, (c) => {
    const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 32, 32);
  });
}
