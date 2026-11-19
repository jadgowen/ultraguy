import Phaser from 'phaser';
import { VIEW_W } from '../constants';
import { sfx } from '../sfx';
import { makeHopTextures } from './HopScene';
import { ModeScene } from './ModeScene';

/**
 * SCRAP'S JUNK MAZE: a small top-down action dungeon in the scrapyard. Four
 * rooms: hook the key off its island, swing across the shaft on posts, clear
 * the sorting floor to find the big key, then face Scrap in the compactor.
 * FIRE shoots, JUMP fires the hookshot: it pulls you to posts, pulls items to
 * you, and stuns what it hits. Scrap's magnet field turns your shots while he
 * stalks you: hook him (or let his charge slam him into a wall) to make him
 * dizzy, then let him have it. He throws spinning saw blades that come back.
 *
 * (Internally the boss is still "mantis": this dungeon was his before.)
 */

const T = 16;
const RW = 16;
const RH = 11;
const OX = Math.round((VIEW_W - RW * T) / 2);
const OY = 40;
const MAX_HP = 8;
const MANTIS_HP = 36;
const HOOK_LEN = 92;

// Tiles: # wall, . floor, ~ pit, o post, k key, h heart, L locked door, B boss door,
// e beetle, s sprout, P start, M Mantis.
const ROOMS: Record<string, string[]> = {
  A: [
    '#######LL#######',
    '#..............#',
    '#..............#',
    '#.......~~~~~..#',
    '#..P....~~k~~..#',
    '#.......~~~~~..#',
    '#..............#',
    '#..h...........#',
    '#..............#',
    '#..............#',
    '################',
  ],
  B: [
    '################',
    '#........~~....#',
    '#..e.....~~....#',
    '#........~~.e..#',
    '#........~~..o..',
    '#..e...o.~~.....',
    '#........~~....#',
    '#........~~.e..#',
    '#........~~....#',
    '#........~~....#',
    '#######..#######',
  ],
  C: [
    '################',
    '#..............#',
    '#..s........s..#',
    '#.....####.....#',
    '...............#',
    '...............#',
    '#.....####.....#',
    '#..s........s..#',
    '#.......e...h..#',
    '#..............#',
    '#######BB#######',
  ],
  D: [
    '#######..#######',
    '#..............#',
    '#..o........o..#',
    '#..............#',
    '#..............#',
    '#.......M......#',
    '#..............#',
    '#..............#',
    '#..o........o..#',
    '#..............#',
    '################',
  ],
};

/** Room grid: which room is next to which. */
const LINKS: Record<string, { n?: string; s?: string; e?: string; w?: string }> = {
  A: { n: 'B' },
  B: { s: 'A', e: 'C' },
  C: { w: 'B', s: 'D' },
  D: { n: 'C' },
};

interface Enemy {
  kind: 'beetle' | 'sprout';
  x: number;
  y: number;
  hp: number;
  dir: [number, number];
  t: number;
  stun: number;
  hurt: number;
}

interface Hook {
  x: number;
  y: number;
  dx: number;
  dy: number;
  len: number;
  back: boolean;
  carry: string | null;
  pull: { x: number; y: number } | null;
}

type MantisState = 'walk' | 'windup' | 'dash' | 'dizzy' | 'throw' | 'leap' | 'land';

export class DungeonScene extends ModeScene {
  protected readonly voice = 'scrap';
  protected readonly music = 'dungeon';
  protected readonly homeStage = 'scrapyard' as const;

  private rooms: Record<string, string[][]> = {};
  private room = 'A';
  private cleared = new Set<string>();
  private p = { x: 0, y: 0, fx: 0, fy: 1, hp: MAX_HP, invuln: 0, entry: { x: 0, y: 0 } };
  private keys = 0;
  private bigKey = false;
  private hook: Hook | null = null;
  private shots: { x: number; y: number; dx: number; dy: number; foe: boolean; t: number }[] = [];
  private enemies: Enemy[] = [];
  private mantis: { x: number; y: number; hp: number; state: MantisState; t: number; dx: number; dy: number; stun: number; hurt: number; guardT: number; hookImmune: number; tx: number; ty: number } | null = null;
  private thorns: { x: number; y: number; vx: number; vy: number; t: number }[] = [];
  private g!: Phaser.GameObjects.Graphics;
  private heroImg!: Phaser.GameObjects.Image;
  private mantisImg!: Phaser.GameObjects.Image;

