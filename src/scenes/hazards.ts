import Phaser from 'phaser';
import { PHYS, SCREEN_H, SCREEN_W, TILE, VIEW_H, VIEW_W } from '../constants';
import type { Player } from '../entities/Player';
import type { Projectile } from '../entities/Enemies';
import { Level, SWITCH_OFF_INDEX, Tile } from '../level/Level';
import { THEMES } from '../level/themes';
import { Box, overlaps } from '../physics';
import { sfx } from '../sfx';
import { makeFrames } from '../tileFx';
import type { ThemeId } from '../level/Level';

/**
 * Stage set pieces that aren't sky-specific (see sky.ts for clouds and wind):
 *  - crushers ('!') that wait, slam to the floor and rise again, in a wave;
 *  - switch blocks ('[' / ']') that take turns being solid;
 *  - roller chutes ('@') that keep sending something rolling left;
 *  - water currents ('{' / '}'): streaks to show the flow (the push is in Player);
 *  - dark screens (stage.dark): a circle of light around you, and flashes;
 *  - rising lava (stage.rise): climbs after you while you're in those screens;
 *  - the compactor (stage.compactor): a wall grinding in from the left.
 */

/** Crusher timing, in steps. */
export const CRUSH_WAIT = 80;
export const CRUSH_HOLD = 26;
const CRUSH_RISE = 1.2;
const CRUSH_W = 2 * TILE;
const CRUSH_HEAD = 20;

/** Switch blocks: each set is solid for half the cycle and blinks before going. */
export const SWITCH_PERIOD = 200;
const SWITCH_BLINK = 36;

/** Roller chutes send one every ROLL_EVERY steps while near the screen. */
export const ROLL_EVERY = 170;

interface Crusher {
  x: number;
  top: number;
  floor: number;
  y: number;
  vy: number;
  state: 'wait' | 'fall' | 'hold' | 'rise';
  t: number;
  /** Already came down on the boss this slam. */
  hitBoss: boolean;
  rod: Phaser.GameObjects.TileSprite;
  head: Phaser.GameObjects.Image;
  lamp: Phaser.GameObjects.Image;
}

export interface HazardHost {
  scene: Phaser.Scene;
  level: Level;
  layer: Phaser.Tilemaps.TilemapLayer;
  theme: string;
  player: () => Player;
  view: () => { x: number; y: number };
  shake: (n: number) => void;
  burst: (x: number, y: number, tex: string, n: number) => void;
  spawnShot: (o: { x: number; y: number; w: number; h: number; vx: number; vy: number; tex: string; dmg: number; rolls: boolean; spin: number; life: number }) => Projectile;
  /** Extra lights in the dark (world px; s = size, 1 = the hero's circle). */
  lights?: () => { x: number; y: number; s: number }[];
  /** A press came down on this box: crush whatever boss is under it. Returns true if it hit. */
  crushBoss?: (box: Box) => boolean;
}

/** Width of one tile of the compactor wall's body texture. */
const WALL_W = 64;

export class Hazards {
  private crushers: Crusher[] = [];
  private switches: { c: number; r: number; set: 0 | 1 }[] = [];
  private rollers: { x: number; y: number; t: number }[] = [];
  private currents: { c: number; r: number; dir: number }[] = [];
  private t = 0;
  private dark: Phaser.GameObjects.RenderTexture | null = null;
  private lightStamp: Phaser.GameObjects.Image | null = null;
  private flash = 0;
  /** Screens made dark at run time (a blackout), and dark screens lit again. */
  readonly extraDark = new Set<string>();
  /** Presses run this much faster (the Press Titan, enraged); 1 = normal. */
  rush = 1;
  /** No lightning flashes in the dark (the Angler, enraged). */
  noFlash = false;
  readonly lit = new Set<string>();
  private wall: { x: number; start: number; stop: number; y: number; on: boolean; done: boolean; sprite: Phaser.GameObjects.TileSprite; face: Phaser.GameObjects.TileSprite } | null = null;
  /** Moving belt surfaces drawn over conveyor runs, scrolled the way they push. */
  private belts: { sprite: Phaser.GameObjects.TileSprite; dir: number }[] = [];
  /**
   * The rising tide: Caldera's lava (the same living lava as the boss room's
   * surge: a rolling crest, a churning body, a heat glow) or Canopy's brambles
   * (thorny tendrils writhing over a tangle).
   */
  private lava: {
    y: number;
    start: number;
    top: number;
    x0: number;
    x1: number;
    on: boolean;
    kind: 'lava' | 'bramble';
    theme: string;
    fill: Phaser.GameObjects.TileSprite;
    crest: Phaser.GameObjects.TileSprite;
    glow: Phaser.GameObjects.TileSprite | null;
    /** Brambles: ragged shoots spilling past each side, so an edge never reads as a cut line. */
    sides: Phaser.GameObjects.TileSprite[];
  } | null = null;

