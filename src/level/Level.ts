import { SCREEN_COLS, SCREEN_H, SCREEN_ROWS, SCREEN_W, TILE } from '../constants';
import type { PartId } from '../parts';
import type { WeaponId } from '../weapons';

/**
 * A stage is a grid of screens (16x15 tiles each). Each screen is ASCII art:
 *
 *   .  empty       #  solid      H  ladder / vine    ^  spikes (solid, deadly)
 *   I  ice (solid, slippery)     C  cloud (one-way platform: stand on it, jump up through it)
 *   Z  electric barrier (toggles on/off; hurts while on)
 *   L  lava (not solid; instant death)
 *   <  >  conveyor belt (solid; carries you left / right)
 *   ~  water (not solid; floaty jumps and slow falls)
 *   F  fake wall (looks solid, drawn over sprites, but you walk through it)
 *   &  frozen block (solid until Flame Burst melts it)
 *   x  crumbling cloud (one-way platform that puffs away soon after you land; comes back)
 *   y  updraft (rising air: lifts you, and you can jump again while inside it)
 *   =  moving cloud, horizontal: a 3-tile cloud whose left end starts here and
 *      slides right along the '-' cells after it, then back
 *   v  moving cloud, vertical: starts here (left end, top) and sinks along the
 *      ':' cells below it, then back up
 *      (Moving clouds are drawn per theme: clouds, logs, ice floes, metal lifts...)
 *   %  spring / bounce flower (solid; landing on it launches you high)
 *   [ ]  switch blocks: solid in turns ('[' then ']'), blinking before they vanish
 *   { }  water current pushing left / right (counts as water)
 *   !  crusher: a 2-tile-wide press that hangs here and slams down to the floor
 *   @  roller chute: keeps sending a boulder / snowball / barrel rolling left
 *   D  boss door (solid; opens when the player walks into it from the left)
 *   P  player start              c  checkpoint       *  goal
 *   B  checkpoint that is also the "boss test" start
 *   X  boss (in the boss room)
 *   M  miniboss (stage's `miniboss`; the camera locks around it until it's beaten)
 *   E  energy tank (collectible)
 *   U  upgrade capsule holding the stage's armor part (`upgrade`)
 *   T  teleporter capsule (boss rematch room; left to right = REMATCH_ORDER)
 *
 * Enemies:
 *   w  walker    h  hopper     f  flyer      t  turret (shielded)
 *   l  lurker (camouflaged)    s  spitter plant
 *   p  slider (ice)            i  icicle (hangs, drops when you pass under)
 *   b  bomber (drops eggs)     z  sparker (cloud rider, drops lightning)
 *   k  zapper (coil, arcs both ways)   o  roller (ball that rolls at you)
 *   e  ember (leaps out of lava)       m  magma slug
 *   g  grinder (rolling saw)           j  junkbot (throws scrap)
 *   u  puffer (fish)                   q  clam (shielded, spits pearls)
 *
 * The layout places screens; '.' in the layout is an unused screen.
 * Each horizontal run of used screens is a camera "section": the camera
 * scrolls freely inside a section and does a locked transition between them.
 * '|' in the layout splits a run into two sections without a gap (use it
 * where a boss door separates two screens).
 */

export type BossStageId = 'foundry' | 'canopy' | 'glacier' | 'stratos' | 'powerplant' | 'caldera' | 'scrapyard' | 'reef';
export type FortressStageId = 'fortress1' | 'fortress2' | 'fortress3' | 'gauntlet' | 'finale';
export type StageId = BossStageId | FortressStageId | 'intro' | 'dojo';

export const ALL_STAGE_IDS: StageId[] = [
  'intro',
  'foundry',
  'canopy',
  'glacier',
  'stratos',
  'powerplant',
  'caldera',
  'scrapyard',
  'reef',
  'fortress1',
  'fortress2',
  'fortress3',
  'gauntlet',
  'finale',
  'dojo',
];
export type ThemeId = 'foundry' | 'jungle' | 'ice' | 'sky' | 'power' | 'volcano' | 'scrap' | 'water' | 'fortress' | 'city';
export type MiniKind = 'press' | 'toad' | 'mammoth' | 'kite' | 'dynamo' | 'crab' | 'crusher' | 'angler';
/** Fortress stage bosses (no weapon reward). */
export type GuardianKind = 'gatekeeper' | 'abyss' | 'warden';
export type BossKind = 'anvil' | 'mantis' | 'frostline' | 'gale' | 'volt' | 'magma' | 'scrap' | 'tide' | 'overlord' | 'shade' | 'jared' | MiniKind | GuardianKind;