  constructor() {
    super('dungeon');
  }

  protected setup(): void {
    makeHopTextures(this);
    this.cameras.main.setBackgroundColor('#14121a');
    this.rooms = Object.fromEntries(Object.entries(ROOMS).map(([k, rows]) => [k, rows.map((r) => r.split(''))]));
    this.cleared = new Set();
    this.keys = 0;
    this.bigKey = false;
    this.hook = null;
    this.shots = [];
    this.thorns = [];
    this.mantis = null;
    this.g = this.add.graphics();
    this.heroImg = this.add.image(0, 0, 'hop_hero').setDepth(6);
    this.mantisImg = this.add.image(0, 0, 'scrap_idle').setDepth(5).setScale(0.7).setVisible(false); // the Junk Golem art is 48x44; keep him maze-sized
    this.p = { x: 0, y: 0, fx: 0, fy: 1, hp: MAX_HP, invuln: 0, entry: { x: 0, y: 0 } };
    this.enter('A', null);
    this.help('ARROWS MOVE   FIRE SHOOT   JUMP HOOKSHOT');
  }

  // --- map --------------------------------------------------------------------------

  private tile(c: number, r: number): string {
    return this.rooms[this.room][r]?.[c] ?? '#';
  }

  private setTile(c: number, r: number, ch: string): void {
    this.rooms[this.room][r][c] = ch;
  }

  private solidAt(x: number, y: number): boolean {
    const ch = this.tile(Math.floor(x / T), Math.floor(y / T));
    return ch === '#' || ch === 'o' || ch === 'L' || ch === 'B';
  }

  /** Can a 10x10 body stand centered here? */
  private free(x: number, y: number): boolean {
    for (const [ox, oy] of [[-5, -5], [4, -5], [-5, 4], [4, 4]]) if (this.solidAt(x + ox, y + oy)) return false;
    return true;
  }

  private enter(room: string, from: 'n' | 's' | 'e' | 'w' | null): void {
    this.room = room;
    this.hook = null;
    this.shots = [];
    this.thorns = [];
    this.enemies = [];
    const grid = this.rooms[room];
    for (let r = 0; r < RH; r++)
      for (let c = 0; c < RW; c++) {
        const ch = grid[r][c];
        const x = c * T + T / 2;
        const y = r * T + T / 2;
        if (ch === 'P') {
          this.p.x = x;
          this.p.y = y;
          grid[r][c] = '.';
        } else if ((ch === 'e' || ch === 's') && !this.cleared.has(room)) {
          this.enemies.push({ kind: ch === 'e' ? 'beetle' : 'sprout', x, y, hp: 2, dir: [1, 0], t: Math.floor(Math.random() * 60), stun: 0, hurt: 0 });
        } else if (ch === 'M') {
          this.mantis = { x, y, hp: MANTIS_HP, state: 'walk', t: 0, dx: 0, dy: 0, stun: 0, hurt: 0, guardT: 0, hookImmune: 0, tx: 0, ty: 0 };
        }
      }
    // Come in through the doorway on the side you came from.
    if (from === 'n') this.p.y = T / 2 + 2;
    if (from === 's') this.p.y = RH * T - T / 2 - 2;
    if (from === 'w') this.p.x = T / 2 + 2;
    if (from === 'e') this.p.x = RW * T - T / 2 - 2;
    this.p.entry = { x: this.p.x, y: this.p.y };
    if (room === 'D') {
      // The door shuts behind you (step clear of it first).
      grid[0][7] = grid[0][8] = '#';
      this.p.y = Math.max(this.p.y, T + T / 2);
      this.p.entry = { x: this.p.x, y: this.p.y };
      this.mantisImg.setVisible(true);
      this.banner.setText('SCRAP!');
      this.time.delayedCall(1100, () => !this.result && this.banner.setText(''));
    }
  }