  constructor(private host: HazardHost) {
    const { scene, level } = host;
    for (const p of level.crushers) {
      // The press drops until the floor under it.
      let r = Math.floor(p.y / TILE) + 1;
      while (r < level.rows && !level.isSolid(Math.floor(p.x / TILE), r) && !level.isSolid(Math.floor(p.x / TILE) + 1, r)) r++;
      const floor = r * TILE;
      scene.add.image(p.x + CRUSH_W / 2 - 10, p.y - 2, 'crusher_mount').setOrigin(0).setDepth(3.1);
      const rod = scene.add.tileSprite(p.x + CRUSH_W / 2 - 4, p.y, 8, 1, 'crusher_rod').setOrigin(0).setDepth(3);
      const head = scene.add.image(p.x, p.y, 'crusher').setOrigin(0).setDepth(3);
      const lamp = scene.add.image(p.x + CRUSH_W / 2 - 2, p.y + 5, 'crusher_lamp').setOrigin(0).setDepth(3.05).setVisible(false);
      // Neighbors start a little later each, so a row of presses rolls like a wave.
      const offset = Math.floor(p.x / TILE) * 9;
      this.crushers.push({ x: p.x, top: p.y, floor, y: p.y, vy: 0, state: 'wait', t: -offset % CRUSH_WAIT, hitBoss: false, rod, head, lamp });
    }
    for (const { c, r } of level.findTiles(Tile.SwitchA)) this.switches.push({ c, r, set: 0 });
    for (const { c, r } of level.findTiles(Tile.SwitchB)) this.switches.push({ c, r, set: 1 });
    for (const p of level.rollers) {
      this.rollers.push({ x: p.x, y: p.y, t: Math.floor(p.x / TILE) * 7 });
      scene.add.image(p.x, p.y, 'chute').setOrigin(0.5, 1).setDepth(1);
    }
    // Conveyor runs: one scrolling belt strip per run.
    for (let r = 0; r < level.rows; r++) {
      for (let c = 0; c < level.cols; c++) {
        const t = level.tileAt(c, r);
        if (t !== Tile.ConveyorL && t !== Tile.ConveyorR) continue;
        if (c > 0 && level.tileAt(c - 1, r) === t) continue;
        let end = c;
        while (level.tileAt(end + 1, r) === t) end++;
        const dir = t === Tile.ConveyorR ? 1 : -1;
        const sprite = scene.add.tileSprite(c * TILE, r * TILE, (end - c + 1) * TILE, 8, dir > 0 ? 'belt_r' : 'belt_l').setOrigin(0).setDepth(0.5);
        this.belts.push({ sprite, dir });
      }
    }
    for (const { c, r } of level.findTiles(Tile.CurrentL)) this.currents.push({ c, r, dir: -1 });
    for (const { c, r } of level.findTiles(Tile.CurrentR)) this.currents.push({ c, r, dir: 1 });

    if (level.data.dark || level.data.blackout) {
      // Drawn fresh each step: black, with a soft hole cut for each light.
      this.dark = scene.add.renderTexture(0, 0, VIEW_W, VIEW_H).setOrigin(0).setScrollFactor(0).setDepth(30).setVisible(false);
      this.lightStamp = scene.make.image({ key: 'light', add: false }).setOrigin(0.5);
    }
    const comp = level.data.compactor;
    if (comp) {
      let x0 = Infinity;
      let x1 = 0;
      let y = 0;
      for (let r = 0; r < level.rows; r += SCREEN_H / TILE) {
        for (let c = 0; c < level.cols; c += SCREEN_W / TILE) {
          const id = level.screenIdAt(c * TILE, r * TILE);
          if (!id || !comp.screens.includes(id)) continue;
          x0 = Math.min(x0, c * TILE);
          x1 = Math.max(x1, c * TILE + SCREEN_W);
          y = r * TILE;
        }
      }
      // It starts out of sight to the left (behind you as you walk in).
      const start = x0 - 96;
      const sprite = scene.add.tileSprite(start - VIEW_W, y, VIEW_W, SCREEN_H, 'compactor_body').setOrigin(0).setDepth(14).setVisible(false);
      const face = scene.add.tileSprite(start, y, 12, SCREEN_H, 'compactor_face').setOrigin(0).setDepth(14).setVisible(false);
      this.wall = { x: start, start, stop: x1, y, on: false, done: false, sprite, face };
    }
    const rise = level.data.rise;
    if (rise) {
      // Lava starts at the bottom of the lowest rising screen and stops near the top of the highest.
      // It only fills the columns of those screens, and starts a little below the floor.
      let start = 0;
      let top = Infinity;
      let x0 = Infinity;
      let x1 = 0;
      for (let r = 0; r < level.rows; r += SCREEN_H / TILE) {
        for (let c = 0; c < level.cols; c += SCREEN_W / TILE) {
          const id = level.screenIdAt(c * TILE, r * TILE);
          if (!id || !rise.screens.includes(id)) continue;
          start = Math.max(start, r * TILE + SCREEN_H + 4 * TILE);
          top = Math.min(top, r * TILE + 5 * TILE);
          x0 = Math.min(x0, c * TILE);
          x1 = Math.max(x1, c * TILE + SCREEN_W);
        }
      }
      // Drawn only inside the shaft: the columns between its walls (a column
      // that's mostly solid down the rising screens is wall). The walls frame
      // it, so its sides never end in a hard line against open air.
      const solidShare = (c: number) => {
        let solid = 0;
        let n = 0;
        for (let r = Math.floor(top / TILE) - 5; r < Math.floor(start / TILE) - 4; r++) {
          const id = level.screenIdAt(c * TILE, r * TILE);
          if (!id || !rise.screens.includes(id)) continue;
          n++;
          if (level.isSolid(c, r)) solid++;
        }
        return n ? solid / n : 1;
      };
      let c0 = x0 / TILE;
      let c1 = x1 / TILE - 1;
      while (c0 < c1 && solidShare(c0) >= 0.6) c0++;
      while (c1 > c0 && solidShare(c1) >= 0.6) c1--;
      const dx = c0 * TILE;
      const w = (c1 + 1) * TILE - dx;
      if (host.theme === 'jungle') {
        // (The jungle's rising tide is brambles, not lava.)
        const fill = scene.add.tileSprite(dx, start, w, SCREEN_H * 4, 'rise_jungle').setOrigin(0).setDepth(14);
        const crest = scene.add.tileSprite(dx, start, w, BRAMBLE_H, 'bramble_crest_0').setOrigin(0).setDepth(14.1);
        const side = (x: number, flip: boolean) => scene.add.tileSprite(x, start, BRAMBLE_SIDE_W, SCREEN_H * 4, 'bramble_side').setOrigin(0).setDepth(14).setFlipX(flip);
        const sides = [side(dx - BRAMBLE_SIDE_W, true), side(dx + w, false)];
        this.lava = { y: start, start, top, x0: dx, x1: dx + w, on: false, kind: 'bramble', theme: host.theme, fill, crest, glow: null, sides };
      } else {
        const theme = host.theme as ThemeId;
        makeFrames(scene, theme);
        const fill = scene.add.tileSprite(dx, start, w, SCREEN_H * 4, `lava_body_${theme}_0`).setOrigin(0).setDepth(14);
        const crest = scene.add.tileSprite(dx, start, w, TILE, `lava_top_${theme}_0`).setOrigin(0).setDepth(14);
        // A taller heat haze over it (the glow texture is one tile, stretched).
        const glow = scene.add.tileSprite(dx, start, w, TILE, `lava_glow_${theme}`).setOrigin(0, 1).setDepth(14.1).setScale(1, 3).setBlendMode(Phaser.BlendModes.ADD);
        this.lava = { y: start, start, top, x0: dx, x1: dx + w, on: false, kind: 'lava', theme, fill, crest, glow, sides: [] };
      }
      this.placeLava();
    }
  }

