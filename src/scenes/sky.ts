import Phaser from 'phaser';
import { PHYS, TILE, VIEW_H, VIEW_W } from '../constants';
import type { Player } from '../entities/Player';
import { Level, MOVER_TILES, Mover, Tile } from '../level/Level';
import { moveX, moveY } from '../physics';
import { sfx } from '../sfx';

/**
 * Moving parts for sky-style stages (used by Stratos, available to any stage):
 *  - moving clouds ('=' / 'v' tracks) that carry you;
 *  - crumbling clouds ('x') that puff away soon after you land, then return;
 *  - updrafts ('y'): drawn as faint columns with rising streaks;
 *  - wind gusts on the stage's windy screens: calm, a warning, then a push.
 */

/** Frames a crumbling cloud holds after you land, and how long it stays gone. */
export const CRUMBLE_HOLD = 32;
export const CRUMBLE_GONE = 150;

/** Gust cycle, in frames. */
export const GUST_CALM = 150;
export const GUST_WARN = 60;
export const GUST_BLOW = 120;

const CRUMBLE_INDEX = Tile.Crumble - 1;

/** Average speed of a moving cloud, px per step, and how long it waits at each end. */
const MOVER_SPEED = 0.85;
export const MOVER_DWELL = 45;

interface LiveMover extends Mover {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  t: number;
  /** Frames to travel one way. */
  travel: number;
  sprite: Phaser.GameObjects.Image;
}

interface Crumble {
  cells: { c: number; r: number }[];
  t: number;
}

export interface SkyHost {
  scene: Phaser.Scene;
  level: Level;
  layer: Phaser.Tilemaps.TilemapLayer;
  player: () => Player;
  view: () => { x: number; y: number };
  burst: (x: number, y: number, tex: string, n: number) => void;
  windStreak: (dir: number) => void;
}

/**
 * Where a moving cloud is along its track (0 = start, 1 = far end) at step
 * `t`: wait, ease out, wait, ease back. Easing slows it at the ends so you
 * can step on and off.
 */
export function moverProgress(t: number, travel: number, dwell = MOVER_DWELL): number {
  const cycle = 2 * (dwell + travel);
  const u = t % cycle;
  const ease = (x: number) => (1 - Math.cos(Math.PI * x)) / 2;
  if (u < dwell) return 0;
  if (u < dwell + travel) return ease((u - dwell) / travel);
  if (u < 2 * dwell + travel) return 1;
  return 1 - ease((u - 2 * dwell - travel) / travel);
}

export class Sky {
  private movers: LiveMover[] = [];
  /** Moving cloud the player stood on last step. */
  private riding: LiveMover | null = null;
  private crumbles: Crumble[] = [];
  private updraftCells: { c: number; r: number }[] = [];
  private gustT = 0;
  private gustIndex = 0;
  private gustLabel: Phaser.GameObjects.Text;
  /** Push from the current gust (0 when calm or off a windy screen). */
  gust = 0;

  constructor(private host: SkyHost, theme: string) {
    const { scene, level } = host;
    for (const m of level.movers) {
      const dist = Math.hypot(m.x1 - m.x0, m.y1 - m.y0);
      const sprite = scene.add.image(m.x0, m.y0, `mcloud_${theme}`).setOrigin(0).setDepth(2);
      this.movers.push({ ...m, x: m.x0, y: m.y0, prevX: m.x0, prevY: m.y0, t: 0, travel: Math.max(1, Math.round(dist / MOVER_SPEED)), sprite });
    }
    // Updrafts: faint columns (the streaks are spawned as you go).
    this.updraftCells = level.findTiles(Tile.Updraft);
    if (this.updraftCells.length) {
      const g = scene.add.graphics().setDepth(-1);
      g.fillStyle(0xffffff, 0.1);
      for (const { c, r } of this.updraftCells) g.fillRect(c * TILE, r * TILE, TILE, TILE);
    }
    this.gustLabel = scene.add
      .text(VIEW_W / 2, 30, '', { fontFamily: 'monospace', fontSize: '10px', color: '#fff1e0', stroke: '#1a1428', strokeThickness: 3 })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(40)
      .setVisible(false);
  }

  /** Before the player moves: move the clouds and carry whoever is riding one. */
  stepMovers(): void {
    for (const m of this.movers) {
      m.prevX = m.x;
      m.prevY = m.y;
      const k = moverProgress(m.t++, m.travel);
      m.x = Phaser.Math.Linear(m.x0, m.x1, k);
      m.y = Phaser.Math.Linear(m.y0, m.y1, k);
      m.sprite.setPosition(Math.round(m.x), Math.round(m.y));
    }
    const p = this.host.player();
    const m = this.riding;
    this.riding = null;
    if (m && p.alive && p.grounded && (p.state === 'idle' || p.state === 'run' || p.state === 'hurt')) {
      const L = this.host.level;
      moveX(L, p, m.x - m.prevX);
      const dy = m.y - m.prevY;
      if (dy < 0) moveY(L, p, dy, false);
      else p.y += dy;
    }
  }

  /**
   * Land the player on a moving cloud if they fell onto one this step
   * (one-way: only from above). Called from the player's motion.
   */
  landOnMover(p: Player, prevBottom: number): boolean {
    const bottom = p.bottom;
    for (const m of this.movers) {
      const w = MOVER_TILES * TILE;
      if (p.x + p.w <= m.x + 2 || p.x >= m.x + w - 2) continue;
      if (bottom < m.y || prevBottom > Math.max(m.y, m.prevY) + 0.5) continue;
      p.y = m.y - p.h;
      this.riding = m;
      return true;
    }
    return false;
  }

