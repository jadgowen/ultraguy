import Phaser from 'phaser';
import { STEP_MS, VIEW_H, VIEW_W } from '../constants';
import { Controls } from '../input';
import { PARALLAX } from '../envArt';
import type { ThemeId } from '../level/Level';
import { THEMES } from '../level/themes';
import { sfx } from '../sfx';
import { PixelText, pixelText } from '../pixelFont';
import { uiHighlight, uiPanel } from '../uiArt';

export const FONT = 'monospace';

/**
 * Base for menu screens: fixed-step input polling and a simple vertical list
 * with a blinking cursor.
 */
export abstract class MenuScene extends Phaser.Scene {
  protected controls!: Controls;
  protected frame = 0;
  private acc = 0;
  private items: PixelText[] = [];
  private cursor: PixelText | null = null;
  /** The glow behind the selected row. */
  private highlight: Phaser.GameObjects.Image | null = null;
  protected selected = 0;
  /** Parallax layers behind the menu, drifting slowly. */
  private backdropLayers: { sprite: Phaser.GameObjects.TileSprite; speed: number }[] = [];
  /** While true, the list ignores UP/DOWN (e.g. waiting for a key to bind). */
  protected inputLocked = false;

  protected initMenu(): void {
    this.acc = 0;
    this.frame = 0;
    this.items = [];
    this.cursor = null;
    this.highlight = null;
    this.inputLocked = false;
    this.backdropLayers = [];
    this.controls = new Controls(this);
  }

  /**
   * A stage's parallax layers drifting behind the menu, under a dark
   * gradient (`dim` at the top and bottom, lighter through the middle) so
   * text reads cleanly over it.
   */
  protected backdrop(theme: ThemeId, dim = 0.55): void {
    this.cameras.main.setBackgroundColor(THEMES[theme].sky);
    this.backdropLayers = PARALLAX.map(({ layer, factor }) => ({
      sprite: this.add.tileSprite(0, 0, VIEW_W, VIEW_H, `bgl_${theme}_${layer}`).setOrigin(0).setDepth(-20 + layer),
      speed: factor * 0.6,
    }));
    const shade = this.add.graphics().setDepth(-5);
    const bands = 12;
    for (let i = 0; i < bands; i++) {
      const k = Math.abs(i / (bands - 1) - 0.5) * 2; // 1 at the edges, 0 in the middle
      shade.fillStyle(0x05060c, dim * (0.55 + 0.45 * k));
      shade.fillRect(0, Math.floor((i * VIEW_H) / bands), VIEW_W, Math.ceil(VIEW_H / bands) + 1);
    }
  }

  /** A steel-framed glass panel behind a block of menu text (centered on x, y). */
  protected panel(x: number, y: number, w: number, h: number): Phaser.GameObjects.Image {
    return this.add.image(Math.round(x), Math.round(y), uiPanel(this, w, h)).setDepth(-4);
  }

  /** Lay out a vertical list; returns the text objects (for relabeling). */
  protected list(x: number, y: number, labels: string[], start = 0): PixelText[] {
    this.items = labels.map((l, i) => pixelText(this, x, y + i * 14, l, { fontFamily: FONT, fontSize: '12px', color: '#fff1e0' }));
    const width = Math.max(...this.items.map((t) => t.width)) + 30;
    this.highlight = this.add.image(x - 18, y, uiHighlight(this, width, 13)).setOrigin(0, 0).setDepth(-3);
    this.cursor = pixelText(this, x - 14, y, '>', { fontFamily: FONT, fontSize: '12px', color: '#5ef0c8' });
    this.select(start);
    return this.items;
  }

  protected select(i: number): void {
    if (!this.items.length) return;
    this.selected = (i + this.items.length) % this.items.length;
    this.cursor?.setY(this.items[this.selected].y);
    this.highlight?.setY(this.items[this.selected].y - 1);
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
      if (this.items.length && !this.inputLocked) {
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
    // The cursor nudges toward the item; the highlight breathes.
    if (this.cursor && this.items.length) this.cursor.setX(this.items[0].x - 14 + Math.round(Math.sin(this.frame / 8) * 1.5));
    this.highlight?.setAlpha(0.75 + Math.sin(this.frame / 14) * 0.25);
    for (const b of this.backdropLayers) b.sprite.tilePositionX += b.speed * Math.min(delta, 100) / 16.7;
  }

  protected confirmed(): boolean {
    return this.controls.justPressed('start') || this.controls.justPressed('jump');
  }
}
