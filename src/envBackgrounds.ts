import type Phaser from 'phaser';
import type { ThemeId } from './level/Level';
import type { Theme } from './level/themes';

/**
 * Three parallax layers per theme (0 far, 1 middle, 2 near), drawn with
 * Canvas 2D in a 16-bit style: banded, dithered gradients, silhouettes with a
 * rim of light, and a few lit details. Each layer repeats horizontally.
 */

type Rnd = Phaser.Math.RandomDataGenerator;
type Ctx = CanvasRenderingContext2D;

interface Painter {
  width: [number, number, number];
  paint: (layer: number, ctx: Ctx, w: number, h: number, rnd: Rnd, t: Theme) => void;
}

// --- helpers --------------------------------------------------------------------

function px(ctx: Ctx, color: string, x: number, y: number, w = 1, h = 1): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function rgb(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, k: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const f = (x: number, y: number) => Math.round(x + (y - x) * k);
  return `#${[f(r1, r2), f(g1, g2), f(b1, b2)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Vertical gradient in hard bands, checkerboard-dithered where they meet. */
function bands(ctx: Ctx, w: number, y0: number, y1: number, top: string, bottom: string, n = 12): void {
  const bh = (y1 - y0) / n;
  for (let i = 0; i < n; i++) {
    const c = mix(top, bottom, i / (n - 1));
    const y = Math.round(y0 + i * bh);
    px(ctx, c, 0, y, w, Math.ceil(bh) + 1);
    if (i > 0) {
      const prev = mix(top, bottom, (i - 1) / (n - 1));
      for (let x = 0; x < w; x++) for (let d = 0; d < 2; d++) if ((x + d) % 2 === 0) px(ctx, prev, x, y + d);
    }
  }
}

function stars(ctx: Ctx, w: number, maxY: number, n: number, rnd: Rnd, colors: string[]): void {
  for (let i = 0; i < n; i++) px(ctx, rnd.pick(colors), rnd.between(0, w - 1), rnd.between(0, maxY));
}

/** A jagged ridge across the layer (wraps cleanly), filled to the bottom, with a rim. */
function ridge(ctx: Ctx, w: number, h: number, base: number, amp: number, fill: string, rim: string, rnd: Rnd, step = 8, cap?: string): number[] {
  const n = Math.ceil(w / step);
  const pts: number[] = [];
  for (let i = 0; i < n; i++) pts.push(base - rnd.between(0, amp));
  pts.push(pts[0]);
  const heights: number[] = [];
  for (let x = 0; x < w; x++) {
    const i = Math.floor(x / step);
    const k = (x % step) / step;
    const y = Math.round(pts[i] + (pts[i + 1] - pts[i]) * k);
    heights.push(y);
    px(ctx, fill, x, y, 1, h - y);
    px(ctx, rim, x, y, 1, 1);
    if (cap) {
      const depth = Math.max(0, Math.round((base - amp * 0.4 - y) / 2));
      if (depth > 0) px(ctx, cap, x, y, 1, Math.min(depth, 6));
    }
  }
  return heights;
}

function haze(ctx: Ctx, w: number, h: number, color: string, height: number, alpha = 0.12): void {
  ctx.globalAlpha = alpha;
  for (let i = 0; i < 4; i++) px(ctx, color, 0, h - height + i * (height / 4), w, height - i * (height / 4));
  ctx.globalAlpha = 1;
}

function blob(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Puffy cloud made of overlapping ellipses, with a shaded underside. */
function cloud(ctx: Ctx, x: number, y: number, size: number, light: string, shade: string, rnd: Rnd): void {
  const parts = rnd.between(3, 5);
  for (let i = 0; i < parts; i++) blob(ctx, x + i * size * 0.6, y + rnd.between(-2, 2), size * 0.7, size * 0.45, shade);
  for (let i = 0; i < parts; i++) blob(ctx, x + i * size * 0.6, y - 3 + rnd.between(-2, 2), size * 0.6, size * 0.38, light);
}

// --- painters ---------------------------------------------------------------------

const foundry: Painter = {
  width: [512, 384, 320],
  paint(layer, ctx, w, h, rnd) {
    if (layer === 0) {
      bands(ctx, w, 0, h, '#070818', '#3a2a52');
      stars(ctx, w, 120, 70, rnd, ['#5a5f8a', '#8a90c0', '#c8ccf0']);
      let x = 0;
      while (x < w) {
        const bw = rnd.between(14, 34);
        const bh = rnd.between(40, 100);
        px(ctx, '#161a34', x, h - bh, bw, bh);
        px(ctx, '#232849', x, h - bh, bw, 1);
        for (let wy = h - bh + 5; wy < h - 4; wy += 6) for (let wx = x + 3; wx < x + bw - 3; wx += 5) if (rnd.frac() < 0.35) px(ctx, rnd.pick(['#e8a04a', '#c8763a', '#9aa0d0']), wx, wy, 2, 2);
        if (rnd.frac() < 0.35) {
          const sx = x + rnd.between(2, Math.max(2, bw - 6));
          const sh = rnd.between(24, 50);
          px(ctx, '#121530', sx, h - bh - sh, 5, sh);
          px(ctx, '#d83a4a', sx + 1, h - bh - sh, 3, 1);
          for (let k = 0; k < 6; k++) {
            ctx.globalAlpha = 0.35 - k * 0.05;
            px(ctx, '#4a4668', sx - 2 + k * 5, h - bh - sh - 6 - k * 5, 9 + k * 2, 5);
          }
          ctx.globalAlpha = 1;
        }
        x += bw + rnd.between(0, 6);
      }
    } else if (layer === 1) {
      const base = '#1d2240';
      const rim = '#3c4a7c';
      let x = 4;
      while (x < w - 20) {
        const kind = rnd.between(0, 2);
        if (kind === 0) {
          const tw = rnd.between(34, 50);
          const th = rnd.between(50, 80);
          const top = h - th;
          px(ctx, base, x, top + 6, tw, th);
          px(ctx, base, x + 4, top + 2, tw - 8, 4);
          px(ctx, base, x + 8, top, tw - 16, 2);
          px(ctx, rim, x + 8, top, tw - 16, 1);
          px(ctx, rim, x + 4, top + 2, 4, 1);
          px(ctx, rim, x, top + 6, 4, 1);
          for (let y = top + 14; y < h; y += 12) px(ctx, '#252b4e', x, y, tw, 1);
          px(ctx, '#e8b33a', x + tw / 2 - 1, top + 20, 2, 2);
          x += tw + rnd.between(6, 14);
        } else if (kind === 1) {
          const cw = rnd.between(10, 14);
          const ch = rnd.between(110, 150);
          px(ctx, base, x, h - ch, cw, ch);
          px(ctx, rim, x, h - ch, 1, ch);
          for (let y = h - ch + 8; y < h; y += 14) px(ctx, '#2a3158', x, y, cw, 2);
          px(ctx, '#ff5a6a', x + cw / 2 - 1, h - ch - 2, 3, 2);
          x += cw + rnd.between(10, 24);
        } else {
          const bw = rnd.between(40, 70);
          const bh = rnd.between(30, 46);
          px(ctx, base, x, h - bh, bw, bh);
          px(ctx, rim, x, h - bh, bw, 1);
          px(ctx, '#2a3158', x, h - bh - 6, bw, 3);
          px(ctx, rim, x, h - bh - 6, bw, 1);
          for (let k = x + 6; k < x + bw - 6; k += 12) px(ctx, '#2a3158', k, h - bh - 6, 2, 6);
          x += bw + rnd.between(4, 12);
        }
      }
      haze(ctx, w, h, '#6a5a9a', 40);
    } else {
      const col = '#252c48';
      for (const gx of [24, 184]) {
        px(ctx, col, gx, 0, 14, h);
        px(ctx, '#36406a', gx, 0, 2, h);
        px(ctx, '#161a30', gx + 12, 0, 2, h);
        for (let y = 6; y < h; y += 20) {
          px(ctx, '#3a4470', gx + 4, y, 2, 2);
          px(ctx, '#3a4470', gx + 9, y, 2, 2);
        }
      }
      ctx.strokeStyle = '#20263f';
      ctx.lineWidth = 3;
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        ctx.moveTo(38, 20 + k * 50);
        ctx.lineTo(184, 60 + k * 50);
        ctx.moveTo(38, 60 + k * 50);
        ctx.lineTo(184, 20 + k * 50);
        ctx.stroke();
      }
      px(ctx, col, 38, 18, 146, 4);
      px(ctx, '#36406a', 38, 18, 146, 1);
      for (const cx of [96, 120, 268]) {
        const len = rnd.between(40, 110);
        for (let y = 0; y < len; y += 4) {
          px(ctx, '#3a4470', cx, y, 2, 3);
          px(ctx, '#20263f', cx, y + 3, 2, 1);
        }
        px(ctx, '#4a5584', cx - 2, len, 6, 4);
      }
    }
  },
};

const jungle: Painter = {
  width: [512, 384, 320],
  paint(layer, ctx, w, h, rnd) {
    if (layer === 0) {
      bands(ctx, w, 0, h, '#0a2418', '#3a6a40');
      // Light shafts through the canopy.
      ctx.globalAlpha = 0.07;
      for (let i = 0; i < 5; i++) {
        const x = rnd.between(0, w);
        ctx.fillStyle = '#e8ffc0';
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 18, 0);
        ctx.lineTo(x + 70, h);
        ctx.lineTo(x + 40, h);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ridge(ctx, w, h, 170, 50, '#123222', '#1e4a2e', rnd, 12);
      // Distant tree crowns.
      for (let x = 0; x < w; x += rnd.between(20, 34)) blob(ctx, x, 150 + rnd.between(-10, 10), rnd.between(16, 24), rnd.between(10, 16), '#163a28');
    } else if (layer === 1) {
      // Big trunks with bark and hanging moss, leaf clumps.
      for (let x = 10; x < w - 20; x += rnd.between(70, 110)) {
        const tw = rnd.between(14, 22);
        px(ctx, '#1a3424', x, 0, tw, h);
        px(ctx, '#2a4e34', x, 0, 2, h);
        px(ctx, '#10241a', x + tw - 2, 0, 2, h);
        for (let y = 10; y < h; y += rnd.between(12, 22)) px(ctx, '#244632', x + 3, y, tw - 6, 2);
        for (let k = 0; k < 4; k++) blob(ctx, x + tw / 2 + rnd.between(-30, 30), rnd.between(10, 90), rnd.between(18, 30), rnd.between(10, 16), '#1c4a2c');
      }
      for (let x = 0; x < w; x += 16) blob(ctx, x, rnd.between(4, 18), 16, 12, '#215a34');
      haze(ctx, w, h, '#8ac08a', 50, 0.08);
    } else {
      // Vines hanging from the canopy, ferns at the bottom.
      for (const vx of [30, 110, 200, 270]) {
        const len = rnd.between(60, 170);
        for (let y = 0; y < len; y += 2) px(ctx, '#2a6a34', vx + Math.round(Math.sin(y / 14) * 3), y, 2, 2);
        for (let y = 8; y < len; y += 12) {
          const lx = vx + Math.round(Math.sin(y / 14) * 3);
          px(ctx, '#4ca04a', lx - 4, y, 4, 2);
          px(ctx, '#6cc04a', lx + 2, y + 5, 4, 2);
        }
      }
      for (let x = 0; x < w; x += rnd.between(30, 60)) {
        for (let k = -3; k <= 3; k++) {
          ctx.strokeStyle = '#1e5a2e';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, h);
          ctx.quadraticCurveTo(x + k * 6, h - 24, x + k * 12, h - 30 + Math.abs(k) * 4);
          ctx.stroke();
        }
      }
    }
  },
};

const ice: Painter = {
  width: [512, 384, 320],
  paint(layer, ctx, w, h, rnd) {
    if (layer === 0) {
      bands(ctx, w, 0, h, '#060c22', '#2c4a7a');
      stars(ctx, w, 140, 90, rnd, ['#6a7ab0', '#a8b8e8', '#ffffff']);
      // Aurora ribbons.
      for (const [col, y0] of [['#3af0a0', 40], ['#5ac8f0', 62]] as const) {
        ctx.globalAlpha = 0.18;
        for (let x = 0; x < w; x++) {
          const y = y0 + Math.sin((x / w) * Math.PI * 4) * 12 + Math.sin((x / w) * Math.PI * 10) * 4;
          px(ctx, col, x, y, 1, 16 + Math.sin(x / 9) * 6);
        }
        ctx.globalAlpha = 1;
      }
      ridge(ctx, w, h, 190, 60, '#1c2c52', '#4a6aa0', rnd, 40, '#c8dcf4');
    } else if (layer === 1) {
      ridge(ctx, w, h, 205, 75, '#22365e', '#7a9ad0', rnd, 32, '#e6f0ff');
      haze(ctx, w, h, '#c8dcf8', 50, 0.1);
    } else {
      // Snowy pines along the bottom, icicles from the top.
      for (let x = 8; x < w - 10; x += rnd.between(36, 64)) {
        const th = rnd.between(50, 80);
        for (let k = 0; k < th; k += 2) {
          const hw = Math.round((k / th) * 14) + 1;
          px(ctx, '#16244a', x - hw, h - th + k, hw * 2, 2);
          if (k % 10 === 0) px(ctx, '#e6f0ff', x - hw, h - th + k, hw, 1);
        }
        px(ctx, '#2a1a1a', x - 1, h - 8, 3, 8);
      }
      for (let x = 0; x < w; x += rnd.between(6, 14)) {
        const len = rnd.between(6, 22);
        for (let y = 0; y < len; y++) px(ctx, y < 2 ? '#e6f4ff' : '#9ac8ec', x, y, Math.max(1, 3 - Math.floor((y / len) * 3)), 1);
      }
    }
  },
};

const sky: Painter = {
  width: [512, 448, 384],
  paint(layer, ctx, w, h, rnd) {
    if (layer === 0) {
      bands(ctx, w, 0, h, '#2e6ad0', '#c4e4ff');
      // Sun glow.
      // Sun: stepped rings of glow, brightest in the middle.
      for (const [rad, a] of [[56, 0.06], [42, 0.08], [30, 0.12], [20, 0.25]] as const) {
        ctx.globalAlpha = a;
        blob(ctx, w * 0.7, 40, rad, rad, '#fff8d0');
      }
      ctx.globalAlpha = 1;
      blob(ctx, w * 0.7, 40, 12, 12, '#fffbe8');
      for (let x = -20; x < w; x += rnd.between(50, 90)) cloud(ctx, x, rnd.between(150, 200), rnd.between(16, 24), '#e8f4ff', '#b8d4f0', rnd);
    } else if (layer === 1) {
      for (let x = -10; x < w; x += rnd.between(90, 140)) cloud(ctx, x, rnd.between(120, 210), rnd.between(24, 34), '#ffffff', '#c4dcf4', rnd);
    } else {
      ctx.globalAlpha = 0.7;
      for (let i = 0; i < 6; i++) {
        const x = rnd.between(0, w);
        const y = rnd.between(20, 200);
        px(ctx, '#ffffff', x, y, rnd.between(30, 60), 2);
        px(ctx, '#e8f4ff', x + 10, y + 3, rnd.between(20, 40), 1);
      }
      ctx.globalAlpha = 1;
      // A few birds.
      for (let i = 0; i < 3; i++) {
        const x = rnd.between(20, w - 20);
        const y = rnd.between(30, 90);
        px(ctx, '#3a4a6a', x, y, 3, 1);
        px(ctx, '#3a4a6a', x + 3, y - 1, 1, 1);
        px(ctx, '#3a4a6a', x + 4, y, 3, 1);
      }
    }
  },
};

const power: Painter = {
  width: [512, 384, 320],
  paint(layer, ctx, w, h, rnd) {
    if (layer === 0) {
      bands(ctx, w, 0, h, '#03060f', '#142440');
      stars(ctx, w, 100, 30, rnd, ['#2a3a5a', '#4a6a8a']);
      // Pylons and cooling towers on the horizon.
      for (let x = 10; x < w; x += rnd.between(60, 100)) {
        if (rnd.frac() < 0.5) {
          const tw = 30;
          const th = rnd.between(50, 70);
          ctx.fillStyle = '#0c1628';
          ctx.beginPath();
          ctx.moveTo(x, h);
          ctx.lineTo(x + 6, h - th);
          ctx.lineTo(x + tw - 6, h - th);
          ctx.lineTo(x + tw, h);
          ctx.fill();
          px(ctx, '#1a2a44', x + 6, h - th, tw - 12, 1);
        } else {
          const ph = rnd.between(60, 90);
          px(ctx, '#0c1628', x + 6, h - ph, 2, ph);
          px(ctx, '#0c1628', x, h - ph + 10, 14, 2);
          px(ctx, '#ff3a3a', x + 6, h - ph - 2, 2, 2);
        }
      }
    } else if (layer === 1) {
      // Transformer banks with lit lines and dials.
      for (let x = 0; x < w - 30; x += rnd.between(54, 80)) {
        const bw = rnd.between(34, 48);
        const bh = rnd.between(60, 110);
        px(ctx, '#111d33', x, h - bh, bw, bh);
        px(ctx, '#24385a', x, h - bh, bw, 1);
        for (let y = h - bh + 8; y < h - 6; y += 10) px(ctx, '#18294a', x + 3, y, bw - 6, 2);
        px(ctx, '#3aa8c8', x + 4, h - bh + 4, bw - 8, 1);
        blob(ctx, x + bw / 2, h - bh + 18, 5, 5, '#0a1220');
        px(ctx, '#f8e040', x + bw / 2, h - bh + 15, 1, 3);
        for (let k = 0; k < 3; k++) px(ctx, rnd.pick(['#3af0a0', '#f8e040', '#ff3a3a']), x + 6 + k * 5, h - 14, 2, 2);
      }
      haze(ctx, w, h, '#3aa8c8', 40, 0.06);
    } else {
      // Sagging cables with glowing insulators.
      ctx.strokeStyle = '#0a1424';
      ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        const y0 = 10 + k * 22;
        ctx.beginPath();
        ctx.moveTo(0, y0);
        ctx.quadraticCurveTo(w / 2, y0 + 40, w, y0);
        ctx.stroke();
      }
      for (const x of [60, 160, 260]) {
        px(ctx, '#16243c', x, 0, 10, h);
        px(ctx, '#24385a', x, 0, 1, h);
        for (let y = 20; y < h; y += 40) {
          px(ctx, '#3aa8c8', x + 3, y, 4, 4);
          px(ctx, '#bff4ff', x + 4, y + 1, 2, 2);
        }
      }
    }
  },
};

const volcano: Painter = {
  width: [512, 384, 320],
  paint(layer, ctx, w, h, rnd) {
    if (layer === 0) {
      bands(ctx, w, 0, h, '#120402', '#6a1a0a');
      // The volcano, glowing crater and lava streams.
      const cx = w / 2;
      ctx.fillStyle = '#2a0c08';
      ctx.beginPath();
      ctx.moveTo(cx - 200, h);
      ctx.lineTo(cx - 30, 90);
      ctx.lineTo(cx + 30, 90);
      ctx.lineTo(cx + 200, h);
      ctx.fill();
      px(ctx, '#ff7a2a', cx - 28, 90, 56, 2);
      px(ctx, '#ffc040', cx - 20, 89, 40, 1);
      // Two lava streams winding down the slopes.
      for (const side of [-1, 1]) {
        let x = cx + side * 18;
        for (let y = 92; y < h - 20; y++) {
          x += side * (0.55 + Math.sin(y / 9) * 0.35);
          px(ctx, '#7a1a08', x - 1, y, 4, 1);
          px(ctx, y % 4 ? '#e8501a' : '#ff9a3a', x, y, 2, 1);
        }
      }
      // Glow over the crater in soft rings.
      for (const [rx, ry, a] of [[60, 30, 0.06], [44, 22, 0.1], [30, 14, 0.16]] as const) {
        ctx.globalAlpha = a;
        blob(ctx, cx, 84, rx, ry, '#ff7a2a');
      }
      ctx.globalAlpha = 1;
      stars(ctx, w, 160, 40, rnd, ['#ff7a2a', '#ffc040', '#7a2a10']);
    } else if (layer === 1) {
      ridge(ctx, w, h, 200, 80, '#2e100a', '#a8441a', rnd, 10);
      haze(ctx, w, h, '#ff6a1a', 60, 0.12);
    } else {
      // Stalactites, embers.
      for (let x = 0; x < w; x += rnd.between(14, 30)) {
        const len = rnd.between(10, 46);
        for (let y = 0; y < len; y++) px(ctx, y > len - 4 ? '#5a1e10' : '#2a0c08', x - Math.round((1 - y / len) * 5), y, Math.round((1 - y / len) * 10) + 1, 1);
      }
      for (let i = 0; i < 30; i++) px(ctx, rnd.pick(['#ff7a2a', '#ffc040']), rnd.between(0, w), rnd.between(60, h), 1, 1);
    }
  },
};

const scrap: Painter = {
  width: [512, 384, 320],
  paint(layer, ctx, w, h, rnd) {
    if (layer === 0) {
      bands(ctx, w, 0, h, '#241626', '#d0783a');
      ctx.globalAlpha = 0.6;
      blob(ctx, w * 0.3, 150, 26, 26, '#ffb060');
      ctx.globalAlpha = 1;
      ridge(ctx, w, h, 200, 40, '#3a2420', '#6a3e2a', rnd, 6);
    } else if (layer === 1) {
      // Junk piles and cranes.
      for (let x = 0; x < w; x += rnd.between(14, 26)) {
        const bw = rnd.between(14, 30);
        const bh = rnd.between(10, 40);
        px(ctx, rnd.pick(['#4a2e22', '#3e2620', '#563424']), x, h - bh - rnd.between(0, 30), bw, bh + 30);
        px(ctx, '#8a5a3a', x, h - bh - 30, bw, 1);
      }
      for (const cx of [80, 280]) {
        px(ctx, '#2e1c18', cx, 40, 6, h - 40);
        px(ctx, '#2e1c18', cx - 40, 40, 90, 5);
        for (let x = cx - 40; x < cx + 50; x += 8) px(ctx, '#4a2e22', x, 41, 2, 3);
        px(ctx, '#2e1c18', cx - 34, 45, 1, 50);
        px(ctx, '#3e2620', cx - 40, 95, 14, 8);
      }
      haze(ctx, w, h, '#e89050', 50, 0.1);
    } else {
      for (const x of [40, 230]) {
        px(ctx, '#2a1a16', x, 0, 10, h);
        px(ctx, '#4a2e22', x, 0, 2, h);
        for (let y = 10; y < h; y += 24) px(ctx, '#4a2e22', x - 4, y, 18, 3);
      }
      for (const cx of [130, 300]) {
        const len = rnd.between(50, 120);
        for (let y = 0; y < len; y += 4) px(ctx, '#5a3a2a', cx, y, 2, 3);
        px(ctx, '#3a2a2a', cx - 8, len, 18, 6);
        px(ctx, '#d83a4a', cx - 8, len + 6, 18, 2);
      }
    }
  },
};

const water: Painter = {
  width: [512, 384, 320],
  paint(layer, ctx, w, h, rnd) {
    if (layer === 0) {
      bands(ctx, w, 0, h, '#1a6a9a', '#04121e');
      // Light rays from the surface.
      ctx.globalAlpha = 0.08;
      for (let i = 0; i < 6; i++) {
        const x = rnd.between(0, w);
        ctx.fillStyle = '#e8ffff';
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 14, 0);
        ctx.lineTo(x + 50, h);
        ctx.lineTo(x + 20, h);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ridge(ctx, w, h, 210, 50, '#0a2236', '#1a4a6a', rnd, 10);
    } else if (layer === 1) {
      // Reef rocks with coral fans and anemones.
      ridge(ctx, w, h, 220, 50, '#0e2e46', '#2a5a7a', rnd, 14);
      for (let x = 10; x < w; x += rnd.between(30, 60)) {
        const col = rnd.pick(['#a84a6a', '#c86a4a', '#6a4aa8']);
        const y = h - rnd.between(30, 60);
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        for (let k = -2; k <= 2; k++) {
          ctx.beginPath();
          ctx.moveTo(x, y + 20);
          ctx.lineTo(x + k * 6, y);
          ctx.stroke();
        }
      }
      haze(ctx, w, h, '#3a8ab8', 40, 0.08);
    } else {
      // Kelp strands, bubbles.
      for (let x = 12; x < w; x += rnd.between(40, 80)) {
        const len = rnd.between(80, 180);
        for (let y = 0; y < len; y += 2) {
          const kx = x + Math.round(Math.sin(y / 18) * 5);
          px(ctx, '#1a5a4a', kx, h - y, 3, 2);
          if (y % 16 === 0) px(ctx, '#2a7a5a', kx + 3, h - y, 5, 2);
        }
      }
      for (let i = 0; i < 24; i++) {
        const x = rnd.between(0, w);
        const y = rnd.between(0, h);
        px(ctx, '#8ad0f0', x, y, 2, 2);
        px(ctx, '#ffffff', x, y, 1, 1);
      }
    }
  },
};

const fortress: Painter = {
  width: [512, 384, 320],
  paint(layer, ctx, w, h, rnd) {
    if (layer === 0) {
      bands(ctx, w, 0, h, '#05020a', '#2a1238');
      stars(ctx, w, 120, 50, rnd, ['#3a2a5a', '#6a4a8a']);
      for (const [rad, a] of [[40, 0.06], [30, 0.1], [22, 0.18]] as const) {
        ctx.globalAlpha = a;
        blob(ctx, w * 0.25, 60, rad, rad, '#ff5050');
      }
      ctx.globalAlpha = 1;
      blob(ctx, w * 0.25, 60, 16, 16, '#ff7a6a');
      // Distant towers with red windows.
      for (let x = 0; x < w; x += rnd.between(30, 60)) {
        const tw = rnd.between(12, 22);
        const th = rnd.between(60, 140);
        px(ctx, '#140a1e', x, h - th, tw, th);
        px(ctx, '#140a1e', x - 2, h - th - 4, tw + 4, 4);
        for (let k = 0; k < tw; k += 4) px(ctx, '#140a1e', x - 2 + k, h - th - 8, 2, 4);
        for (let y = h - th + 10; y < h - 10; y += 18) if (rnd.frac() < 0.5) px(ctx, '#ff5050', x + tw / 2 - 1, y, 2, 4);
      }
    } else if (layer === 1) {
      // Battlements and banners.
      const top = h - 90;
      px(ctx, '#1e1230', 0, top, w, 90);
      for (let x = 0; x < w; x += 16) px(ctx, '#1e1230', x, top - 8, 10, 8);
      px(ctx, '#4a2a6a', 0, top, w, 1);
      for (let x = 0; x < w; x += 16) px(ctx, '#4a2a6a', x, top - 8, 10, 1);
      for (let x = 30; x < w; x += rnd.between(60, 100)) {
        px(ctx, '#8a1a2a', x, top + 6, 14, 34);
        px(ctx, '#d83a4a', x, top + 6, 14, 2);
        px(ctx, '#ffd84a', x + 5, top + 16, 4, 4);
        px(ctx, '#8a1a2a', x, top + 40, 4, 4);
        px(ctx, '#8a1a2a', x + 10, top + 40, 4, 4);
      }
      haze(ctx, w, h, '#6a2a8a', 40, 0.1);
    } else {
      for (const x of [50, 220]) {
        px(ctx, '#160c22', x, 0, 18, h);
        px(ctx, '#2e1c44', x, 0, 2, h);
        for (let y = 0; y < h; y += 16) px(ctx, '#0e0816', x, y, 18, 1);
        // Torch.
        px(ctx, '#3a2a2a', x + 7, 110, 4, 10);
        for (const [rad, a] of [[18, 0.05], [12, 0.09], [7, 0.16]] as const) {
          ctx.globalAlpha = a;
          blob(ctx, x + 9, 104, rad, rad, '#ff7a3a');
        }
        ctx.globalAlpha = 1;
        px(ctx, '#ffc040', x + 7, 102, 4, 6);
        px(ctx, '#fff0a0', x + 8, 104, 2, 3);
      }
      for (const cx of [130, 290]) {
        const len = rnd.between(40, 100);
        for (let y = 0; y < len; y += 4) px(ctx, '#3a2a4a', cx, y, 2, 3);
      }
    }
  },
};

const city: Painter = {
  width: [512, 384, 320],
  paint(layer, ctx, w, h, rnd) {
    if (layer === 0) {
      bands(ctx, w, 0, h, '#8ac8ec', '#eaf6fa');
      for (let x = -20; x < w; x += rnd.between(80, 130)) cloud(ctx, x, rnd.between(30, 80), rnd.between(14, 20), '#ffffff', '#d8ecf8', rnd);
      for (let x = 0; x < w; x += rnd.between(18, 30)) {
        const bh = rnd.between(40, 90);
        px(ctx, '#c4dae6', x, h - bh, rnd.between(16, 26), bh);
      }
    } else if (layer === 1) {
      for (let x = 0; x < w; x += rnd.between(40, 60)) {
        const bw = rnd.between(30, 44);
        const bh = rnd.between(60, 120);
        px(ctx, '#aac2d2', x, h - bh, bw, bh);
        px(ctx, '#d0e0ea', x, h - bh, bw, 1);
        for (let y = h - bh + 6; y < h - 6; y += 8) for (let k = x + 4; k < x + bw - 4; k += 6) px(ctx, '#8aa8bc', k, y, 3, 4);
      }
    } else {
      // Street trees and lamps.
      for (let x = 20; x < w; x += rnd.between(80, 120)) {
        px(ctx, '#6a5a4a', x, h - 40, 4, 40);
        blob(ctx, x + 2, h - 50, 18, 14, '#5aa06a');
        blob(ctx, x - 2, h - 54, 10, 8, '#7ac08a');
      }
      for (let x = 70; x < w; x += 140) {
        px(ctx, '#4a5a6a', x, h - 70, 3, 70);
        px(ctx, '#4a5a6a', x, h - 70, 12, 3);
        px(ctx, '#fff0a0', x + 9, h - 67, 4, 3);
      }
    }
  },
};

export const bgPainters: Record<ThemeId, Painter> = {
  foundry,
  jungle,
  ice,
  sky,
  power,
  volcano,
  scrap,
  water,
  fortress,
  city,
};
