import type Phaser from 'phaser';

/**
 * Art for TIDE'S TRENCH (TrenchScene), drawn once with Canvas 2D in the
 * game's 16-bit style.
 *
 *  - tr_diver0/1: UltraGuy diving head-first (orange suit, air tank, flippers kicking)
 *  - tr_jelly0/1: a glowing jellyfish (bell open / closed, trailing tendrils)
 *  - tr_mine0/1: an old sea mine on its chain (the second frame is the warning blink)
 *  - tr_urchin: spiny urchin on the rock; tr_bubble: an air bubble; tr_flare: a flare stick
 *  - tr_head0/1: Tide's head from the side (jaw shut / open), facing right
 *  - tr_seg: one plated body segment with a light
 *  - tr_light: a soft round light (the darkness is erased with it)
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
function rows(c: Ctx, art: string[], pal: Record<string, string>, ox = 0, oy = 0): void {
  art.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && pal[ch] && px(c, pal[ch], ox + x, oy + y)));
}
/** A shaded ellipse (lit from the top left) with an ink rim. */
function blob(c: Ctx, cx: number, cy: number, rx: number, ry: number, ramp: string[]): void {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (d > 1) continue;
      if (d > 0.78) {
        px(c, INK, x, y);
        continue;
      }
      const k = 0.85 - ((x - cx) / rx + (y - cy) / ry) * 0.3 - d * 0.3 + bayer(x, y) * 0.1;
      px(c, ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(k * ramp.length)))], x, y);
    }
}

