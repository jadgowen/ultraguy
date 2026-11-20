import type Phaser from 'phaser';

/**
 * Art for TIDE'S TIDE POOL (the pinball table), drawn once with Canvas 2D in
 * the game's 16-bit style.
 *
 *  - pb_table: the whole static table, 200 x 236: lit deep water, a sandy
 *    floor, rocks and coral along the edges, painted inserts (lane arrows, the
 *    target bank, a whirlpool emblem) and chrome rails along every wall
 *  - pb_bumper0/1: an anemone pop bumper (lit when hit)
 *  - pb_target_up/down, pb_lane_off/on: drop targets and rollover lights
 *  - pb_flipper: a flipper pointing right from its pivot (origin at the pivot)
 *  - pb_ball, pb_plunger, pb_glow
 */

type Ctx = CanvasRenderingContext2D;
type Seg = [number, number, number, number];

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

/** A chrome rail along a segment: dark rim, steel body, a bright line on top. */
function rail(c: Ctx, [x1, y1, x2, y2]: Seg): void {
  const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1)));
  for (const [w, col] of [[5, INK], [3, '#4a80b8'], [1, '#c8f0ff']] as const) {
    for (let i = 0; i <= n; i++) {
      const x = x1 + ((x2 - x1) * i) / n;
      const y = y1 + ((y2 - y1) * i) / n;
      px(c, col, x - Math.floor(w / 2), y - Math.floor(w / 2), w, w);
    }
  }
}

function table(c: Ctx, walls: Seg[], W: number, H: number): void {
  // Water: deep at the top, lighter toward the sand, with slanting light shafts.
  const WATER = ['#06182c', '#0a2440', '#0e3054', '#123e68', '#18507e'];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const shaft = Math.max(0, Math.sin((x + y * 0.35) / 22) - 0.6) * 0.5;
      px(c, pick(WATER, 0.25 + (y / H) * 0.6 + shaft, x, y), x, y);
    }
  // A whirlpool emblem painted in the middle of the playfield.
  for (let r = 6; r < 34; r += 5)
    for (let a = 0; a < Math.PI * 2; a += 0.04) {
      const rr = r + a * 1.4;
      const x = 94 + Math.cos(a + r * 0.2) * rr;
      const y = 128 + Math.sin(a + r * 0.2) * rr * 0.55;
      if (hash(Math.round(x), Math.round(y), r) < 0.6) px(c, '#1e5a8a', x, y);
    }
  // Sand along the bottom (behind the flippers) with ripples and shells.
  const SAND = ['#8a6a3a', '#b08a50', '#c8a060', '#e0c080'];
  for (let y = 196; y < H; y++)
    for (let x = 0; x < W; x++) {
      const rip = Math.sin(x / 5 + y * 0.9) > 0.7 ? 0.25 : 0;
      px(c, pick(SAND, 0.35 + rip + ((y - 196) / 60) * 0.3, x, y), x, y);
    }
  for (const [x, y, col] of [[30, 222, '#ff8aa8'], [150, 226, '#fff1e0'], [96, 230, '#ffc070']] as const) {
    px(c, INK, x - 1, y - 1, 5, 4);
    px(c, col, x, y, 3, 2);
  }
  // Rocks and coral hugging the side walls.
  const rock = (cx: number, cy: number, r: number) => {
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y * 1.4 > r * r) continue;
        const k = 0.75 - (x + y) / (r * 3) + bayer(x, y) * 0.12;
        px(c, k > 0.7 ? '#6a7a9a' : k > 0.45 ? '#4a5878' : '#2e3a56', cx + x, cy + y);
      }
  };
  for (const [x, y, r] of [[16, 170, 7], [14, 120, 5], [184, 200, 6], [170, 176, 5], [24, 186, 5]] as const) rock(x, y, r);
  /** A branching coral: a trunk that forks, the tips lit. */
  const coral = (x: number, y: number, col: string, hi: string) => {
    const branch = (bx: number, by: number, a: number, len: number, depth: number): void => {
      let cx = bx, cy = by;
      for (let i = 0; i < len; i++) {
        cx += Math.cos(a);
        cy += Math.sin(a);
        px(c, INK, cx - 1, cy, 3, 1);
        px(c, col, cx, cy, 1, 1);
      }
      px(c, hi, cx, cy, 1, 1);
      if (depth > 0) {
        branch(cx, cy, a - 0.55, len * 0.7, depth - 1);
        branch(cx, cy, a + 0.5, len * 0.75, depth - 1);
      }
    };
    branch(x, y, -Math.PI / 2, 6, 2);
  };
  coral(26, 160, '#e8484e', '#ff8a8a');
  coral(164, 160, '#c8a0ff', '#f0e0ff');
  // Inserts: three lane arrows up top, the target bank's light strip, a "save" lamp.
  for (const lx of [70, 100, 130]) {
    for (let i = 0; i < 4; i++) px(c, '#2a5a8a', lx - i, 32 + i, 1 + i * 2, 1);
  }
  for (let i = 0; i < 3; i++) {
    px(c, INK, 20, 66 + i * 22, 6, 8);
    px(c, '#4a2030', 21, 67 + i * 22, 4, 6);
  }
  px(c, INK, 90, 212, 20, 7);
  px(c, '#3a2a14', 91, 213, 18, 5);
  // The launch lane: a darker channel.
  for (let y = 94; y < H; y++) for (let x = 180; x < 189; x++) px(c, pick(['#06182c', '#0a2440'], 0.3 + bayer(x, y) * 0.3, x, y), x, y);
  for (const s of walls) rail(c, s);
}