  /** After the player moves: crumbling clouds under their feet start to go. */
  stepCrumbles(): void {
    const p = this.host.player();
    const { level, layer, burst } = this.host;
    if (p.alive && p.grounded) {
      const row = Math.floor((p.bottom + 0.5) / TILE);
      for (let c = Math.floor(p.x / TILE); c <= Math.floor((p.x + p.w - 0.01) / TILE); c++) {
        if (level.tileAt(c, row) !== Tile.Crumble || this.crumbles.some((k) => k.cells.some((q) => q.c === c && q.r === row))) continue;
        // The whole run of crumbling cloud goes together.
        let c0 = c;
        let c1 = c;
        while (level.tileAt(c0 - 1, row) === Tile.Crumble) c0--;
        while (level.tileAt(c1 + 1, row) === Tile.Crumble) c1++;
        const cells = [];
        for (let x = c0; x <= c1; x++) cells.push({ c: x, r: row });
        this.crumbles.push({ cells, t: 0 });
      }
    }
    for (const k of this.crumbles) {
      k.t++;
      if (k.t < CRUMBLE_HOLD) {
        // Shiver, faster near the end.
        const fast = k.t > CRUMBLE_HOLD / 2;
        for (const { c, r } of k.cells) layer.getTileAt(c, r)?.setAlpha(k.t % (fast ? 4 : 8) < (fast ? 2 : 4) ? 0.55 : 1);
      } else if (k.t === CRUMBLE_HOLD) {
        sfx.crumble();
        for (const { c, r } of k.cells) {
          level.setTile(c, r, Tile.Empty);
          layer.removeTileAt(c, r);
          burst(c * TILE + 8, r * TILE + 6, 'boom', 1);
        }
      } else if (k.t >= CRUMBLE_HOLD + CRUMBLE_GONE) {
        // Comes back, unless that would trap the player inside it.
        const inside = k.cells.some(({ c, r }) => p.x < (c + 1) * TILE && p.x + p.w > c * TILE && p.y < (r + 1) * TILE && p.bottom > r * TILE);
        if (inside) continue;
        this.restore(k);
        k.t = -1;
      }
    }
    this.crumbles = this.crumbles.filter((k) => k.t >= 0);
  }

  private restore(k: Crumble): void {
    for (const { c, r } of k.cells) {
      this.host.level.setTile(c, r, Tile.Crumble);
      this.host.layer.putTileAt(CRUMBLE_INDEX, c, r).setAlpha(1);
    }
  }

  /** The gust cycle: calm, a warning (light streaks), then a push. */
  stepGust(): void {
    const wind = this.host.level.data.wind;
    const p = this.host.player();
    const windy = !!wind && p.alive && wind.screens.includes(this.host.level.screenIdAt(p.cx, p.cy));
    if (!wind || !windy) {
      this.gust = 0;
      this.gustLabel.setVisible(false);
      return;
    }
    const dir = wind.dirs[this.gustIndex % wind.dirs.length];
    const t = this.gustT++;
    const arrow = dir > 0 ? '>>>' : '<<<';
    if (t < GUST_CALM) {
      this.gust = 0;
      this.gustLabel.setVisible(false);
    } else if (t < GUST_CALM + GUST_WARN) {
      // Warning: a few light streaks and a blinking arrow.
      this.gust = 0;
      if (t % 10 === 0) this.host.windStreak(dir);
      this.gustLabel.setText(`${arrow}  WIND  ${arrow}`).setVisible(t % 16 < 10);
    } else if (t < GUST_CALM + GUST_WARN + GUST_BLOW) {
      // Ramp in and out so it never yanks you.
      const b = t - GUST_CALM - GUST_WARN;
      const ramp = Math.min(1, b / 15, (GUST_BLOW - b) / 15);
      this.gust = dir * PHYS.gust * ramp;
      if (t % 3 === 0) this.host.windStreak(dir);
      if (b === 0) sfx.wind();
      this.gustLabel.setText(`${arrow}  WIND  ${arrow}`).setVisible(true);
    } else {
      this.gustT = 0;
      this.gustIndex++;
      this.gust = 0;
      this.gustLabel.setVisible(false);
    }
  }

  /** Rising streaks inside updrafts that are on screen. */
  private fxT = 0;

  stepUpdraftFx(): void {
    if (!this.updraftCells.length || ++this.fxT % 4 !== 0) return;
    const v = this.host.view();
    const visible = this.updraftCells.filter(({ c, r }) => c * TILE >= v.x - TILE && c * TILE <= v.x + VIEW_W && r * TILE >= v.y - TILE && r * TILE <= v.y + VIEW_H);
    if (!visible.length) return;
    const { c, r } = visible[Math.floor(Math.random() * visible.length)];
    const s = this.host.scene.add.image(c * TILE + Math.random() * TILE, r * TILE + TILE, 'windline').setAngle(90).setAlpha(0.5).setDepth(-1);
    this.host.scene.tweens.add({ targets: s, y: s.y - 40, alpha: 0, duration: 600, onComplete: () => s.destroy() });
  }

  /** After a death: every cloud back, gusts restart from calm. */
  reset(): void {
    for (const k of this.crumbles) this.restore(k);
    this.crumbles = [];
    this.riding = null;
    this.gustT = 0;
    this.gust = 0;
    this.gustLabel.setVisible(false);
  }
}
