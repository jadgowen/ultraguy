import Phaser from 'phaser';
import { TILE } from '../constants';
import type { Player } from '../entities/Player';
import type { EnemyKind, Level } from '../level/Level';
import { Box, overlaps } from '../physics';
import { sfx } from '../sfx';

export interface BlackoutHost {
  scene: Phaser.Scene;
  level: Level;
  layer: Phaser.Tilemaps.TilemapLayer;
  player: () => Player;
  view: () => { x: number; y: number };
  shake: (px: number) => void;
  burst: (x: number, y: number, tex: string, n: number) => void;
  /** Make these screens dark (true) or light again (false). */
  setDark: (screens: string, on: boolean) => void;
  spawnEnemy: (kind: EnemyKind, x: number, y: number) => void;
  /** How many enemies are about. */
  enemyCount: () => number;
  say: (text: string, frames?: number) => void;
}

/** A swarm member every this many steps while the lights are out (up to SWARM_MAX at once). */
const SWARM_EVERY = 150;
const SWARM_MAX = 4;

/**
 * BLACKOUT (Power Plant's midpoint, instead of a miniboss). Walk into the
 * generator room and the power cuts out: only a circle around you is lit, and
 * Sparkers come for you out of the dark. Find the generators (their lamps
 * blink red in the dark) and shoot each one to bring it back. When they're all
 * running the lights come on and the shutter out of the room opens.
 */
export class Blackout {
  state: 'waiting' | 'dark' | 'done' = 'waiting';
  private t = 0;
  private readonly gens: { box: Box; on: boolean; body: Phaser.GameObjects.Image; lamp: Phaser.GameObjects.Image }[] = [];
  private readonly shutterImgs: Phaser.GameObjects.Image[] = [];

  constructor(private h: BlackoutHost) {
    makeTextures(h.scene);
    for (const g of h.level.generators) {
      // Above the dark (depth 31), so its lamp is the thing you look for.
      const body = h.scene.add.image(g.x, g.y, 'generator').setOrigin(0.5, 1).setDepth(31);
      const lamp = h.scene.add.image(g.x, g.y - 17, 'gen_lamp_off').setOrigin(0.5, 0.5).setDepth(31.1);
      this.gens.push({ box: { x: g.x - 8, y: g.y - 22, w: 16, h: 22 }, on: false, body, lamp });
    }
    for (const { c, r } of h.level.shutters) this.shutterImgs.push(h.scene.add.image(c * TILE, r * TILE, 'shutter').setOrigin(0).setDepth(2));
  }

  private get screens(): string {
    return this.h.level.data.blackout ?? '';
  }

  step(): void {
    const p = this.h.player();
    this.t++;
    const id = this.h.level.screenIdAt(p.cx, p.cy);
    if (this.state === 'waiting' && p.alive && id && this.screens.includes(id)) {
      this.state = 'dark';
      this.t = 0;
      this.h.setDark(this.screens, true);
      this.h.say('BLACKOUT!', 70);
      sfx.zap();
      this.h.shake(4);
    }
    if (this.state === 'dark' && p.alive) {
      // Out of the dark they come, from just off the edge of the view.
      if (this.t % SWARM_EVERY === 60 && this.h.enemyCount() < SWARM_MAX) {
        const v = this.h.view();
        const side = Math.random() < 0.5 ? -1 : 1;
        const x = side < 0 ? v.x + 12 : v.x + 400;
        this.h.spawnEnemy(Math.random() < 0.5 ? 'sparker' : 'flyer', x, v.y + 70 + Math.random() * 40);
      }
    }
    // Lamps: off ones blink red, running ones glow green.
    for (const g of this.gens) {
      g.lamp.setTexture(g.on ? 'gen_lamp_on' : 'gen_lamp_off');
      g.lamp.setVisible(g.on || this.t % 40 < 26);
      g.lamp.setScale(g.on ? 1 + 0.1 * Math.sin(this.t * 0.2) : 1);
    }
  }

  /** A player shot: does it hit a generator that's still off? */
  shoot(b: Box): boolean {
    if (this.state !== 'dark') return false;
    const g = this.gens.find((k) => !k.on && overlaps(b, k.box));
    if (!g) return false;
    g.on = true;
    g.body.setTexture('generator_on');
    sfx.charge(2);
    this.h.burst(g.box.x + 8, g.box.y + 6, 'spark', 8);
    const left = this.gens.filter((k) => !k.on).length;
    if (left > 0) this.h.say(`${left} TO GO`, 50);
    else this.restore();
    return true;
  }

  /** Every generator is running: lights on, shutter up. */
  private restore(): void {
    this.state = 'done';
    this.h.setDark(this.screens, false);
    this.h.say('POWER RESTORED', 90);
    sfx.clear();
    this.h.shake(3);
    const { level, layer } = this.h;
    for (const { c, r } of level.shutters) {
      level.setTile(c, r, 0);
      layer.removeTileAt(c, r);
    }
    for (const img of this.shutterImgs) {
      this.h.scene.tweens.add({ targets: img, y: img.y - TILE * 4, alpha: 0, duration: 700, ease: 'Quad.easeIn' });
    }
  }

  /** After a death: generators you started stay running, but the lights are on until you walk back in. */
  reset(): void {
    if (this.state === 'done') return;
    this.state = 'waiting';
    this.h.setDark(this.screens, false);
  }
}

function makeTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('generator')) return;
  const K = 0x1a1428;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const r = (c: number, x: number, y: number, w: number, h: number) => g.fillStyle(c).fillRect(x, y, w, h);
  for (const on of [false, true]) {
    g.clear();
    // A squat generator: housing, cooling fins, a dial, a lamp socket on top.
    r(K, 1, 4, 14, 18);
    r(0x4a5268, 2, 5, 12, 16);
    r(0x7a86a0, 2, 5, 12, 1);
    r(0x2a3044, 2, 19, 12, 2);
    for (let y = 8; y < 18; y += 2) r(0x2a3044, 3, y, 5, 1);
    r(K, 9, 8, 5, 5);
    r(on ? 0x5ef0c8 : 0x3a4458, 10, 9, 3, 3);
    r(on ? 0xffffff : 0x55607a, 11, 9, 1, 2);
    r(K, 5, 0, 6, 5);
    r(0x8a98b0, 6, 1, 4, 3);
    r(K, 0, 20, 16, 2);
    g.generateTexture(on ? 'generator_on' : 'generator', 16, 22);
  }
  g.clear();
  r(0xff3030, 1, 0, 4, 6);
  r(0xff3030, 0, 1, 6, 4);
  r(0xffb0a0, 2, 1, 2, 2);
  g.generateTexture('gen_lamp_off', 6, 6);
  g.clear();
  r(0x5ef0c8, 1, 0, 4, 6);
  r(0x5ef0c8, 0, 1, 6, 4);
  r(0xe0fff8, 2, 1, 2, 2);
  g.generateTexture('gen_lamp_on', 6, 6);
  g.clear();
  // Shutter: steel slats with a hazard band.
  r(K, 0, 0, 16, 16);
  for (let y = 0; y < 16; y += 4) {
    r(0x6a7488, 1, y + 1, 14, 2);
    r(0x9aa4b8, 1, y + 1, 14, 1);
  }
  r(0xffc040, 1, 13, 3, 2);
  r(0xffc040, 8, 13, 3, 2);
  g.generateTexture('shutter', 16, 16);
  g.destroy();
}
