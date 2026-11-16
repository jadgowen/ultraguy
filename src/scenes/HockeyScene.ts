import Phaser from 'phaser';
import { VIEW_W } from '../constants';
import { sfx } from '../sfx';
import { makeHopTextures } from './HopScene';
import { ModeScene } from './ModeScene';

/**
 * FROSTLINE'S RINK: one-on-one ice hockey, seen from above. Skate on slippery
 * ice, carry the puck, FIRE to shoot, JUMP to body-check (a check into the
 * puck carrier knocks it loose). You defend the left net. First to 3.
 */

const RW = 320;
const RH = 170;
const OX = Math.round((VIEW_W - RW) / 2);
const OY = 40;
const MOUTH = 22; // half the goal mouth
const WIN_SCORE = 3;

interface Skater {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number;
  fy: number;
  max: number;
  accel: number;
  dashT: number;
  dashCd: number;
  stun: number;
  sprite: Phaser.GameObjects.Image;
}

export class HockeyScene extends ModeScene {
  protected readonly voice = 'frostline';
  protected readonly music = 'hockey';
  protected readonly homeStage = 'glacier' as const;

  private you!: Skater;
  private frost!: Skater;
  private puck = { x: RW / 2, y: RH / 2, vx: 0, vy: 0, owner: null as Skater | null, lockFor: null as Skater | null, lockT: 0 };
  private score = [0, 0];
  private pause = 0;
  private aiShootT = 0;
  private g!: Phaser.GameObjects.Graphics;

  constructor() {
    super('hockey');
  }

  protected setup(): void {
    makeHopTextures(this);
    this.cameras.main.setBackgroundColor('#0a1420');
    this.g = this.add.graphics();
    const mk = (tex: string, scale: number, max: number, accel: number): Skater => ({
      x: 0, y: 0, vx: 0, vy: 0, fx: 1, fy: 0, max, accel, dashT: 0, dashCd: 0, stun: 0,
      sprite: this.add.image(0, 0, tex).setScale(scale).setDepth(5),
    });
    this.you = mk('hop_hero', 1, 2.2, 0.14);
    this.frost = mk('frostline_slide', 0.6, 1.9, 0.11);
    this.score = [0, 0];
    this.pause = 0;
    this.aiShootT = 0;
    this.faceoff();
    this.help('ARROWS SKATE   FIRE SHOOT   JUMP BODY CHECK');
  }

  private faceoff(): void {
    Object.assign(this.you, { x: RW / 2 - 50, y: RH / 2, vx: 0, vy: 0, fx: 1, fy: 0, dashT: 0, stun: 0 });
    Object.assign(this.frost, { x: RW / 2 + 50, y: RH / 2, vx: 0, vy: 0, fx: -1, fy: 0, dashT: 0, stun: 0 });
    Object.assign(this.puck, { x: RW / 2, y: RH / 2, vx: 0, vy: (Math.random() - 0.5) * 0.6, owner: null, lockFor: null, lockT: 0 });
  }

  protected tick(): void {
    if (this.pause > 0) {
      if (--this.pause === 0) {
        this.banner.setText('');
        this.faceoff();
      }
      return;
    }
    const c = this.controls;
    const ix = (c.isDown('right') ? 1 : 0) - (c.isDown('left') ? 1 : 0);
    const iy = (c.isDown('down') ? 1 : 0) - (c.isDown('up') ? 1 : 0);
    this.drive(this.you, ix, iy, c.justPressed('fire'), c.justPressed('jump'));
    this.thinkFrost();
    for (const s of [this.you, this.frost]) this.skate(s);
    this.bump();
    this.stepPuck();
    this.hud.setText(`ULTRAGUY ${this.score[0]}  -  ${this.score[1]} FROSTLINE`).setX(VIEW_W / 2 - 60);
  }

  /** Steer a skater: push in a direction, shoot, check. */
  private drive(s: Skater, ix: number, iy: number, shoot: boolean, check: boolean): void {
    if (s.stun > 0) return;
    if (ix || iy) {
      const l = Math.hypot(ix, iy);
      s.fx = ix / l;
      s.fy = iy / l;
      s.vx += s.fx * s.accel;
      s.vy += s.fy * s.accel;
    }
    const p = this.puck;
    if (shoot && p.owner === s) {
      // Aim mostly where you face, nudged toward the far net.
      const gx = s === this.you ? RW + 4 : -4;
      const toGoal = Math.atan2(RH / 2 - s.y, gx - s.x);
      const face = Math.atan2(s.fy, s.fx);
      const diff = Phaser.Math.Angle.Wrap(toGoal - face);
      // You get a little more help aiming than he does.
      const a = Math.abs(diff) < 1.3 ? face + diff * (s === this.you ? 0.75 : 0.45) : face;
      p.owner = null;
      p.vx = Math.cos(a) * 5.4 + s.vx * 0.3;
      p.vy = Math.sin(a) * 5.4 + s.vy * 0.3;
      p.lockFor = s;
      p.lockT = 14;
      sfx.chargeShot();
    }
    if (check && s.dashCd === 0) {
      s.dashT = 12;
      s.dashCd = 55;
      s.vx = s.fx * 3.8;
      s.vy = s.fy * 3.8;
      sfx.whoosh();
    }
  }