  // --- the loop ------------------------------------------------------------------------

  protected tick(): void {
    const c = this.controls;
    const p = this.p;
    if (p.invuln > 0) p.invuln--;
    const pulling = this.hook?.pull;
    if (!this.hook) {
      const ix = (c.isDown('right') ? 1 : 0) - (c.isDown('left') ? 1 : 0);
      const iy = (c.isDown('down') ? 1 : 0) - (c.isDown('up') ? 1 : 0);
      if (ix || iy) {
        if (ix && iy) {
          // Keep facing the way you were going.
          if (p.fx === 0) [p.fx, p.fy] = [0, iy];
          else [p.fx, p.fy] = [ix, 0];
        } else [p.fx, p.fy] = [ix, iy];
        const sp = ix && iy ? 1.05 : 1.45;
        if (this.free(p.x + ix * sp, p.y)) p.x += ix * sp;
        if (this.free(p.x, p.y + iy * sp)) p.y += iy * sp;
      }
      if (c.justPressed('fire') && this.shots.filter((s) => !s.foe).length < 2) {
        this.shots.push({ x: p.x + p.fx * 6, y: p.y + p.fy * 6, dx: p.fx * 3.6, dy: p.fy * 3.6, foe: false, t: 0 });
        sfx.shoot();
      }
      if (c.justPressed('jump')) {
        this.hook = { x: p.x, y: p.y, dx: p.fx, dy: p.fy, len: 0, back: false, carry: null, pull: null };
        sfx.thorn();
      }
    }
    this.stepHook();
    // Pits (unless you're flying across on the hookshot).
    if (!pulling && this.tile(Math.floor(p.x / T), Math.floor(p.y / T)) === '~') {
      sfx.splash();
      this.hurt(1, true);
      p.x = p.entry.x;
      p.y = p.entry.y;
      this.hook = null;
    }
    this.pickups();
    this.doors();
    this.stepShots();
    this.stepEnemies();
    if (this.mantis) this.stepMantis();
    this.exits();
    const hearts = Array.from({ length: MAX_HP / 2 }, (_, i) => (p.hp >= (i + 1) * 2 ? '@' : p.hp === i * 2 + 1 ? 'o' : '-')).join('');
    const boss = this.mantis && this.room === 'D' ? `   SCRAP ${'#'.repeat(Math.ceil(this.mantis.hp / 4))}` : '';
    this.hud.setText(`LIFE ${hearts}   KEYS ${this.keys}${this.bigKey ? ' +BIG' : ''}${boss}`).setX(OX);
  }

  private hurt(n: number, force = false, from?: { x: number; y: number }): void {
    const p = this.p;
    if (p.invuln > 0 && !force) return;
    p.hp -= n;
    p.invuln = 80;
    // Knocked back, away from whatever hit you (never into a wall or a pit).
    if (from) {
      const dx = p.x - from.x;
      const dy = p.y - from.y;
      const d = Math.hypot(dx, dy) || 1;
      for (let i = 0; i < 10; i++) {
        const nx = p.x + (dx / d) * 3;
        const ny = p.y + (dy / d) * 3;
        if (!this.free(nx, ny) || this.tile(Math.floor(nx / T), Math.floor(ny / T)) === '~') break;
        p.x = nx;
        p.y = ny;
      }
    }
    sfx.hurt();
    this.cameras.main.shake(120, 0.008);
    if (p.hp <= 0) this.finish(false, 'LOST IN THE JUNK...');
  }

