import { Level, StageData, Tile } from '../src/level/Level';

export interface ReachOptions {
  /** Jump Boots: double jump. */
  boots?: boolean;
  /** Flame Burst: frozen blocks can be melted. */
  flame?: boolean;
  /** Target the upgrade capsule instead of the boss door / goal. */
  toUpgrade?: boolean;
}

/**
 * Rough reachability, on the tile grid: can the hero get from the start to
 * the boss door (or goal, or upgrade capsule)? Jumps are conservative (2
 * tiles up, 4 across; 5/5 with boots; higher in water), may not pass
 * through walls, and you can't land in lava or on spikes. It doesn't model
 * conveyors, enemies or exact arcs, so it can call a hard jump possible.
 */
export function reach(stage: StageData, opts: ReachOptions = {}): { ok: boolean; visited: number; stuck?: { c: number; r: number } } {
  const L = new Level(stage);
  const T = (c: number, r: number) => L.tileAt(c, r);
  const blocks = (c: number, r: number) => L.isSolid(c, r) && !(opts.flame && T(c, r) === Tile.Melt);
  const deadly = (c: number, r: number) => T(c, r) === Tile.Lava;
  // A cell where the 12x22 hero can stand: two cells clear, support below.
  const support = (c: number, r: number) => (L.isSolid(c, r + 1) && !L.isSpike(c, r + 1)) || L.isPlatform(c, r + 1);
  const clear = (c: number, r: number) => !blocks(c, r) && !blocks(c, r - 1) && !deadly(c, r);
  const stand = (c: number, r: number) => r >= 0 && r < L.rows && clear(c, r) && support(c, r);
  const key = (c: number, r: number) => c * 10000 + r;
  const cell = (p: { x: number; y: number }) => ({ c: Math.floor(p.x / 16), r: Math.floor((p.y - 1) / 16) });

  const start = cell(L.playerStart);
  const door = L.doors[0];
  const goal = opts.toUpgrade && L.upgrade ? cell(L.upgrade) : door ? { c: door.col - 1, r: door.r1 } : cell(L.goal!);

  const seen = new Set<number>();
  const q: { c: number; r: number }[] = [];
  const push = (c: number, r: number) => {
    const k = key(c, r);
    if (!seen.has(k)) {
      seen.add(k);
      q.push({ c, r });
    }
  };
  // Fall from (c, r) until standing (or grabbing a ladder); null on death.
  const fall = (c: number, r: number): number | null => {
    for (let y = r; y < L.rows; y++) {
      if (blocks(c, y)) return null;
      if (deadly(c, y) || L.isSpike(c, y + 1)) return null;
      if (support(c, y) && clear(c, y)) return y;
      if (L.isLadder(c, y)) return y;
    }
    return null;
  };

  push(start.c, start.r);
  while (q.length) {
    const { c, r } = q.shift()!;
    if (c === goal.c && Math.abs(r - goal.r) <= 1) return { ok: true, visited: seen.size };
    const water = T(c, r) === Tile.Water;
    const up = water ? 4 : opts.boots ? 5 : 2;
    const far = water ? 6 : opts.boots ? 5 : 4;
    if (L.isLadder(c, r) || L.isLadder(c, r + 1)) {
      for (const dy of [-1, 1]) if (L.isLadder(c, r + dy) || (dy < 0 && L.isLadder(c, r))) push(c, r + dy);
      if (L.isLadderTop(c, r + 1)) push(c, r + 1);
    }
    const onSomething = support(c, r) || L.isLadder(c, r) || water;
    if (!onSomething) {
      const y = fall(c, r);
      if (y !== null) push(c, y);
      continue;
    }
    for (const dx of [-1, 1]) {
      if (clear(c + dx, r)) {
        if (stand(c + dx, r)) push(c + dx, r);
        else {
          const y = fall(c + dx, r);
          if (y !== null) push(c + dx, y);
        }
      }
      for (let h = 0; h <= up; h++) {
        if (blocks(c, r - 1 - h)) break; // ceiling right above
        for (let d = 1; d <= (h >= 2 && !water ? far - 1 : far); d++) {
          const tc = c + dx * d;
          const tr = r - h;
          if (!clear(tc, tr) && !stand(tc, tr)) break; // the arc can't pass through a wall
          if (stand(tc, tr)) push(tc, tr);
          const y = clear(tc, tr) ? fall(tc, tr) : null;
          if (y !== null && y >= tr) push(tc, y);
          if (L.isLadder(tc, tr)) push(tc, tr);
        }
      }
    }
  }
  let stuck = { c: 0, r: 0 };
  for (const k of seen) {
    const c = Math.floor(k / 10000);
    if (c > stuck.c) stuck = { c, r: k % 10000 };
  }
  return { ok: false, visited: seen.size, stuck };
}
