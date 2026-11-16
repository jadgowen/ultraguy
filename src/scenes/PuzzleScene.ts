import Phaser from 'phaser';
import { VIEW_W } from '../constants';
import { pixelText } from '../pixelFont';
import { sfx } from '../sfx';
import { ModeScene } from './ModeScene';

/**
 * SCRAP'S JUNK DUEL: a versus falling-block puzzle. Pairs of junk (bolts,
 * gears, pipes, chips) fall into your bin; connect four or more of one kind to
 * crush them. Crushes (and chains of them) dump scrap blocks into Scrap's bin;
 * his crushes dump them into yours. Scrap clears when a crush happens next to
 * it. Fill up to the top and you lose.
 */

const COLS = 6;
const ROWS = 12;
const CELL = 13;
const KINDS = 4;
const JUNK = 9; // garbage
const SPAWN_C = 2;
const BOARD_Y = 30;
const LEFT_X = Math.round(VIEW_W / 2 - 150);
const RIGHT_X = Math.round(VIEW_W / 2 + 150 - COLS * CELL);

type Grid = number[][]; // -1 empty, 0..3 junk kinds, JUNK scrap

interface Piece {
  c: number;
  r: number;
  /** Where the second block sits: 0 up, 1 right, 2 down, 3 left. */
  rot: number;
  a: number;
  b: number;
}

interface Board {
  grid: Grid;
  piece: Piece | null;
  next: [number, number];
  fallT: number;
  /** Clearing in progress: steps until the next resolve step, and the chain so far. */
  resolveT: number;
  chain: number;
  popping: Set<number>;
  /** Scrap blocks waiting to drop in. */
  incoming: number;
  moveT: number;
  x: number;
}

