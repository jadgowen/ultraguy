import Phaser from 'phaser';
import { PHYS, SCREEN_H, SCREEN_W, TILE, VIEW_H, VIEW_W } from '../constants';
import type { Player } from '../entities/Player';
import type { Projectile } from '../entities/Enemies';
import { Level, SWITCH_OFF_INDEX, Tile } from '../level/Level';
import { THEMES } from '../level/themes';
import { Box, overlaps } from '../physics';
import { sfx } from '../sfx';

/**
 * Stage set pieces that aren't sky-specific (see sky.ts for clouds and wind):
 *  - crushers ('!') that wait, slam to the floor and rise again, in a wave;
 *  - switch blocks ('[' / ']') that take turns being solid;
 *  - roller chutes ('@') that keep sending something rolling left;
 *  - water currents ('{' / '}'): streaks to show the flow (the push is in Player);
 *  - dark screens (stage.dark): a circle of light around you, and flashes;
 *  - rising lava (stage.rise): climbs after you while you're in those screens.
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
}

export class Hazards {
  private crushers: Crusher[] = [];
  private switches: { c: number; r: number; set: 0 | 1 }[] = [];
  private rollers: { x: number; y: number; t: number }[] = [];
  private currents: { c: number; r: number; dir: number }[] = [];
  private t = 0;
  private dark: Phaser.GameObjects.Image | null = null;
  private flash = 0;
  /** Moving belt surfaces drawn over conveyor runs, scrolled the way they push. */
  private belts: { sprite: Phaser.GameObjects.TileSprite; dir: number }[] = [];
  private lava: { y: number; start: number; top: number; x0: number; x1: number; on: boolean; fill: Phaser.GameObjects.TileSprite } | null = null;

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
      this.crushers.push({ x: p.x, top: p.y, floor, y: p.y, vy: 0, state: 'wait', t: -offset % CRUSH_WAIT, rod, head, lamp });
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

    if (level.data.dark) {
      this.dark = scene.add.image(0, 0, 'darkness').setDepth(30).setVisible(false);
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
      const fill = scene.add.tileSprite(x0, start, x1 - x0, SCREEN_H * 4, `lava_${host.theme}`).setOrigin(0).setDepth(14).setAlpha(0.95);
      this.lava = { y: start, start, top, x0, x1, on: false, fill };
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
  }

  private stepCrushers(): void {
    const p = this.host.player();
    const v = this.host.view();
    for (const k of this.crushers) {
      k.t++;
      switch (k.state) {
        case 'wait':
          if (k.t >= CRUSH_WAIT) {
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
      const left = CRUSH_WAIT - k.t;
      const blink = k.state === 'wait' && left < 40 ? (left < 16 ? k.t % 4 < 2 : k.t % 10 < 5) : k.state === 'fall' || k.state === 'hold';
      k.lamp.setY(Math.round(k.y) + 5).setVisible(blink);
      k.rod.setSize(8, Math.max(1, Math.round(k.y - k.top)));
      const box: Box = { x: k.x + 1, y: k.y, w: CRUSH_W - 2, h: CRUSH_HEAD };
      if (p.alive && overlaps(p, box)) p.hurt(PHYS.crusherDamage, k.x + CRUSH_W / 2);
    }
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
    const dark = !!this.host.level.data.dark?.includes(this.host.level.screenIdAt(p.cx, p.cy)) && this.host.level.screenIdAt(p.cx, p.cy) !== '';
    this.dark.setVisible(dark);
    if (!dark) return;
    // Lightning-style flashes every few seconds light up the whole room.
    if (this.t % 240 === 0) {
      this.flash = 26;
      sfx.zap();
    }
    if (this.flash > 0) this.flash--;
    const a = this.flash > 18 ? 0.05 : this.flash > 0 ? 0.92 - (this.flash / 18) * 0.8 : 0.92;
    this.dark.setPosition(p.cx, p.cy).setAlpha(a);
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
    L.fill.setY(Math.round(L.y));
    L.fill.tilePositionY = 0;
    L.fill.tilePositionX = (this.t * 0.3) % TILE;
    // Only where the lava actually is: once you're past the climb, other screens are safe.
    if (p.alive && p.bottom > L.y + 6 && p.cx >= L.x0 && p.cx < L.x1) p.die(true);
  }

  /** After a death: lava back down, presses back up. */
  reset(): void {
    if (this.lava) {
      this.lava.y = this.lava.start;
      this.lava.on = false;
      this.lava.fill.setY(this.lava.start);
    }
    for (const k of this.crushers) {
      k.y = k.top;
      k.state = 'wait';
      k.t = 0;
    }
    this.flash = 0;
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
