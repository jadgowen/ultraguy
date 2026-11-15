import Phaser from 'phaser';
import { STEP_MS } from '../constants';
import { Controls } from '../input';
import { sfx } from '../sfx';

export const FONT = 'monospace';

/**
 * Base for menu screens: fixed-step input polling and a simple vertical list
 * with a blinking cursor.
 */
export abstract class MenuScene extends Phaser.Scene {
  protected controls!: Controls;
  protected frame = 0;
  private acc = 0;
  private items: Phaser.GameObjects.Text[] = [];
  private cursor: Phaser.GameObjects.Text | null = null;
  protected selected = 0;

  protected initMenu(): void {
    this.acc = 0;
    this.frame = 0;
    this.items = [];
    this.cursor = null;
    this.controls = new Controls(this);
  }

  /** Lay out a vertical list; returns the text objects (for relabeling). */
  protected list(x: number, y: number, labels: string[], start = 0): Phaser.GameObjects.Text[] {
    this.items = labels.map((l, i) => this.add.text(x, y + i * 14, l, { fontFamily: FONT, fontSize: '12px', color: '#fff1e0' }));
    this.cursor = this.add.text(x - 14, y, '>', { fontFamily: FONT, fontSize: '12px', color: '#5ef0c8' });
    this.select(start);
    return this.items;
  }

  protected select(i: number): void {
    if (!this.items.length) return;
    this.selected = (i + this.items.length) % this.items.length;
    this.cursor?.setY(this.items[this.selected].y);
    this.items.forEach((t, j) => t.setColor(j === this.selected ? '#fff1e0' : '#8a8fa8'));
  }

  /** One fixed step of menu logic. Return true to stop processing this frame. */
  protected abstract tick(): boolean | void;

  update(_t: number, delta: number): void {
    this.acc += Math.min(delta, 100);
    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS;
      this.frame++;
      this.controls.poll();
      if (this.items.length) {
        if (this.controls.justPressed('up')) {
          this.select(this.selected - 1);
          sfx.tick();
        }
        if (this.controls.justPressed('down')) {
          this.select(this.selected + 1);
          sfx.tick();
        }
      }
      if (this.tick()) return;
    }
    this.cursor?.setVisible(Math.floor(this.frame / 20) % 3 !== 0);
  }

  protected confirmed(): boolean {
    return this.controls.justPressed('start') || this.controls.justPressed('jump');
  }
}
