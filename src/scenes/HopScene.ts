import Phaser from 'phaser';
import { playMusic, playVoice, stopMusic } from '../audio';
import { STEP_MS, VIEW_H, VIEW_W } from '../constants';
import { Controls } from '../input';
import { pixelText } from '../pixelFont';
import { sfx } from '../sfx';
import { pixelateIn } from './cutscene';
import { ModeData, returnToGame } from './encounters';

/**
 * BRIAR TOAD'S THICKET: a lane-crossing hop. Hop tile by tile from the bottom
 * bank, past five trail lanes of critters, across four river lanes (ride the
 * logs and lily pads; some pads sink for a moment), into the three lily pads
 * at the top. Fill all three to win. The toad sits on one pad at a time: don't
 * land on him (he never hops onto the pad you're lined up with). Five lives,
 * and a timer for each crossing.
 */

const T = 16;
const COLS = 16;
const ROWS = 12;
const OX = Math.round((VIEW_W - COLS * T) / 2);
const OY = 30;
const PAD_COLS = [2, 7, 12];
const LIVES = 5;
const CROSS_FRAMES = 60 * 32;

type Kind = 'log' | 'pad' | 'beetle' | 'boulder' | 'vine' | 'boar' | 'rollog';

interface Lane {
  row: number;
  speed: number;
  river: boolean;
  items: { x: number; len: number; kind: Kind; sinkT?: number }[];
}

/** Lanes, top to bottom: river 1-4, safe 5, trail 6-10, start 11. */
function makeLanes(): Lane[] {
  const lane = (row: number, speed: number, river: boolean, kind: Kind, len: number, gap: number, offset = 0): Lane => {
    const items = [];
    for (let x = offset; x < COLS * T + 64; x += (len + gap) * T) items.push({ x, len, kind, sinkT: kind === 'pad' ? Math.floor(Math.random() * 400) : undefined });
    return { row, speed, river, items };
  };
  return [
    lane(1, 0.4, true, 'log', 6, 2),
    lane(2, -0.55, true, 'pad', 3, 2, 20),
    lane(3, 1.1, true, 'log', 3, 3, 40),
    lane(4, -0.8, true, 'pad', 2, 2),
    lane(6, -1.3, false, 'beetle', 1, 4),
    lane(7, 0.8, false, 'boulder', 1, 3, 30),
    lane(8, -0.6, false, 'vine', 3, 4, 10),
    lane(9, -1.8, false, 'boar', 1, 6, 50),
    lane(10, 1.0, false, 'rollog', 2, 4),
  ];
}

export class HopScene extends Phaser.Scene {
  private controls!: Controls;
  private mode!: ModeData;
  private acc = 0;
  private frame = 0;
  private lanes: Lane[] = [];
  private px = 0;
  private py = 0;
  private hop = 0;
  private fromX = 0;
  private fromY = 0;
  private toX = 0;
  private toY = 0;
  private lives = LIVES;
  private filled: boolean[] = [false, false, false];
  private toadPad = 1;
  private toadT = 0;
  private timer = CROSS_FRAMES;
  private dead = 0;
  private result: 'win' | 'lose' | null = null;
  private overT = 0;
  private started = 0;
  private g!: Phaser.GameObjects.Graphics;
  private hero!: Phaser.GameObjects.Image;
  private toad!: Phaser.GameObjects.Image;
  private banner!: ReturnType<typeof pixelText>;
  private hud!: ReturnType<typeof pixelText>;

  constructor() {
    super('hop');
  }

  /** Who sits on the pads: Mantis in his Boss Hall rematch, otherwise the Briar Toad. */
  private host: 'mantis' | 'toad' = 'mantis';

