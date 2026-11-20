import Phaser from 'phaser';
import { playMusic, playVoice, stopMusic } from '../audio';
import { STEP_MS, VIEW_H, VIEW_W } from '../constants';
import { Controls } from '../input';
import { pixelText } from '../pixelFont';
import { sfx } from '../sfx';
import { pixelateIn } from './cutscene';
import { ModeData, returnToGame } from './encounters';
import { makeBombArt } from './bombArt';
import { makeHopArt } from './hopArt';

/**
 * MAGMA'S BOMB PIT: a maze bomb battle, seen from above. Drop bombs (JUMP or
 * FIRE) to blast the breakable rock and catch Magma in the cross of fire.
 * Rocks hide power-ups: +BOMB, +FIRE (range), +SPEED. Three hearts each.
 */

const T = 16;
const COLS = 15;
const ROWS = 11;
const OX = Math.round((VIEW_W - COLS * T) / 2);
const OY = 38;
const FUSE = 150;
const BLAST = 30;
/** Hearts each: you get more than Magma (this one was the hardest minigame). */
const HEARTS_YOU = 5;
const HEARTS_MAGMA = 3;
/** Magma's limits: he can't power up past these (you can). */
const MAGMA_MAX_BOMBS = 2;
const MAGMA_MAX_RANGE = 3;

type Cell = 0 | 1 | 2; // floor, pillar, rock
type Power = 'bomb' | 'fire' | 'speed';

interface Fighter {
  x: number;
  y: number;
  dir: [number, number];
  speed: number;
  maxBombs: number;
  range: number;
  hearts: number;
  invuln: number;
  sprite: Phaser.GameObjects.Image;
}

interface Bomb {
  c: number;
  r: number;
  t: number;
  range: number;
  owner: Fighter;
  /** The owner may walk off the bomb it just dropped. */
  passable: boolean;
}

export class BombScene extends Phaser.Scene {
  private controls!: Controls;
  private mode!: ModeData;
  private acc = 0;
  private frame = 0;
  private grid: Cell[][] = [];
  private powers = new Map<number, Power>();
  private bombs: Bomb[] = [];
  private flames: { c: number; r: number; t: number }[] = [];
  private you!: Fighter;
  private magma!: Fighter;
  private g!: Phaser.GameObjects.Graphics;
  private fxG!: Phaser.GameObjects.Graphics;
  private pool: Phaser.GameObjects.Image[] = [];
  private poolUsed = 0;
  private banner!: ReturnType<typeof pixelText>;
  private hud!: ReturnType<typeof pixelText>;
  private result: 'win' | 'lose' | null = null;
  private overT = 0;
  private started = 0;
  private aiPath: [number, number][] = [];

  constructor() {
    super('bomb');
  }

  create(data: ModeData): void {
    this.mode = { stage: data?.stage ?? 'caldera', ret: data?.ret ?? { kind: 'vault', step: 0 } };
    this.controls = new Controls(this);
    Object.assign(this, { acc: 0, frame: 0, bombs: [], flames: [], result: null, overT: 0, started: 0, aiPath: [] });
    this.powers = new Map();
    this.buildArena();
    makeBombArt(this);
    makeHopArt(this);
    this.cameras.main.setBackgroundColor('#140606');
    this.pool = [];
    this.poolUsed = 0;
    this.bakeArena();
    this.g = this.add.graphics().setDepth(1);
    this.fxG = this.add.graphics().setDepth(6).setBlendMode(Phaser.BlendModes.ADD);
    const mk = (c: number, r: number, tex: string): Fighter => ({ x: c * T + T / 2, y: r * T + T / 2, dir: [0, 1], speed: 1.0, maxBombs: 1, range: 2, hearts: HEARTS_YOU, invuln: 0, sprite: this.add.image(0, 0, tex).setDepth(5) });
    this.you = mk(1, 1, 'hop_hero0');
    this.magma = mk(COLS - 2, ROWS - 2, 'bm_magma0');
    this.you.maxBombs = 2;
    this.magma.hearts = HEARTS_MAGMA;
    this.magma.speed = 0.78;
    this.banner = pixelText(this, VIEW_W / 2, 20, 'READY...', { fontSize: '16px', color: '#fff1e0', stroke: '#000000' }).setOrigin(0.5).setDepth(20);
    this.hud = pixelText(this, OX, 6, '', { color: '#fff1e0', stroke: '#000000' }).setDepth(20);
    pixelText(this, OX, VIEW_H - 14, 'ARROWS MOVE  JUMP/FIRE BOMB', { color: '#8a8fa8', stroke: '#000000' }).setDepth(20);
    stopMusic();
    pixelateIn(this, 800);
    this.time.delayedCall(400, () => playMusic(this, 'bomb'));
  }