export function makeTrenchArt(scene: Phaser.Scene): void {
  // UltraGuy diving head-first: helmet and visor at the bottom, tank on his back, flippers kicking up top.
  for (const f of [0, 1])
    canvas(scene, `tr_diver${f}`, 16, 24, (c) =>
      rows(
        c,
        [
          f ? '..KK......KK....' : '...KK....KK.....',
          f ? '.KTTK....KTTK...' : '..KTTK..KTTK....',
          f ? '..KTTK..KTTK....' : '..KTTK..KTTK....',
          '...KOK..KOK.....',
          '...KOOKKOOK.....',
          '....KOOOOK......',
          '...KGKOOOOK.....',
          '..KGGKOOOOK.....',
          '..KGWKOOOOOK....',
          '..KGGKOOOOOK....',
          '..KGgKOoOOOK....',
          '...KKKOoOOOK....',
          '..KOK.KOOOK.KOK.',
          '..KOK.KOOOK.KOK.',
          '...KOKKOOOKKOK..',
          '....KKOOOOOKK...',
          '.....KKKKKKK....',
          '....KOOOOOOOK...',
          '...KOCCCCCOOK...',
          '...KOCWCCCOOK...',
          '...KOOCCCOOK....',
          '....KOOOOOK.....',
          '.....KKKKK......',
        ],
        { K: INK, O: '#f28c28', o: '#b85a1a', T: '#2aa088', G: '#8a8fa8', g: '#55607a', W: '#eef2fa', C: '#5ef0c8' },
      ),
    );
  // A jellyfish: a glowing bell and trailing tendrils.
  for (const f of [0, 1])
    canvas(scene, `tr_jelly${f}`, 18, 22, (c) => {
      blob(c, 9, 6, f ? 7.5 : 6.5, f ? 4.5 : 5.5, ['#6a3a8a', '#9a5ac8', '#d0a8f0', '#f4e4ff']);
      for (let i = 0; i < 4; i++) {
        const x0 = 4 + i * 3.4;
        for (let y = 10; y < 21; y++) px(c, y % 3 === 0 ? '#f4e4ff' : '#c8a0ff', x0 + Math.sin(y * 0.6 + i + f * 2) * 1.2, y);
      }
      px(c, '#ffffff', 6, 4, 2, 1);
    });
  // An old sea mine on a chain; the second frame blinks red.
  for (const f of [0, 1])
    canvas(scene, `tr_mine${f}`, 20, 26, (c) => {
      for (let y = 18; y < 26; y += 2) {
        px(c, INK, 9, y, 3, 2);
        px(c, '#8a8fa8', 10, y, 1, 1);
      }
      for (const [x, y] of [[10, 1], [10, 17], [2, 9], [18, 9], [4, 3], [16, 3], [4, 15], [16, 15]]) {
        px(c, INK, x - 1, y - 1, 3, 3);
        px(c, '#c8ccd8', x, y);
      }
      blob(c, 10, 9, 7, 7, ['#2b2540', '#3a3a50', '#55607a', '#8a8fa8']);
      px(c, f ? '#ff3a3a' : '#5a1a1a', 9, 8, 2, 2);
    });
  canvas(scene, 'tr_urchin', 16, 12, (c) => {
    for (let i = 0; i < 11; i++) {
      const a = Math.PI + (i / 10) * Math.PI;
      for (let r = 4; r < 8; r++) px(c, r > 6 ? '#e8c8f0' : '#8a3a8a', 8 + Math.cos(a) * r, 11 + Math.sin(a) * r);
    }
    blob(c, 8, 10, 5, 4, ['#3a1a4a', '#5a2a6a', '#8a3a8a', '#c86ac8']);
  });
  canvas(scene, 'tr_bubble', 12, 12, (c) => {
    for (let a = 0; a < Math.PI * 2; a += 0.05) px(c, '#bfe6ff', 6 + Math.cos(a) * 5, 6 + Math.sin(a) * 5);
    px(c, '#ffffff', 3, 3, 2, 2);
    px(c, '#ffffff', 2, 5, 1, 1);
  });
  canvas(scene, 'tr_flare', 4, 10, (c) => {
    px(c, INK, 0, 2, 4, 8);
    px(c, '#e8484e', 1, 3, 2, 6);
    px(c, '#ffffff', 1, 0, 2, 3);
  });
  // Tide's head, side-on, facing right: a long plated skull, a glowing eye, the jaw shut or gaping.
  for (const f of [0, 1])
    canvas(scene, `tr_head${f}`, 48, 34, (c) => {
      blob(c, 18, 14, 17, 11, ['#1e4a5a', '#2a6a7a', '#3aa88a', '#8ae8c8']);
      for (let i = 0; i < 4; i++) for (let y = 6; y < 22; y++) if (y % 3) px(c, '#1e4a5a', 8 + i * 6, y);
      // Fin crest.
      for (let i = 0; i < 4; i++) for (let y = 0; y < 6 - i; y++) px(c, y === 0 ? INK : '#5ef0c8', 6 + i * 5, 4 - y + i);
      const open = f ? 9 : 0;
      // Upper jaw and lower jaw with teeth.
      for (let x = 26; x < 46; x++) {
        const top = 12 - (x - 26) * 0.18;
        px(c, INK, x, top - 1, 1, 1);
        for (let y = top; y < 18; y++) px(c, y < top + 2 ? '#8ae8c8' : '#3aa88a', x, y);
        px(c, INK, x, 18, 1, 1);
        if (x % 3 === 0) px(c, '#fff4e0', x, 19, 1, 2);
        const lt = 19 + open * ((x - 22) / 24);
        for (let y = lt; y < lt + 5; y++) px(c, y < lt + 1 ? '#fff4e0' : '#2a6a7a', x, y);
        px(c, INK, x, lt + 5, 1, 1);
      }
      if (f) for (let x = 27; x < 44; x++) for (let y = 19; y < 19 + 9 * ((x - 22) / 24); y++) px(c, '#3a0a1a', x, y);
      // The eye.
      blob(c, 25, 10, 3.2, 3.2, ['#d8a020', '#ffe14a', '#fff4b0', '#ffffff']);
      px(c, INK, 26, 10, 1, 1);
    });
  canvas(scene, 'tr_seg', 26, 26, (c) => {
    blob(c, 13, 13, 12, 11, ['#1e4a5a', '#2a6a7a', '#3aa88a', '#8ae8c8']);
    for (let y = 4; y < 22; y++) if (y % 3) px(c, '#1e4a5a', 7, y);
    blob(c, 15, 8, 2.5, 2.5, ['#2aa088', '#5ef0c8', '#bffff0', '#ffffff']);
  });
  canvas(scene, 'tr_light', 128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  });
}