  /** One step, after the player has moved. */
  step(): void {
    this.t++;
    for (const b of this.belts) b.sprite.tilePositionX -= b.dir * PHYS.conveyor;
    this.stepCrushers();
    this.stepSwitches();
    this.stepRollers();
    this.stepCurrentFx();
    this.stepDark();
    this.stepLava();
    this.stepWall();
  }

  /** Is this screen dark right now? */
  isDark(id: string): boolean {
    if (!id || this.lit.has(id)) return false;
    return !!this.host.level.data.dark?.includes(id) || this.extraDark.has(id);
  }

  private stepWall(): void {
    const W = this.wall;
    if (!W) return;
    const p = this.host.player();
    const comp = this.host.level.data.compactor!;
    const id = this.host.level.screenIdAt(p.cx, p.cy);
    if (!W.on && !W.done && id && comp.screens.includes(id) && p.alive) {
      W.on = true;
      sfx.crush();
      this.host.shake(5);
    }
    if (W.on && p.alive) {
      // Catches up if you're far ahead, so the pressure stays on.
      const gap = p.x - W.x;
      W.x += comp.speed * (gap > VIEW_W * 0.6 ? 2.5 : 1);
      if (this.t % 30 === 0) {
        sfx.crush();
        this.host.shake(1);
      }
      if (this.t % 6 === 0) this.host.burst(W.x + 4, W.y + SCREEN_H - TILE * 2 - Math.random() * 8, 'spark', 1);
      if (W.x >= W.stop) {
        W.x = W.stop;
        W.on = false;
        W.done = true;
        this.host.shake(6);
        sfx.crush();
      }
    }
    W.sprite.setX(Math.round(W.x - VIEW_W)).setVisible(W.on || W.done);
    W.face.setX(Math.round(W.x)).setVisible(W.on || W.done);
    W.sprite.tilePositionY = 0;
    W.face.tilePositionY = (this.t * 0.5) % 16;
    // Caught by it: flattened.
    if (p.alive && W.on && p.x < W.x + 10 && p.bottom > W.y && p.y < W.y + SCREEN_H) p.die(true);
  }

  /** The compactor is grinding after you right now. */
  get wallOn(): boolean {
    return !!this.wall?.on;
  }

  /** The rising lava (or brambles) is on its way up. */
  get lavaOn(): boolean {
    return !!this.lava?.on;
  }

  /** The compactor wall's front edge (world x), or -Infinity. */
  get wallX(): number {
    return this.wall?.on ? this.wall.x + 10 : -Infinity;
  }

  private stepCrushers(): void {
    const p = this.host.player();
    const v = this.host.view();
    for (const k of this.crushers) {
      k.t++;
      switch (k.state) {
        case 'wait':
          if (k.t >= CRUSH_WAIT / this.rush) {
            k.state = 'fall';
            k.vy = 0;
          }
          break;
        case 'fall':
          k.vy = Math.min(k.vy + 0.6, 7);
          k.y += k.vy;
          if (k.y + CRUSH_HEAD >= k.floor) {
            k.y = k.floor - CRUSH_HEAD;
            k.state = 'hold';
            k.t = 0;
            const onScreen = k.x > v.x - CRUSH_W && k.x < v.x + VIEW_W && k.floor > v.y && k.floor < v.y + VIEW_H + TILE;
            if (onScreen) {
              this.host.shake(3);
              sfx.crush();
              // Dust out both sides, sparks off the teeth.
              this.host.burst(k.x + 2, k.floor - 2, 'boom', 2);
              this.host.burst(k.x + CRUSH_W - 2, k.floor - 2, 'boom', 2);
              this.host.burst(k.x + CRUSH_W / 2, k.floor - 4, 'spark', 5);
            }
          }
          break;
        case 'hold':
          if (k.t >= CRUSH_HOLD) k.state = 'rise';
          break;
        case 'rise':
          k.y -= CRUSH_RISE;
          if (k.y <= k.top) {
            k.y = k.top;
            k.state = 'wait';
            k.t = 0;
          }
          break;
      }
      k.head.setY(Math.round(k.y));
      // Warning lamp: blinks during the last stretch of the wait, faster near the end.
      const left = CRUSH_WAIT / this.rush - k.t;
      const blink = k.state === 'wait' && left < 40 ? (left < 16 ? k.t % 4 < 2 : k.t % 10 < 5) : k.state === 'fall' || k.state === 'hold';
      k.lamp.setY(Math.round(k.y) + 5).setVisible(blink);
      k.rod.setSize(8, Math.max(1, Math.round(k.y - k.top)));
      const box: Box = { x: k.x + 1, y: k.y, w: CRUSH_W - 2, h: CRUSH_HEAD };
      if (p.alive && overlaps(p, box)) this.touchCrusher(p, k);
      if (k.state === 'wait') k.hitBoss = false;
      else if ((k.state === 'fall' || k.state === 'hold') && !k.hitBoss && this.host.crushBoss?.(box)) k.hitBoss = true;
    }
  }