export interface StageData {
  id: StageId;
  name: string;
  theme: ThemeId;
  /** Boss behind the door (fortress stages 1-3 have none: they end at a goal capsule). */
  boss?: BossKind;
  bossName?: string;
  /** Weapon earned by beating this stage's boss. */
  bossWeapon?: WeaponId;
  /** Miniboss at the 'M' marker. */
  miniboss?: MiniKind;
  /** Armor part in the upgrade capsule ('U'). */
  upgrade?: PartId;
  screens: Record<string, string[]>;
  layout: string[];
  /** Scenery drawn behind the sprites: images or text, in world pixels. */
  decor?: Decor[];
  /** Wind gusts blow on these screens (by screen id), in the given directions in turn. */
  wind?: { screens: string; dirs: (1 | -1)[] };
  /** Screens that are dark: you see a small circle around you, plus flashes. */
  dark?: string;
  /** Short line under the stage name on the title card. */
  tagline?: string;
  /** Lava rises through these screens once you enter them (px per step). */
  rise?: { screens: string; speed: number };
}

/** A moving cloud: its top-left travels between (x0, y0) and (x1, y1). */
export interface Mover {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Width of a moving cloud, in tiles. */
export const MOVER_TILES = 3;

export interface Decor {
  x: number;
  y: number;
  tex?: string;
  text?: string;
  /** A plain filled rectangle (w x h in `fill` color). */
  rect?: { w: number; h: number; fill: number };
  color?: string;
  size?: number;
  /** Draw order; default 1 (above tiles, behind sprites). Bosses are 6, the hero 10. */
  depth?: number;
}

export enum Tile {
  Empty = 0,
  Solid = 1,
  Ladder = 2,
  Spike = 3,
  Door = 4,
  Ice = 5,
  Cloud = 6,
  Electric = 7,
  Lava = 8,
  ConveyorL = 9,
  ConveyorR = 10,
  Water = 11,
  Fake = 12,
  Melt = 13,
  Crumble = 14,
  Updraft = 15,
  Spring = 16,
  SwitchA = 17,
  SwitchB = 18,
  CurrentL = 19,
  CurrentR = 20,
}

/** Tileset frame drawn where a switch block is switched off (just its outline). */
export const SWITCH_OFF_INDEX = 19;

/** Tileset frame for a frozen block. Fake walls use the solid frame (0). */
export const MELT_INDEX = 12;

/** Tileset frame for an electric barrier while it's switched off. */
export const ELECTRIC_OFF_INDEX = 11;

/** A vertical boss-door column, rows r0..r1 inclusive. */
export interface Door {
  col: number;
  r0: number;
  r1: number;
}

export type EnemyKind =
  | 'walker'
  | 'hopper'
  | 'flyer'
  | 'turret'
  | 'lurker'
  | 'spitter'
  | 'slider'
  | 'icicle'
  | 'bomber'
  | 'sparker'
  | 'zapper'
  | 'roller'
  | 'ember'
  | 'slug'
  | 'grinder'
  | 'junkbot'
  | 'puffer'
  | 'clam'
  | 'dummy'
  | 'shieldDummy'
  | 'airDummy';

export interface Spawn {
  kind: EnemyKind;
  x: number; // center x, px
  y: number; // bottom y, px
  alive: boolean;
  armed: boolean; // may spawn the next time it scrolls into view
}

export interface Section {
  row: number; // screen row
  x0: number; // first screen column
  x1: number; // last screen column (inclusive)
}

export interface Point {
  x: number;
  y: number;
}

const ENEMY_CHARS: Record<string, EnemyKind> = {
  w: 'walker',
  h: 'hopper',
  f: 'flyer',
  t: 'turret',
  l: 'lurker',
  s: 'spitter',
  p: 'slider',
  i: 'icicle',
  b: 'bomber',
  z: 'sparker',
  k: 'zapper',
  o: 'roller',
  e: 'ember',
  m: 'slug',
  g: 'grinder',
  j: 'junkbot',
  u: 'puffer',
  q: 'clam',
  // Dojo targets.
  d: 'dummy',
  n: 'shieldDummy',
  a: 'airDummy',
};

const TILE_CHARS: Record<string, Tile> = {
  '#': Tile.Solid,
  H: Tile.Ladder,
  '^': Tile.Spike,
  D: Tile.Door,
  I: Tile.Ice,
  C: Tile.Cloud,
  Z: Tile.Electric,
  L: Tile.Lava,
  '<': Tile.ConveyorL,
  '>': Tile.ConveyorR,
  '~': Tile.Water,
  F: Tile.Fake,
  '&': Tile.Melt,
  x: Tile.Crumble,
  y: Tile.Updraft,
  '%': Tile.Spring,
  '[': Tile.SwitchA,
  ']': Tile.SwitchB,
  '{': Tile.CurrentL,
  '}': Tile.CurrentR,
};

const MARKERS = new Set(['.', 'X', 'B', 'P', 'c', '*', 'M', 'E', 'T', 'U', '=', '-', 'v', ':', '!', '@', '+', '$']);

/** Water, including currents. */
export function isWaterTile(t: Tile): boolean {
  return t === Tile.Water || t === Tile.CurrentL || t === Tile.CurrentR;
}

export class Level {
  readonly cols: number;
  readonly rows: number;
  readonly tiles: Uint8Array;
  readonly spawns: Spawn[] = [];
  readonly checkpoints: Point[] = [];
  readonly sections: Section[] = [];
  playerStart: Point = { x: 32, y: 208 };
  goal: Point | null = null;
  boss: Point | null = null;
  miniboss: Point | null = null;
  readonly tanks: Point[] = [];
  /** Hidden extra lives ('+') and bolt caches ('$'). */
  readonly oneUps: Point[] = [];
  readonly boltCaches: Point[] = [];
  readonly teleporters: Point[] = [];
  upgrade: Point | null = null;
  bossTestStart: Point | null = null;
  readonly doors: Door[] = [];
  readonly movers: Mover[] = [];
  /** Crusher anchors (top-left of the 2-tile head) and roller chutes. */
  readonly crushers: Point[] = [];
  readonly rollers: Point[] = [];
  /** Screen id at each layout cell ('' where unused), [sy][sx]. */
  private readonly screenGrid: string[][] = [];
  /** Moving-cloud marker characters by cell, used to trace tracks once all screens are in. */
  private readonly moverChars = new Map<number, string>();