export function makePinballArt(scene: Phaser.Scene, walls: Seg[], W: number, H: number): void {
  canvas(scene, 'pb_table', W, H, (c) => table(c, walls, W, H));
  for (const lit of [0, 1])
    canvas(scene, `pb_bumper${lit}`, 22, 22, (c) => {
      for (let y = 0; y < 22; y++)
        for (let x = 0; x < 22; x++) {
          const d = Math.hypot(x - 10.5, y - 10.5);
          if (d > 10.5) continue;
          if (d > 9.5) {
            px(c, INK, x, y);
            continue;
          }
          // Tentacle ring, then the cap.
          const a = Math.atan2(y - 10.5, x - 10.5);
          const tent = d > 6 && Math.sin(a * 9) > 0.2;
          const k = 0.8 - (x + y) / 44 + bayer(x, y) * 0.15;
          if (d > 6) px(c, tent ? (lit ? '#ffffff' : k > 0.6 ? '#ffb0c8' : '#e86a90') : lit ? '#ffe0ea' : '#8c2a4a', x, y);
          else px(c, lit ? (k > 0.5 ? '#ffffff' : '#fff4c0') : k > 0.65 ? '#ff8a8a' : k > 0.4 ? '#e8484e' : '#8c2030', x, y);
        }
      px(c, '#ffffff', 7, 7, 2, 2);
    });
  canvas(scene, 'pb_target_up', 6, 14, (c) => {
    px(c, INK, 0, 0, 6, 14);
    for (let y = 1; y < 13; y++) px(c, y < 3 ? '#ff8a8a' : y < 10 ? '#e8484e' : '#8c2030', 1, y, 4, 1);
    px(c, '#ffe14a', 2, 5, 2, 4);
  });
  canvas(scene, 'pb_target_down', 6, 4, (c) => {
    px(c, INK, 0, 0, 6, 4);
    px(c, '#4a2030', 1, 1, 4, 2);
  });
  for (const on of [0, 1])
    canvas(scene, `pb_lane_${on ? 'on' : 'off'}`, 9, 9, (c) => {
      for (let y = 0; y < 9; y++)
        for (let x = 0; x < 9; x++) {
          const d = Math.hypot(x - 4, y - 4);
          if (d > 4.3) continue;
          px(c, d > 3.3 ? INK : on ? (d < 1.5 ? '#ffffff' : '#ffe14a') : d < 1.5 ? '#5a7a9a' : '#2a4a6a', x, y);
        }
    });
  // Flipper: a tapered bat pointing right, its pivot at (5, 5).
  canvas(scene, 'pb_flipper', 40, 11, (c) => {
    for (let x = 0; x < 40; x++) {
      const half = 4.6 - (x / 39) * 2.6;
      for (let y = 0; y < 11; y++) {
        const dy = y - 5;
        const inEnd = x < 5 ? Math.hypot(x - 5, dy) <= 4.6 : x > 36 ? Math.hypot(x - 36, dy) <= 2 : Math.abs(dy) <= half;
        if (!inEnd) continue;
        const edge = x < 5 ? Math.hypot(x - 5, dy) > 3.6 : x > 36 ? Math.hypot(x - 36, dy) > 1.2 : Math.abs(dy) > half - 1;
        const k = 0.8 - (dy + half) / (half * 2.4);
        px(c, edge ? INK : k > 0.62 ? '#ffc070' : k > 0.35 ? '#f28c28' : '#b8501a', x, y);
      }
    }
    // Rubber band and the pivot cap.
    for (let x = 8; x < 35; x++) px(c, '#8c2030', x, Math.round(5 + 4.6 - (x / 39) * 2.6), 1, 1);
    for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) if (Math.hypot(x - 5, y - 5) <= 2.4) px(c, Math.hypot(x - 4, y - 4) < 1.2 ? '#ffffff' : '#ffe14a', x, y);
  });
  canvas(scene, 'pb_ball', 10, 10, (c) => {
    for (let y = 0; y < 10; y++)
      for (let x = 0; x < 10; x++) {
        const d = Math.hypot(x - 4.5, y - 4.5);
        if (d > 4.8) continue;
        const k = 1 - Math.hypot(x - 3, y - 3) / 7 + bayer(x, y) * 0.12;
        px(c, d > 3.9 ? INK : k > 0.8 ? '#ffffff' : k > 0.55 ? '#e0e6f0' : k > 0.3 ? '#a0a8c0' : '#5a6078', x, y);
      }
    // The table's blue, reflected along the bottom.
    px(c, '#4a90c8', 3, 7, 4, 1);
  });
  canvas(scene, 'pb_plunger', 8, 24, (c) => {
    px(c, INK, 1, 0, 6, 24);
    px(c, '#c8ccd8', 2, 1, 4, 5);
    px(c, '#ffffff', 2, 1, 1, 5);
    for (let y = 6; y < 23; y += 2) px(c, '#8a8fa8', 2, y, 4, 1);
    px(c, '#e8484e', 1, 21, 6, 3);
  });
  canvas(scene, 'pb_glow', 32, 32, (c) => {
    const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.4)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 32, 32);
  });
}
