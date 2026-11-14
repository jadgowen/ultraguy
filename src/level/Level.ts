import { SCREEN_COLS, SCREEN_ROWS, TILE, VIEW_H, VIEW_W } from '../constants';

/**
 * A stage is a grid of screens (16x15 tiles each). Each screen is ASCII art:
 *
 *   .  empty       #  solid      H  ladder     ^  spikes (solid, deadly)
 *   P  player start              c  checkpoint *  goal
 *   w  walker   h  hopper   f  flyer   t  turret (shielded)
 *
 * The layout places screens; '.' in the layout is an unused screen.
 * Each horizontal run of used screens is a camera "section": the camera
 * scrolls freely inside a section and does a locked transition between them.
 */
export interface StageData {
  name: string;
  screens: Record<string, string[]>;
  layout: string[];
}

export enum Tile {
  Empty = 0,
  Solid = 1,
  Ladder = 2,
  Spike = 3,
}

export type EnemyKind = 'walker' | 'hopper' | 'flyer' | 'turret';

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

const ENEMY_CHARS: Record<string, EnemyKind> = { w: 'walker', h: 'hopper', f: 'flyer', t: 'turret' };

export class Level {
  readonly cols: number;
  readonly rows: number;
  readonly tiles: Uint8Array;
  readonly spawns: Spawn[] = [];
  readonly checkpoints: Point[] = [];
  readonly sections: Section[] = [];
  playerStart: Point = { x: 32, y: 208 };
  goal: Point | null = null;

  constructor(readonly data: StageData) {
    const screensWide = Math.max(...data.layout.map((r) => r.length));
    const screensHigh = data.layout.length;
    this.cols = screensWide * SCREEN_COLS;
    this.rows = screensHigh * SCREEN_ROWS;
    this.tiles = new Uint8Array(this.cols * this.rows);

    data.layout.forEach((line, sy) => {
      for (let sx = 0; sx < line.length; sx++) {
        const id = line[sx];
        if (id === '.') continue;
        const screen = data.screens[id];
        if (!screen) throw new Error(`Stage "${data.name}": unknown screen "${id}"`);
        this.loadScreen(id, screen, sx, sy);
      }
      // Sections: runs of used screens in this row.
      let start = -1;
      for (let sx = 0; sx <= line.length; sx++) {
        const used = sx < line.length && line[sx] !== '.';
        if (used && start < 0) start = sx;
        if (!used && start >= 0) {
          this.sections.push({ row: sy, x0: start, x1: sx - 1 });
          start = -1;
        }
      }
    });
  }

  private loadScreen(id: string, screen: string[], sx: number, sy: number): void {
    if (screen.length !== SCREEN_ROWS) throw new Error(`Screen "${id}" needs ${SCREEN_ROWS} rows, has ${screen.length}`);
    screen.forEach((row, r) => {
      if (row.length !== SCREEN_COLS) throw new Error(`Screen "${id}" row ${r} needs ${SCREEN_COLS} chars, has ${row.length}`);
      for (let c = 0; c < SCREEN_COLS; c++) {
        const ch = row[c];
        const gc = sx * SCREEN_COLS + c;
        const gr = sy * SCREEN_ROWS + r;
        const cx = gc * TILE + TILE / 2;
        const bottom = (gr + 1) * TILE;
        let t = Tile.Empty;
        if (ch === '#') t = Tile.Solid;
        else if (ch === 'H') t = Tile.Ladder;
        else if (ch === '^') t = Tile.Spike;
        else if (ch === 'P') this.playerStart = { x: cx, y: bottom };
        else if (ch === 'c') this.checkpoints.push({ x: cx, y: bottom });
        else if (ch === '*') this.goal = { x: cx, y: bottom };
        else if (ENEMY_CHARS[ch]) this.spawns.push({ kind: ENEMY_CHARS[ch], x: cx, y: bottom, alive: false, armed: true });
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
    return t === Tile.Solid || t === Tile.Spike;
  }

  /** Solid ground an enemy is willing to walk on (not spikes). */
  isFloor(c: number, r: number): boolean {
    return this.tileAt(c, r) === Tile.Solid || this.isLadderTop(c, r);
  }

  isSpike(c: number, r: number): boolean {
    return this.tileAt(c, r) === Tile.Spike;
  }

  isLadder(c: number, r: number): boolean {
    return this.tileAt(c, r) === Tile.Ladder;
  }

  isLadderTop(c: number, r: number): boolean {
    return this.isLadder(c, r) && !this.isLadder(c, r - 1);
  }

  sectionAt(px: number, py: number): Section | null {
    const sx = Math.floor(px / VIEW_W);
    const sy = Math.floor(py / VIEW_H);
    return this.sections.find((s) => s.row === sy && sx >= s.x0 && sx <= s.x1) ?? null;
  }

  /** Tile indices for a Phaser tilemap (-1 = empty). */
  tileIndexGrid(): number[][] {
    const out: number[][] = [];
    for (let r = 0; r < this.rows; r++) {
      const row: number[] = [];
      for (let c = 0; c < this.cols; c++) row.push(this.tiles[r * this.cols + c] - 1);
      out.push(row);
    }
    return out;
  }
}