  constructor(readonly data: StageData) {
    const screensWide = Math.max(...data.layout.map((r) => r.replace(/\|/g, '').length));
    const screensHigh = data.layout.length;
    this.cols = screensWide * SCREEN_COLS;
    this.rows = screensHigh * SCREEN_ROWS;
    this.tiles = new Uint8Array(this.cols * this.rows);

    data.layout.forEach((line, sy) => {
      this.screenGrid[sy] = [];
      // Sections: runs of used screens in this row, also split at '|'.
      let sx = 0;
      let start = -1;
      const close = () => {
        if (start >= 0) this.sections.push({ row: sy, x0: start, x1: sx - 1 });
        start = -1;
      };
      for (const id of line) {
        if (id === '|') {
          close();
          continue;
        }
        if (id === '.') close();
        else {
          const screen = data.screens[id];
          if (!screen) throw new Error(`Stage "${data.name}": unknown screen "${id}"`);
          this.loadScreen(id, screen, sx, sy);
          this.screenGrid[sy][sx] = id;
          if (start < 0) start = sx;
        }
        sx++;
      }
      close();
    });
    this.fillMarkersInWater();
    this.findDoors();
    this.findMovers();
  }

  /** Trace each moving cloud's track ('-' to the right of '=', ':' below 'v'). */
  private findMovers(): void {
    const at = (c: number, r: number) => this.moverChars.get(r * this.cols + c);
    for (const [k, ch] of this.moverChars) {
      const c = k % this.cols;
      const r = Math.floor(k / this.cols);
      if (ch === '=') {
        let end = c;
        while (at(end + 1, r) === '-') end++;
        this.movers.push({ x0: c * TILE, y0: r * TILE, x1: Math.max(c, end - MOVER_TILES + 1) * TILE, y1: r * TILE });
      } else if (ch === 'v') {
        let end = r;
        while (at(c, end + 1) === ':') end++;
        this.movers.push({ x0: c * TILE, y0: r * TILE, x1: c * TILE, y1: end * TILE });
      }
    }
  }

  /** Id of the screen containing a world point ('' if none). */
  screenIdAt(px: number, py: number): string {
    return this.screenGrid[Math.floor(py / SCREEN_H)]?.[Math.floor(px / SCREEN_W)] ?? '';
  }

  /** Cells holding an enemy or marker are empty; if they sit in water, make them water too. */
  private markerCells: { c: number; r: number }[] = [];
  private fillMarkersInWater(): void {
    for (const { c, r } of this.markerCells) {
      const near = [this.tileAt(c - 1, r), this.tileAt(c + 1, r), this.tileAt(c, r - 1), this.tileAt(c, r + 1)];
      if (near.some(isWaterTile)) this.tiles[r * this.cols + c] = Tile.Water;
    }
  }