  /**
   * Touching a press. Coming down on you, it hurts. Anything else is just a
   * solid block of steel: walking into its side pushes you back, and jumping
   * into its underside bonks your head. No damage either way.
   */
  private touchCrusher(p: Player, k: Crusher): void {
    const bottom = k.y + CRUSH_HEAD;
    // Where its underside was a step ago: if that was above your head, it came down on you.
    const wasAbove = bottom - Math.max(0, k.vy) <= p.y + 4;
    if (k.state === 'fall' && wasAbove) {
      p.hurt(PHYS.crusherDamage, k.x + CRUSH_W / 2);
      return;
    }
    if (p.vy < 0 && p.y > bottom - 6) {
      p.y = bottom;
      p.vy = 0;
      return;
    }
    if (p.cx < k.x + CRUSH_W / 2) p.x = k.x - p.w;
    else p.x = k.x + CRUSH_W;
  }

  private stepSwitches(): void {
    if (!this.switches.length) return;
    const { level, layer } = this.host;
    const p = this.host.player();
    const u = this.t % SWITCH_PERIOD;
    const half = SWITCH_PERIOD / 2;
    const onSet = u < half ? 0 : 1;
    const left = half - (u % half); // steps until this set goes away
    for (const s of this.switches) {
      const want = s.set === onSet;
      const tile = s.set === 0 ? Tile.SwitchA : Tile.SwitchB;
      const isOn = level.tileAt(s.c, s.r) === tile;
      if (want && !isOn) {
        // Don't appear on top of the player.
        const cell: Box = { x: s.c * TILE, y: s.r * TILE, w: TILE, h: TILE };
        if (overlaps(p, cell)) continue;
        level.setTile(s.c, s.r, tile);
        layer.putTileAt(tile - 1, s.c, s.r).setAlpha(1);
      } else if (!want && isOn) {
        level.setTile(s.c, s.r, Tile.Empty);
        layer.putTileAt(SWITCH_OFF_INDEX, s.c, s.r).setAlpha(0.5);
      } else if (want && left < SWITCH_BLINK) {
        layer.getTileAt(s.c, s.r)?.setAlpha(left % 8 < 4 ? 0.45 : 1);
      }
    }
    if ((u === 0 || u === half) && this.switchesOnScreen()) sfx.switchBlock();
  }

  private switchesOnScreen(): boolean {
    const v = this.host.view();
    return this.switches.some(({ c, r }) => c * TILE > v.x - TILE && c * TILE < v.x + VIEW_W && r * TILE > v.y - TILE && r * TILE < v.y + VIEW_H);
  }

  private stepRollers(): void {
    const v = this.host.view();
    for (const r of this.rollers) {
      const near = r.x > v.x && r.x < v.x + VIEW_W + 8 && r.y > v.y && r.y <= v.y + VIEW_H + TILE;
      if (!near) continue;
      if (++r.t % ROLL_EVERY !== 0) continue;
      this.host.spawnShot({ x: r.x - 7, y: r.y - 14, w: 14, h: 14, vx: -1.7, vy: 0, tex: `roller_${this.host.theme}`, dmg: 4, rolls: true, spin: -0.15, life: 900 });
      sfx.chute();
    }
  }

  private stepCurrentFx(): void {
    if (!this.currents.length || this.t % 3 !== 0) return;
    const v = this.host.view();
    const vis = this.currents.filter(({ c, r }) => c * TILE >= v.x - TILE && c * TILE <= v.x + VIEW_W && r * TILE >= v.y - TILE && r * TILE <= v.y + VIEW_H);
    if (!vis.length) return;
    const { c, r, dir } = vis[Math.floor(Math.random() * vis.length)];
    const s = this.host.scene.add.image(c * TILE + 8, r * TILE + Math.random() * TILE, 'windline').setAlpha(0.45).setDepth(16);
    this.host.scene.tweens.add({ targets: s, x: s.x + dir * 36, alpha: 0, duration: 500, onComplete: () => s.destroy() });
  }

  private stepDark(): void {
    if (!this.dark) return;
    const p = this.host.player();
    const dark = this.isDark(this.host.level.screenIdAt(p.cx, p.cy));
    this.dark.setVisible(dark);
    if (!dark) return;
    // Lightning-style flashes every few seconds light up the whole room.
    if (this.t % 240 === 0 && !this.noFlash) {
      this.flash = 26;
      sfx.zap();
    }
    if (this.flash > 0) this.flash--;
    const a = this.flash > 18 ? 0.05 : this.flash > 0 ? 0.92 - (this.flash / 18) * 0.8 : 0.92;
    const v = this.host.view();
    const rt = this.dark;
    rt.clear();
    rt.fill(0x05040a, a);
    const stamp = this.lightStamp!;
    const lights = [{ x: p.cx, y: p.cy, s: 1 }, ...(this.host.lights?.() ?? [])];
    for (const L of lights) {
      stamp.setPosition(Math.round(L.x - v.x), Math.round(L.y - v.y)).setScale(L.s);
      rt.erase(stamp);
    }
  }

