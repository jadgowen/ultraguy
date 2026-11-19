import Phaser from 'phaser';
import { playMusic, playVoice, stopMusic } from '../audio';
import { STEP_MS, VIEW_H, VIEW_W } from '../constants';
import { Controls } from '../input';
import { pixelText } from '../pixelFont';
import { sfx } from '../sfx';
import { pixelateIn } from './cutscene';
import { ModeData, returnToGame } from './encounters';
import { makeHopTextures } from './HopScene';

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
    makeBombTextures(this);
    makeHopTextures(this);
    this.cameras.main.setBackgroundColor('#1a0806');
    this.g = this.add.graphics();
    const mk = (c: number, r: number, tex: string): Fighter => ({ x: c * T + T / 2, y: r * T + T / 2, dir: [0, 1], speed: 1.0, maxBombs: 1, range: 2, hearts: HEARTS_YOU, invuln: 0, sprite: this.add.image(0, 0, tex).setDepth(5) });
    this.you = mk(1, 1, 'hop_hero');
    this.magma = mk(COLS - 2, ROWS - 2, 'bomb_magma');
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

  private draw(): void {
    const g = this.g;
    g.clear();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = OX + c * T;
        const y = OY + r * T;
        const cell = this.grid[r][c];
        if (cell === 1) {
          g.fillStyle(0x1a0c0a).fillRect(x, y, T, T);
          g.fillStyle(0x3a1c16).fillRect(x + 1, y + 1, T - 2, T - 2);
          g.fillStyle(0x5a2e22).fillRect(x + 1, y + 1, T - 2, 2);
          g.fillStyle(0x24100c).fillRect(x + 1, y + T - 3, T - 2, 2);
        } else {
          g.fillStyle((r + c) % 2 ? 0x2a120e : 0x30160f).fillRect(x, y, T, T);
          const p = this.powers.get(r * COLS + c);
          if (p && cell === 0) {
            g.fillStyle(0x1a1428).fillRect(x + 2, y + 2, 12, 12);
            g.fillStyle(p === 'bomb' ? 0x3a78d8 : p === 'fire' ? 0xff7a2a : 0x5ef0c8).fillRect(x + 3, y + 3, 10, 10);
            g.fillStyle(0xfff1e0);
            if (p === 'bomb') g.fillCircle(x + 8, y + 9, 3);
            else if (p === 'fire') g.fillTriangle(x + 8, y + 4, x + 5, y + 11, x + 11, y + 11);
            else g.fillRect(x + 5, y + 7, 6, 2).fillTriangle(x + 11, y + 5, x + 11, y + 11, x + 13, y + 8);
          }
          if (cell === 2) {
            g.fillStyle(0x1a0c0a).fillRect(x, y, T, T);
            g.fillStyle(0x6a3a2a).fillRect(x + 1, y + 1, T - 2, T - 2);
            g.fillStyle(0x8a5a3a).fillRect(x + 1, y + 1, T - 2, 2);
            g.fillStyle(0x4a2418).fillRect(x + 3, y + 7, 10, 1).fillRect(x + 8, y + 2, 1, 5);
            g.fillStyle(0xff7a2a).fillRect(x + 11, y + 10, 2, 1);
          }
        }
      }
    }
    for (const b of this.bombs) {
      const x = OX + b.c * T + 8;
      const y = OY + b.r * T + 9;
      const pulse = b.t < 50 ? (this.frame % 8 < 4 ? 1 : 0) : this.frame % 30 < 15 ? 1 : 0;
      g.fillStyle(0x0a0608).fillCircle(x, y, 6 + pulse);
      g.fillStyle(0x3a3a50).fillCircle(x - 2, y - 2, 2);
      g.fillStyle(0x8a8fa8).fillRect(x + 2, y - 8, 2, 3);
      g.fillStyle(this.frame % 4 < 2 ? 0xffe14a : 0xff7a2a).fillRect(x + 3, y - 10, 2, 2);
    }
    for (const f of this.flames) {
      const x = OX + f.c * T;
      const y = OY + f.r * T;
      const k = f.t / BLAST;
      g.fillStyle(0xff3a1a, 0.9).fillRect(x + 1, y + 1, T - 2, T - 2);
      g.fillStyle(0xffa83a).fillRect(x + 3, y + 3, T - 6, T - 6);
      g.fillStyle(0xfff0a0).fillRect(x + 5 + (1 - k) * 2, y + 5 + (1 - k) * 2, T - 10 - (1 - k) * 4, T - 10 - (1 - k) * 4);
    }
    for (const f of [this.you, this.magma]) {
      f.sprite.setPosition(OX + f.x, OY + f.y - 1).setVisible(f.invuln === 0 || this.frame % 6 < 3);
    }
  }
}

function makeBombTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('bomb_magma')) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // Magma from above: a basalt boulder with lava seams and ember eyes.
  g.fillStyle(0x1a1428).fillCircle(8, 8, 8);
  g.fillStyle(0x4a4650).fillCircle(8, 8, 7);
  g.fillStyle(0x6a6670).fillCircle(6, 6, 3);
  g.fillStyle(0xff7a2a).fillRect(3, 9, 4, 1).fillRect(6, 10, 1, 2).fillRect(10, 4, 1, 3).fillRect(11, 10, 3, 1);
  g.fillStyle(0xffe14a).fillRect(5, 4, 2, 2).fillRect(9, 4, 2, 2);
  g.generateTexture('bomb_magma', 16, 16);
  g.destroy();
}
