import Phaser from 'phaser';
import { TILE } from '../../constants';
import type { Point } from '../../level/Level';
import { sfx } from '../../sfx';
import type { GameScene } from '../../scenes/GameScene';
import { BOSS_ANCHORS } from './bossAnchors';
import { Boss, Room } from './Boss';
import { BossFx } from './bossFx';

type Mode = 'idle' | 'toss' | 'magnet' | 'pull' | 'barrage';

/** The ceiling pull: wind-up, then the warning, then the drops one after another. */
const PULL_BITE = 18;
const CHUNK = 12;

/** A spot the ceiling pull will bring junk down on. */
interface Drop {
  x: number;
  /** Where it lands (the floor or the top of whatever's under it). */
  land: number;
  /** The step its chunk breaks loose, and the step it lands. */
  at: number;
  hits: number;
}

/** A 12x12 lump of ceiling junk (rusted plate with a steel strap). */
function makeChunk(g: GameScene): void {
  if (g.textures.exists('junkchunk')) return;
  const t = g.textures.createCanvas('junkchunk', CHUNK, CHUNK)!;
  const c = t.getContext();
  const px = (x: number, y: number, w: number, h: number, col: string) => {
    c.fillStyle = col;
    c.fillRect(x, y, w, h);
  };
  px(1, 0, 10, 12, '#1a1428');
  px(0, 1, 12, 10, '#1a1428');
  px(1, 1, 10, 10, '#b8703a');
  px(1, 1, 10, 2, '#e8b07a');
  px(1, 8, 10, 3, '#7a4220');
  px(6, 1, 3, 10, '#8a8fa8');
  px(6, 1, 3, 1, '#fff1e0');
  px(6, 9, 3, 2, '#55607a');
  px(3, 5, 1, 1, '#4a2814');
  px(10, 4, 1, 1, '#4a2814');
  t.refresh();
}

/**
 * SCRAP (Scrapyard). Weak to Flame Burst.
 *  - toss: throws saw blades that land and roll along the floor (jump them)
 *  - magnet: drags you toward it while junk orbits in (walk away!)
 *  - pull: raises his fist and turns his magnet on the ceiling; dust and shadows mark
 *    where junk will come loose, then it rains down (stand in the gaps)
 *  - EX barrage: three saws at once (short, middle, long), then a hail of junk
 */
export class Scrap extends Boss {
  private mode: Mode = 'idle';
  private wait = 30;
  private last: Mode | null = null;
  private drops: Drop[] = [];

  private readonly fx: BossFx;
  /** The ceiling pull's warnings and its field, drawn over the room. */
  private readonly warn: Phaser.GameObjects.Graphics;
  private anim = 0;

  constructor(g: GameScene, at: Point, room: Room) {
    super(g, 'scrap', 32, 34, 'flame', at, room);
    this.fx = new BossFx(g);
    this.warn = g.add.graphics().setDepth(5.5);
    makeChunk(g);
  }

  /** The anchor table entry for a frame. */
  private anchor(frame: string) {
    return BOSS_ANCHORS[`scrap_${frame}`] ?? BOSS_ANCHORS.scrap_idle1;
  }

  /** A saw leaves his raised back fist. */
  private saw(vx: number, vy: number): void {
    const h = this.anchor('toss2').hand ?? [0, -30];
    this.g.spawnEnemyShot({ x: this.cx + h[0] * this.facing - 7, y: this.bottom + h[1] - 7, w: 14, h: 14, vx, vy, tex: 'sawshot', dmg: 4, spin: 0.4 * this.facing, rolls: true });
  }

  /** Where something dropped at x lands: the first solid tile under the ceiling. */
  private landAt(x: number): number {
    const c = Math.floor(x / TILE);
    for (let r = Math.floor(this.room.top / TILE); r * TILE < this.room.floor; r++) {
      if (this.g.level.isSolid(c, r)) return r * TILE;
    }
    return this.room.floor;
  }