  private findDoors(): void {
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        if (this.tileAt(c, r) !== Tile.Door || this.tileAt(c, r - 1) === Tile.Door) continue;
        let r1 = r;
        while (this.tileAt(c, r1 + 1) === Tile.Door) r1++;
        this.doors.push({ col: c, r0: r, r1 });
      }
    }
  }

  setTile(c: number, r: number, t: Tile): void {
    if (c >= 0 && c < this.cols && r >= 0 && r < this.rows) this.tiles[r * this.cols + c] = t;
  }

  private loadScreen(id: string, screen: string[], sx: number, sy: number): void {
    const where = `Stage "${this.data.name}" screen "${id}"`;
    if (screen.length !== SCREEN_ROWS) throw new Error(`${where} needs ${SCREEN_ROWS} rows, has ${screen.length}`);
    screen.forEach((row, r) => {
      if (row.length !== SCREEN_COLS) throw new Error(`${where} row ${r} needs ${SCREEN_COLS} chars, has ${row.length}`);
      for (let c = 0; c < SCREEN_COLS; c++) {
        const ch = row[c];
        const gc = sx * SCREEN_COLS + c;
        const gr = sy * SCREEN_ROWS + r;
        const cx = gc * TILE + TILE / 2;
        const bottom = (gr + 1) * TILE;
        const t = TILE_CHARS[ch] ?? Tile.Empty;
        if (!(ch in TILE_CHARS) && ch !== '.') this.markerCells.push({ c: gc, r: gr });
        if (ch === '=' || ch === '-' || ch === 'v' || ch === ':') this.moverChars.set(gr * this.cols + gc, ch);
        if (ch === 'X') this.boss = { x: cx, y: bottom };
        else if (ch === 'B') {
          this.bossTestStart = { x: cx, y: bottom };
          this.checkpoints.push({ x: cx, y: bottom });
        } else if (ch === 'P') this.playerStart = { x: cx, y: bottom };
        else if (ch === 'c') this.checkpoints.push({ x: cx, y: bottom });
        else if (ch === '*') this.goal = { x: cx, y: bottom };
        else if (ch === 'M') this.miniboss = { x: cx, y: bottom };
        else if (ch === 'E') this.tanks.push({ x: cx, y: bottom });
        else if (ch === '+') this.oneUps.push({ x: cx, y: bottom });
        else if (ch === '$') this.boltCaches.push({ x: cx, y: bottom });
        else if (ch === 'T') this.teleporters.push({ x: cx, y: bottom });
        else if (ch === 'U') this.upgrade = { x: cx, y: bottom };
        else if (ch === '!') this.crushers.push({ x: gc * TILE, y: gr * TILE });
        else if (ch === '@') this.rollers.push({ x: cx, y: bottom });
        else if (ENEMY_CHARS[ch]) this.spawns.push({ kind: ENEMY_CHARS[ch], x: cx, y: bottom, alive: false, armed: true });
        else if (t === Tile.Empty && !MARKERS.has(ch)) throw new Error(`${where} row ${r}: unknown character "${ch}"`);
        this.tiles[gr * this.cols + gc] = t;
      }
    });
  }

  tileAt(c: number, r: number): Tile {
    if (c < 0 || c >= this.cols) return Tile.Solid; // side walls
    if (r < 0 || r >= this.rows) return Tile.Empty; // open sky / bottomless pits
    return this.tiles[r * this.cols + c] as Tile;
  }

  isSolid(c: number, r: number): boolean {
    const t = this.tileAt(c, r);
    return t === Tile.Solid || t === Tile.Spike || t === Tile.Door || t === Tile.Ice || t === Tile.ConveyorL || t === Tile.ConveyorR || t === Tile.Melt || t === Tile.Spring || t === Tile.SwitchA || t === Tile.SwitchB;
  }

  /** Ground an enemy is willing to walk on (not spikes). */
  isFloor(c: number, r: number): boolean {
    const t = this.tileAt(c, r);
    return t === Tile.Solid || t === Tile.Door || t === Tile.Ice || t === Tile.ConveyorL || t === Tile.ConveyorR || t === Tile.Melt || t === Tile.SwitchA || t === Tile.SwitchB || this.isPlatform(c, r);
  }

  isUpdraft(c: number, r: number): boolean {
    return this.tileAt(c, r) === Tile.Updraft;
  }

  isLava(c: number, r: number): boolean {
    return this.tileAt(c, r) === Tile.Lava;
  }

  isWater(c: number, r: number): boolean {
    return isWaterTile(this.tileAt(c, r));
  }

  /** Current push at a cell: -1 (left), 1 (right) or 0. */
  currentAt(c: number, r: number): number {
    const t = this.tileAt(c, r);
    return t === Tile.CurrentL ? -1 : t === Tile.CurrentR ? 1 : 0;
  }

  hasWater(): boolean {
    return this.tiles.some((t) => isWaterTile(t as Tile));
  }


  isElectric(c: number, r: number): boolean {
    return this.tileAt(c, r) === Tile.Electric;
  }

  /** Conveyor push at a tile: -1, 0 or 1. */
  conveyorAt(c: number, r: number): number {
    const t = this.tileAt(c, r);
    return t === Tile.ConveyorL ? -1 : t === Tile.ConveyorR ? 1 : 0;
  }

  /** All tiles of one type (e.g. electric barriers to toggle). */
  findTiles(type: Tile): { c: number; r: number }[] {
    const out: { c: number; r: number }[] = [];
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.tiles[r * this.cols + c] === type) out.push({ c, r });
    return out;
  }

  isSpike(c: number, r: number): boolean {
    return this.tileAt(c, r) === Tile.Spike;
  }

  isIce(c: number, r: number): boolean {
    return this.tileAt(c, r) === Tile.Ice;
  }

  isLadder(c: number, r: number): boolean {
    return this.tileAt(c, r) === Tile.Ladder;
  }

  isLadderTop(c: number, r: number): boolean {
    return this.isLadder(c, r) && !this.isLadder(c, r - 1);
  }

  /** One-way platforms: ladder tops and clouds. */
  isPlatform(c: number, r: number): boolean {
    const t = this.tileAt(c, r);
    return t === Tile.Cloud || t === Tile.Crumble || this.isLadderTop(c, r);
  }

  sectionAt(px: number, py: number): Section | null {
    const sx = Math.floor(px / SCREEN_W);
    const sy = Math.floor(py / SCREEN_H);
    return this.sections.find((s) => s.row === sy && sx >= s.x0 && sx <= s.x1) ?? null;
  }

  /** Tile indices for the main Phaser tilemap layer (-1 = empty). Water is drawn on its own layer. */
  tileIndexGrid(): number[][] {
    return this.grid((t) => (isWaterTile(t) || t === Tile.Fake || t === Tile.Updraft ? -1 : t === Tile.Melt ? MELT_INDEX : t - 1));
  }

  /**
   * Which sides of a cell have a block (solid or fake wall) next to them, as
   * bits: 1 up, 2 right, 4 down, 8 left. Used to pick auto-tile frames.
   */
  blockMask(c: number, r: number): number {
    const block = (x: number, y: number) => {
      const t = this.tileAt(x, y);
      return t === Tile.Solid || t === Tile.Fake;
    };
    return (block(c, r - 1) ? 1 : 0) | (block(c + 1, r) ? 2 : 0) | (block(c, r + 1) ? 4 : 0) | (block(c - 1, r) ? 8 : 0);
  }

  /** Fake walls, drawn as solid wall on a layer over the sprites (so you vanish into them). */
  fakeIndexGrid(): number[][] {
    return this.grid((t) => (t === Tile.Fake ? 0 : -1));
  }

  /** Tile indices for the translucent water layer drawn over sprites. */
  waterIndexGrid(): number[][] {
    const w = Tile.Water - 1;
    return this.grid((t) => (isWaterTile(t) ? w : -1)).map((row, r) =>
      row.map((v, c) => (v === -1 && this.underwaterSeeThrough(c, r) ? w : v)),
    );
  }

  /**
   * See-through tiles (spikes, ladders) touching water: the water layer covers
   * them too, so they don't show as a dry hole in the tint.
   */
  private underwaterSeeThrough(c: number, r: number): boolean {
    const t = this.tileAt(c, r);
    if (t !== Tile.Spike && t !== Tile.Ladder && t !== Tile.Updraft) return false;
    return [this.tileAt(c - 1, r), this.tileAt(c + 1, r), this.tileAt(c, r - 1)].some(isWaterTile);
  }

  private grid(index: (t: Tile) => number): number[][] {
    const out: number[][] = [];
    for (let r = 0; r < this.rows; r++) {
      const row: number[] = [];
      for (let c = 0; c < this.cols; c++) row.push(index(this.tiles[r * this.cols + c] as Tile));
      out.push(row);
    }
    return out;
  }
}
