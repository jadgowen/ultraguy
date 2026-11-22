import Phaser from 'phaser';
import { loadSave } from '../save';
import { SKINS } from '../skins';
import { sfx } from '../sfx';

/**
 * UltraGuy's teleport: a beam of light in his colors.
 *
 *  - IN: the beam streaks down from the top of the screen to where he'll
 *    stand, hits with a flash and a spray of sparks, and he takes shape out
 *    of it (a white silhouette that grows up from the ground, overshoots a
 *    little, then flickers into his real colors).
 *  - OUT: the reverse: he flickers white, stretches up into a thin line of
 *    light, and the beam shoots up off the top of the screen.
 *
 * The scene hides the player's own sprite while a beam runs and draws this
 * instead; `step` returns false once it's done.
 */

/** Pixels per step the beam travels. */
const SPEED = 13;
/** Length of the streak behind the beam's head. */
const TAIL = 34;
/** Steps the hero takes to form out of the beam (IN) or thin into it (OUT). */
const FORM = 14;
const FLICKER = 8;

type Phase = 'drop' | 'form' | 'flicker' | 'thin' | 'rise';

export interface BeamLook {
  /** The hero's current texture and frame (so he forms in the pose he'll stand in). */
  texture: string;
  frame: string | number;
  flipX: boolean;
}

export class Beam {
  private g: Phaser.GameObjects.Graphics;
  private ghost: Phaser.GameObjects.Image;
  private phase: Phase = 'drop';
  private t = 0;
  private headY = 0;
  private readonly main: number;
  private readonly light: number;
  private sparks: { x: number; y: number; vx: number; vy: number; life: number }[] = [];

  private constructor(
    private scene: Phaser.Scene,
    private readonly dir: 'in' | 'out',
    private readonly x: number,
    /** Where his feet are. */
    private readonly ground: number,
    /** Top of the view: where the beam comes from / goes to. */
    private readonly top: number,
    look: BeamLook,
  ) {
    const skin = SKINS.find((s) => s.id === loadSave().skin)?.colors;
    this.main = skin?.main ?? 0xf28c28;
    this.light = skin?.light ?? 0xffd08a;
    this.g = scene.add.graphics().setDepth(11).setBlendMode(Phaser.BlendModes.ADD);
    this.ghost = scene.add.image(x, ground, look.texture, look.frame).setOrigin(0.5, 1).setDepth(10.5).setFlipX(look.flipX).setVisible(false);
    if (dir === 'in') {
      this.phase = 'drop';
      this.headY = top - TAIL;
      sfx.beamIn();
    } else {
      this.phase = 'flicker';
      this.ghost.setVisible(true);
      sfx.beamOut();
    }
  }

  static in(scene: Phaser.Scene, x: number, ground: number, top: number, look: BeamLook): Beam {
    return new Beam(scene, 'in', x, ground, top, look);
  }

  static out(scene: Phaser.Scene, x: number, ground: number, top: number, look: BeamLook): Beam {
    return new Beam(scene, 'out', x, ground, top, look);
  }

  /** One step; false once it's over (the beam has cleaned itself up). */
  step(): boolean {
    this.t++;
    const g = this.g;
    g.clear();
    switch (this.phase) {
      case 'drop':
        this.headY = Math.min(this.ground, this.headY + SPEED);
        this.drawStreak(this.headY - TAIL, this.headY);
        if (this.headY >= this.ground) {
          this.burst();
          this.next(this.dir === 'in' ? 'form' : 'rise');
        }
        break;
      case 'form': {
        // A white silhouette grows up out of the impact, overshooting a touch.
        const k = this.t / FORM;
        const e = 1 - (1 - k) ** 3;
        const sy = Math.min(1.08, 0.12 + e * 0.96);
        const sx = 1.6 - e * 0.6;
        this.ghost.setVisible(true).setTintFill(0xffffff).setScale(k > 0.85 ? 1 : sx, k > 0.85 ? 1 : sy);
        this.drawStreak(this.ground - 70 * (1 - e), this.ground, 1 - e);
        if (this.t >= FORM) this.next('flicker');
        break;
      }
      case 'flicker':
        // White, his colors, white... and then just his colors.
        if (this.t % 4 < 2) this.ghost.setTintFill(this.t % 8 < 4 ? 0xffffff : this.light);
        else this.ghost.clearTint();
        this.ghost.setScale(1);
        if (this.t >= FLICKER) {
          if (this.dir === 'in') return this.finish();
          this.next('thin');
        }
        break;
      case 'thin': {
        // OUT: he stretches up into a thin line of light.
        const k = this.t / FORM;
        const e = k * k;
        this.ghost.setTintFill(0xffffff).setScale(Math.max(0.08, 1 - e * 0.95), 1 + e * 1.6);
        this.drawStreak(this.ground - 30 - e * 40, this.ground, e);
        if (this.t >= FORM) {
          this.ghost.setVisible(false);
          this.headY = this.ground;
          this.burst();
          this.next('rise');
        }
        break;
      }
      case 'rise':
        this.headY -= SPEED;
        this.drawStreak(this.headY, Math.min(this.ground, this.headY + TAIL + 10));
        if (this.headY + TAIL < this.top) return this.finish();
        break;
    }
    this.stepSparks();
    return true;
  }

  /** Stop now (a scene change, a death). */
  destroy(): void {
    this.g.destroy();
    this.ghost.destroy();
  }

  private finish(): boolean {
    this.destroy();
    return false;
  }

  private next(p: Phase): void {
    this.phase = p;
    this.t = 0;
  }

  /** The beam: a white core inside his color, inside a soft glow; `a` fades it. */
  private drawStreak(y0: number, y1: number, a = 1): void {
    if (y1 <= y0 || a <= 0) return;
    const g = this.g;
    const x = this.x;
    g.fillStyle(this.main, 0.25 * a).fillRect(x - 6, y0, 12, y1 - y0);
    g.fillStyle(this.main, 0.9 * a).fillRect(x - 3, y0, 6, y1 - y0);
    g.fillStyle(this.light, a).fillRect(x - 2, y0 + 1, 4, y1 - y0 - 1);
    g.fillStyle(0xffffff, a).fillRect(x - 1, y0 + 2, 2, y1 - y0 - 2);
    // A bright head where it's going.
    const head = this.phase === 'rise' ? y0 : y1;
    g.fillStyle(0xffffff, 0.9 * a).fillCircle(x, head, 4);
  }

  /** Where the beam meets the ground: a flash, a ring, and sparks thrown sideways. */
  private burst(): void {
    for (let i = 0; i < 10; i++) {
      const s = (i % 2 ? 1 : -1) * (0.8 + Math.random() * 2.2);
      this.sparks.push({ x: this.x, y: this.ground - 2, vx: s, vy: -0.6 - Math.random() * 1.6, life: 14 + Math.floor(Math.random() * 8) });
    }
    this.scene.cameras.main.flash(70, 255, 255, 255, false);
  }

  private stepSparks(): void {
    const g = this.g;
    // The ring on the ground just after the hit.
    if ((this.phase === 'form' || (this.phase === 'rise' && this.dir === 'out')) && this.t < 10) {
      const k = this.t / 10;
      g.lineStyle(2, this.light, 1 - k).strokeEllipse(this.x, this.ground - 1, 10 + k * 40, 4 + k * 6);
    }
    for (const s of this.sparks) {
      s.life--;
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.15;
      g.fillStyle(s.life % 4 < 2 ? 0xffffff : this.light, 1).fillRect(Math.round(s.x), Math.round(s.y), 2, 2);
    }
    this.sparks = this.sparks.filter((s) => s.life > 0);
  }
}
