import Phaser from 'phaser';
import { playMusic, playVoice, stopMusic } from '../audio';
import { STEP_MS, VIEW_H, VIEW_W } from '../constants';
import { Controls } from '../input';
import { pixelText } from '../pixelFont';
import { sfx } from '../sfx';
import { pixelateIn } from './cutscene';
import { ModeData, returnToGame } from './encounters';
import { makeHopArt } from './hopArt';

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
  /** Images reused every frame (water, riders, traffic). */
  private pool: Phaser.GameObjects.Image[] = [];
  private poolUsed = 0;
  /** Which way UltraGuy faces (radians; 0 = up), and splash / dust puffs. */
  private faceA = 0;
  private puffs: { x: number; y: number; t: number; water: boolean }[] = [];
  private shadow!: Phaser.GameObjects.Ellipse;
  private timerBar!: Phaser.GameObjects.Graphics;
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
    makeHopArt(this);
    this.cameras.main.setBackgroundColor('#0e2218');
    this.pool = [];
    this.poolUsed = 0;
    this.puffs = [];
    this.faceA = 0;
    this.bakeGround();
    // Jungle either side (over anything that drifts off the field's edge).
    this.add.image(0, 0, 'hop_jungle').setOrigin(0).setDepth(15);
    this.add.image(VIEW_W, 0, 'hop_jungle').setOrigin(1, 0).setFlipX(true).setDepth(15);
    const rim = this.add.graphics().setDepth(16);
    rim.fillStyle(0x06140c).fillRect(OX - 3, OY - 3, COLS * T + 6, 3).fillRect(OX - 3, OY + ROWS * T, COLS * T + 6, 3);
    rim.fillRect(OX - 3, OY, 3, ROWS * T).fillRect(OX + COLS * T, OY, 3, ROWS * T);
    rim.fillStyle(0x7ad06a).fillRect(OX - 1, OY - 1, COLS * T + 2, 1).fillRect(OX - 1, OY + ROWS * T, COLS * T + 2, 1);
    rim.fillRect(OX - 1, OY, 1, ROWS * T).fillRect(OX + COLS * T, OY, 1, ROWS * T);
    this.g = this.add.graphics().setDepth(7);
    this.timerBar = this.add.graphics().setDepth(20);
    this.toad = this.add.image(0, 0, `${this.host}_idle`).setScale(0.5).setDepth(5);
    this.shadow = this.add.ellipse(0, 0, 10, 4, 0x000000, 0.3).setDepth(5.9);
    this.hero = this.add.image(0, 0, 'hop_hero0').setDepth(6);
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
      this.faceA = Math.atan2(dx, -dy);
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
    if (!this.laneAt(row)?.river) this.puffs.push({ x: this.px, y: this.py + 4, t: 0, water: false });
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
    const wet = text === 'SPLASH!' || text === 'SWEPT AWAY!';
    this.puffs.push({ x: this.px, y: this.py, t: 0, water: wet });
    if (wet) sfx.splash();
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

  /** The ground that never moves (grass banks, the trail, the bramble goal row) into one texture. */
  private bakeGround(): void {
    const rt = this.add.renderTexture(OX, OY, COLS * T, ROWS * T).setOrigin(0).setDepth(0);
    for (let r = 0; r < ROWS; r++) {
      const l = this.laneAt(r);
      if (l?.river) continue;
      for (let c = 0; c < COLS; c++) {
        const key = r === 0 ? 'hop_bramble' : r === 5 || r === 11 ? `hop_grass${(c * 7 + r) % 3 === 0 ? 1 : 0}` : `hop_trail${(c * 5 + r * 3) % 3}`;
        rt.draw(key, c * T, r * T);
      }
    }
  }

  /** Show a pooled image this frame. */
  private put(key: string, x: number, y: number, o: { depth?: number; flipX?: boolean; rot?: number; alpha?: number; origin0?: boolean } = {}): void {
    let img = this.pool[this.poolUsed];
    if (!img) {
      img = this.add.image(0, 0, key);
      this.pool.push(img);
    }
    this.poolUsed++;
    img.setTexture(key).setOrigin(o.origin0 ? 0 : 0.5).setPosition(Math.round(x), Math.round(y)).setDepth(o.depth ?? 2).setFlipX(!!o.flipX).setRotation(o.rot ?? 0).setAlpha(o.alpha ?? 1).setVisible(true);
  }

  private draw(): void {
    const g = this.g;
    g.clear();
    this.poolUsed = 0;
    const f = this.frame;
    // Water (animated), the goal pads in the bramble row, and the foam along the banks.
    const wk = Math.floor(f / 10) % 4;
    for (const l of this.lanes) if (l.river) for (let c = 0; c < COLS; c++) this.put(`hop_water${(wk + c) % 4}`, OX + c * T, OY + l.row * T, { depth: 0.5, origin0: true });
    PAD_COLS.forEach((pc, i) => this.put(this.filled[i] ? 'hop_goalpad_done' : 'hop_goalpad', OX + pc * T, OY, { depth: 1, origin0: true }));
    for (const row of [1, 5]) {
      for (let x = 0; x < COLS * T; x += 2) {
        const y = OY + row * T - (row === 5 ? 1 : 0) + (Math.sin((x + f) / 6) > 0.5 ? 1 : 0);
        g.fillStyle(0xe6f8ff, 0.8).fillRect(OX + x, y, 2, 1);
      }
    }
    // Riders and traffic.
    const W = COLS * T + 64;
    for (const l of this.lanes) {
      const y = OY + l.row * T + 8;
      const right = l.speed > 0;
      for (const it of l.items) {
        const left = OX + ((((it.x % W) + W) % W) - 32);
        if (left > OX + COLS * T + 8 || left + it.len * T < OX - 8) continue;
        const sinkT = it.sinkT ?? 0;
        const sinking = it.kind === 'pad' && sinkT > 330;
        const under = it.kind === 'pad' && sinkT > 380;
        for (let k = 0; k < it.len; k++) {
          const x = left + k * T + 8;
          const part = it.len === 1 ? 'm' : k === 0 ? 'l' : k === it.len - 1 ? 'r' : 'm';
          switch (it.kind) {
            case 'log':
              this.put(`hop_log_${part}`, x, y + Math.sin((f + it.x) / 20) * 0.6, { depth: 1.5 });
              break;
            case 'pad':
              if (under) break;
              this.put(sinking ? 'hop_pad_sink' : 'hop_pad', x, y + Math.sin((f + k * 20 + it.x) / 24), { depth: 1.5, alpha: sinking && f % 8 < 3 ? 0.6 : 1 });
              break;
            case 'vine':
              this.put(`hop_vine_${part}`, x, y, { depth: 1.5 });
              break;
            case 'beetle':
              this.put(`hop_beetle${Math.floor(f / 6) % 2}`, x, y, { depth: 1.5, flipX: !right });
              break;
            case 'boar':
              this.put(`hop_boar${Math.floor(f / 4) % 2}`, x, y, { depth: 1.5, flipX: !right });
              break;
            case 'boulder':
              this.put('hop_boulder', x, y, { depth: 1.5, rot: (it.x / 8) % (Math.PI * 2) });
              break;
            case 'rollog':
              if (k === 0) this.put(`hop_rollog${Math.floor(Math.abs(it.x) / 4) % 2}`, x + 8, y, { depth: 1.5, flipX: !right });
              break;
          }
        }
        // Ripples behind anything floating.
        if (l.river && !under) g.fillStyle(0xbfe6ff, 0.5).fillRect(right ? left - 3 : left + it.len * T + 1, y - 1 + ((f >> 3) % 2), 2, 1);
      }
    }
    for (let i = this.poolUsed; i < this.pool.length; i++) this.pool[i].setVisible(false);
    // The host on his pad.
    const tpX = OX + PAD_COLS[this.toadPad] * T + 8;
    this.toad.setPosition(tpX, OY + 8 + Math.sin(f / 8) * 1);
    // The hero: hops in a little arc (with a shadow), facing where he's going.
    const lift = this.hop > 0 ? Math.sin((1 - this.hop / 7) * Math.PI) * 4 : 0;
    const shown = this.dead === 0 || f % 6 < 3;
    this.hero
      .setTexture(this.hop > 0 ? 'hop_hero1' : 'hop_hero0')
      .setRotation(this.faceA)
      .setPosition(OX + Math.round(this.px), OY + Math.round(this.py - lift))
      .setScale(1 + lift * 0.04)
      .setVisible(shown && !(this.dead > 0 && this.puffs.some((p) => p.water && p.t < 30)));
    this.shadow.setPosition(OX + this.px, OY + this.py + 5).setScale(1 - lift * 0.08).setVisible(shown && this.dead === 0);
    // Splashes and dust.
    for (const p of this.puffs) {
      p.t++;
      const k = p.t / 30;
      if (p.water) {
        g.lineStyle(2 - k * 1.5, 0xe6f8ff, 1 - k).strokeEllipse(OX + p.x, OY + p.y, 6 + k * 20, 3 + k * 8);
        for (let i = 0; i < 5; i++) g.fillStyle(0xbfe6ff, 1 - k).fillRect(OX + p.x + Math.cos(i * 1.3) * k * 12, OY + p.y - Math.sin(k * Math.PI) * 10 + i, 2, 2);
      } else for (let i = 0; i < 4; i++) g.fillStyle(0xc8a070, 0.7 * (1 - k * 2)).fillCircle(OX + p.x + (i - 1.5) * (3 + k * 10), OY + p.y, 2 - k);
    }
    this.puffs = this.puffs.filter((p) => p.t < (p.water ? 30 : 15));
    // Status: lives, pads, and the crossing timer as a bar.
    const secs = Math.ceil(this.timer / 60);
    this.hud.setText(`LIVES ${Math.max(0, this.lives)}   PADS ${this.filled.filter(Boolean).length}/3   TIME ${secs}`);
    const tb = this.timerBar;
    tb.clear();
    const k = Math.max(0, this.timer / CROSS_FRAMES);
    tb.fillStyle(0x06140c).fillRect(OX, 21, COLS * T, 5);
    tb.fillStyle(k < 0.25 && f % 20 < 10 ? 0xe8484e : k < 0.25 ? 0xf28c28 : 0x5aba5a).fillRect(OX + 1, 22, Math.round((COLS * T - 2) * k), 3);
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
