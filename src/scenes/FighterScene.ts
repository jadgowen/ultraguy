import Phaser from 'phaser';
import { playMusic, playVoice, stopMusic } from '../audio';
import { STEP_MS, VIEW_H, VIEW_W } from '../constants';
import { heroFrames } from '../heroSprites';
import { Controls } from '../input';
import { pixelText } from '../pixelFont';
import { sfx } from '../sfx';
import { heroTexture } from '../weapons';
import { pixelateIn } from './cutscene';
import { ModeData, returnToGame } from './encounters';

/**
 * SHADE: a one-on-one fighting duel, best of three rounds.
 *
 *   LEFT/RIGHT walk (hold back to block; down-back blocks low)
 *   UP jump, DOWN crouch
 *   FIRE jab, JUMP kick (crouching: low jab / sweep; in the air: jump-in)
 *   ULTRA SHOT   down, down-forward, forward + FIRE
 *   RISING UPPER forward, down, down-forward + FIRE (invincible at the start)
 */

const FLOOR = 206;
const SCALE = 2;
const LEFT_WALL = 24;
const RIGHT_WALL = VIEW_W - 24;
const ROUND_FRAMES = 60 * 60;
const MAX_HP = 100;

type Height = 'high' | 'mid' | 'low';
type MoveId = 'jab' | 'kick' | 'cjab' | 'sweep' | 'air' | 'shot' | 'upper';

interface Move {
  frame: string;
  startup: number;
  active: number;
  recovery: number;
  dmg: number;
  reach: number;
  height: Height;
  knockdown?: boolean;
  hitstun: number;
}

const MOVES: Record<MoveId, Move> = {
  jab: { frame: 'punch', startup: 4, active: 3, recovery: 8, dmg: 5, reach: 30, height: 'mid', hitstun: 14 },
  kick: { frame: 'kick', startup: 7, active: 4, recovery: 14, dmg: 9, reach: 38, height: 'mid', hitstun: 18 },
  cjab: { frame: 'crouchPunch', startup: 4, active: 3, recovery: 8, dmg: 4, reach: 30, height: 'low', hitstun: 12 },
  sweep: { frame: 'kick', startup: 8, active: 4, recovery: 20, dmg: 8, reach: 40, height: 'low', knockdown: true, hitstun: 20 },
  air: { frame: 'kick', startup: 4, active: 12, recovery: 0, dmg: 8, reach: 30, height: 'high', hitstun: 16 },
  shot: { frame: 'idle_s', startup: 12, active: 1, recovery: 28, dmg: 0, reach: 0, height: 'mid', hitstun: 0 },
  upper: { frame: 'jump', startup: 2, active: 14, recovery: 22, dmg: 14, reach: 30, height: 'mid', knockdown: true, hitstun: 24 },
};

type State = 'idle' | 'walk' | 'crouch' | 'jump' | 'attack' | 'block' | 'hit' | 'down' | 'getup' | 'win' | 'lose';

interface Fighter {
  name: string;
  tex: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  hp: number;
  state: State;
  t: number;
  move: MoveId | null;
  hitDone: boolean;
  crouching: boolean;
  /** Stun / recovery left (hit, block, down). */
  stun: number;
  push: number;
  wins: number;
  sprite: Phaser.GameObjects.Image;
  /** Input history for motions: numpad directions relative to facing. */
  dirs: { d: number; f: number }[];
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  owner: Fighter;
  sprite: Phaser.GameObjects.Image;
}

export class FighterScene extends Phaser.Scene {
  private controls!: Controls;
  private mode!: ModeData;
  private acc = 0;
  private frame = 0;
  private you!: Fighter;
  private shade!: Fighter;
  private shots: Projectile[] = [];
  private round = 1;
  private clock = ROUND_FRAMES;
  private phase: 'intro' | 'fight' | 'ko' | 'over' = 'intro';
  private phaseT = 0;
  private aiT = 0;
  private hud!: Phaser.GameObjects.Graphics;
  private banner!: ReturnType<typeof pixelText>;
  private timeText!: ReturnType<typeof pixelText>;
  private frames!: Record<string, number>;

  constructor() {
    super('fighter');
  }