  create(data: ModeData): void {
    this.mode = { stage: data?.stage ?? 'canopy', ret: data?.ret ?? { kind: 'vault', step: 0 } };
    this.host = this.mode.ret.kind === 'vault' ? 'mantis' : 'toad';
    this.controls = new Controls(this);
    Object.assign(this, { acc: 0, frame: 0, lives: LIVES, filled: [false, false, false], toadPad: 1, toadT: 0, timer: CROSS_FRAMES, dead: 0, result: null, overT: 0, started: 0 });
    this.lanes = makeLanes();
    makeHopTextures(this);
    this.cameras.main.setBackgroundColor('#0e2218');
    this.g = this.add.graphics();
    this.toad = this.add.image(0, 0, `${this.host}_idle`).setScale(0.5).setDepth(5);
    this.hero = this.add.image(0, 0, 'hop_hero').setDepth(6);
    this.banner = pixelText(this, VIEW_W / 2, VIEW_H / 2 - 20, 'FILL ALL THREE LILY PADS!', { fontSize: '16px', color: '#fff1e0', stroke: '#000000' }).setOrigin(0.5).setDepth(20);
    this.hud = pixelText(this, OX, 8, '', { color: '#fff1e0', stroke: '#000000' }).setDepth(20);
    pixelText(this, OX, VIEW_H - 14, 'ARROWS HOP', { color: '#8a8fa8', stroke: '#000000' }).setDepth(20);
    this.respawnHero();
    stopMusic();
    pixelateIn(this, 800);
    this.time.delayedCall(400, () => playMusic(this, 'hop'));
  }

