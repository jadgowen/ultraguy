import Phaser from 'phaser';
import { TILE, VIEW_H, VIEW_W } from '../constants';
import type { Player } from '../entities/Player';
import { Level } from '../level/Level';
import type { ThemeId } from '../level/Level';
import { sfx } from '../sfx';
import { makeFrames } from '../tileFx';
import type { ShotOptions } from './GameScene';

/** How fast the lift climbs (px per step), and how far below it the magma follows. */
const SPEED = 0.6;
const LAVA_GAP = 72;
const W = 64;

export interface ElevatorHost {
  scene: Phaser.Scene;
  level: Level;
  theme: ThemeId;
  player: () => Player;
  shake: (px: number) => void;
  spawnShot: (o: ShotOptions) => void;
  /** The lift reached the top: hand the camera back to the sections. */
  arrived: () => void;
  /** Big text for a moment (HOLD ON!). */
  say: (text: string) => void;
}

/**
 * THE MAGMA ELEVATOR (Caldera's midpoint, instead of a miniboss). Step on the
 * lift at the bottom of the shaft and it rumbles, then climbs. The camera
 * follows it up (no screen transitions on the way), magma rises right behind
 * it, the walls spit fire and rocks fall. Off at the top.
 */
export class Elevator {
  state: 'idle' | 'rumble' | 'rising' | 'done' = 'idle';
  top = 0;
  private x = 0;
  private t = 0;
  private lavaTop = 0;
  private readonly x0: number; // shaft interior, world px
  private readonly x1: number;
  private readonly platform: Phaser.GameObjects.Image;
  /** The magma: the stage's living lava (crest, churning body, heat glow), as in the boss room. */
  private readonly lava: { top: Phaser.GameObjects.TileSprite; body: Phaser.GameObjects.TileSprite; glow: Phaser.GameObjects.TileSprite };
  /** Frames since the scene started (the lava keeps moving while you wait). */
  private anim = 0;

  constructor(private h: ElevatorHost) {
    const e = h.level.elevator!;
    // The shaft's inside: open cells either side of the lift, halfway up (the
    // bottom has a side opening to walk in by).
    const row = Math.floor((e.start.y + e.stop.y) / 2 / TILE);
    let c0 = Math.floor(e.start.x / TILE);
    let c1 = c0;
    while (!h.level.isSolid(c0 - 1, row)) c0--;
    while (!h.level.isSolid(c1 + 1, row)) c1++;
    this.x0 = c0 * TILE;
    this.x1 = (c1 + 1) * TILE;
    makePlatform(h.scene);
    this.platform = h.scene.add.image(0, 0, 'lift_platform').setOrigin(0, 0).setDepth(3);
    makeFrames(h.scene, h.theme);
    const w = this.x1 - this.x0;
    const ts = (key: string, hh: number) => h.scene.add.tileSprite(this.x0, 0, w, hh, key).setOrigin(0, 0).setDepth(14);
    this.lava = {
      top: ts(`lava_top_${h.theme}_0`, TILE),
      body: ts(`lava_body_${h.theme}_0`, VIEW_H * 3),
      glow: ts(`lava_glow_${h.theme}`, TILE).setOrigin(0, 1).setDepth(14.1).setScale(1, 3).setBlendMode(Phaser.BlendModes.ADD),
    };
    this.reset();
  }

  /** The ride is on: the camera and the shaft are the elevator's. */
  get active(): boolean {
    return this.state === 'rumble' || this.state === 'rising';
  }

  reset(): void {
    const e = this.h.level.elevator!;
    this.state = 'idle';
    this.t = 0;
    this.top = e.start.y;
    this.x = e.start.x - W / 2;
    this.lavaTop = e.start.y + TILE * 3;
    this.draw();
  }

  /** Where the camera sits during the ride. */
  get camX(): number {
    return Math.round((this.x0 + this.x1) / 2 - VIEW_W / 2);
  }
  get camY(): number {
    return Math.round(this.top - VIEW_H + 100);
  }

  private standing(p: Player): boolean {
    return p.alive && Math.abs(p.bottom - this.top) <= 2 && p.x + p.w > this.x + 2 && p.x < this.x + W - 2;
  }

