import Phaser from 'phaser';
import { ALL_BOSS_STAGES } from './level/stages';
import type { SaveData } from './save';

/**
 * PIP: UltraGuy's drone. Rivet builds it once you've beaten your first boss.
 * It starts with only its lamp; Rivet sells the rest of its upgrades, and a
 * paint shop's worth of shells, paints and trails for it.
 */
export type PipModule = 'lamp' | 'fetch' | 'guard' | 'zap';
export type PipShell = 'round' | 'saucer' | 'cube' | 'bird' | 'gold';
export type PipPaint = 'teal' | 'ember' | 'berry' | 'lime' | 'frost' | 'onyx';
export type PipTrail = 'none' | 'sparks' | 'bubbles' | 'notes' | 'stars';
export type PipKind = 'module' | 'shell' | 'paint' | 'trail';

export interface PipThing {
  id: string;
  name: string;
  /** Bolts at Rivet's (0: comes with Pip). Undefined: earned, not sold. */
  price?: number;
  blurb: string;
}

export const PIP_MODULES: (PipThing & { id: PipModule })[] = [
  { id: 'lamp', name: 'LAMP', price: 0, blurb: 'lights up the dark around Pip' },
  { id: 'fetch', name: 'FETCH', price: 80, blurb: 'flies out and brings back bolts and pickups' },
  { id: 'guard', name: 'GUARD', price: 150, blurb: 'zaps one enemy shot out of the air, then recharges' },
  { id: 'zap', name: 'ZAP', price: 200, blurb: 'takes pot shots at enemies (not bosses)' },
];

export const PIP_SHELLS: (PipThing & { id: PipShell })[] = [
  { id: 'round', name: 'ROUND', price: 0, blurb: "Pip's own shell" },
  { id: 'saucer', name: 'SAUCER', price: 60, blurb: 'a little flying saucer' },
  { id: 'cube', name: 'CUBE', price: 60, blurb: 'all corners' },
  { id: 'bird', name: 'BIRDIE', price: 90, blurb: 'flaps its wings' },
  { id: 'gold', name: 'GOLDEN', blurb: 'win every EX rematch' },
];

/** Paint: main, light and dark. */
export const PIP_PAINTS: (PipThing & { id: PipPaint; colors: [string, string, string] })[] = [
  { id: 'teal', name: 'TEAL', price: 0, blurb: 'factory finish', colors: ['#4ab8a8', '#9af0e0', '#226a64'] },
  { id: 'ember', name: 'EMBER', price: 30, blurb: 'hot orange', colors: ['#f28c28', '#ffd08a', '#a04a10'] },
  { id: 'berry', name: 'BERRY', price: 30, blurb: 'pink and proud', colors: ['#e0508a', '#ffb0d0', '#8a2050'] },
  { id: 'lime', name: 'LIME', price: 30, blurb: 'zesty', colors: ['#8ad02a', '#d8ff8a', '#4a7a10'] },
  { id: 'frost', name: 'FROST', price: 30, blurb: 'cool white', colors: ['#d8e4f4', '#ffffff', '#8a9ab8'] },
  { id: 'onyx', name: 'ONYX', price: 50, blurb: 'sleek black', colors: ['#3a3a48', '#6a6a80', '#16161e'] },
];

export const PIP_TRAILS: (PipThing & { id: PipTrail })[] = [
  { id: 'none', name: 'NONE', price: 0, blurb: 'just the thruster' },
  { id: 'sparks', name: 'SPARKS', price: 40, blurb: 'a shower of sparks' },
  { id: 'bubbles', name: 'BUBBLES', price: 40, blurb: 'floaty bubbles' },
  { id: 'notes', name: 'MUSIC', price: 50, blurb: 'a little tune wherever it goes' },
  { id: 'stars', name: 'STARS', price: 60, blurb: 'twinkle twinkle' },
];

export const PIP_CATALOG: Record<PipKind, PipThing[]> = { module: PIP_MODULES, shell: PIP_SHELLS, paint: PIP_PAINTS, trail: PIP_TRAILS };

/** Pip shows up once a stage boss is down. */
export function pipUnlocked(save: SaveData): boolean {
  return ALL_BOSS_STAGES.some((id) => save.cleared.includes(id));
}

/** Owned: free things, earned things, and bought ones ("kind:id"). */
export function pipOwns(save: SaveData, kind: PipKind, id: string): boolean {
  const t = PIP_CATALOG[kind].find((k) => k.id === id);
  if (!t) return false;
  if (t.price === 0) return true;
  if (t.price === undefined) return id === 'gold' && ALL_BOSS_STAGES.every((s) => save.exCleared.includes(s));
  return save.pipOwned.includes(`${kind}:${id}`);
}

// --- art ---------------------------------------------------------------------------

const K = '#1a1428';
export const PIP_W = 16;
export const PIP_H = 14;