  private stepLava(): void {
    const L = this.lava;
    if (!L) return;
    const p = this.host.player();
    const rise = this.host.level.data.rise!;
    const id = this.host.level.screenIdAt(p.cx, p.cy);
    if (!L.on && id && rise.screens.includes(id)) {
      L.on = true;
      sfx.lavaRise();
      this.host.shake(4);
    }
    if (L.on && p.alive && L.y > L.top) {
      // Rise faster if you're far ahead, so it always keeps up the pressure.
      const gap = L.y - p.bottom;
      L.y -= rise.speed * (gap > VIEW_H * 0.75 ? 2.5 : 1);
    }
    this.placeLava();
    // Embers off the lava's surface, in view.
    if (L.kind === 'lava' && L.on && this.t % 5 === 0) {
      const v = this.host.view();
      const x = Math.max(L.x0, v.x) + Math.random() * Math.min(VIEW_W, L.x1 - Math.max(L.x0, v.x));
      if (L.y < v.y + VIEW_H + 8) this.host.burst(x, L.y + 2, 'ember', 1);
    }
    // Only where the lava actually is: once you're past the climb, other screens are safe.
    if (p.alive && p.bottom > L.y + 6 && p.cx >= L.x0 && p.cx < L.x1) p.die(true);
  }

  /** Move the rising tide's layers to its surface and animate them. */
  private placeLava(): void {
    const L = this.lava;
    if (!L) return;
    const y = Math.round(L.y);
    if (L.kind === 'lava') {
      // As in the boss room: the crest a little over the surface, the body under it, drifting along.
      const f = Math.floor(this.t / 5) % 8;
      const drift = (this.t * 0.4) % TILE;
      L.crest.setTexture(`lava_top_${L.theme}_${f}`).setY(y - 2);
      L.crest.tilePositionX = drift;
      L.fill.setTexture(`lava_body_${L.theme}_${f}`).setY(y - 2 + TILE);
      L.fill.tilePositionX = drift;
      L.glow?.setY(y).setAlpha(0.6 + Math.sin(this.t * 0.1) * 0.25);
    } else {
      // The tendrils reach up over the surface; the tangle under them shifts as it climbs.
      const f = Math.floor(this.t / 6) % BRAMBLE_FRAMES;
      L.crest.setTexture(`bramble_crest_${f}`).setY(y - BRAMBLE_REACH);
      L.crest.tilePositionX = Math.round(Math.sin(this.t * 0.013) * 6);
      L.fill.setY(y - BRAMBLE_REACH + BRAMBLE_H - 2);
      L.fill.tilePositionX = Math.round(Math.sin(this.t * 0.017 + 1) * 4);
      L.fill.tilePositionY = Math.round(-this.t * 0.08) % 64;
      for (const sd of L.sides) {
        sd.setY(y + 2);
        sd.tilePositionY = L.fill.tilePositionY;
      }
    }
  }

  /** After a death: lava back down, presses back up. */
  reset(): void {
    if (this.lava) {
      this.lava.y = this.lava.start;
      this.lava.on = false;
      this.placeLava();
    }
    for (const k of this.crushers) {
      k.y = k.top;
      k.state = 'wait';
      k.t = 0;
    }
    this.flash = 0;
    this.rush = 1;
    this.noFlash = false;
    if (this.wall && !this.wall.done) {
      this.wall.x = this.wall.start;
      this.wall.on = false;
      this.wall.done = false;
    }
  }

  /** The lava surface (Infinity when this stage has none). */
  get lavaY(): number {
    return this.lava ? this.lava.y : Infinity;
  }
}