  /** Spread the drops across the room (a bit of jitter, so they're never the same twice). */
  private planDrops(): void {
    const n = this.phase2 ? 6 : 5;
    const left = this.room.left + 16;
    const span = this.room.right - 16 - left;
    const first = PULL_BITE + (this.phase2 ? 26 : 32);
    const gap = this.phase2 ? 4 : 5;
    // Fall time for a chunk let go at 1.5 px/step under gravity 0.25 (vy t + t^2/8 = h).
    const order = Phaser.Utils.Array.Shuffle([...Array(n).keys()]);
    this.drops = order.map((slot, i) => {
      const x = Phaser.Math.Clamp(left + (span * (slot + 0.5)) / n + Phaser.Math.Between(-6, 6), this.room.left + 8, this.room.right - 8);
      const land = this.landAt(x);
      const h = land - this.room.top;
      const fall = Math.ceil(-6 + Math.sqrt(36 + 8 * h));
      return { x, land, at: first + i * gap, hits: first + i * gap + fall };
    });
  }

  /** How long the whole pull runs. */
  private pullEnd(): number {
    return Math.max(PULL_BITE + 60, ...this.drops.map((d) => d.hits)) + 16;
  }

  private setMode(m: Mode, wait = 0): void {
    this.mode = m;
    this.drops = [];
    this.t = 0;
    this.wait = this.quick(wait);
  }

  protected think(): void {
    const p = this.g.player;
    switch (this.mode) {
      case 'idle':
        this.vx = 0;
        this.facePlayer();
        this.physics();
        if (--this.wait <= 0) this.choose();
        break;

      case 'toss':
        this.physics();
        if (this.t === 14 || this.t === 40 || (this.phase2 && this.t === 66)) {
          this.facePlayer();
          this.saw(this.facing * 2, -3);
          sfx.thorn();
        }
        if (this.t >= (this.phase2 ? 90 : 64)) this.setMode('idle', 28);
        break;

      case 'barrage':
        this.physics();
        if (this.t === 20 || (this.phase2 && this.t === 70)) {
          this.facePlayer();
          for (const v of [1.1, 1.9, 2.8]) this.saw(this.facing * v, -3.4);
          sfx.thorn();
        }
        if (this.t === 44) {
          for (let i = 0; i < 3; i++) {
            const x = Phaser.Math.Between(this.room.left + 8, this.room.right - 16);
            this.g.spawnEnemyShot({ x, y: this.room.top - i * 24, w: 8, h: 8, vx: 0, vy: 1, tex: 'scrap', dmg: 3, gravity: true, spin: 0.2 });
          }
        }
        if (this.t >= (this.phase2 ? 110 : 80)) this.setMode('idle', 30);
        break;

      case 'magnet': {
        this.physics();
        this.facePlayer();
        const active = this.t > 16 && this.t < (this.phase2 ? 130 : 100);
        if (active) {
          // Pull toward Scrap; walking away at full speed still escapes.
          this.g.wind = Math.sign(this.cx - p.cx) * (this.phase2 ? 1.0 : 0.8);
          if (this.t % 4 === 0) this.g.windStreak(Math.sign(this.cx - p.cx));
        }
        if (this.t % 30 === 20 && active) {
          // Junk flies in from the edges toward Scrap.
          const fromLeft = this.cx > p.cx;
          const x = fromLeft ? this.room.left : this.room.right - 8;
          this.g.spawnEnemyShot({ x, y: this.room.floor - 40 - Math.random() * 40, w: 8, h: 8, vx: fromLeft ? 2.6 : -2.6, vy: 0, tex: 'scrap', dmg: 3, spin: 0.3, life: 140 });
        }
        if (this.t >= (this.phase2 ? 140 : 110)) this.setMode('idle', 28);
        break;
      }

      case 'pull': {
        this.vx = 0;
        this.physics();
        if (this.t === 1) sfx.charge(2);
        if (this.t === PULL_BITE) {
          this.planDrops();
          sfx.quake();
        }
        if (this.t > PULL_BITE && this.t < this.pullEnd() - 16 && this.t % 12 === 0) this.g.shake(2);
        for (const d of this.drops) {
          if (this.t === d.at) {
            this.g.spawnEnemyShot({ x: d.x - CHUNK / 2, y: this.room.top, w: CHUNK, h: CHUNK, vx: 0, vy: 1.5, tex: 'junkchunk', dmg: 4, gravity: true, spin: Phaser.Math.FloatBetween(-0.15, 0.15) });
            sfx.crumble();
          }
          if (this.t === d.hits) sfx.land();
        }
        if (this.t >= this.pullEnd()) {
          this.setMode('idle', 30);
        }
        break;
      }
    }
  }