  create(data: ModeData): void {
    this.mode = { stage: data?.stage ?? 'finale', ret: data?.ret ?? { kind: 'boss', step: 1 } };
    this.controls = new Controls(this);
    this.frames = heroFrames(this);
    Object.assign(this, { acc: 0, frame: 0, shots: [], round: 1, clock: ROUND_FRAMES, phase: 'intro', phaseT: 0, aiT: 0 });
    this.cameras.main.setBackgroundColor('#0c0612');
    [0, 1, 2].forEach((l) => this.add.tileSprite(0, -16, VIEW_W, VIEW_H, `bgl_fortress_${l}`).setOrigin(0).setDepth(-20 + l));
    const g = this.add.graphics().setDepth(-5);
    g.fillStyle(0x1e1230).fillRect(0, FLOOR, VIEW_W, VIEW_H - FLOOR);
    g.fillStyle(0x4a2a6a).fillRect(0, FLOOR, VIEW_W, 2);
    for (let x = 0; x < VIEW_W; x += 32) g.fillStyle(0x2a1a40).fillRect(x, FLOOR + 6, 30, 1);
    g.fillStyle(0x8a1a2a).fillRect(VIEW_W / 2 - 60, FLOOR + 10, 120, 18);
    g.fillStyle(0xd83a4a).fillRect(VIEW_W / 2 - 60, FLOOR + 10, 120, 2);
    const mk = (name: string, tex: string, x: number, facing: 1 | -1): Fighter => ({
      name, tex, x, y: 0, vx: 0, vy: 0, facing, hp: MAX_HP, state: 'idle', t: 0, move: null, hitDone: false, crouching: false, stun: 0, push: 0, wins: 0, dirs: [],
      sprite: this.add.image(x, FLOOR, tex, this.frames.idle).setOrigin(0.5, 1).setScale(SCALE).setDepth(5),
    });
    this.you = mk('ULTRAGUY', heroTexture('buster'), 130, 1);
    this.shade = mk('SHADE', 'hero_shade', VIEW_W - 130, -1);
    this.hud = this.add.graphics().setDepth(40);
    this.banner = pixelText(this, VIEW_W / 2, 90, '', { fontSize: '24px', color: '#fff1e0', stroke: '#000000' }).setOrigin(0.5).setDepth(41);
    this.timeText = pixelText(this, VIEW_W / 2, 8, '60', { fontSize: '16px', color: '#ffe14a', stroke: '#000000' }).setOrigin(0.5, 0).setDepth(41);
    pixelText(this, 8, 22, 'ULTRAGUY', { color: '#f28c28', stroke: '#000000' }).setDepth(41);
    pixelText(this, VIEW_W - 8, 22, 'SHADE', { color: '#ff3050', stroke: '#000000' }).setOrigin(1, 0).setDepth(41);
    pixelText(this, 8, VIEW_H - 12, 'FIRE JAB  JUMP KICK  UP JUMP  BACK BLOCK  v>+FIRE SHOT  >v>+FIRE UPPER', { color: '#8a8fa8', stroke: '#000000' }).setDepth(41);
    stopMusic();
    pixelateIn(this, 800);
    this.time.delayedCall(400, () => playMusic(this, 'fighter'));
    this.startRound();
  }

  private startRound(): void {
    this.phase = 'intro';
    this.phaseT = 0;
    this.clock = ROUND_FRAMES;
    for (const [f, x, facing] of [[this.you, 130, 1], [this.shade, VIEW_W - 130, -1]] as const) {
      Object.assign(f, { x, y: 0, vx: 0, vy: 0, facing, hp: MAX_HP, state: 'idle', t: 0, move: null, stun: 0, push: 0, dirs: [] });
    }
    for (const s of this.shots) s.sprite.destroy();
    this.shots = [];
    const finalRound = this.you.wins === 1 && this.shade.wins === 1;
    this.banner.setText(finalRound ? 'FINAL ROUND' : `ROUND ${this.round}`);
    playVoice(this, finalRound ? 'fight_final' : this.round === 1 ? 'fight_round1' : 'fight_round2');
  }

