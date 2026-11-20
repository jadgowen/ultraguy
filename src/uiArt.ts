import type Phaser from 'phaser';

/**
 * Shared menu art, drawn with Canvas 2D in the game's 16-bit style and cached
 * by size: a steel-framed glass panel (menus, the pause screen, boss select
 * cells) and a soft highlight bar for the selected row.
 */

type Ctx = CanvasRenderingContext2D;
const INK = '#1a1428';

const px = (c: Ctx, col: string, x: number, y: number, w = 1, h = 1) => {
  c.fillStyle = col;
  c.fillRect(x, y, w, h);
};
const bayer = (x: number, y: number) => [0, 0.5, 0.75, 0.25][(x & 1) + ((y & 1) << 1)];
const pick = (ramp: string[], k: number, x: number, y: number) => {
  const v = Math.min(ramp.length - 1, Math.max(0, k * (ramp.length - 1)));
  const lo = Math.floor(v);
  return ramp[Math.min(ramp.length - 1, lo + (v - lo > bayer(x, y) ? 1 : 0))];
};

export type PanelStyle = 'steel' | 'gold' | 'danger';
const ACCENT: Record<PanelStyle, string> = { steel: '#5ef0c8', gold: '#ffe14a', danger: '#ff5a5a' };

/**
 * A panel: a dark glassy fill (lighter at the top, a faint sheen across it), a
 * steel bevel (lit top and left, shaded bottom and right), an accent line under
 * the top edge and rivets in the corners. Returns the texture key.
 */
export function uiPanel(scene: Phaser.Scene, w: number, h: number, style: PanelStyle = 'steel', alpha = 0.9): string {
  w = Math.round(w);
  h = Math.round(h);
  const key = `ui_panel_${style}_${w}x${h}_${Math.round(alpha * 100)}`;
  if (scene.textures.exists(key)) return key;
  const t = scene.textures.createCanvas(key, w, h)!;
  const c = t.getContext();
  c.globalAlpha = alpha;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sheen = Math.abs(x - y * 1.6 - w * 0.25) < 10 ? 0.12 : 0;
      px(c, pick(['#06081a', '#0a0e26', '#101836', '#18244a'], 0.65 - (y / h) * 0.55 + sheen, x, y), x, y);
    }
  c.globalAlpha = 1;
  // Bevel.
  px(c, INK, 1, 0, w - 2, 1);
  px(c, INK, 1, h - 1, w - 2, 1);
  px(c, INK, 0, 1, 1, h - 2);
  px(c, INK, w - 1, 1, 1, h - 2);
  px(c, '#c8ccd8', 1, 1, w - 2, 1);
  px(c, '#8a8fa8', 1, 2, 1, h - 4);
  px(c, '#55607a', w - 2, 2, 1, h - 4);
  px(c, '#2b2540', 1, h - 2, w - 2, 1);
  // The accent line, fading toward the ends.
  for (let x = 3; x < w - 3; x++) {
    const k = 1 - Math.abs(x - w / 2) / (w / 2);
    if (bayer(x, 0) < k * 1.4) px(c, ACCENT[style], x, 3, 1, 1);
  }
  // Rivets.
  for (const [rx, ry] of [[3, 5], [w - 5, 5], [3, h - 5], [w - 5, h - 5]]) {
    if (h < 14) break;
    px(c, '#eef2fa', rx, ry, 1, 1);
    px(c, '#2b2540', rx + 1, ry + 1, 1, 1);
  }
  t.refresh();
  return key;
}

/** A highlight bar for the selected row: brightest in the middle, fading at the ends. */
export function uiHighlight(scene: Phaser.Scene, w: number, h: number, color = '#5ef0c8'): string {
  w = Math.round(w);
  h = Math.round(h);
  const key = `ui_hl_${w}x${h}_${color}`;
  if (scene.textures.exists(key)) return key;
  const t = scene.textures.createCanvas(key, w, h)!;
  const c = t.getContext();
  for (let x = 0; x < w; x++) {
    const k = Math.min(1, x / 10) * Math.min(1, (w - x) / (w * 0.6));
    c.globalAlpha = 0.28 * k;
    px(c, color, x, 0, 1, h);
    c.globalAlpha = 0.6 * k;
    px(c, color, x, 0, 1, 1);
    px(c, color, x, h - 1, 1, 1);
  }
  c.globalAlpha = 1;
  t.refresh();
  return key;
}