  update(_t: number, delta: number): void {
    this.acc += Math.min(delta, 100);
    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS;
      this.step();
    }
    this.draw();
  }

  private respawnHero(): void {
    this.px = 7 * T + T / 2;
    this.py = 11 * T + T / 2;
    this.hop = 0;
    this.timer = CROSS_FRAMES;
  }

  private laneAt(row: number): Lane | undefined {
    return this.lanes.find((l) => l.row === row);
  }

  /** What's under the hero in a lane (span check in pixels, with wrap). */
  private itemUnder(l: Lane, x: number) {
    const W = COLS * T + 64;
    for (const it of l.items) {
      const left = ((it.x % W) + W) % W - 32;
      if (x >= left + 2 && x <= left + it.len * T - 2) return it;
    }
    return null;
  }

  private step(): void {
    this.frame++;
    this.controls.poll();
    if (this.result) {
      if (++this.overT === 180) returnToGame(this, this.mode, this.result === 'win');
      return;
    }
    if (++this.started < 90) return;
    if (this.started === 90) this.banner.setText('');
    // Lanes move.
    for (const l of this.lanes) {
      for (const it of l.items) {
        it.x += l.speed;
        if (it.kind === 'pad' && it.sinkT !== undefined) it.sinkT = (it.sinkT + 1) % 420;
      }
    }
    // The toad moves between empty pads now and then.
    if (++this.toadT > 220) {
      this.toadT = 0;
      // He won't jump onto the pad you're lined up with (that would be cheap).
      const yourCol = Math.floor(this.px / T);
      // He can sit on filled pads too, so the last empty pad always opens up.
      const free = [0, 1, 2].filter((i) => i !== this.toadPad && PAD_COLS[i] !== yourCol);
      if (free.length) this.toadPad = free[Math.floor(Math.random() * free.length)];
    }
    if (this.dead > 0) {
      if (--this.dead === 0) {
        if (this.lives <= 0) this.finish(false);
        else this.respawnHero();
      }
      return;
    }
    if (--this.timer <= 0) {
      this.die('TIME UP!');
      return;
    }
    // Hopping.
    const c = this.controls;
    if (this.hop > 0) {
      this.hop--;
      const k = 1 - this.hop / 7;
      this.px = Phaser.Math.Linear(this.fromX, this.toX, k);
      this.py = Phaser.Math.Linear(this.fromY, this.toY, k);
      if (this.hop === 0) this.land();
      return;
    }
    let dx = 0;
    let dy = 0;
    if (c.justPressed('up')) dy = -1;
    else if (c.justPressed('down')) dy = 1;
    else if (c.justPressed('left')) dx = -1;
    else if (c.justPressed('right')) dx = 1;
    if (dx || dy) {
      const nx = this.px + dx * T;
      const ny = this.py + dy * T;
      if (ny > 11 * T + T || ny < 0 || nx < T / 2 || nx > COLS * T - T / 2) return;
      this.fromX = this.px;
      this.fromY = this.py;
      this.toX = nx;
      this.toY = ny;
      this.hop = 7;
      sfx.jump();
      return;
    }
    // Riding / hazards while standing.
    const row = Math.floor(this.py / T);
    const l = this.laneAt(row);
    if (l?.river) {
      const it = this.itemUnder(l, this.px);
      if (!it || (it.kind === 'pad' && (it.sinkT ?? 0) > 380)) this.die('SPLASH!');
      else {
        this.px += l.speed;
        if (this.px < 4 || this.px > COLS * T - 4) this.die('SWEPT AWAY!');
      }
    } else if (l && this.itemUnder(l, this.px)) this.die('OUCH!');
  }

  private land(): void {
    const row = Math.floor(this.py / T);
    if (row === 0) {
      // The goal row: a free pad, the toad, or thorns.
      const col = Math.floor(this.px / T);
      const pad = PAD_COLS.findIndex((pc) => Math.abs(pc - col) <= 0);
      if (pad < 0) return this.die('THORNS!');
      if (pad === this.toadPad) return this.die(this.host === 'mantis' ? 'SNIP!' : 'GULP!');
      if (this.filled[pad]) return this.die('TAKEN!');
      this.filled[pad] = true;
      sfx.pickup();
      if (this.filled.every(Boolean)) this.finish(true);
      else {
        this.banner.setText(`${this.filled.filter(Boolean).length} / 3`);
        this.time.delayedCall(900, () => !this.result && this.banner.setText(''));
        this.respawnHero();
      }
    }
  }

  private die(text: string): void {
    this.lives--;
    this.dead = 70;
    this.banner.setText(text);
    this.time.delayedCall(1100, () => !this.result && this.banner.setText(''));
    if (text === 'SPLASH!' || text === 'SWEPT AWAY!') sfx.splash();
    else sfx.hurt();
    this.cameras.main.shake(120, 0.008);
  }

  private finish(won: boolean): void {
    this.result = won ? 'win' : 'lose';
    this.banner.setText(won ? 'YOU MADE IT!' : 'GAME OVER');
    stopMusic();
    if (won) {
      sfx.victory();
      playVoice(this, `${this.host}_loses`);
    } else playVoice(this, `${this.host}_wins`);
  }

  private draw(): void {
    const g = this.g;
    g.clear();
    const f = this.frame;
    for (let r = 0; r < ROWS; r++) {
      const y = OY + r * T;
      const l = this.laneAt(r);
      if (r === 0) {
        g.fillStyle(0x1e4a2a).fillRect(OX, y, COLS * T, T);
        for (let c = 0; c < COLS; c++) if (!PAD_COLS.includes(c)) g.fillStyle(0x2e7a34).fillRect(OX + c * T + 2, y + 2, 12, 12).fillStyle(0xb08a4a).fillRect(OX + c * T + 7, y + 3, 2, 2);
      } else if (l?.river) {
        g.fillStyle(0x1a5a8a).fillRect(OX, y, COLS * T, T);
        g.fillStyle(0x3a8ab8);
        for (let x = (f * 0.5 * Math.sign(l.speed)) % 24; x < COLS * T; x += 24) g.fillRect(OX + ((x + 240) % (COLS * T)), y + 6, 6, 1);
      } else if (r === 5 || r === 11) {
        g.fillStyle(0x3a7a3a).fillRect(OX, y, COLS * T, T);
        for (let c = 0; c < COLS; c += 2) g.fillStyle(0x4ca04a).fillRect(OX + c * T + 4, y + 4, 2, 3);
      } else {
        g.fillStyle(0x6a4a30).fillRect(OX, y, COLS * T, T);
        g.fillStyle(0x5a3e28).fillRect(OX, y + T - 1, COLS * T, 1);
      }
    }
    // Goal pads.
    PAD_COLS.forEach((pc, i) => {
      const x = OX + pc * T;
      g.fillStyle(0x4ca04a).fillCircle(x + 8, OY + 8, 7);
      g.fillStyle(0x0e2218).fillTriangle(x + 8, OY + 8, x + 15, OY + 4, x + 15, OY + 12);
      if (this.filled[i]) g.fillStyle(0xf28c28).fillCircle(x + 8, OY + 8, 4);
    });
    const W = COLS * T + 64;
    for (const l of this.lanes) {
      const y = OY + l.row * T;
      for (const it of l.items) {
        const left = OX + ((((it.x % W) + W) % W) - 32);
        const w = it.len * T;
        const clipL = Math.max(left, OX);
        const clipR = Math.min(left + w, OX + COLS * T);
        if (clipR <= clipL) continue;
        const sinking = it.kind === 'pad' && (it.sinkT ?? 0) > 330;
        const colors: Record<Kind, [number, number]> = {
          log: [0x7a5a3a, 0x9a7a4a], pad: [0x2e7a34, 0x6cc04a], beetle: [0x1a1428, 0xd83a4a], boulder: [0x55607a, 0x8a8fa8],
          vine: [0x2e7a34, 0xb08a4a], boar: [0x5a3e2a, 0xc8a070], rollog: [0x5a3e2a, 0x9a7a4a],
        };
        const [base, hi] = colors[it.kind];
        if (sinking && f % 8 < 4) continue;
        if (it.kind === 'pad') {
          for (let k = 0; k < it.len; k++) {
            const cx = left + k * T + 8;
            if (cx < OX + 4 || cx > OX + COLS * T - 4) continue;
            g.fillStyle(sinking ? 0x1e5a2a : base).fillCircle(cx, y + 8, 7);
            g.fillStyle(hi).fillCircle(cx - 2, y + 6, 2);
          }
          continue;
        }
        g.fillStyle(0x1a1428).fillRect(clipL, y + 2, clipR - clipL, T - 4);
        g.fillStyle(base).fillRect(clipL + 1, y + 3, clipR - clipL - 2, T - 6);
        g.fillStyle(hi).fillRect(clipL + 1, y + 3, clipR - clipL - 2, 2);
        if (it.kind === 'beetle' || it.kind === 'boar') g.fillStyle(0xfff1e0).fillRect(l.speed > 0 ? clipR - 4 : clipL + 2, y + 6, 2, 2);
      }
    }
    // The toad on his pad.
    const tpX = OX + PAD_COLS[this.toadPad] * T + 8;
    this.toad.setPosition(tpX, OY + 8 + Math.sin(f / 8) * 1);
    // The hero, hopping (a little arc).
    const lift = this.hop > 0 ? Math.sin((1 - this.hop / 7) * Math.PI) * 3 : 0;
    this.hero.setPosition(OX + this.px, OY + this.py - lift).setVisible(this.dead === 0 || f % 6 < 3);
    const secs = Math.ceil(this.timer / 60);
    this.hud.setText(`LIVES ${Math.max(0, this.lives)}   PADS ${this.filled.filter(Boolean).length}/3   TIME ${secs}`);
  }
}

export function makeHopTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('hop_hero')) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // UltraGuy from above: helmet, visor, shoulders.
  g.fillStyle(0x1a1428).fillCircle(7, 7, 7);
  g.fillStyle(0xb85a1a).fillCircle(7, 8, 6);
  g.fillStyle(0xf28c28).fillCircle(7, 7, 5);
  g.fillStyle(0xffc070).fillRect(4, 3, 4, 2);
  g.fillStyle(0x1a1428).fillRect(4, 1, 6, 3);
  g.fillStyle(0x5ef0c8).fillRect(5, 1, 4, 2);
  g.generateTexture('hop_hero', 14, 14);
  g.destroy();
}