  update(_t: number, delta: number): void {
    this.acc += Math.min(delta, 100);
    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS;
      this.step();
    }
    this.draw();
  }

  // --- the loop ------------------------------------------------------------------------

  private step(): void {
    this.frame++;
    this.controls.poll();
    this.phaseT++;
    if (this.phase === 'intro') {
      if (this.phaseT === 80) {
        this.banner.setText('FIGHT!');
        playVoice(this, 'fight_go');
      }
      if (this.phaseT === 120) {
        this.banner.setText('');
        this.phase = 'fight';
      }
      this.face();
      return;
    }
    if (this.phase === 'over') {
      if (this.phaseT === 240) returnToGame(this, this.mode, this.you.wins >= 2);
      this.moveFighter(this.you);
      this.moveFighter(this.shade);
      return;
    }
    if (this.phase === 'ko') {
      this.moveFighter(this.you);
      this.moveFighter(this.shade);
      if (this.phaseT === 150) this.nextRound();
      return;
    }
    if (--this.clock <= 0) {
      this.endRound(this.you.hp >= this.shade.hp ? this.you : this.shade, true);
      return;
    }
    this.face();
    this.inputYou();
    this.thinkShade();
    for (const f of [this.you, this.shade]) {
      this.stepFighter(f);
      this.moveFighter(f);
    }
    this.stepShots();
    this.separate();
  }

  /** Both always face each other (while on the ground and free). */
  private face(): void {
    for (const [a, b] of [[this.you, this.shade], [this.shade, this.you]] as const) {
      if (a.y === 0 && (a.state === 'idle' || a.state === 'walk' || a.state === 'crouch')) a.facing = b.x > a.x ? 1 : -1;
    }
  }

  /** Numpad direction (6 = forward) from the stick, relative to facing. */
  private dir(f: Fighter, up: boolean, down: boolean, left: boolean, right: boolean): number {
    const fwd = f.facing > 0 ? right : left;
    const back = f.facing > 0 ? left : right;
    const h = fwd ? 1 : back ? -1 : 0;
    const v = up ? 1 : down ? -1 : 0;
    return 5 + h + v * 3;
  }

  private motion(f: Fighter, seq: number[]): boolean {
    // Look for the sequence, in order, within the last 18 steps.
    const recent = f.dirs.filter((d) => this.frame - d.f <= 18).map((d) => d.d);
    let i = 0;
    for (const d of recent) if (d === seq[i]) i++;
    return i >= seq.length;
  }

  private inputYou(): void {
    const c = this.controls;
    const f = this.you;
    const d = this.dir(f, c.isDown('up'), c.isDown('down'), c.isDown('left'), c.isDown('right'));
    if (!f.dirs.length || f.dirs[f.dirs.length - 1].d !== d) f.dirs.push({ d, f: this.frame });
    if (f.dirs.length > 12) f.dirs.shift();
    this.control(f, d, c.justPressed('fire'), c.justPressed('jump'));
  }

  /** Shared by you and the AI: what to do with a direction and two buttons this step. */
  private control(f: Fighter, d: number, punch: boolean, kick: boolean): void {
    const free = f.state === 'idle' || f.state === 'walk' || f.state === 'crouch' || f.state === 'block';
    if (f.state === 'jump' && f.move === null && (punch || kick)) return this.attack(f, 'air');
    if (!free) return;
    if (punch && this.motion(f, [2, 3, 6]) && !this.shots.some((s) => s.owner === f)) return this.attack(f, 'shot');
    if (punch && this.motion(f, [6, 2, 3])) return this.attack(f, 'upper');
    const crouch = d === 1 || d === 2 || d === 3;
    if (punch) return this.attack(f, crouch ? 'cjab' : 'jab');
    if (kick) return this.attack(f, crouch ? 'sweep' : 'kick');
    if (d >= 7) {
      f.state = 'jump';
      f.vy = -6.2;
      f.vx = d === 9 ? 1.8 * f.facing : d === 7 ? -1.8 * f.facing : 0;
      f.y = -0.1;
      f.move = null;
      return;
    }
    f.crouching = crouch;
    f.state = crouch ? 'crouch' : d === 6 || d === 4 ? 'walk' : 'idle';
    f.vx = d === 6 ? 1.3 * f.facing : d === 4 ? -0.95 * f.facing : 0;
  }

  private attack(f: Fighter, id: MoveId): void {
    f.move = id;
    f.hitDone = false;
    f.t = 0;
    if (id === 'air') return; // stays in the jump state
    f.state = 'attack';
    f.crouching = id === 'cjab' || id === 'sweep';
    f.vx = 0;
    if (id === 'upper') {
      f.vy = -5.6;
      f.vx = 0.8 * f.facing;
      f.y = -0.1;
      sfx.uppercut();
    }
  }

  private stepFighter(f: Fighter): void {
    f.t++;
    if (f.push) {
      f.x += f.push;
      f.push *= 0.8;
      if (Math.abs(f.push) < 0.1) f.push = 0;
    }
    switch (f.state) {
      case 'hit':
      case 'block':
        if (f.stun > 0 && --f.stun === 0) f.state = 'idle';
        break;
      case 'down':
        if (--f.stun <= 0) {
          f.state = 'getup';
          f.stun = 24;
        }
        break;
      case 'getup':
        if (--f.stun <= 0) f.state = 'idle';
        break;
      case 'jump':
        if (f.move === 'air') this.checkHit(f, MOVES.air, f.t > MOVES.air.startup && f.t <= MOVES.air.startup + MOVES.air.active);
        break;
      case 'attack': {
        const m = MOVES[f.move!];
        if (f.move === 'shot' && f.t === m.startup) {
          const img = this.add.image(f.x + f.facing * 26, FLOOR - 26, 'charge2').setDepth(6).setScale(1.5).setFlipX(f.facing < 0);
          if (f === this.shade) img.setTint(0xff5070);
          this.shots.push({ x: f.x + f.facing * 26, y: FLOOR - 26, vx: 3 * f.facing, owner: f, sprite: img });
          sfx.fireball();
        }
        if (f.move !== 'shot') this.checkHit(f, m, f.t > m.startup && f.t <= m.startup + m.active);
        if (f.move === 'upper' ? f.y === 0 && f.t > 6 && f.t > m.startup + m.active + 4 : f.t >= m.startup + m.active + m.recovery) {
          f.state = 'idle';
          f.move = null;
          f.crouching = false;
        }
        break;
      }
    }
  }

  private moveFighter(f: Fighter): void {
    if (f.state === 'walk' || f.state === 'jump' || f.y < 0 || f.state === 'down') f.x += f.vx;
    if (f.y < 0) {
      f.vy += 0.32;
      f.y += f.vy;
      if (f.y >= 0) {
        f.y = 0;
        f.vy = 0;
        f.vx = 0;
        if (f.state === 'jump') {
          f.state = 'idle';
          f.move = null;
        }
      }
    } else if (f.state !== 'walk') f.vx *= f.state === 'down' ? 0.85 : 0;
    f.x = Phaser.Math.Clamp(f.x, LEFT_WALL, RIGHT_WALL);
  }

  /** Bodies don't overlap on the ground. */
  private separate(): void {
    const a = this.you;
    const b = this.shade;
    if (a.y < -20 || b.y < -20) return;
    const gap = Math.abs(a.x - b.x);
    if (gap < 22) {
      const push = (22 - gap) / 2;
      const s = a.x < b.x ? -1 : 1;
      a.x = Phaser.Math.Clamp(a.x + s * push, LEFT_WALL, RIGHT_WALL);
      b.x = Phaser.Math.Clamp(b.x - s * push, LEFT_WALL, RIGHT_WALL);
    }
  }

  private other(f: Fighter): Fighter {
    return f === this.you ? this.shade : this.you;
  }

  private checkHit(f: Fighter, m: Move, active: boolean): void {
    if (!active || f.hitDone) return;
    const o = this.other(f);
    if (o.state === 'down' || o.state === 'getup') return;
    const dx = (o.x - f.x) * f.facing;
    if (dx < 0 || dx > m.reach) return;
    // Heights: in the air you can only hit someone near your level.
    if (Math.abs(o.y - f.y) > 40) return;
    // The rising upper is invincible for its first frames.
    if (o.state === 'attack' && o.move === 'upper' && o.t <= 6) return;
    f.hitDone = true;
    this.land(o, m, f);
  }

  /** Does `o` block an attack of this height coming from `from`? */
  private blocks(o: Fighter, height: Height, fromX: number): boolean {
    if (o.state !== 'idle' && o.state !== 'walk' && o.state !== 'crouch' && o.state !== 'block') return false;
    if (o.y < 0) return false;
    const holdingBack = o === this.you ? (o.facing > 0 ? this.controls.isDown('left') : this.controls.isDown('right')) : this.aiBlocking;
    const awayFromAttacker = (fromX - o.x) * o.facing > 0;
    if (!holdingBack || !awayFromAttacker) return false;
    const crouching = o === this.you ? this.controls.isDown('down') : this.aiCrouchBlock;
    if (height === 'low') return crouching;
    if (height === 'high') return !crouching;
    return true;
  }

  private land(o: Fighter, m: Move, from: Fighter): void {
    const blocked = this.blocks(o, m.height, from.x);
    if (blocked) {
      o.state = 'block';
      o.stun = Math.round(m.hitstun * 0.6);
      o.push = -o.facing * 1.6;
      o.hp = Math.max(1, o.hp - (from.move === 'shot' || from.move === 'upper' ? 2 : 0));
      sfx.punchBlock();
      return;
    }
    o.hp = Math.max(0, o.hp - m.dmg);
    sfx.punch();
    this.cameras.main.shake(80, 0.006);
    if (o.hp === 0 || m.knockdown || o.y < 0) {
      o.state = 'down';
      o.stun = 50;
      o.vy = -3;
      o.y = Math.min(o.y, -0.1);
      o.vx = -o.facing * 1.4;
      o.move = null;
      if (o.hp === 0) this.endRound(from, false);
      else sfx.bodyFall();
    } else {
      o.state = 'hit';
      o.stun = m.hitstun;
      o.push = -o.facing * 2;
      o.move = null;
    }
  }

  private stepShots(): void {
    for (const s of this.shots) {
      s.x += s.vx;
      s.sprite.setPosition(s.x, s.y);
      const o = this.other(s.owner);
      if (Math.abs(o.x - s.x) < 14 && o.y > -30 && o.state !== 'down' && o.state !== 'getup' && !(o.state === 'attack' && o.move === 'upper' && o.t <= 6)) {
        this.land(o, { ...MOVES.jab, dmg: 10, hitstun: 18, height: 'mid' }, s.owner);
        s.x = -999;
      }
      // Shots cancel each other out.
      for (const t of this.shots) if (t !== s && Math.abs(t.x - s.x) < 10) s.x = t.x = -999;
    }
    for (const s of this.shots) if (s.x < 0 || s.x > VIEW_W) s.sprite.destroy();
    this.shots = this.shots.filter((s) => s.x >= 0 && s.x <= VIEW_W);
  }

  // --- Shade ----------------------------------------------------------------------------

  private aiBlocking = false;
  private aiCrouchBlock = false;

  private thinkShade(): void {
    const s = this.shade;
    const p = this.you;
    const dist = Math.abs(p.x - s.x);
    const level = this.round + (this.shade.wins > this.you.wins ? 0 : 1);
    // Reactions every step: block what's coming (sometimes).
    const threat = (p.state === 'attack' && p.t <= MOVES[p.move!].startup + 2) || this.shots.some((sh) => sh.owner === p && Math.abs(sh.x - s.x) < 70);
    this.aiBlocking = threat && Math.random() < 0.45 + level * 0.08;
    this.aiCrouchBlock = this.aiBlocking && p.crouching;
    if (--this.aiT > 0) {
      this.control(s, s.state === 'walk' ? (s.vx * s.facing > 0 ? 6 : 4) : 5, false, false);
      return;
    }
    this.aiT = Phaser.Math.Between(8, 16) - level * 2;
    const r = Math.random();
    // Anti-air a jumping player.
    if (p.y < -10 && (p.x - s.x) * s.facing > 0 && dist < 80 && r < 0.55) {
      s.dirs.push({ d: 6, f: this.frame - 3 }, { d: 2, f: this.frame - 2 }, { d: 3, f: this.frame - 1 });
      return this.control(s, 3, true, false);
    }
    // Jump over a fireball.
    if (this.shots.some((sh) => sh.owner === p && Math.abs(sh.x - s.x) < 90) && r < 0.35) return this.control(s, 9, false, false);
    if (dist > 140) {
      if (r < 0.35) {
        s.dirs.push({ d: 2, f: this.frame - 3 }, { d: 3, f: this.frame - 2 }, { d: 6, f: this.frame - 1 });
        return this.control(s, 6, true, false);
      }
      return this.control(s, 6, false, false);
    }
    if (dist > 50) {
      if (r < 0.15) return this.control(s, 9, false, false);
      if (r < 0.3) {
        s.dirs.push({ d: 2, f: this.frame - 3 }, { d: 3, f: this.frame - 2 }, { d: 6, f: this.frame - 1 });
        return this.control(s, 6, true, false);
      }
      return this.control(s, r < 0.8 ? 6 : 4, false, false);
    }
    // Close: mix it up.
    if (r < 0.3) return this.control(s, 5, true, false);
    if (r < 0.5) return this.control(s, 5, false, true);
    if (r < 0.62) return this.control(s, 2, false, true);
    if (r < 0.72) return this.control(s, 2, true, false);
    return this.control(s, 4, false, false);
  }

  // --- rounds ------------------------------------------------------------------------------

  private endRound(winner: Fighter, timeUp: boolean): void {
    if (this.phase !== 'fight') return;
    winner.wins++;
    this.phase = 'ko';
    this.phaseT = 0;
    const perfect = winner.hp === MAX_HP;
    this.banner.setText(timeUp ? 'TIME!' : perfect ? 'PERFECT!' : 'K.O.!');
    if (!timeUp) playVoice(this, perfect ? 'fight_perfect' : 'fight_ko');
    sfx.bodyFall();
    this.cameras.main.flash(250, 255, 255, 255);
  }

  private nextRound(): void {
    if (this.you.wins >= 2 || this.shade.wins >= 2) {
      const won = this.you.wins >= 2;
      this.phase = 'over';
      this.phaseT = 0;
      this.banner.setText(won ? 'YOU WIN!' : 'YOU LOSE');
      stopMusic();
      playVoice(this, won ? 'fight_youwin' : 'fight_youlose');
      this.time.delayedCall(1400, () => playVoice(this, won ? 'shade_loses' : 'shade_wins'));
      const w = won ? this.you : this.shade;
      w.state = 'win';
      return;
    }
    this.round++;
    this.startRound();
  }

  // --- drawing ---------------------------------------------------------------------------------

  private poseOf(f: Fighter): string {
    switch (f.state) {
      case 'walk':
        return ['run1', 'run2', 'run3'][Math.floor(this.frame / 8) % 3];
      case 'crouch':
        return 'crouch';
      case 'jump':
        return f.move === 'air' ? 'kick' : 'jump';
      case 'attack': {
        const m = MOVES[f.move!];
        if (f.move === 'sweep') return 'kick';
        return f.t <= m.startup + m.active + 2 ? m.frame : f.crouching ? 'crouch' : 'idle';
      }
      case 'block':
        return f.crouching ? 'crouch' : 'block';
      case 'hit':
      case 'down':
      case 'getup':
        return 'hurt';
      case 'win':
        return 'win';
      default:
        return 'idle';
    }
  }

  private draw(): void {
    for (const f of [this.you, this.shade]) {
      const pose = this.poseOf(f);
      f.sprite.setTexture(f.tex, this.frames[pose] ?? this.frames.idle).setFlipX(f.facing < 0);
      const lying = f.state === 'down';
      f.sprite.setPosition(f.x, FLOOR + f.y + (f.move === 'sweep' && f.state === 'attack' ? 8 : 0)).setAngle(lying ? -90 * f.facing : 0);
      f.sprite.setTint(f.state === 'hit' && f.stun % 6 < 3 ? 0xffb0b0 : f.state === 'block' ? 0xc8d8ff : 0xffffff);
    }
    const h = this.hud;
    h.clear();
    const bar = (x: number, hp: number, right: boolean) => {
      h.fillStyle(0x1a1428).fillRect(x, 8, 160, 10);
      h.fillStyle(0x8c2030).fillRect(x + 1, 9, 158, 8);
      const w = Math.round((hp / MAX_HP) * 158);
      h.fillStyle(0xffe14a).fillRect(right ? x + 1 + 158 - w : x + 1, 9, w, 8);
      h.fillStyle(0xffffff, 0.35).fillRect(right ? x + 1 + 158 - w : x + 1, 9, w, 2);
    };
    bar(8, this.you.hp, false);
    bar(VIEW_W - 168, this.shade.hp, true);
    for (let i = 0; i < 2; i++) {
      h.fillStyle(i < this.you.wins ? 0xffe14a : 0x3a3450).fillCircle(180 - i * 8, 26, 3);
      h.fillStyle(i < this.shade.wins ? 0xffe14a : 0x3a3450).fillCircle(VIEW_W - 180 + i * 8, 26, 3);
    }
    this.timeText.setText(String(Math.max(0, Math.ceil(this.clock / 60))));
  }
}