/** Texture key for a shell in a paint, flap frame 0 or 1 (made on first use). */
export function pipTexture(scene: Phaser.Scene, shell: PipShell, paint: PipPaint, frame: 0 | 1): string {
  const key = `pip_${shell}_${paint}_${frame}`;
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, PIP_W, PIP_H)!;
  const ctx = tex.getContext();
  const px = (c: string, x: number, y: number, w = 1, h = 1) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  const [m, l, d] = shell === 'gold' ? ['#f0c020', '#fff4a0', '#a87808'] : PIP_PAINTS.find((p) => p.id === paint)!.colors;
  const up = frame === 0;
  // The eye window (the pupil is drawn on top at run time, so it can look around).
  const eye = (x: number, y: number) => {
    px(K, x - 1, y - 1, 6, 5);
    px('#e8f8ff', x, y, 4, 3);
    px('#ffffff', x, y, 2, 1);
  };
  if (shell === 'round' || shell === 'gold' || shell === 'bird') {
    // Round body.
    const rows = [
      [5, 6], [3, 10], [2, 12], [1, 14], [1, 14], [1, 14], [1, 14], [2, 12], [3, 10], [5, 6],
    ];
    rows.forEach(([x, w], i) => px(K, x, 2 + i, w, 1));
    rows.forEach(([x, w], i) => {
      if (i === 0 || i === rows.length - 1) return;
      px(i < 4 ? l : i > 6 ? d : m, x + 1, 2 + i, w - 2, 1);
    });
    px(l, 4, 4, 2, 1);
    eye(6, 5);
    if (shell === 'bird') {
      // A beak, and wings that flap.
      px(K, 13, 6, 3, 3);
      px('#ffc040', 13, 7, 2, 1);
      const wy = up ? 2 : 8;
      px(K, 0, wy, 4, 4);
      px(l, 1, wy + 1, 2, 2);
      px(K, 12, wy, 4, 4);
      px(l, 13, wy + 1, 2, 2);
    } else {
      // Little side fins that twitch, and an antenna (a crown on the golden one).
      px(K, 0, up ? 5 : 6, 2, 3);
      px(K, 14, up ? 5 : 6, 2, 3);
      px(d, 0, up ? 6 : 7, 1, 1);
      px(d, 15, up ? 6 : 7, 1, 1);
      if (shell === 'gold') {
        px(K, 5, 0, 6, 3);
        px('#fff4a0', 6, 1, 1, 1);
        px('#fff4a0', 8, 0, 1, 2);
        px('#fff4a0', 10, 1, 1, 1);
        px('#ff5050', 8, 2, 1, 1);
      } else {
        px(K, 7, 0, 2, 2);
        px(up ? '#ff5050' : '#ffe14a', 7, 0, 1, 1);
      }
    }
  } else if (shell === 'saucer') {
    // Glass dome over a wide rim with blinking lights.
    px(K, 4, 1, 8, 6);
    px('#bfefff', 5, 2, 6, 4);
    px('#ffffff', 6, 2, 2, 1);
    px(K, 0, 6, 16, 5);
    px(m, 1, 7, 14, 2);
    px(l, 1, 7, 14, 1);
    px(d, 2, 9, 12, 1);
    for (let x = 2; x < 14; x += 4) px((x / 4) % 2 === (up ? 0 : 1) ? '#ffe14a' : '#8a6a10', x, 8, 2, 1);
    px(K, 6, 11, 4, 2);
    px(d, 7, 11, 2, 1);
    eye(6, 3);
  } else {
    // Cube: a beveled box with a slot eye and a little prop on top.
    px(K, 2, 3, 12, 11);
    px(m, 3, 4, 10, 9);
    px(l, 3, 4, 10, 1);
    px(l, 3, 4, 1, 9);
    px(d, 3, 12, 10, 1);
    px(d, 12, 4, 1, 9);
    eye(6, 6);
    px(K, 7, 1, 2, 2);
    px(K, up ? 3 : 5, 0, up ? 10 : 6, 1);
  }
  tex.refresh();
  return key;
}

/** Small art shared by Pip and its trails (made once). */
export function makePipBits(scene: Phaser.Scene): void {
  if (scene.textures.exists('pip_pupil')) return;
  const make = (key: string, w: number, h: number, draw: (px: (c: string, x: number, y: number, w?: number, h?: number) => void) => void) => {
    const t = scene.textures.createCanvas(key, w, h)!;
    const ctx = t.getContext();
    draw((c, x, y, ww = 1, hh = 1) => {
      ctx.fillStyle = c;
      ctx.fillRect(x, y, ww, hh);
    });
    t.refresh();
  };
  make('pip_pupil', 2, 2, (px) => px(K, 0, 0, 2, 2));
  make('pip_flame', 2, 2, (px) => {
    px('#ffe14a', 0, 0, 2, 1);
    px('#f28c28', 0, 1, 2, 1);
  });
  make('pip_dot', 1, 1, (px) => px('#ffffff', 0, 0));
  make('pip_bubble', 5, 5, (px) => {
    px('#bfefff', 1, 0, 3, 1);
    px('#bfefff', 0, 1, 1, 3);
    px('#bfefff', 4, 1, 1, 3);
    px('#bfefff', 1, 4, 3, 1);
    px('#ffffff', 1, 1);
  });
  make('pip_note', 5, 6, (px) => {
    px('#fff1e0', 3, 0, 1, 4);
    px('#fff1e0', 3, 0, 2, 1);
    px('#fff1e0', 1, 3, 3, 2);
    px('#fff1e0', 0, 4, 1, 1);
  });
  make('pip_star', 5, 5, (px) => {
    px('#fff4a0', 2, 0, 1, 5);
    px('#fff4a0', 0, 2, 5, 1);
    px('#ffffff', 2, 2);
  });
  make('pip_shot', 4, 4, (px) => {
    px('#5ef0c8', 0, 1, 4, 2);
    px('#5ef0c8', 1, 0, 2, 4);
    px('#ffffff', 1, 1, 2, 2);
  });
  // The guard's ready ring.
  const r = scene.textures.createCanvas('pip_ring', 22, 22)!;
  const ctx = r.getContext();
  ctx.strokeStyle = 'rgba(94,240,200,0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(11, 11, 10, 0, Math.PI * 2);
  ctx.stroke();
  r.refresh();
}
