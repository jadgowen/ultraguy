import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../constants';
import { pixelText } from '../pixelFont';
import { sfx } from '../sfx';
import { makeHockeyArt } from './hockeyArt';
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
/** The boards' thickness around the ice (drawn into the rink texture). */
const BOARD = 8;

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
  /** Where the blades have been (the scratch trail), and the stride. */
  trail: [number, number][];
  stride: number;
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
  private fxG!: Phaser.GameObjects.Graphics;
  private nets: Phaser.GameObjects.Image[] = [];
  private puckImg!: Phaser.GameObjects.Image;
  private spray: { x: number; y: number; vx: number; vy: number; t: number }[] = [];
  private puckTrail: [number, number][] = [];
  /** Steps left in the goal light, and which net (0 = yours on the left). */
  private goalT = 0;
  private goalNet = 0;
  private scoreText: ReturnType<typeof pixelText>[] = [];

  constructor() {
    super('hockey');
  }

  protected setup(): void {
    makeHockeyArt(this, RW, RH, BOARD, MOUTH);
    this.cameras.main.setBackgroundColor('#0a1420');
    this.drawStands();
    this.add.image(OX - BOARD, OY - BOARD, 'hk_rink').setOrigin(0).setDepth(0);
    this.g = this.add.graphics().setDepth(1);
    this.fxG = this.add.graphics().setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
    this.nets = [
      this.add.image(OX - 10, OY + RH / 2, 'hk_net').setOrigin(0, 0.5).setDepth(2),
      this.add.image(OX + RW + 10, OY + RH / 2, 'hk_net').setOrigin(1, 0.5).setFlipX(true).setDepth(2),
    ];
    this.puckImg = this.add.image(0, 0, 'hk_puck').setDepth(4);
    this.spray = [];
    this.puckTrail = [];
    this.goalT = 0;
    const mk = (tex: string, scale: number, max: number, accel: number): Skater => ({
      x: 0, y: 0, vx: 0, vy: 0, fx: 1, fy: 0, max, accel, dashT: 0, dashCd: 0, stun: 0,
      sprite: this.add.image(0, 0, tex).setScale(scale).setDepth(5),
      trail: [],
      stride: 0,
    });
    this.you = mk('hk_you0', 1, 2.2, 0.14);
    this.frost = mk('hk_frost0', 1, 1.9, 0.11);
    const label = (x: number, t: string, col: string) => pixelText(this, x, 8, t, { color: col, stroke: '#000000' }).setOrigin(0.5, 0).setDepth(20);
    this.scoreText = [label(VIEW_W / 2 - 22, '0', '#ffc070'), label(VIEW_W / 2 + 22, '0', '#9ee8ff')];
    label(VIEW_W / 2 - 74, 'ULTRAGUY', '#f28c28');
    label(VIEW_W / 2 + 76, 'FROSTLINE', '#9ee8ff');
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
    this.hud.setText('');
    this.scoreText[0].setText(String(this.score[0]));
    this.scoreText[1].setText(String(this.score[1]));
    this.stepFx();
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
    // The goal light over the net it went into (side 0 scores on the right net).
    this.goalT = 60;
    this.goalNet = side === 0 ? 1 : 0;
    for (let i = 0; i < 16; i++) this.spray.push({ x: this.puck.x, y: this.puck.y, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, t: 20 + Math.floor(Math.random() * 10) });
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

  /** The stands around the rink: rows of dim faces and the arena dark. */
  private drawStands(): void {
    const g = this.add.graphics().setDepth(-1);
    const cols = [0x2a3a5a, 0x3a2a4a, 0x2a4a4a, 0x4a3a3a, 0x1e2a44];
    for (let y = 2; y < VIEW_H; y += 6)
      for (let x = (y % 12) / 2; x < VIEW_W; x += 7) {
        const inRink = x > OX - BOARD - 4 && x < OX + RW + BOARD + 4 && y > OY - BOARD - 4 && y < OY + RH + BOARD + 4;
        if (inRink) continue;
        g.fillStyle(cols[(x * 7 + y * 3) % cols.length]).fillRect(x, y + 2, 5, 3);
        g.fillStyle(0x8a7a6a, 0.6).fillRect(x + 1, y, 3, 2);
      }
    // The scoreboard panel.
    g.fillStyle(0x05080e).fillRect(VIEW_W / 2 - 126, 3, 252, 20);
    g.fillStyle(0x1e3a5a).fillRect(VIEW_W / 2 - 125, 4, 250, 18);
    g.fillStyle(0x05080e).fillRect(VIEW_W / 2 - 124, 5, 248, 16);
    for (const x of [VIEW_W / 2 - 32, VIEW_W / 2 + 12]) {
      g.fillStyle(0x1a1428).fillRect(x, 5, 20, 16);
    }
  }

  /** Ice spray and blade trails as skaters carve and check; the puck's streak. */
  private stepFx(): void {
    for (const s of [this.you, this.frost]) {
      const sp = Math.hypot(s.vx, s.vy);
      s.stride += sp * 0.12;
      if (sp > 0.6 && this.frame % 3 === 0) s.trail = [[s.x, s.y + 5] as [number, number], ...s.trail].slice(0, 16);
      // Spray when checking, or when the blades bite against the direction of travel.
      const turning = sp > 1.2 && s.vx * s.fx + s.vy * s.fy < sp * 0.4;
      if ((s.dashT > 0 || turning) && this.frame % 2 === 0)
        for (let i = 0; i < 2; i++) this.spray.push({ x: s.x, y: s.y + 4, vx: -s.vx * 0.4 + (Math.random() - 0.5) * 1.6, vy: -s.vy * 0.4 + (Math.random() - 0.5) * 1.6, t: 14 + Math.floor(Math.random() * 8) });
    }
    for (const p of this.spray) {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.9;
      p.vy *= 0.9;
      p.t--;
    }
    this.spray = this.spray.filter((p) => p.t > 0);
    const pk = this.puck;
    if (Math.hypot(pk.vx, pk.vy) > 2.5 && !pk.owner) this.puckTrail = [[pk.x, pk.y] as [number, number], ...this.puckTrail].slice(0, 6);
    else this.puckTrail = this.puckTrail.slice(0, Math.max(0, this.puckTrail.length - 1));
    if (this.goalT > 0) this.goalT--;
  }

  protected draw(): void {
    const g = this.g;
    const f = this.fxG;
    g.clear();
    f.clear();
    // Blade scratches on the ice.
    for (const s of [this.you, this.frost])
      s.trail.forEach(([x, y], i) => {
        g.fillStyle(0x9ac8e8, 0.5 - i * 0.03).fillRect(OX + x - 2, OY + y, 2, 1).fillRect(OX + x + 1, OY + y, 2, 1);
      });
    // Nets: the one just scored on shakes and lights up red.
    this.nets.forEach((n, i) => {
      const shake = this.goalT > 40 && this.goalNet === i ? Math.sin(this.goalT * 2) * 1.5 : 0;
      n.setX((i === 0 ? OX - 10 : OX + RW + 10) + shake);
      if (this.goalT > 0 && this.goalNet === i && this.frame % 10 < 6) {
        const x = i === 0 ? OX - 4 : OX + RW + 4;
        f.fillStyle(0xff3a3a, 0.5).fillCircle(x, OY + RH / 2, 26);
        f.fillStyle(0xff8a8a, 0.6).fillCircle(x, OY - 2, 5);
      }
    });
    // Skaters: shadows, a stride, a check flare.
    for (const s of [this.you, this.frost]) {
      g.fillStyle(0x2a4a6a, 0.35).fillEllipse(OX + s.x, OY + s.y + 7, 14, 5);
      const tex = s === this.you ? 'hk_you' : 'hk_frost';
      const moving = Math.hypot(s.vx, s.vy) > 0.4;
      s.sprite
        .setTexture(`${tex}${moving && Math.floor(s.stride) % 2 ? 1 : 0}`)
        .setPosition(OX + Math.round(s.x), OY + Math.round(s.y))
        .setRotation(Math.atan2(s.fy, s.fx) + Math.PI / 2)
        .setAlpha(s.stun > 0 && this.frame % 6 < 3 ? 0.4 : 1);
      if (s.dashT > 0) f.fillStyle(s === this.you ? 0xffa040 : 0x9ee8ff, 0.4).fillCircle(OX + s.x + s.fx * 6, OY + s.y + s.fy * 6, 9);
      if (s.stun > 0) for (let i = 0; i < 3; i++) f.fillStyle(0xffe14a, 0.9).fillCircle(OX + s.x + Math.cos(this.frame / 6 + i * 2) * 8, OY + s.y - 10 + Math.sin(this.frame / 6 + i * 2) * 2, 1.2);
    }
    // Ice spray.
    for (const p of this.spray) g.fillStyle(0xffffff, Math.min(1, p.t / 10)).fillRect(OX + p.x, OY + p.y, p.t > 10 ? 2 : 1, p.t > 10 ? 2 : 1);
    // The puck, with a streak when it's flying.
    const p = this.puck;
    this.puckTrail.forEach(([x, y], i) => f.fillStyle(0x6a9ac8, 0.35 - i * 0.05).fillEllipse(OX + x, OY + y, 7 - i, 4));
    g.fillStyle(0x2a4a6a, 0.35).fillEllipse(OX + p.x, OY + p.y + 3, 8, 3);
    this.puckImg.setPosition(OX + Math.round(p.x), OY + Math.round(p.y));
    // Overhead lights glinting on the ice.
    for (const [lx, ly] of [[RW * 0.25, RH * 0.3], [RW * 0.75, RH * 0.7], [RW * 0.5, RH * 0.5]]) f.fillStyle(0xffffff, 0.05).fillEllipse(OX + lx, OY + ly, 70, 26);
  }
}
