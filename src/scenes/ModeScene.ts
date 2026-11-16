import Phaser from 'phaser';
import { playMusic, playVoice, stopMusic } from '../audio';
import { STEP_MS, VIEW_H, VIEW_W } from '../constants';
import { Controls } from '../input';
import type { StageId } from '../level/Level';
import { pixelText } from '../pixelFont';
import { sfx } from '../sfx';
import { pixelateIn } from './cutscene';
import { ModeData, returnToGame } from './encounters';

/**
 * Shared frame for the Boss Hall's game modes: the fixed 60 Hz step, a READY /
 * GO countdown, a banner and HUD line, and the ending (his line, a pause, then
 * back to the Hall). A mode fills in `setup`, `tick` and `draw`, and calls
 * `finish(won)` when it's decided.
 */
export abstract class ModeScene extends Phaser.Scene {
  protected controls!: Controls;
  protected mode!: ModeData;
  /** Steps since the scene started. */
  protected frame = 0;
  /** Steps since GO (0 until then). */
  protected playT = 0;
  protected result: 'win' | 'lose' | null = null;
  protected banner!: ReturnType<typeof pixelText>;
  protected hud!: ReturnType<typeof pixelText>;
  private acc = 0;
  private overT = 0;

  /** Voice prefix: `<voice>_wins` / `<voice>_loses`. */
  protected abstract readonly voice: string;
  protected abstract readonly music: string;
  protected abstract readonly homeStage: StageId;
  protected readonly readyFrames: number = 90;

  /** Build the mode (reset every field: the scene object is reused). */
  protected abstract setup(): void;
  /** One step of play (only after GO, until it's decided). */
  protected abstract tick(): void;
  protected abstract draw(): void;
  /** Keeps animating after the result (optional). */
  protected afterTick(): void {}

  create(data: ModeData): void {
    this.mode = { stage: data?.stage ?? this.homeStage, ret: data?.ret ?? { kind: 'vault', step: 0 } };
    this.controls = new Controls(this);
    this.acc = 0;
    this.frame = 0;
    this.playT = 0;
    this.overT = 0;
    this.result = null;
    this.setup();
    this.banner = pixelText(this, VIEW_W / 2, VIEW_H / 2 - 20, 'READY...', { fontSize: '16px', color: '#fff1e0', stroke: '#000000' }).setOrigin(0.5).setDepth(50);
    this.hud = pixelText(this, 8, 4, '', { color: '#fff1e0', stroke: '#000000' }).setDepth(50);
    stopMusic();
    pixelateIn(this, 800);
    this.time.delayedCall(400, () => playMusic(this, this.music));
  }

  /** A line of control help along the bottom. */
  protected help(text: string, x = VIEW_W / 2, y = VIEW_H - 10): void {
    pixelText(this, x, y, text, { color: '#8a8fa8', stroke: '#000000', align: 'center' }).setOrigin(0.5, 0).setDepth(50);
  }

  update(_t: number, delta: number): void {
    this.acc += Math.min(delta, 100);
    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS;
      this.frame++;
      this.controls.poll();
      if (this.result) {
        this.afterTick();
        if (++this.overT === 220) returnToGame(this, this.mode, this.result === 'win');
        continue;
      }
      if (this.frame < this.readyFrames) continue;
      if (this.frame === this.readyFrames) {
        this.banner.setText('GO!');
        this.time.delayedCall(700, () => !this.result && this.banner.setText(''));
      }
      this.playT++;
      this.tick();
    }
    this.draw();
  }

  /** Settle it: banner, his line, then back to the Hall after a pause. */
  protected finish(won: boolean, text?: string): void {
    if (this.result) return;
    this.result = won ? 'win' : 'lose';
    this.banner.setText(text ?? (won ? 'YOU WIN!' : 'YOU LOSE...'));
    stopMusic();
    if (won) sfx.victory();
    this.time.delayedCall(600, () => playVoice(this, `${this.voice}_${won ? 'loses' : 'wins'}`));
  }
}