const ROT: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export class PuzzleScene extends ModeScene {
  protected readonly voice = 'scrap';
  protected readonly music = 'puzzle';
  protected readonly homeStage = 'scrapyard' as const;

  private you!: Board;
  private scrap!: Board;
  private aiPlan: { rot: number; c: number } | null = null;
  private aiT = 0;
  private g!: Phaser.GameObjects.Graphics;
  private scrapImg!: Phaser.GameObjects.Image;
  private chainText!: ReturnType<typeof pixelText>;

  constructor() {
    super('puzzle');
  }

  protected setup(): void {
    this.cameras.main.setBackgroundColor('#100c08');
    this.g = this.add.graphics();
    const mk = (x: number): Board => ({
      grid: Array.from({ length: ROWS }, () => Array(COLS).fill(-1)),
      piece: null, next: this.pair(), fallT: 0, resolveT: 0, chain: 0, popping: new Set(), incoming: 0, moveT: 0, x,
    });
    this.you = mk(LEFT_X);
    this.scrap = mk(RIGHT_X);
    this.aiPlan = null;
    this.aiT = 0;
    this.scrapImg = this.add.image(VIEW_W / 2, 150, 'scrap_idle').setScale(1.5).setDepth(5);
    this.chainText = pixelText(this, VIEW_W / 2, 196, '', { color: '#ffe14a', stroke: '#000000' }).setOrigin(0.5).setDepth(20);
    pixelText(this, LEFT_X + (COLS * CELL) / 2, BOARD_Y - 12, 'ULTRAGUY', { color: '#f28c28', stroke: '#000000' }).setOrigin(0.5, 0).setDepth(20);
    pixelText(this, RIGHT_X + (COLS * CELL) / 2, BOARD_Y - 12, 'SCRAP', { color: '#c8ccd8', stroke: '#000000' }).setOrigin(0.5, 0).setDepth(20);
    pixelText(this, VIEW_W / 2, 56, 'NEXT', { color: '#8a8fa8', stroke: '#000000' }).setOrigin(0.5, 0).setDepth(20);
    this.help('LEFT/RIGHT MOVE   DOWN DROP   JUMP/FIRE TURN');
  }

  private pair(): [number, number] {
    return [Math.floor(Math.random() * KINDS), Math.floor(Math.random() * KINDS)];
  }

  // --- rules -------------------------------------------------------------------------

  private cells(p: Piece): [number, number, number][] {
    const [dc, dr] = ROT[p.rot];
    return [[p.c, p.r, p.a], [p.c + dc, p.r + dr, p.b]];
  }

  private fits(grid: Grid, p: Piece): boolean {
    return this.cells(p).every(([c, r]) => c >= 0 && c < COLS && r < ROWS && (r < 0 || grid[r][c] === -1));
  }

  private spawn(b: Board): boolean {
    const [a, bb] = b.next;
    b.next = this.pair();
    b.piece = { c: SPAWN_C, r: 0, rot: 0, a, b: bb };
    b.fallT = 0;
    if (b === this.scrap) this.aiPlan = null;
    return this.fits(b.grid, b.piece);
  }

  /** Let everything settle down its column. */
  private static settle(grid: Grid): void {
    for (let c = 0; c < COLS; c++) {
      let w = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (grid[r][c] === -1) continue;
        const v = grid[r][c];
        grid[r][c] = -1;
        grid[w--][c] = v;
      }
    }
  }

  /** Groups of 4+ (and junk next to them) to pop; empty if none. */
  private static findPops(grid: Grid): Set<number> {
    const seen = new Set<number>();
    const out = new Set<number>();
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const v = grid[r][c];
        if (v < 0 || v === JUNK || seen.has(r * COLS + c)) continue;
        const group: number[] = [];
        const q = [r * COLS + c];
        seen.add(r * COLS + c);
        while (q.length) {
          const k = q.pop()!;
          group.push(k);
          const kr = Math.floor(k / COLS);
          const kc = k % COLS;
          for (const [dc, dr] of ROT) {
            const nc = kc + dc;
            const nr = kr + dr;
            const nk = nr * COLS + nc;
            if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS || seen.has(nk) || grid[nr][nc] !== v) continue;
            seen.add(nk);
            q.push(nk);
          }
        }
        if (group.length >= 4) for (const k of group) out.add(k);
      }
    for (const k of [...out]) {
      const kr = Math.floor(k / COLS);
      const kc = k % COLS;
      for (const [dc, dr] of ROT) {
        const nr = kr + dr;
        const nc = kc + dc;
        if (grid[nr]?.[nc] === JUNK) out.add(nr * COLS + nc);
      }
    }
    return out;
  }

  /** How much scrap a pop sends: more for bigger crushes and longer chains. */
  private static attack(popped: number, chain: number): number {
    return Math.max(0, popped - 3) + (chain - 1) * 4 + (chain >= 2 ? 1 : 0);
  }

  private lock(b: Board): void {
    for (const [c, r, v] of this.cells(b.piece!)) if (r >= 0) b.grid[r][c] = v;
    b.piece = null;
    b.chain = 0;
    b.resolveT = 8;
    sfx.land();
  }

  /** Clearing: settle, pop, repeat with a small pause between steps. */
  private resolve(b: Board): void {
    if (--b.resolveT > 0) return;
    if (b.popping.size) {
      for (const k of b.popping) b.grid[Math.floor(k / COLS)][k % COLS] = -1;
      b.popping = new Set();
      b.resolveT = 8;
      return;
    }
    PuzzleScene.settle(b.grid);
    const pops = PuzzleScene.findPops(b.grid);
    if (pops.size) {
      b.chain++;
      const sent = PuzzleScene.attack(pops.size, b.chain);
      // Offset what's coming at you first, then send the rest.
      const other = b === this.you ? this.scrap : this.you;
      const cancel = Math.min(sent, b.incoming);
      b.incoming -= cancel;
      other.incoming += sent - cancel;
      b.popping = pops;
      b.resolveT = 22;
      sfx.crumble();
      if (b.chain >= 2) {
        sfx.weakHit();
        this.chainText.setText(`${b === this.you ? 'YOUR' : "SCRAP'S"} ${b.chain} CHAIN!`);
        this.time.delayedCall(900, () => this.chainText.setText(''));
      }
      return;
    }
    // Done: take any scrap that's coming, then a new pair.
    if (b.incoming > 0) {
      const n = Math.min(b.incoming, 18);
      b.incoming -= n;
      this.dropJunk(b, n);
      sfx.crush();
      if (b === this.you) this.cameras.main.shake(160, 0.006);
    }
    b.resolveT = 0;
    if (!this.spawn(b)) this.finish(b === this.scrap, b === this.scrap ? 'SCRAP IS BURIED!' : 'BURIED IN JUNK...');
  }

  private dropJunk(b: Board, n: number): void {
    const order = Phaser.Utils.Array.Shuffle([...Array(COLS).keys()]);
    for (let i = 0; i < n; i++) {
      const c = order[i % COLS];
      const top = b.grid.findIndex((row) => row[c] !== -1);
      const r = (top === -1 ? ROWS : top) - 1;
      if (r >= 0) b.grid[r][c] = JUNK;
    }
  }

  // --- the loop ------------------------------------------------------------------------

  protected tick(): void {
    for (const b of [this.you, this.scrap]) {
      if (this.result) return;
      if (!b.piece && b.resolveT === 0 && !b.popping.size) {
        if (!this.spawn(b)) return this.finish(b === this.scrap, b === this.scrap ? 'SCRAP IS BURIED!' : 'BURIED IN JUNK...');
      }
      if (!b.piece) {
        this.resolve(b);
        continue;
      }
      if (b === this.you) this.inputYou();
      else this.thinkScrap();
      if (!b.piece) continue;
      // Gravity, faster as the match goes on.
      const every = Math.max(12, 30 - Math.floor(this.playT / 900) * 2);
      // Only you can hurry a piece down; Scrap's fall at the natural pace.
      const fast = b === this.you && this.controls.isDown('down');
      if (++b.fallT >= (fast ? 2 : every)) {
        b.fallT = 0;
        const moved = { ...b.piece, r: b.piece.r + 1 };
        if (this.fits(b.grid, moved)) b.piece = moved;
        else this.lock(b);
      }
    }
    this.hud.setText('');
  }

  private tryMove(b: Board, dc: number, drot: number): boolean {
    const p = b.piece!;
    const next = { ...p, c: p.c + dc, rot: (p.rot + drot + 4) % 4 };
    if (this.fits(b.grid, next)) {
      b.piece = next;
      return true;
    }
    if (drot) {
      // Wall kicks: nudge sideways (or up) to make the turn.
      for (const [kc, kr] of [[1, 0], [-1, 0], [0, -1]]) {
        const kicked = { ...next, c: next.c + kc, r: next.r + kr };
        if (this.fits(b.grid, kicked)) {
          b.piece = kicked;
          return true;
        }
      }
    }
    return false;
  }

  private inputYou(): void {
    const c = this.controls;
    const b = this.you;
    const dir = (c.isDown('right') ? 1 : 0) - (c.isDown('left') ? 1 : 0);
    if (c.justPressed('left') || c.justPressed('right')) {
      b.moveT = 0;
      if (this.tryMove(b, dir, 0)) sfx.tick();
    } else if (dir) {
      // Hold to slide: a short pause, then repeat.
      if (++b.moveT > 10 && b.moveT % 4 === 0) this.tryMove(b, dir, 0);
    }
    if (c.justPressed('jump') && this.tryMove(b, 0, 1)) sfx.select();
    if (c.justPressed('fire') && this.tryMove(b, 0, -1)) sfx.select();
  }

  // --- Scrap -------------------------------------------------------------------------------

  private thinkScrap(): void {
    const b = this.scrap;
    if (!this.aiPlan) this.aiPlan = this.plan(b);
    const delay = Math.max(6, 13 - Math.floor(this.playT / 1200));
    if (++this.aiT < delay) return;
    this.aiT = 0;
    const p = b.piece!;
    const plan = this.aiPlan;
    if (p.rot !== plan.rot) this.tryMove(b, 0, 1);
    else if (p.c !== plan.c) {
      if (!this.tryMove(b, Math.sign(plan.c - p.c), 0)) plan.c = p.c; // blocked: settle for here
    }
  }

  /** Try every column and turn; score what happens. */
  private plan(b: Board): { rot: number; c: number } {
    const p = b.piece!;
    const options: { rot: number; c: number; score: number }[] = [];
    for (let rot = 0; rot < 4; rot++)
      for (let c = 0; c < COLS; c++) {
        let test: Piece = { ...p, c, rot, r: 0 };
        if (!this.fits(b.grid, test)) continue;
        while (this.fits(b.grid, { ...test, r: test.r + 1 })) test = { ...test, r: test.r + 1 };
        const grid = b.grid.map((row) => row.slice());
        for (const [cc, rr, v] of this.cells(test)) if (rr >= 0) grid[rr][cc] = v;
        let score = 0;
        // Simulate the whole chain.
        let chain = 0;
        for (;;) {
          PuzzleScene.settle(grid);
          const pops = PuzzleScene.findPops(grid);
          if (!pops.size) break;
          chain++;
          score += PuzzleScene.attack(pops.size, chain) * 12 + pops.size * 2;
          for (const k of pops) grid[Math.floor(k / COLS)][k % COLS] = -1;
        }
        // Like-next-to-like (sets up future crushes), low stacks, a clear middle.
        for (let r = 0; r < ROWS; r++)
          for (let cc = 0; cc < COLS; cc++) {
            const v = grid[r][cc];
            if (v < 0 || v === JUNK) continue;
            if (grid[r][cc + 1] === v) score += 1.5;
            if (grid[r + 1]?.[cc] === v) score += 1.5;
          }
        for (let cc = 0; cc < COLS; cc++) {
          const top = grid.findIndex((row) => row[cc] !== -1);
          const h = top === -1 ? 0 : ROWS - top;
          score -= h * h * 0.12 * (cc === SPAWN_C || cc === SPAWN_C + 1 ? 2 : 1);
        }
        options.push({ rot, c, score });
      }
    options.sort((x, y) => y.score - x.score);
    // Not perfect: about half the time he takes one of his next few ideas.
    const pick = Math.random() < 0.5 ? options[Math.min(options.length - 1, 1 + Math.floor(Math.random() * 4))] : options[0];
    return pick ? { rot: pick.rot, c: pick.c } : { rot: p.rot, c: p.c };
  }

  // --- drawing ---------------------------------------------------------------------------------

  private static readonly COLORS: [number, number, number][] = [
    [0x8c2030, 0xd83a4a, 0xff8aa8], // bolts
    [0xb87a10, 0xffc040, 0xfff1a0], // gears
    [0x2e7a34, 0x5ab84a, 0xa8e070], // pipes
    [0x3a78b8, 0x6ab8e8, 0xc8f0ff], // chips
  ];

  private block(x: number, y: number, v: number, flash = false): void {
    const g = this.g;
    if (v === JUNK) {
      g.fillStyle(0x2b2540).fillRect(x, y, CELL - 1, CELL - 1);
      g.fillStyle(0x55607a).fillRect(x + 1, y + 1, CELL - 3, CELL - 3);
      g.fillStyle(0x8a8fa8).fillRect(x + 2, y + 2, 3, 2).fillRect(x + 7, y + 7, 3, 2);
      return;
    }
    const [d, m, l] = PuzzleScene.COLORS[v];
    g.fillStyle(flash ? 0xffffff : d).fillRect(x, y, CELL - 1, CELL - 1);
    g.fillStyle(flash ? 0xffffff : m).fillRect(x + 1, y + 1, CELL - 3, CELL - 3);
    g.fillStyle(l);
    // Each kind gets its own mark.
    if (v === 0) g.fillRect(x + 5, y + 2, 2, 8).fillRect(x + 3, y + 2, 6, 2);
    else if (v === 1) g.fillCircle(x + 6, y + 6, 3).fillStyle(m).fillCircle(x + 6, y + 6, 1);
    else if (v === 2) g.fillRect(x + 2, y + 4, 8, 4);
    else g.fillRect(x + 3, y + 3, 6, 6).fillStyle(d).fillRect(x + 5, y + 5, 2, 2);
  }

  protected draw(): void {
    const g = this.g;
    g.clear();
    for (const b of [this.you, this.scrap]) {
      g.fillStyle(0x3a2a1a).fillRect(b.x - 4, BOARD_Y - 4, COLS * CELL + 8, ROWS * CELL + 8);
      g.fillStyle(0x0c0806).fillRect(b.x, BOARD_Y, COLS * CELL, ROWS * CELL);
      g.fillStyle(0xd83a4a, 0.25).fillRect(b.x + SPAWN_C * CELL, BOARD_Y, CELL, CELL);
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
          const v = b.grid[r][c];
          if (v === -1) continue;
          const pop = b.popping.has(r * COLS + c);
          if (pop && this.frame % 6 < 3) continue;
          this.block(b.x + c * CELL, BOARD_Y + r * CELL, v, pop);
        }
      if (b.piece) for (const [c, r, v] of this.cells(b.piece)) if (r >= 0) this.block(b.x + c * CELL, BOARD_Y + r * CELL, v);
      // Incoming scrap, as pips over the bin.
      for (let i = 0; i < Math.min(b.incoming, 18); i++) g.fillStyle(0x8a8fa8).fillRect(b.x + i * 4 + 1, BOARD_Y - 8, 3, 3);
    }
    // Next pairs.
    this.block(VIEW_W / 2 - 16, 68, this.you.next[1]);
    this.block(VIEW_W / 2 - 16, 68 + CELL, this.you.next[0]);
    this.block(VIEW_W / 2 + 4, 68, this.scrap.next[1]);
    this.block(VIEW_W / 2 + 4, 68 + CELL, this.scrap.next[0]);
    this.scrapImg.setY(150 + Math.sin(this.frame / 20) * 2).setFlipX(true);
  }
}