/** Shared art for these hazards (drawn at boot, see textures.ts). */
export function makeHazardTextures(scene: Phaser.Scene): void {
  const K = 0x1a1428;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // Crusher head: a beveled housing with a hazard band and a warning lamp
  // socket, over a heavy jaw of shaded teeth.
  const hx = (c: number, x: number, y: number, w: number, h: number) => g.fillStyle(c).fillRect(x, y, w, h);
  hx(K, 0, 0, CRUSH_W, 12);
  hx(0x5a6680, 1, 1, CRUSH_W - 2, 11);
  hx(0xb8c4d8, 1, 1, CRUSH_W - 2, 1);
  hx(0x8a98b0, 1, 2, CRUSH_W - 2, 1);
  hx(0x3a4458, 1, 10, CRUSH_W - 2, 2);
  hx(0x8a98b0, 1, 1, 1, 10);
  hx(0x2a3244, CRUSH_W - 2, 1, 1, 10);
  // Hazard band.
  hx(K, 2, 4, CRUSH_W - 4, 5);
  for (let x = 2; x < CRUSH_W - 2; x += 4) {
    hx(0xffc040, x, 5, 2, 3);
    hx(0x2a2a30, x + 2, 5, 2, 3);
  }
  // Lamp socket (the lamp itself is a separate sprite that blinks).
  hx(K, CRUSH_W / 2 - 3, 4, 6, 5);
  hx(0x5a1a20, CRUSH_W / 2 - 2, 5, 4, 3);
  // Jaw bar, then shaded wedge teeth with gaps between them.
  hx(K, 0, 12, CRUSH_W, 3);
  hx(0x3a4458, 1, 12, CRUSH_W - 2, 2);
  // Each tooth: a symmetric wedge, lit on the left. Rows: K=outline, l=light, m=mid, d=dark.
  const TOOTH = ['KlmdK', 'KlmdK', '.KlK.', '.KmK.', '..K..'];
  const toothColor: Record<string, number> = { K, l: 0xe8eef8, m: 0xa8b4c8, d: 0x6a7890 };
  for (let x = 1; x + 5 <= CRUSH_W; x += 6) {
    TOOTH.forEach((row, y) => [...row].forEach((ch, i) => ch !== '.' && hx(toothColor[ch], x + i, 15 + y, 1, 1)));
  }
  g.generateTexture('crusher', CRUSH_W, CRUSH_HEAD);
  g.clear();
  // Piston rod: chrome with a bright stripe and ring joints every 8px.
  hx(K, 0, 0, 8, 8);
  hx(0x8a98b0, 1, 0, 6, 8);
  hx(0xe8eef8, 2, 0, 1, 8);
  hx(0xb8c4d8, 3, 0, 1, 8);
  hx(0x5a6680, 6, 0, 1, 8);
  hx(0x3a4458, 1, 7, 6, 1);
  g.generateTexture('crusher_rod', 8, 8);
  g.clear();
  // Ceiling mount.
  hx(K, 0, 0, 20, 7);
  hx(0x5a6680, 1, 0, 18, 6);
  hx(0x8a98b0, 1, 0, 18, 1);
  hx(0x2a3244, 1, 5, 18, 1);
  hx(0xd8e0ec, 3, 2, 2, 2);
  hx(0xd8e0ec, 15, 2, 2, 2);
  g.generateTexture('crusher_mount', 20, 7);
  g.clear();
  // Warning lamp (lit).
  hx(0xff5a6a, 0, 0, 4, 3);
  hx(0xffd0d0, 1, 0, 1, 1);
  g.generateTexture('crusher_lamp', 4, 3);
  g.clear();
  // Roller chute: a pipe mouth facing left.
  g.fillStyle(K).fillRect(0, 0, 16, 16);
  g.fillStyle(0x6b7a90).fillRect(2, 1, 14, 14);
  g.fillStyle(0xc8ccd8).fillRect(2, 1, 14, 2);
  g.fillStyle(K).fillRect(0, 3, 9, 11);
  g.fillStyle(0xffc040).fillRect(11, 5, 3, 7);
  g.generateTexture('chute', 16, 16);
  // Conveyor belt surface (top half of the tile), chevrons every 8px, per direction.
  for (const [key, dir] of [['belt_l', -1], ['belt_r', 1]] as const) {
    g.clear();
    g.fillStyle(K).fillRect(0, 0, 8, 8);
    g.fillStyle(0x3a3a44).fillRect(0, 1, 8, 6);
    g.fillStyle(0x5a5a66).fillRect(0, 1, 8, 1);
    g.fillStyle(0x24242c).fillRect(0, 6, 8, 1);
    g.fillStyle(0xffc040);
    if (dir > 0) g.fillRect(2, 2, 2, 1).fillRect(4, 3, 2, 1).fillRect(2, 4, 2, 1);
    else g.fillRect(4, 2, 2, 1).fillRect(2, 3, 2, 1).fillRect(4, 4, 2, 1);
    g.fillStyle(0x7a6a2a).fillRect(dir > 0 ? 2 : 4, 5, 2, 1);
    g.generateTexture(key, 8, 8);
  }
  g.destroy();

  // Darkness: black with a soft hole in the middle (centered on the player).
  const w = VIEW_W * 2 + 64;
  const h = VIEW_H * 2 + 64;
  const tex = scene.textures.createCanvas('darkness', w, h)!;
  const ctx = tex.getContext();
  ctx.fillStyle = '#05040a';
  ctx.fillRect(0, 0, w, h);
  const grad = ctx.createRadialGradient(w / 2, h / 2, 34, w / 2, h / 2, 78);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  tex.refresh();

  // A light, for cutting holes in the dark (opaque middle, soft edge).
  const L = scene.textures.createCanvas('light', 156, 156)!;
  const lc = L.getContext();
  const lg = lc.createRadialGradient(78, 78, 34, 78, 78, 78);
  lg.addColorStop(0, 'rgba(255,255,255,1)');
  lg.addColorStop(1, 'rgba(255,255,255,0)');
  lc.fillStyle = lg;
  lc.fillRect(0, 0, 156, 156);
  L.refresh();

  makeCompactorTextures(scene);
  makeBrambles(scene);

  // Per theme: the thing a roller chute sends, and rising-lava fill.
  for (const [id, t] of Object.entries(THEMES)) {
    const r = scene.make.graphics({ x: 0, y: 0 }, false);
    if (id === 'ice') {
      r.fillStyle(K).fillCircle(7, 7, 7);
      r.fillStyle(0xf4fbff).fillCircle(7, 7, 6);
      r.fillStyle(0xb8cce8).fillCircle(9, 9, 3);
    } else if (id === 'scrap') {
      r.fillStyle(K).fillRect(0, 1, 14, 12);
      r.fillStyle(0xb85a1a).fillRect(1, 2, 12, 10);
      r.fillStyle(0xf28c28).fillRect(1, 2, 12, 2);
      r.fillStyle(0x7a3a10).fillRect(1, 6, 12, 2).fillRect(6, 2, 2, 10);
    } else {
      r.fillStyle(K).fillCircle(7, 7, 7);
      r.fillStyle(t.solid.base).fillCircle(7, 7, 6);
      r.fillStyle(t.solid.light).fillCircle(5, 5, 2);
      r.fillStyle(t.solid.dark).fillRect(8, 8, 3, 2);
    }
    r.generateTexture(`roller_${id}`, 14, 14);
    r.clear();
    r.fillStyle(t.lava.base).fillRect(0, 0, TILE, TILE);
    r.fillStyle(t.lava.light).fillRect(0, 0, TILE, 2).fillRect(3, 2, 3, 1).fillRect(10, 2, 4, 1);
    r.fillStyle(t.lava.dark).fillRect(2, 8, 4, 2).fillRect(9, 11, 5, 2);
    r.generateTexture(`lava_${id}`, TILE, TILE);
    r.destroy();
  }
}

/**
 * The compactor: a riveted steel wall (body, tiles vertically) with a face of
 * grinding teeth on its leading edge (scrolls as it advances).
 */