  private choose(): void {
    const options: Mode[] = ['toss', 'magnet', 'pull', 'toss'];
    const pool = this.withEx(options, 'barrage').filter((m) => m !== this.last);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this.last = pick;
    this.facePlayer();
    this.setMode(pick);
  }

  protected introPose(): string {
    return 'toss';
  }

  /** True while the magnet is turned on the ceiling (fist up, field rising). */
  private pulling(): boolean {
    return this.mode === 'pull' && this.t >= PULL_BITE && this.t < this.pullEnd() - 14;
  }

  /** The frame for right now (see art/scrapArt.mjs for what each looks like). */
  private frame(): string {
    const m = this.mode;
    if (m === 'pull') return this.pulling() ? (this.t % 6 < 3 ? 'pull2' : 'pull3') : 'pull1';
    if (m === 'magnet' && this.t > 16) return this.t % 8 < 4 ? 'magnet1' : 'magnet2';
    if (m === 'toss' && this.t % 26 < 12) return this.t % 26 < 6 ? 'toss1' : 'toss2';
    if (m === 'barrage' && this.t >= 12 && this.t < 30) return this.t < 20 ? 'toss1' : 'toss2';
    // The junk jostles in his field.
    return `idle${1 + (Math.floor(this.anim / 8) % 4)}`;
  }

  step(): void {
    super.step();
    this.anim++;
  }

  render(): void {
    super.render();
    const frame = this.posing ? 'toss2' : this.frame();
    this.sprite.setTexture(`scrap_${frame}`);
    const a = this.anchor(frame);
    const visible = this.sprite.visible && this.state !== 'dying';
    const pulling = this.pulling();
    this.fx.update({
      x: Math.round(this.cx),
      bottom: Math.round(this.bottom),
      facing: this.facing,
      floor: this.room.floor,
      eye: a.eye,
      eyeColor: 0xffe14a,
      hot: a.up ? [a.up] : [],
      hotColor: 0xff6e6e,
      heat: pulling ? 1 : 0,
      visible,
    });
    this.drawWarnings(a.up, visible && this.mode === 'pull');
  }

  /** Dust trickling and darkening shadows where the junk will fall, and the field rising to the roof. */
  private drawWarnings(up: [number, number] | undefined, on: boolean): void {
    const g = this.warn;
    g.clear();
    if (!on) return;
    const t = this.t;
    this.drops.forEach((d, i) => {
      if (t < d.hits) {
        const k = Phaser.Math.Clamp((t - PULL_BITE) / (d.hits - PULL_BITE), 0, 1);
        g.fillStyle(0x000000, 0.35 + k * 0.4).fillEllipse(d.x, d.land - 1, 10 + k * 10, 4);
      }
      if (t < d.at) {
        for (let j = 0; j < 5; j++) {
          const y = this.room.top + ((t * 2 + j * 17 + i * 11) % 48);
          g.fillStyle(0xe8d4b0, 0.9).fillRect(d.x + (((j * 7 + i * 3) % 11) - 5), y, 2, 2);
        }
      }
    });
    if (up && this.pulling()) {
      const ux = this.cx + up[0] * this.facing;
      const uy = this.bottom + up[1];
      g.fillStyle(0xff5a5a, 0.07).fillRect(ux - 6, this.room.top, 12, uy - this.room.top);
      for (let i = 0; i < 4; i++) {
        const k = ((t * 2 + i * 18) % 72) / 72;
        const y = uy - k * (uy - this.room.top);
        g.lineStyle(1, 0xff6e6e, 0.8 * (1 - k * 0.6)).strokeEllipse(ux, y, 8 + k * 14, 3 + k * 4);
      }
    }
  }

  destroy(): void {
    this.fx.destroy();
    this.warn.destroy();
    super.destroy();
  }

  protected pose(): string {
    if (this.mode === 'magnet' && this.t > 16) return 'magnet';
    if (this.mode === 'toss' && this.t % 26 < 12) return 'toss';
    if (this.mode === 'barrage' && this.t >= 12 && this.t < 30) return 'toss';
    return 'idle';
  }
}