  private skate(s: Skater): void {
    if (s.stun > 0) s.stun--;
    if (s.dashCd > 0) s.dashCd--;
    if (s.dashT > 0) s.dashT--;
    // Ice: glide, slow to a stop.
    s.vx *= 0.975;
    s.vy *= 0.975;
    const sp = Math.hypot(s.vx, s.vy);
    const max = s.dashT > 0 ? 3.8 : s.max;
    if (sp > max) {
      s.vx *= max / sp;
      s.vy *= max / sp;
    }
    s.x += s.vx;
    s.y += s.vy;
    if (s.x < 8 || s.x > RW - 8) {
      s.vx = -s.vx * 0.5;
      s.x = Phaser.Math.Clamp(s.x, 8, RW - 8);
    }
    if (s.y < 8 || s.y > RH - 8) {
      s.vy = -s.vy * 0.5;
      s.y = Phaser.Math.Clamp(s.y, 8, RH - 8);
    }
  }

  /** Skaters collide; a body check into the puck carrier knocks it loose. */
  private bump(): void {
    const a = this.you;
    const b = this.frost;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    if (d >= 16 || d === 0) return;
    const nx = dx / d;
    const ny = dy / d;
    const push = (16 - d) / 2;
    a.x -= nx * push;
    a.y -= ny * push;
    b.x += nx * push;
    b.y += ny * push;
    for (const [hitter, victim] of [[a, b], [b, a]] as const) {
      if (hitter.dashT <= 0 || victim.stun > 0) continue;
      victim.stun = 40;
      victim.vx = (victim === b ? nx : -nx) * 3;
      victim.vy = (victim === b ? ny : -ny) * 3;
      hitter.dashT = 0;
      sfx.punch();
      this.cameras.main.shake(120, 0.008);
      const p = this.puck;
      if (p.owner === victim) {
        p.owner = null;
        p.vx = victim.vx * 0.8 + (Math.random() - 0.5);
        p.vy = victim.vy * 0.8 + (Math.random() - 0.5);
        p.lockFor = victim;
        p.lockT = 30;
      }
    }
  }

  private stepPuck(): void {
    const p = this.puck;
    if (p.lockT > 0 && --p.lockT === 0) p.lockFor = null;
    if (p.owner) {
      const o = p.owner;
      p.x = o.x + o.fx * 9;
      p.y = o.y + o.fy * 9;
      p.vx = o.vx;
      p.vy = o.vy;
      if (o.stun > 0) p.owner = null;
    } else {
      p.vx *= 0.99;
      p.vy *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      // Goals.
      const inMouth = Math.abs(p.y - RH / 2) < MOUTH;
      if (p.x < 2 && inMouth) return this.goal(1);
      if (p.x > RW - 2 && inMouth) return this.goal(0);
      if (p.x < 3 || p.x > RW - 3) {
        p.vx = -p.vx * 0.8;
        p.x = Phaser.Math.Clamp(p.x, 3, RW - 3);
        sfx.tick();
      }
      if (p.y < 3 || p.y > RH - 3) {
        p.vy = -p.vy * 0.8;
        p.y = Phaser.Math.Clamp(p.y, 3, RH - 3);
        sfx.tick();
      }
      // Pick it up.
      for (const s of [this.you, this.frost]) {
        if (s.stun > 0 || p.lockFor === s) continue;
        if (Math.hypot(p.x - s.x, p.y - s.y) < 11) {
          p.owner = s;
          sfx.tick();
          break;
        }
      }
    }
    // The carrier can be stripped by simply skating into them, sometimes.
    const o = p.owner;
    if (o) {
      const other = o === this.you ? this.frost : this.you;
      if (other.stun === 0 && Math.hypot(other.x - p.x, other.y - p.y) < 8 && Math.random() < 0.05) {
        p.owner = other;
        sfx.deflect();
      }
    }
  }

  private goal(side: 0 | 1): void {
    this.score[side]++;
    sfx.explode();
    this.cameras.main.flash(250, side === 0 ? 255 : 120, side === 0 ? 200 : 180, 255);
    this.puck.owner = null;
    this.puck.vx = this.puck.vy = 0;
    if (this.score[side] >= WIN_SCORE) {
      this.finish(side === 0, side === 0 ? 'YOU WIN THE GAME!' : 'FROSTLINE WINS');
      return;
    }
    this.banner.setText(side === 0 ? 'GOAL!' : 'HE SCORES!');
    this.pause = 100;
  }