function makeCompactorTextures(scene: Phaser.Scene): void {
  const K = 0x1a1428;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const r = (c: number, x: number, y: number, w: number, h: number) => g.fillStyle(c).fillRect(x, y, w, h);
  r(0x3a2e2a, 0, 0, WALL_W, 32);
  r(0x5a4a40, 0, 0, WALL_W, 2);
  r(0x241a18, 0, 30, WALL_W, 2);
  for (let x = 0; x < WALL_W; x += 16) {
    r(0x6a5a4e, x + 1, 3, 14, 12);
    r(0x8a7a68, x + 1, 3, 14, 1);
    r(0x4a3c34, x + 1, 14, 14, 1);
    r(0x6a5a4e, x + 1, 17, 14, 12);
    r(0x8a7a68, x + 1, 17, 14, 1);
    r(0x4a3c34, x + 1, 28, 14, 1);
    r(0xb8a890, x + 3, 5, 1, 1);
    r(0xb8a890, x + 12, 19, 1, 1);
  }
  // Hazard stripes down the right edge.
  for (let y = 0; y < 32; y += 8) {
    r(0xffc040, WALL_W - 6, y, 6, 4);
    r(K, WALL_W - 6, y + 4, 6, 4);
  }
  g.generateTexture('compactor_body', WALL_W, 32);
  g.clear();
  // Teeth: wedges pointing right.
  r(K, 0, 0, 12, 16);
  r(0x8a98b0, 0, 1, 4, 14);
  for (let i = 0; i < 6; i++) {
    r(0xb8c4d8, 4, 2 + i, 2 + i, 1);
    r(0x8a98b0, 4, 8 + i, 7 - i, 1);
  }
  r(0xeef2fa, 4, 2, 2, 1);
  g.generateTexture('compactor_face', 12, 16);
  g.destroy();
}

/** Canopy's brambles: the crest strip's size, how far its tendrils reach over the deadly line, and its frames. */
const BRAMBLE_W = 96;
const BRAMBLE_H = 40;
const BRAMBLE_REACH = 22;
const BRAMBLE_FRAMES = 8;
const BRAMBLE_SIDE_W = 10;

/**
 * Canopy's rising brambles. The body (`rise_jungle`, 64x64, tiles both ways)
 * is a dark tangle of thorny vines, deeper in shadow toward the bottom of each
 * strand; it scrolls slowly so the thicket seems to churn as it climbs. Over
 * it, the crest (`bramble_crest_<k>`): a ragged top edge bristling with thorns
 * and, reaching up from it, thorny tendrils that sway and curl, each tipped
 * with a hook and some with a red bud.
 */