  private stepHook(): void {
    const h = this.hook;
    if (!h) return;
    const p = this.p;
    if (h.pull) {
      // Reel yourself in toward the post.
      const dx = h.pull.x - p.x;
      const dy = h.pull.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 15) {
        this.hook = null;
        // Don't end up standing over a pit.
        if (this.tile(Math.floor(p.x / T), Math.floor(p.y / T)) === '~') {
          p.x = h.pull.x - h.dx * 16;
          p.y = h.pull.y - h.dy * 16;
        }
        return;
      }
      p.x += (dx / d) * 4;
      p.y += (dy / d) * 4;
      h.x = h.pull.x;
      h.y = h.pull.y;
      return;
    }
    if (!h.back) {
      h.len += 4.5;
      h.x = p.x + h.dx * h.len;
      h.y = p.y + h.dy * h.len;
      const c = Math.floor(h.x / T);
      const r = Math.floor(h.y / T);
      const ch = this.tile(c, r);
      if (ch === 'o') {
        h.pull = { x: c * T + T / 2, y: r * T + T / 2 };
        sfx.deflect();
        return;
      }
      if (ch === 'k' || ch === 'h' || ch === 'K') {
        h.carry = ch;
        this.setTile(c, r, '.');
        h.back = true;
        sfx.pickup();
      } else if (this.solidAt(h.x, h.y) || h.len >= HOOK_LEN) {
        h.back = true;
        if (this.solidAt(h.x, h.y)) sfx.tick();
      }
      for (const e of this.enemies) {
        if (e.hp > 0 && Math.abs(e.x - h.x) < 9 && Math.abs(e.y - h.y) < 9) {
          e.stun = 120;
          h.back = true;
          sfx.freeze();
        }
      }
      const m = this.mantis;
      if (m && this.room === 'D' && Math.abs(m.x - h.x) < 13 && Math.abs(m.y - h.y) < 13 && m.state !== 'leap') {
        h.back = true;
        // He shakes it off if you just stunned him.
        if (m.state === 'walk' || m.state === 'windup' || m.state === 'dash') {
          if (m.hookImmune > 0) {
            sfx.deflect();
            m.guardT = 8;
          } else {
            m.stun = 80;
            m.state = 'dizzy';
            m.t = 0;
            sfx.freeze();
          }
        }
      }
    } else {
      h.len -= 6;
      h.x = p.x + h.dx * h.len;
      h.y = p.y + h.dy * h.len;
      if (h.len <= 0) {
        if (h.carry) this.grant(h.carry);
        this.hook = null;
      }
    }
  }

  private grant(item: string): void {
    if (item === 'k') {
      this.keys++;
      this.banner.setText('YOU GOT A KEY!');
    } else if (item === 'K') {
      this.bigKey = true;
      this.banner.setText('YOU GOT THE BIG KEY!');
    } else this.p.hp = Math.min(MAX_HP, this.p.hp + 2);
    if (item !== 'h') this.time.delayedCall(1000, () => !this.result && this.banner.setText(''));
    sfx.pickup();
  }

  private pickups(): void {
    const c = Math.floor(this.p.x / T);
    const r = Math.floor(this.p.y / T);
    const ch = this.tile(c, r);
    if (ch === 'k' || ch === 'h' || ch === 'K') {
      this.setTile(c, r, '.');
      this.grant(ch);
    }
  }

  /** Walk into a locked door with a key (or the boss door with the big key) to open it. */
  private doors(): void {
    const p = this.p;
    const c = Math.floor((p.x + p.fx * 9) / T);
    const r = Math.floor((p.y + p.fy * 9) / T);
    const ch = this.tile(c, r);
    if (ch === 'L' && this.keys > 0) {
      this.keys--;
      this.openDoor('L');
    } else if (ch === 'B' && this.bigKey) this.openDoor('B');
  }

  private openDoor(ch: string): void {
    const grid = this.rooms[this.room];
    for (const row of grid) for (let i = 0; i < row.length; i++) if (row[i] === ch) row[i] = '.';
    sfx.door();
  }

  private exits(): void {
    const p = this.p;
    const link = LINKS[this.room];
    if (p.y < 6 && link.n) this.enter(link.n, 's');
    else if (p.y > RH * T - 6 && link.s) this.enter(link.s, 'n');
    else if (p.x > RW * T - 6 && link.e) this.enter(link.e, 'w');
    else if (p.x < 6 && link.w) this.enter(link.w, 'e');
  }

  // --- enemies -------------------------------------------------------------------------

  private stepShots(): void {
    const p = this.p;
    for (const s of this.shots) {
      s.x += s.dx;
      s.y += s.dy;
      s.t++;
      if (this.solidAt(s.x, s.y) || s.t > 120) {
        s.t = 999;
        continue;
      }
      if (s.foe) {
        if (Math.abs(s.x - p.x) < 6 && Math.abs(s.y - p.y) < 6 && !this.hook?.pull) {
          s.t = 999;
          this.hurt(1);
        }
        continue;
      }
      for (const e of this.enemies) {
        if (e.hp <= 0 || Math.abs(e.x - s.x) > 8 || Math.abs(e.y - s.y) > 8) continue;
        s.t = 999;
        e.hp--;
        e.hurt = 10;
        sfx.hit();
        if (e.hp <= 0) {
          sfx.enemyDie();
          if (Math.random() < 0.25) {
            const c = Math.floor(e.x / T);
            const r = Math.floor(e.y / T);
            if (this.tile(c, r) === '.') this.setTile(c, r, 'h');
          }
        }
      }
      const m = this.mantis;
      if (m && this.room === 'D' && m.state !== 'leap' && m.hurt === 0 && Math.abs(m.x - s.x) < 12 && Math.abs(m.y - s.y) < 13) {
        s.t = 999;
        // His scythes guard him while he stalks you: stun him (hookshot, or a dash into
        // the wall), or catch him mid-throw or landing.
        if (m.state === 'walk' || m.state === 'windup' || m.state === 'dash') {
          sfx.deflect();
          m.guardT = 8;
          continue;
        }
        m.hp -= 1;
        m.hurt = 12;
        sfx.hit();
        if (m.hp <= 0) {
          sfx.explode();
          this.cameras.main.shake(400, 0.02);
          this.finish(true, 'SCRAP IS SCRAPPED!');
        }
      }
    }
    this.shots = this.shots.filter((s) => s.t < 999);
  }

  private stepEnemies(): void {
    const p = this.p;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      if (e.hurt > 0) e.hurt--;
      if (e.stun > 0) {
        e.stun--;
        continue;
      }
      e.t++;
      if (e.kind === 'beetle') {
        if (e.t % 90 === 0 || !this.free(e.x + e.dir[0] * 6, e.y + e.dir[1] * 6)) {
          // Wander, leaning toward you.
          const toward: [number, number] = Math.abs(p.x - e.x) > Math.abs(p.y - e.y) ? [Math.sign(p.x - e.x), 0] : [0, Math.sign(p.y - e.y)];
          const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], toward, toward];
          e.dir = dirs[Math.floor(Math.random() * dirs.length)];
        }
        const nx = e.x + e.dir[0] * 0.6;
        const ny = e.y + e.dir[1] * 0.6;
        if (this.free(nx, ny) && this.tile(Math.floor(nx / T), Math.floor(ny / T)) !== '~') {
          e.x = nx;
          e.y = ny;
        }
      } else if (e.t % 110 === 60) {
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        this.shots.push({ x: e.x, y: e.y, dx: Math.cos(a) * 1.5, dy: Math.sin(a) * 1.5, foe: true, t: 0 });
      }
      if (Math.abs(e.x - p.x) < 10 && Math.abs(e.y - p.y) < 10 && !this.hook?.pull) this.hurt(1, false, e);
    }
    // Clear a room: in the garden (C), the big key appears.
    if (this.enemies.length && this.enemies.every((e) => e.hp <= 0) && !this.cleared.has(this.room)) {
      this.cleared.add(this.room);
      if (this.room === 'C') {
        this.setTile(8, 5, 'K');
        sfx.door();
        this.banner.setText('A BIG KEY APPEARS!');
        this.time.delayedCall(1100, () => !this.result && this.banner.setText(''));
      }
    }
  }

  private stepMantis(): void {
    const m = this.mantis!;
    if (this.room !== 'D') return;
    const p = this.p;
    m.t++;
    if (m.hurt > 0) m.hurt--;
    if (m.guardT > 0) m.guardT--;
    if (m.hookImmune > 0) m.hookImmune--;
    const rage = m.hp <= MANTIS_HP / 2;
    switch (m.state) {
      case 'walk': {
        const dx = p.x - m.x;
        const dy = p.y - m.y;
        const d = Math.hypot(dx, dy) || 1;
        const nx = m.x + (dx / d) * 0.7;
        const ny = m.y + (dy / d) * 0.7;
        if (this.free(nx, m.y)) m.x = nx;
        if (this.free(m.x, ny)) m.y = ny;
        if (m.t > (rage ? 50 : 80)) {
          const r = Math.random();
          m.t = 0;
          if (r < 0.4) {
            m.state = 'windup';
            const a = Math.atan2(dy, dx);
            m.dx = Math.cos(a);
            m.dy = Math.sin(a);
          } else if (r < 0.75) {
            m.state = 'throw';
          } else {
            m.state = 'leap';
            m.tx = p.x;
            m.ty = p.y;
            sfx.jump();
          }
        }
        break;
      }
      case 'windup':
        if (m.t > 30) {
          m.state = 'dash';
          m.t = 0;
          sfx.whoosh();
        }
        break;
      case 'dash': {
        const sp = rage ? 4 : 3.4;
        const nx = m.x + m.dx * sp;
        const ny = m.y + m.dy * sp;
        if (!this.free(nx, ny)) {
          // Slammed into the wall: dizzy, open to hits.
          m.state = 'dizzy';
          m.stun = 80;
          m.t = 0;
          sfx.crush();
          this.cameras.main.shake(160, 0.01);
        } else {
          m.x = nx;
          m.y = ny;
        }
        if (m.t > 60) {
          m.state = 'walk';
          m.t = 0;
        }
        break;
      }
      case 'dizzy':
        if (--m.stun <= 0) {
          m.state = 'walk';
          m.t = 0;
          m.hookImmune = 150;
        }
        break;
      case 'throw':
        if (m.t === 20) {
          const n = rage ? 2 : 1;
          for (let i = 0; i < n; i++) {
            const a = Math.atan2(p.y - m.y, p.x - m.x) + (i - (n - 1) / 2) * 0.5;
            this.thorns.push({ x: m.x, y: m.y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, t: 0 });
          }
          sfx.thorn();
        }
        if (m.t > 40) {
          m.state = 'walk';
          m.t = 0;
        }
        break;
      case 'leap':
        // In the air: drifts over the spot you were, then lands.
        m.x += (m.tx - m.x) * 0.06;
        m.y += (m.ty - m.y) * 0.06;
        if (m.t > 55) {
          m.state = 'land';
          m.t = 0;
          sfx.crush();
          this.cameras.main.shake(200, 0.012);
          if (Math.hypot(p.x - m.x, p.y - m.y) < 22) this.hurt(2, false, m);
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            this.shots.push({ x: m.x, y: m.y, dx: Math.cos(a) * 1.6, dy: Math.sin(a) * 1.6, foe: true, t: 0 });
          }
        }
        break;
      case 'land':
        if (m.t > 30) {
          m.state = 'walk';
          m.t = 0;
        }
        break;
    }
    // Thorn boomerangs: out, then back to him.
    for (const t of this.thorns) {
      t.t++;
      if (t.t > 35) {
        const a = Math.atan2(m.y - t.y, m.x - t.x);
        t.vx += Math.cos(a) * 0.25;
        t.vy += Math.sin(a) * 0.25;
      }
      t.x += t.vx;
      t.y += t.vy;
      if (Math.abs(t.x - p.x) < 7 && Math.abs(t.y - p.y) < 7 && !this.hook?.pull) this.hurt(1);
      if (t.t > 40 && Math.hypot(t.x - m.x, t.y - m.y) < 10) t.t = 999;
    }
    this.thorns = this.thorns.filter((t) => t.t < 200);
    // Touching him hurts (not while he's dizzy or up in the air).
    if (m.state !== 'leap' && m.state !== 'dizzy' && Math.abs(m.x - p.x) < 14 && Math.abs(m.y - p.y) < 14 && !this.hook?.pull) this.hurt(m.state === 'dash' ? 2 : 1, false, m);
  }

  // --- drawing ---------------------------------------------------------------------------------

  protected draw(): void {
    const g = this.g;
    g.clear();
    const grid = this.rooms[this.room];
    for (let r = 0; r < RH; r++)
      for (let c = 0; c < RW; c++) {
        const ch = grid[r][c];
        const x = OX + c * T;
        const y = OY + r * T;
        if (ch === '#') {
          // Stacked scrap: steel plates with rust and rivets.
          g.fillStyle(0x2a2a36).fillRect(x, y, T, T);
          g.fillStyle(0x55607a).fillRect(x + 1, y + 1, T - 2, 6);
          g.fillStyle(0x8a8fa8).fillRect(x + 1, y + 1, T - 2, 1);
          g.fillStyle(0x7a4a22).fillRect(x + 2, y + 9, 5, 4).fillRect(x + 10, y + 3, 3, 2);
          g.fillStyle(0xc8ccd8).fillRect(x + 3, y + 3, 1, 1).fillRect(x + 12, y + 11, 1, 1);
          continue;
        }
        if (ch === '~') {
          g.fillStyle(0x050805).fillRect(x, y, T, T);
          if (grid[r - 1]?.[c] !== '~') g.fillStyle(0x3a2a1a).fillRect(x, y, T, 4);
          continue;
        }
        // Floor.
        // Rusted floor plates.
        g.fillStyle((c + r) % 2 ? 0x4a4438 : 0x544c3e).fillRect(x, y, T, T);
        g.fillStyle(0x3a342a).fillRect(x, y + T - 1, T, 1).fillRect(x + T - 1, y, 1, T);
        if ((c * 7 + r * 3) % 5 === 0) g.fillStyle(0x7a4a22).fillRect(x + 4, y + 9, 3, 2).fillRect(x + 9, y + 5, 2, 2);
        if ((c + r * 2) % 4 === 0) g.fillStyle(0x6a6458).fillRect(x + 2, y + 2, 1, 1);
        if (ch === 'o') {
          g.fillStyle(0x1a1428).fillCircle(x + 8, y + 9, 6);
          g.fillStyle(0x8a8fa8).fillCircle(x + 8, y + 8, 5);
          g.fillStyle(0xc8ccd8).fillCircle(x + 7, y + 7, 2);
        } else if (ch === 'L' || ch === 'B') {
          g.fillStyle(0x3a2a1a).fillRect(x, y, T, T);
          g.fillStyle(ch === 'B' ? 0x8c2030 : 0x7a5a3a).fillRect(x + 1, y + 1, T - 2, T - 2);
          g.fillStyle(0xffe14a).fillCircle(x + 8, y + 7, 2).fillRect(x + 7, y + 8, 2, 4);
        } else if (ch === 'k' || ch === 'K') {
          const big = ch === 'K';
          const bob = Math.sin(this.frame / 10) * 1.5;
          g.fillStyle(0x1a1428).fillRect(x + 3, y + 5 + bob, big ? 12 : 10, big ? 7 : 5);
          g.fillStyle(0xffe14a).fillCircle(x + 5, y + 8 + bob, big ? 3.5 : 2.5).fillRect(x + 5, y + 7 + bob, big ? 9 : 7, 2);
          g.fillRect(x + (big ? 12 : 10), y + 7 + bob, 2, 4);
        } else if (ch === 'h') {
          g.fillStyle(0xd83a4a).fillCircle(x + 6, y + 7, 3).fillCircle(x + 10, y + 7, 3).fillTriangle(x + 3, y + 8, x + 13, y + 8, x + 8, y + 13);
        }
      }
    // Enemies.
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const x = OX + e.x;
      const y = OY + e.y;
      const flash = e.hurt > 0 || (e.stun > 0 && this.frame % 8 < 4);
      if (e.kind === 'beetle') {
        g.fillStyle(0x1a1428).fillEllipse(x, y, 13, 11);
        g.fillStyle(flash ? 0xffffff : 0x3a78b8).fillEllipse(x, y, 11, 9);
        g.fillStyle(0x6ab8e8).fillRect(x - 1, y - 4, 1, 8);
      } else {
        g.fillStyle(0x1a1428).fillCircle(x, y, 7);
        g.fillStyle(flash ? 0xffffff : 0xb8703a).fillCircle(x, y, 6);
        g.fillStyle(0xd83a4a).fillCircle(x, y, 2.5);
      }
    }
    // Shots and thorns.
    for (const s of this.shots) {
      g.fillStyle(0x1a1428).fillCircle(OX + s.x, OY + s.y, 3);
      g.fillStyle(s.foe ? 0xffa858 : 0x5ef0c8).fillCircle(OX + s.x, OY + s.y, 2);
    }
    // Scrap's saw blades, spinning.
    for (const t of this.thorns) {
      const a = this.frame * 0.5;
      g.fillStyle(0x1a1428).fillCircle(OX + t.x, OY + t.y, 6);
      g.fillStyle(0xc8ccd8).fillCircle(OX + t.x, OY + t.y, 5);
      g.fillStyle(0x55607a).fillCircle(OX + t.x, OY + t.y, 2);
      for (let i = 0; i < 4; i++) {
        const b = a + (i * Math.PI) / 2;
        g.fillStyle(0xeef2fa).fillRect(OX + t.x + Math.cos(b) * 5 - 1, OY + t.y + Math.sin(b) * 5 - 1, 2, 2);
      }
    }
    // Mantis (a shadow while he's in the air).
    const m = this.mantis;
    if (m && this.room === 'D') {
      const air = m.state === 'leap';
      const lift = air ? Math.sin((m.t / 55) * Math.PI) * 30 : 0;
      g.fillStyle(0x000000, 0.35).fillEllipse(OX + m.x, OY + m.y + 10, air ? 18 : 22, 7);
      const tex = m.state === 'throw' ? 'scrap_toss' : m.guardT > 0 ? 'scrap_magnet' : 'scrap_idle';
      const shake = m.state === 'windup' ? (this.frame % 4 < 2 ? 1 : -1) : 0;
      this.mantisImg.setTexture(tex).setPosition(OX + m.x + shake, OY + m.y - 4 - lift).setFlipX(this.p.x < m.x);
      this.mantisImg.setTint(m.hurt > 0 ? 0xff8888 : m.state === 'dizzy' ? 0xc8c8ff : 0xffffff);
      if (m.guardT > 0) g.lineStyle(2, 0x9ad0ff, 0.8).strokeCircle(OX + m.x, OY + m.y - 4, 15 + (this.frame % 12) / 4); // magnet field
      if (m.state === 'dizzy') for (let i = 0; i < 3; i++) g.fillStyle(0xffe14a).fillCircle(OX + m.x + Math.cos(this.frame / 8 + i * 2) * 10, OY + m.y - 22 + Math.sin(this.frame / 8 + i * 2) * 3, 1.5);
    } else this.mantisImg.setVisible(false);
    if (m && this.room === 'D' && !this.result) this.mantisImg.setVisible(true);
    // Hookshot chain and head.
    const h = this.hook;
    const p = this.p;
    if (h) {
      g.lineStyle(1, 0xc8ccd8).lineBetween(OX + p.x, OY + p.y, OX + h.x, OY + h.y);
      g.fillStyle(0xffe14a).fillCircle(OX + h.x, OY + h.y, 3);
    }
    this.heroImg.setPosition(OX + p.x, OY + p.y).setRotation(Math.atan2(p.fy, p.fx) + Math.PI / 2).setVisible(!(p.invuln > 0 && this.frame % 6 < 3));
  }
}