  // --- arena ----------------------------------------------------------------------

  private buildArena(): void {
    const rnd = new Phaser.Math.RandomDataGenerator([`${Date.now()}`]);
    this.grid = [];
    for (let r = 0; r < ROWS; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < COLS; c++) {
        const border = r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1;
        const pillar = r % 2 === 0 && c % 2 === 0;
        const nearSpawn = (r <= 2 && c <= 2) || (r >= ROWS - 3 && c >= COLS - 3);
        row.push(border || pillar ? 1 : !nearSpawn && rnd.frac() < 0.62 ? 2 : 0);
      }
      this.grid.push(row);
    }
    const kinds: Power[] = ['bomb', 'fire', 'speed', 'bomb', 'fire'];
    let i = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (this.grid[r][c] === 2 && rnd.frac() < 0.22) this.powers.set(r * COLS + c, kinds[i++ % kinds.length]);
  }

  private bombAt(c: number, r: number): Bomb | undefined {
    return this.bombs.find((b) => b.c === c && b.r === r);
  }

  private blocked(c: number, r: number, who: Fighter): boolean {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS || this.grid[r][c] !== 0) return true;
    const b = this.bombAt(c, r);
    return !!b && !(b.passable && b.owner === who);
  }

  // --- loop -------------------------------------------------------------------------

  update(_t: number, delta: number): void {
    this.acc += Math.min(delta, 100);
    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS;
      this.step();
    }
    this.draw();
  }

  private step(): void {
    this.frame++;
    this.controls.poll();
    if (this.result) {
      if (++this.overT === 200) returnToGame(this, this.mode, this.result === 'win');
      return;
    }
    if (++this.started < 80) return;
    if (this.started === 80) this.banner.setText('GO!');
    if (this.started === 130) this.banner.setText('');
    // You.
    const c = this.controls;
    const dx = (c.isDown('right') ? 1 : 0) - (c.isDown('left') ? 1 : 0);
    const dy = dx ? 0 : (c.isDown('down') ? 1 : 0) - (c.isDown('up') ? 1 : 0);
    if (dx || dy) this.move(this.you, dx, dy);
    if (c.justPressed('jump') || c.justPressed('fire')) this.dropBomb(this.you);
    this.thinkMagma();
    this.stepBombs();
    for (const f of [this.you, this.magma]) {
      if (f.invuln > 0) f.invuln--;
      this.collectPower(f);
      this.releaseBombs(f);
    }
    this.hud.setText(`ULTRAGUY ${'*'.repeat(this.you.hearts)}${'-'.repeat(HEARTS_YOU - this.you.hearts)}   MAGMA ${'*'.repeat(this.magma.hearts)}${'-'.repeat(HEARTS_MAGMA - this.magma.hearts)}   BOMBS ${this.you.maxBombs} FIRE ${this.you.range}`);
  }

  /** Grid-aligned movement with corner assist: slide toward the lane you're turning into. */
  private move(f: Fighter, dx: number, dy: number): void {
    f.dir = [dx, dy];
    const s = f.speed;
    const cc = Math.floor(f.x / T);
    const cr = Math.floor(f.y / T);
    const centerX = cc * T + T / 2;
    const centerY = cr * T + T / 2;
    if (dx) {
      if (Math.abs(f.y - centerY) > 0.5) {
        f.y += Math.sign(centerY - f.y) * Math.min(s, Math.abs(centerY - f.y));
        return;
      }
      f.y = centerY;
      const ahead = Math.floor((f.x + dx * (T / 2 + 0.01) + dx * s) / T);
      if (ahead !== cc && this.blocked(ahead, cr, f)) f.x = centerX;
      else f.x += dx * s;
    } else if (dy) {
      if (Math.abs(f.x - centerX) > 0.5) {
        f.x += Math.sign(centerX - f.x) * Math.min(s, Math.abs(centerX - f.x));
        return;
      }
      f.x = centerX;
      const ahead = Math.floor((f.y + dy * (T / 2 + 0.01) + dy * s) / T);
      if (ahead !== cr && this.blocked(cc, ahead, f)) f.y = centerY;
      else f.y += dy * s;
    }
  }

  private dropBomb(f: Fighter): void {
    const c = Math.floor(f.x / T);
    const r = Math.floor(f.y / T);
    if (this.bombAt(c, r) || this.bombs.filter((b) => b.owner === f).length >= f.maxBombs) return;
    this.bombs.push({ c, r, t: FUSE, range: f.range, owner: f, passable: true });
    sfx.fuse();
  }

  /** Once you've stepped off your own bomb, it's solid to you too. */
  private releaseBombs(f: Fighter): void {
    for (const b of this.bombs) {
      if (b.owner !== f || !b.passable) continue;
      if (Math.abs(f.x - (b.c * T + T / 2)) >= T - 1 || Math.abs(f.y - (b.r * T + T / 2)) >= T - 1) b.passable = false;
    }
  }

  private blastCells(b: { c: number; r: number; range: number }): [number, number][] {
    const cells: [number, number][] = [[b.c, b.r]];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let i = 1; i <= b.range; i++) {
        const c = b.c + dx * i;
        const r = b.r + dy * i;
        const cell = this.grid[r]?.[c];
        if (cell === undefined || cell === 1) break;
        cells.push([c, r]);
        if (cell === 2) break;
      }
    }
    return cells;
  }

  private stepBombs(): void {
    for (const b of this.bombs) b.t--;
    let exploded = true;
    while (exploded) {
      exploded = false;
      for (const b of [...this.bombs]) {
        if (b.t > 0) continue;
        exploded = true;
        this.bombs.splice(this.bombs.indexOf(b), 1);
        sfx.explode();
        this.cameras.main.shake(90, 0.006);
        for (const [c, r] of this.blastCells(b)) {
          this.flames.push({ c, r, t: BLAST });
          if (this.grid[r][c] === 2) this.grid[r][c] = 0;
          else this.powers.delete(r * COLS + c);
          const other = this.bombAt(c, r);
          if (other) other.t = 0; // chain reaction
        }
      }
    }
    for (const f of this.flames) f.t--;
    this.flames = this.flames.filter((f) => f.t > 0);
    for (const who of [this.you, this.magma]) {
      const c = Math.floor(who.x / T);
      const r = Math.floor(who.y / T);
      if (who.invuln === 0 && this.flames.some((f) => f.c === c && f.r === r)) {
        who.hearts--;
        who.invuln = who === this.you ? 150 : 100;
        sfx.hurt();
        if (who.hearts <= 0) this.finish(who === this.magma);
      }
    }
  }

  private collectPower(f: Fighter): void {
    const c = Math.floor(f.x / T);
    const r = Math.floor(f.y / T);
    const key = r * COLS + c;
    const p = this.powers.get(key);
    if (!p || this.grid[r][c] !== 0) return;
    this.powers.delete(key);
    const magma = f === this.magma;
    if (p === 'bomb') f.maxBombs = Math.min(magma ? MAGMA_MAX_BOMBS : 5, f.maxBombs + 1);
    if (p === 'fire') f.range = Math.min(magma ? MAGMA_MAX_RANGE : 6, f.range + 1);
    if (p === 'speed' && !magma) f.speed = Math.min(1.8, f.speed + 0.25);
    if (f === this.you) sfx.pickup();
  }

  // --- Magma's head -------------------------------------------------------------------

  /** Cells that bombs on the field (plus an extra one) will burn. */
  private dangerSet(extra?: { c: number; r: number; range: number }): Set<number> {
    const set = new Set<number>();
    for (const f of this.flames) set.add(f.r * COLS + f.c);
    for (const b of [...this.bombs, ...(extra ? [extra] : [])]) for (const [c, r] of this.blastCells(b)) set.add(r * COLS + c);
    return set;
  }

  /** Shortest path (cells) from a cell to the first cell that passes `goal`. */
  private bfs(from: [number, number], goal: (c: number, r: number) => boolean, avoid?: Set<number>): [number, number][] | null {
    const prev = new Map<number, number>();
    const start = from[1] * COLS + from[0];
    const q = [start];
    prev.set(start, -1);
    while (q.length) {
      const k = q.shift()!;
      const c = k % COLS;
      const r = Math.floor(k / COLS);
      if (goal(c, r)) {
        const path: [number, number][] = [];
        for (let p = k; p !== start; p = prev.get(p)!) path.unshift([p % COLS, Math.floor(p / COLS)]);
        return path;
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dx;
        const nr = r + dy;
        const nk = nr * COLS + nc;
        if (prev.has(nk) || this.blocked(nc, nr, this.magma) || avoid?.has(nk)) continue;
        prev.set(nk, k);
        q.push(nk);
      }
    }
    return null;
  }

  /**
   * Cheapest route to you if rock could be blasted (rock costs extra). Returns the open
   * cells to walk to reach the first rock on it (empty = you're standing at it), or null
   * if the route has no rock in the way.
   */
  private digRoute(from: [number, number], to: [number, number], avoid: Set<number>): { stand: [number, number][] } | null {
    const start = from[1] * COLS + from[0];
    const goal = to[1] * COLS + to[0];
    const dist = new Map<number, number>([[start, 0]]);
    const prev = new Map<number, number>();
    const open: number[] = [start];
    while (open.length) {
      open.sort((a, b) => dist.get(a)! - dist.get(b)!);
      const k = open.shift()!;
      if (k === goal) break;
      const c = k % COLS;
      const r = Math.floor(k / COLS);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dx;
        const nr = r + dy;
        const cell = this.grid[nr]?.[nc];
        if (cell === undefined || cell === 1) continue;
        const nk = nr * COLS + nc;
        const rock = cell === 2;
        if (!rock && nk !== goal && (this.blocked(nc, nr, this.magma) || avoid.has(nk))) continue;
        const d = dist.get(k)! + (rock ? 4 : 1);
        if (d >= (dist.get(nk) ?? Infinity)) continue;
        dist.set(nk, d);
        prev.set(nk, k);
        if (!open.includes(nk)) open.push(nk);
      }
    }
    if (!prev.has(goal)) return null;
    const path: number[] = [];
    for (let p = goal; p !== start; p = prev.get(p)!) path.unshift(p);
    const firstRock = path.findIndex((k) => this.grid[Math.floor(k / COLS)][k % COLS] === 2);
    if (firstRock < 0) return null;
    return { stand: path.slice(0, firstRock).map((k) => [k % COLS, Math.floor(k / COLS)] as [number, number]) };
  }

  private thinkMagma(): void {
    const m = this.magma;
    const mc = Math.floor(m.x / T);
    const mr = Math.floor(m.y / T);
    const centered = Math.abs(m.x - (mc * T + T / 2)) < 0.6 && Math.abs(m.y - (mr * T + T / 2)) < 0.6;
    // He thinks a little slower than he used to (every 10 steps), so you can outmaneuver him.
    if (centered && (this.frame % 10 === 0 || this.aiPath.length === 0)) {
      const danger = this.dangerSet();
      const pc = Math.floor(this.you.x / T);
      const pr = Math.floor(this.you.y / T);
      const hereKey = mr * COLS + mc;
      if (danger.has(hereKey)) {
        this.aiPath = this.bfs([mc, mr], (c, r) => !danger.has(r * COLS + c)) ?? [];
      } else {
        // Bomb if it would catch you or open rock, and there's a way out.
        const lineUp = (mc === pc || mr === pr) && Math.abs(mc - pc) + Math.abs(mr - pr) <= m.range && this.blastCells({ c: mc, r: mr, range: m.range }).some(([c, r]) => c === pc && r === pr);
        const dig = this.digRoute([mc, mr], [pc, pr], danger);
        const atDig = dig !== null && dig.stand.length === 0;
        const nextToRock = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.grid[mr + dy]?.[mc + dx] === 2);
        const canBomb = this.bombs.filter((b) => b.owner === m).length < m.maxBombs;
        // Lined up with you, he doesn't always take the shot.
        if (canBomb && ((lineUp && Math.random() < 0.55) || atDig || (nextToRock && Math.random() < 0.15))) {
          const withBomb = this.dangerSet({ c: mc, r: mr, range: m.range });
          const escape = this.bfs([mc, mr], (c, r) => !withBomb.has(r * COLS + c));
          if (escape && escape.length <= 6) {
            this.dropBomb(m);
            this.aiPath = escape;
          }
        }
        if (!this.aiPath.length) {
          // Head for you (avoiding fire), or for rock to dig through.
          this.aiPath =
            this.bfs([mc, mr], (c, r) => Math.abs(c - pc) + Math.abs(r - pr) <= 1, danger)?.slice(0, 3) ??
            // Dig toward you: walk up to the first rock on the cheapest route.
            (dig && dig.stand.length ? dig.stand.slice(0, 3) : null) ??
            this.bfs([mc, mr], (c, r) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.grid[r + dy]?.[c + dx] === 2), danger)?.slice(0, 3) ??
            [];
        }
      }
    }
    const next = this.aiPath[0];
    if (!next) return;
    const tx = next[0] * T + T / 2;
    const ty = next[1] * T + T / 2;
    if (Math.abs(m.x - tx) < 0.6 && Math.abs(m.y - ty) < 0.6) {
      m.x = tx;
      m.y = ty;
      this.aiPath.shift();
      return;
    }
    // Never walk into fire, or into a blast that's about to go off.
    const nextKey = next[1] * COLS + next[0];
    const hereKey = mr * COLS + mc;
    const soon = new Set<number>();
    for (const f of this.flames) soon.add(f.r * COLS + f.c);
    for (const b of this.bombs) if (b.t < 30) for (const [c, r] of this.blastCells(b)) soon.add(r * COLS + c);
    if (soon.has(nextKey) && !soon.has(hereKey) && nextKey !== hereKey) {
      this.aiPath = [];
      return;
    }
    const dx = Math.sign(tx - m.x);
    const dy = dx ? 0 : Math.sign(ty - m.y);
    const before = [m.x, m.y];
    this.move(m, dx, dy);
    if (m.x === before[0] && m.y === before[1]) this.aiPath = [];
  }

  private finish(won: boolean): void {
    if (this.result) return;
    this.result = won ? 'win' : 'lose';
    this.banner.setText(won ? 'MAGMA IS DOWN!' : 'YOU GOT TOASTED');
    stopMusic();
    if (won) {
      sfx.victory();
      playVoice(this, 'magma_loses');
    } else playVoice(this, 'magma_wins');
  }

  // --- drawing ---------------------------------------------------------------------------

  /** The floor and the pillars never change: paint them once (a frame of lava-lit rock around them). */
  private bakeArena(): void {
    const rt = this.add.renderTexture(OX, OY, COLS * T, ROWS * T).setOrigin(0).setDepth(0);
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        if (this.grid[r][c] === 1) rt.draw(r < ROWS - 1 && this.grid[r + 1][c] !== 1 ? 'bm_pillar_face' : 'bm_pillar_top', c * T, r * T);
        else rt.draw(`bm_floor${(c * 7 + r * 13 + c * r) % 11 === 0 ? 1 : 0}`, c * T, r * T);
      }
    const rim = this.add.graphics().setDepth(0.5);
    rim.fillStyle(0x0a0404).fillRect(OX - 3, OY - 3, COLS * T + 6, 3).fillRect(OX - 3, OY + ROWS * T, COLS * T + 6, 3).fillRect(OX - 3, OY, 3, ROWS * T).fillRect(OX + COLS * T, OY, 3, ROWS * T);
    rim.fillStyle(0xd84a1a).fillRect(OX - 1, OY - 1, COLS * T + 2, 1).fillRect(OX - 1, OY + ROWS * T, COLS * T + 2, 1).fillRect(OX - 1, OY, 1, ROWS * T).fillRect(OX + COLS * T, OY, 1, ROWS * T);
  }

  /** Show a pooled image this frame. */
  private put(key: string, x: number, y: number, depth = 2, origin0 = true, alpha = 1): void {
    let img = this.pool[this.poolUsed];
    if (!img) {
      img = this.add.image(0, 0, key);
      this.pool.push(img);
    }
    this.poolUsed++;
    img.setTexture(key).setOrigin(origin0 ? 0 : 0.5).setPosition(Math.round(x), Math.round(y)).setDepth(depth).setAlpha(alpha).setVisible(true);
  }

  private draw(): void {
    const g = this.g;
    const fx = this.fxG;
    g.clear();
    fx.clear();
    this.poolUsed = 0;
    const f0 = this.frame;
    // Crates and the power-ups waiting under blown ones.
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const x = OX + c * T;
        const y = OY + r * T;
        const cell = this.grid[r][c];
        if (cell === 2) this.put('bm_crate', x, y);
        else if (cell === 0) {
          const p = this.powers.get(r * COLS + c);
          if (p) {
            this.put(`bm_pw_${p}`, x + 1, y + 1 + Math.round(Math.sin(f0 / 10 + c) * 1), 2);
            fx.fillStyle(p === 'bomb' ? 0x3a78d8 : p === 'fire' ? 0xff7a2a : 0x2aa088, 0.25).fillCircle(x + 8, y + 8, 9);
          }
        }
      }
    // Lava glow breathing up through the floor cracks.
    fx.fillStyle(0xff5a1a, 0.04 + Math.sin(f0 / 40) * 0.02).fillRect(OX, OY, COLS * T, ROWS * T);
    // Bombs: they swell faster as the fuse burns down; a spark on the fuse.
    for (const b of this.bombs) {
      const x = OX + b.c * T;
      const y = OY + b.r * T;
      const fast = b.t < 50;
      const swell = fast ? f0 % 8 < 4 : f0 % 30 < 15;
      this.put(`bm_bomb${swell ? 1 : 0}`, x, y, 3);
      fx.fillStyle(f0 % 4 < 2 ? 0xffe14a : 0xff7a2a, 0.9).fillRect(x + 9, y - 1, 2, 2);
      fx.fillStyle(0xffe14a, 0.25).fillCircle(x + 10, y, 4);
      if (fast) fx.fillStyle(0xff3a1a, 0.15).fillCircle(x + 8, y + 9, 10);
    }
    // Blasts: flickering fire tiles with heat around them.
    for (const f of this.flames) {
      const x = OX + f.c * T;
      const y = OY + f.r * T;
      this.put(`bm_fire${(f0 + f.c + f.r) % 3}`, x, y, 4, true, Math.min(1, f.t / 8));
      fx.fillStyle(0xff7a2a, 0.3 * (f.t / BLAST)).fillCircle(x + 8, y + 8, 12);
    }
    for (let i = this.poolUsed; i < this.pool.length; i++) this.pool[i].setVisible(false);
    // The fighters: UltraGuy turns the way he's walking; Magma's plates part and close.
    for (const f of [this.you, this.magma]) {
      g.fillStyle(0x000000, 0.35).fillEllipse(OX + f.x, OY + f.y + 6, 12, 4);
      f.sprite.setPosition(OX + f.x, OY + f.y - 1).setVisible(f.invuln === 0 || f0 % 6 < 3);
    }
    this.you.sprite.setTexture(f0 % 16 < 8 ? 'hop_hero0' : 'hop_hero1').setRotation(Math.atan2(this.you.dir[0], -this.you.dir[1]));
    this.magma.sprite.setTexture(f0 % 40 < 20 ? 'bm_magma0' : 'bm_magma1');
    fx.fillStyle(0xff8a2a, 0.2).fillCircle(OX + this.magma.x, OY + this.magma.y - 1, 11);
  }
}