function makeBrambles(scene: Phaser.Scene): void {
  const DARK = '#0e170b';
  const VINE = ['#1a3312', '#24481a', '#2f5a1e', '#3f7a28', '#5a9a34'];
  const THORN = ['#6a5a34', '#a89858', '#e8d8a0'];
  const BUD = ['#8a1c28', '#c83a3a', '#ff7a6a'];
  const make = (key: string, w: number, h: number, paint: (px: (c: string, x: number, y: number, ww?: number, hh?: number) => void) => void) => {
    if (scene.textures.exists(key)) return;
    const tex = scene.textures.createCanvas(key, w, h)!;
    const ctx = tex.getContext();
    paint((c, x, y, ww = 1, hh = 1) => {
      if (y < 0 || y >= h) return;
      ctx.fillStyle = c;
      ctx.fillRect(((Math.round(x) % w) + w) % w, Math.round(y), ww, hh);
    });
    tex.refresh();
  };
  // A thorn: a hooked spike from (x, y) out to `side`, curving up, with a dark underside so it reads.
  const thorn = (px: (c: string, x: number, y: number, ww?: number, hh?: number) => void, x: number, y: number, side: number, big = false) => {
    px(DARK, x + side, y + 1);
    px(DARK, x + side * 2, y + 1);
    px(THORN[0], x + side, y);
    px(THORN[1], x + side * 2, y);
    px(THORN[1], x + side * 3, y - 1);
    px(THORN[2], x + side * 3, y - 2);
    if (big) {
      px(DARK, x + side * 3, y);
      px(THORN[1], x + side * 4, y - 2);
      px(THORN[2], x + side * 4, y - 3);
      px('#fff8d0', x + side * 4, y - 4);
    } else px('#fff8d0', x + side * 3, y - 3);
  };
  // --- The body: tangled strands crossing every which way, with thorns along them.
  make('rise_jungle', 64, 64, (px) => {
    px(DARK, 0, 0, 64, 64);
    const strands = [
      { y: 6, a: 4, f: 1, ph: 0 },
      { y: 18, a: 5, f: 2, ph: 1.3 },
      { y: 30, a: 3, f: 1, ph: 2.6 },
      { y: 41, a: 6, f: 2, ph: 0.7 },
      { y: 53, a: 4, f: 1, ph: 4.1 },
      { y: 60, a: 3, f: 3, ph: 2.0 },
    ];
    strands.forEach((st, n) => {
      for (let x = 0; x < 64; x++) {
        const y = st.y + st.a * Math.sin((x / 64) * Math.PI * 2 * st.f + st.ph);
        const shade = n % 2 ? 1 : 2;
        px(VINE[0], x, y + 2, 1, 2);
        px(VINE[shade], x, y, 1, 2);
        px(VINE[shade + 1], x, y - 1);
        // Wrap around: the bottom strand's shadow comes back in at the top.
        px(VINE[0], x, y + 2 - 64, 1, 2);
        if ((x + n * 5) % 9 === 0) thorn(px, x, y - 1, (x + n) % 2 ? 1 : -1, (x + n) % 4 === 0);
      }
    });
    // A few loose leaves and old buds in the shadows.
    for (let i = 0; i < 9; i++) {
      const x = (i * 23 + 7) % 64;
      const y = (i * 37 + 11) % 64;
      if (i % 3 === 0) {
        px(BUD[0], x, y, 2, 2);
        px(BUD[1], x, y);
      } else {
        px(VINE[2], x, y, 3, 1);
        px(VINE[3], x + 1, y - 1, 2, 1);
      }
    }
  });

  // --- The sides: shoots poking out sideways from the thicket's edge (x = 0 is the edge), thorny, on nothing.
  make('bramble_side', BRAMBLE_SIDE_W, 64, (px) => {
    for (let y = 0; y < 64; y += 2) {
      const len = Math.max(0, Math.round(3 + 3 * Math.sin(y * 0.37) + 2 * Math.sin(y * 0.11 + 2)));
      // The thicket's dark fringe, then a shoot with a light top edge.
      px(DARK, 0, y, Math.min(2, len + 1), 2);
      for (let x = 0; x < len; x++) {
        const yy = y + Math.round(Math.sin(x * 0.9 + y) * 0.6);
        px(VINE[2], x, yy);
        px(VINE[0], x, yy + 1);
        if (x === len - 1) px(VINE[4], x, yy - 1);
      }
      if (len > 4 && y % 6 === 0) {
        px(THORN[1], len, y - 1);
        px(THORN[2], len + 1, y - 2);
      }
    }
  });

  // --- The crest: a ragged top over the tangle, and thorny tendrils writhing up from it.
  const W = BRAMBLE_W;
  const base = (x: number) => BRAMBLE_REACH + Math.round(1.6 * Math.sin((x / W) * Math.PI * 4) + 1.1 * Math.sin((x / W) * Math.PI * 10 + 1));
  const tendrils = [
    { x: 7, h: 17, a: 4, off: 0, bud: false, curl: 1 },
    { x: 21, h: 10, a: 3, off: 2.1, bud: true, curl: -1 },
    { x: 34, h: 21, a: 5, off: 4.0, bud: false, curl: -1 },
    { x: 49, h: 13, a: 3.5, off: 1.0, bud: false, curl: 1 },
    { x: 63, h: 19, a: 4.5, off: 3.3, bud: true, curl: 1 },
    { x: 77, h: 9, a: 3, off: 5.2, bud: false, curl: -1 },
    { x: 88, h: 15, a: 4, off: 0.6, bud: false, curl: -1 },
  ];
  for (let k = 0; k < BRAMBLE_FRAMES; k++) {
    const ph = (k / BRAMBLE_FRAMES) * Math.PI * 2;
    make(`bramble_crest_${k}`, W, BRAMBLE_H, (px) => {
      // The tangle under the edge (the body takes over just below the strip).
      for (let x = 0; x < W; x++) {
        const b = base(x);
        px(DARK, x, b - 1, 1, BRAMBLE_H - b + 1);
        px(VINE[2], x, b, 1, 2);
        px(VINE[4], x, b);
        px(VINE[0], x, b + 2);
        // Loops of vine just under the edge, rippling.
        const ly = b + 5 + Math.round(1.5 * Math.sin(x * 0.35 + ph * (x % 2 ? 1 : -1)));
        px(VINE[3], x, ly);
        px(VINE[1], x, ly + 1);
        const ly2 = b + 11 + Math.round(2 * Math.sin(x * 0.2 - ph));
        px(VINE[2], x, ly2);
        px(VINE[0], x, ly2 + 1);
      }
      // Thorns bristling along the edge, nodding with the sway.
      for (let x = 2; x < W; x += 6) thorn(px, x, base(x) - 1, Math.sin(ph + x) > 0 ? 1 : -1);
      // The tendrils: thick at the root, thinning to a whip, bending more toward the tip.
      const paths = tendrils.map((t) => {
        const root = base(t.x);
        return Array.from({ length: t.h + 1 }, (_, s) => {
          const u = s / t.h;
          return { x: Math.round(t.x + t.a * Math.sin(ph + t.off + u * 2.2) * u ** 1.2), y: root - s, th: u < 0.35 ? 3 : u < 0.75 ? 2 : 1, s };
        });
      });
      // Outline first (so tendrils crossing the edge still read), then the stalks.
      for (const path of paths) for (const q of path) px(DARK, q.x - 1, q.y - 1, q.th + 2, 3);
      paths.forEach((path, n) => {
        const t = tendrils[n];
        for (const q of path) {
          px(VINE[2], q.x, q.y, q.th, 1);
          px(VINE[4], q.x, q.y);
          if (q.th > 1) px(VINE[1], q.x + q.th - 1, q.y);
        }
        // Thorns along it, alternating sides, bigger near the root.
        for (const q of path) if (q.s > 1 && q.s < t.h - 1 && q.s % 3 === 0) {
          const side = q.s % 6 ? 1 : -1;
          thorn(px, side > 0 ? q.x + q.th - 1 : q.x, q.y, side, q.s < t.h * 0.5);
        }
        // The tip curls over into a hook, or swells into a red bud.
        const tip = path[path.length - 1];
        if (t.bud) {
          // A round bud in green sepals, outlined; it pulses.
          const bx = tip.x;
          const by = tip.y - 1;
          px(DARK, bx - 1, by - 5, 3, 1);
          px(DARK, bx - 2, by - 4, 5, 3);
          px(DARK, bx - 1, by - 1, 3, 1);
          px(BUD[1], bx - 1, by - 4, 3, 3);
          px(BUD[0], bx - 1, by - 2, 3, 1);
          px(BUD[0], bx + 1, by - 3);
          px(k % 4 < 2 ? '#ffd0c0' : BUD[2], bx - 1, by - 4);
          px(VINE[3], bx - 2, by - 1);
          px(VINE[3], bx + 2, by - 1);
          px(VINE[4], bx, by);
        } else {
          const c = t.curl * (Math.sin(ph + t.off) > -0.3 ? 1 : -1);
          px(VINE[3], tip.x, tip.y - 1);
          px(VINE[3], tip.x + c, tip.y - 2);
          px(THORN[1], tip.x + c * 2, tip.y - 2);
          px(THORN[2], tip.x + c * 3, tip.y - 1);
          px('#fff8d0', tip.x + c * 3, tip.y);
        }
      });
    });
  }
}
