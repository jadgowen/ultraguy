import { TILE } from './constants';
import type { Level } from './level/Level';

/** Axis-aligned box with top-left origin, in pixels. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const EPS = 0.001;

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Move horizontally against solid tiles. Returns true if blocked. */
export function moveX(level: Level, b: Box, dx: number): boolean {
  if (dx === 0) return false;
  b.x += dx;
  const r0 = Math.floor(b.y / TILE);
  const r1 = Math.floor((b.y + b.h - EPS) / TILE);
  if (dx > 0) {
    const col = Math.floor((b.x + b.w - EPS) / TILE);
    for (let r = r0; r <= r1; r++) {
      if (level.isSolid(col, r)) {
        b.x = col * TILE - b.w;
        return true;
      }
    }
  } else {
    const col = Math.floor(b.x / TILE);
    for (let r = r0; r <= r1; r++) {
      if (level.isSolid(col, r)) {
        b.x = (col + 1) * TILE;
        return true;
      }
    }
  }
  return false;
}

/**
 * Move vertically against solid tiles. Ladder tops and clouds act as one-way platforms
 * when `oneWay` is set (you can stand on them, but climb/jump through).
 * Returns true if blocked.
 */
export function moveY(level: Level, b: Box, dy: number, oneWay: boolean): boolean {
  if (dy === 0) return false;
  const prevBottom = b.y + b.h;
  b.y += dy;
  const c0 = Math.floor(b.x / TILE);
  const c1 = Math.floor((b.x + b.w - EPS) / TILE);
  if (dy > 0) {
    const row = Math.floor((b.y + b.h - EPS) / TILE);
    for (let c = c0; c <= c1; c++) {
      const solid = level.isSolid(c, row);
      const platform = oneWay && level.isPlatform(c, row) && prevBottom <= row * TILE + EPS;
      if (solid || platform) {
        b.y = row * TILE - b.h;
        return true;
      }
    }
  } else {
    const row = Math.floor(b.y / TILE);
    for (let c = c0; c <= c1; c++) {
      if (level.isSolid(c, row)) {
        b.y = (row + 1) * TILE;
        return true;
      }
    }
  }
  return false;
}

/**
 * Spike hitbox, forgiving on both sides so a jump over a spike pit isn't
 * decided by a pixel:
 *  - the deadly part of each spike tile is inset SPIKE_INSET_X from its sides;
 *  - the body checked against spikes is the player's box minus BODY_INSET_X on
 *    each side, so toes can overhang spikes on takeoff and landing.
 * Spikes are solid, so the player can never overlap one; the probe is grown
 * 1px vertically to count standing on (or bonking) a spike as a touch.
 *
 * Worked example: a 3-tile (48px) pit needs 46px of travel to clear; a full
 * running jump covers ~53.6px.
 */
export const SPIKE_INSET_X = 4;
export const SPIKE_BODY_INSET_X = 3;

export function touchesSpike(level: Level, b: Box): boolean {
  const probe: Box = { x: b.x + SPIKE_BODY_INSET_X, y: b.y - 1, w: b.w - SPIKE_BODY_INSET_X * 2, h: b.h + 2 };
  const c0 = Math.floor(probe.x / TILE);
  const c1 = Math.floor((probe.x + probe.w - EPS) / TILE);
  const r0 = Math.floor(probe.y / TILE);
  const r1 = Math.floor((probe.y + probe.h - EPS) / TILE);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (!level.isSpike(c, r)) continue;
      const hit: Box = { x: c * TILE + SPIKE_INSET_X, y: r * TILE, w: TILE - SPIKE_INSET_X * 2, h: TILE };
      if (overlaps(probe, hit)) return true;
    }
  }
  return false;
}

/** True if the box is standing on at least one ice tile. */
export function standingOnIce(level: Level, b: Box): boolean {
  const row = Math.floor((b.y + b.h + 0.5) / TILE);
  const c0 = Math.floor(b.x / TILE);
  const c1 = Math.floor((b.x + b.w - EPS) / TILE);
  for (let c = c0; c <= c1; c++) if (level.isIce(c, row)) return true;
  return false;
}