  /** Player physics: land on the lift (like a moving cloud). */
  landOn(p: Player, prevBottom: number): boolean {
    if (p.vy < 0 || prevBottom > this.top + 1.5 || p.bottom < this.top) return false;
    if (p.x + p.w <= this.x + 1 || p.x >= this.x + W - 1) return false;
    p.y = this.top - p.h;
    return true;
  }

  step(): void {
    const p = this.h.player();
    const e = this.h.level.elevator!;
    this.t++;
    if (this.state === 'idle' && this.standing(p) && p.grounded) {
      this.state = 'rumble';
      this.t = 0;
      this.h.say('HOLD ON!');
      sfx.crush();
    }
    if (this.state === 'rumble') {
      if (this.t % 6 === 0) this.h.shake(2);
      if (this.t >= 45) {
        this.state = 'rising';
        this.t = 0;
      }
    } else if (this.state === 'rising') {
      const carried = this.standing(p);
      const dy = Math.min(SPEED, this.top - e.stop.y);
      this.top -= dy;
      if (carried) p.y -= dy;
      // The magma follows right behind.
      this.lavaTop = Math.min(this.lavaTop, this.top + LAVA_GAP);
      if (this.t % 40 === 0) sfx.flame();
      this.hazards();
      if (this.top <= e.stop.y) {
        this.top = e.stop.y;
        this.state = 'done';
        this.h.shake(4);
        sfx.land();
        this.h.arrived();
      }
    }
    // Into the magma: that's it.
    if ((this.active || this.state === 'done') && p.alive && p.bottom > this.lavaTop + 4 && p.cx > this.x0 && p.cx < this.x1) p.die(true);
    this.draw();
  }

  /** Fire from vents in the walls, rocks shaken loose from above. */
  private hazards(): void {
    const half = this.t > 420;
    if (this.t % (half ? 44 : 60) === 20) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = side < 0 ? this.x0 : this.x1 - 8;
      const y = this.top - 30 - Math.random() * 90;
      this.h.spawnShot({ x, y, w: 8, h: 8, vx: -side * (1.6 + Math.random() * 0.8), vy: -2.2, tex: 'fireball', dmg: 3, gravity: true });
      sfx.flame();
    }
    if (this.t % (half ? 70 : 95) === 50) {
      const x = this.x0 + 8 + Math.random() * (this.x1 - this.x0 - 24);
      this.h.spawnShot({ x, y: this.top - VIEW_H + 40, w: 10, h: 10, vx: 0, vy: 0.5, tex: 'scrap', dmg: 4, gravity: true, spin: 0.2 });
    }
  }

  private draw(): void {
    this.platform.setPosition(Math.round(this.x), Math.round(this.top));
    const L = this.lava;
    const y = Math.round(this.lavaTop);
    const f = Math.floor(++this.anim / 5) % 8;
    const drift = (this.anim * 0.4) % TILE;
    L.top.setTexture(`lava_top_${this.h.theme}_${f}`).setY(y - 2);
    L.body.setTexture(`lava_body_${this.h.theme}_${f}`).setY(y - 2 + TILE);
    L.top.tilePositionX = L.body.tilePositionX = drift;
    L.glow.setY(y).setAlpha(0.6 + Math.sin(this.anim * 0.1) * 0.25);
    const on = this.state !== 'idle';
    for (const o of [L.top, L.body, L.glow]) o.setVisible(on);
  }
}

/** The lift: a steel grate with hazard stripes and running lights, on a piston. */
function makePlatform(scene: Phaser.Scene): void {
  if (scene.textures.exists('lift_platform')) return;
  const tex = scene.textures.createCanvas('lift_platform', W, 14)!;
  const ctx = tex.getContext();
  const px = (c: string, x: number, y: number, w = 1, h = 1) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  px('#1a1428', 0, 0, W, 10);
  px('#8a8fa8', 1, 1, W - 2, 2);
  px('#c8ccd8', 1, 1, W - 2, 1);
  for (let x = 1; x < W - 1; x += 8) {
    px('#ffc040', x, 3, 4, 4);
    px('#1a1428', x + 4, 3, 4, 4);
  }
  px('#55607a', 1, 7, W - 2, 2);
  for (const x of [6, W - 9]) px('#ff5050', x, 4, 2, 2);
  // Piston under the middle.
  px('#1a1428', W / 2 - 5, 10, 10, 4);
  px('#8a8fa8', W / 2 - 4, 10, 8, 4);
  px('#c8ccd8', W / 2 - 4, 10, 2, 4);
  tex.refresh();
}