  // --- Frostline ------------------------------------------------------------------------

  private thinkFrost(): void {
    const f = this.frost;
    const p = this.puck;
    const you = this.you;
    let tx: number;
    let ty: number;
    let shoot = false;
    let check = false;
    if (p.owner === f) {
      // Carry it toward your net, swerving around you; shoot from range.
      tx = 30;
      ty = RH / 2 + (you.y > f.y ? -30 : 30);
      this.aiShootT++;
      const range = f.x < 120;
      const pressured = Math.hypot(you.x - f.x, you.y - f.y) < 34 && you.x < f.x;
      if ((range && this.aiShootT > 28) || (pressured && this.aiShootT > 30)) {
        // Face the net before letting it go.
        const a = Math.atan2(RH / 2 + (Math.random() - 0.5) * MOUTH * 2.6 - f.y, -4 - f.x);
        f.fx = Math.cos(a);
        f.fy = Math.sin(a);
        shoot = true;
        this.aiShootT = 0;
      }
    } else {
      this.aiShootT = 0;
      if (p.owner === you) {
        // Get between you and his net; check you if you're close.
        tx = p.x + (RW - p.x) * 0.25;
        ty = p.y + (RH / 2 - p.y) * 0.3;
        if (Math.hypot(you.x - f.x, you.y - f.y) < 40 && f.dashCd === 0 && Math.random() < 0.06) {
          const a = Math.atan2(you.y - f.y, you.x - f.x);
          f.fx = Math.cos(a);
          f.fy = Math.sin(a);
          check = true;
        }
      } else {
        tx = p.x + p.vx * 10;
        ty = p.y + p.vy * 10;
      }
    }
    const dx = tx - f.x;
    const dy = ty - f.y;
    const d = Math.hypot(dx, dy);
    if (shoot || check) this.drive(f, 0, 0, shoot, check);
    else if (d > 4) this.drive(f, dx / d, dy / d, false, false);
  }

  protected draw(): void {
    const g = this.g;
    g.clear();
    // Boards and ice.
    g.fillStyle(0x3a78b8).fillRoundedRect(OX - 6, OY - 6, RW + 12, RH + 12, 14);
    g.fillStyle(0xe6f8ff).fillRoundedRect(OX, OY, RW, RH, 10);
    g.fillStyle(0xc8e8f8);
    for (let i = 0; i < 12; i++) g.fillRect(OX + 14 + i * 26, OY + 20 + ((i * 37) % 120), 18, 1);
    // Lines: center red, blue lines, faceoff circle.
    g.fillStyle(0xd83a4a).fillRect(OX + RW / 2 - 1, OY, 2, RH);
    g.fillStyle(0x6ab8e8).fillRect(OX + RW / 3, OY, 2, RH).fillRect(OX + (RW * 2) / 3, OY, 2, RH);
    g.lineStyle(1, 0x6ab8e8).strokeCircle(OX + RW / 2, OY + RH / 2, 22);
    // Nets.
    for (const [x, col] of [[OX - 6, 0xf28c28], [OX + RW, 0x9ee8ff]] as const) {
      g.fillStyle(0x1a1428).fillRect(x, OY + RH / 2 - MOUTH - 1, 6, MOUTH * 2 + 2);
      g.fillStyle(col).fillRect(x + 1, OY + RH / 2 - MOUTH, 4, MOUTH * 2);
      g.fillStyle(0xffffff, 0.5);
      for (let y = -MOUTH; y < MOUTH; y += 4) g.fillRect(x + 1, OY + RH / 2 + y, 4, 1);
    }
    g.fillStyle(0xd83a4a, 0.25).fillRect(OX, OY + RH / 2 - MOUTH, 10, MOUTH * 2).fillRect(OX + RW - 10, OY + RH / 2 - MOUTH, 10, MOUTH * 2);
    // Skaters and shadows.
    for (const s of [this.you, this.frost]) {
      g.fillStyle(0x000000, 0.2).fillEllipse(OX + s.x, OY + s.y + 6, 14, 5);
      s.sprite.setPosition(OX + s.x, OY + s.y).setAlpha(s.stun > 0 && this.frame % 6 < 3 ? 0.4 : 1);
      if (s === this.frost) s.sprite.setFlipX(s.fx > 0);
      else s.sprite.setRotation(Math.atan2(s.fy, s.fx) + Math.PI / 2);
      if (s.dashT > 0) g.fillStyle(0xffffff, 0.5).fillCircle(OX + s.x - s.vx * 3, OY + s.y - s.vy * 3, 4);
    }
    // Puck.
    const p = this.puck;
    g.fillStyle(0x1a1428).fillEllipse(OX + p.x, OY + p.y, 7, 5);
    g.fillStyle(0x55607a).fillEllipse(OX + p.x, OY + p.y - 1, 5, 2);
  }
}
