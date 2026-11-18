import Phaser from 'phaser';
import { playVoice } from '../audio';
import { VIEW_H, VIEW_W } from '../constants';
import { pixelText } from '../pixelFont';
import { sfx } from '../sfx';

/**
 * Story beats shared by the special modes: a dialogue box (portrait, name,
 * typed text, spoken line) and a "pixelate" warp between game styles.
 */

export interface Line {
  /** Speaker name shown over the box. */
  name: string;
  text: string;
  /** Portrait texture (and frame) shown on the left. */
  portrait?: { key: string; frame?: string | number; scale?: number };
  /** Voice clip id (voice_<id>), if one was generated. */
  voice?: string;
  /** Accent color for the name tag. */
  color?: number;
  /** Runs as the line opens (a sound, a gesture). */
  onOpen?: () => void;
}

/**
 * Show lines one after another at the bottom of the screen. Each types out,
 * then waits for `next()` to report a press (or times out), then the next
 * shows. Calls `done` after the last. Returns a step function to call once
 * per game step.
 */
export function dialogue(scene: Phaser.Scene, lines: Line[], next: () => boolean, done: () => void): () => void {
  const layer = scene.add.container(0, 0).setScrollFactor(0).setDepth(80);
  const boxY = VIEW_H - 62;
  let i = -1;
  let t = 0;
  let shown = 0;
  let hold = 0;
  let text: ReturnType<typeof pixelText> | null = null;

  const open = (n: number) => {
    layer.removeAll(true);
    const line = lines[n];
    const box = scene.add.rectangle(8, boxY, VIEW_W - 16, 54, 0x0a0c18, 0.92).setOrigin(0).setStrokeStyle(2, line.color ?? 0x5ef0c8);
    layer.add(box);
    let tx = 18;
    if (line.portrait) {
      const frame = scene.add.rectangle(14, boxY + 5, 44, 44, 0x1a1f3a).setOrigin(0).setStrokeStyle(1, 0x3a4470);
      const img = scene.add.image(36, boxY + 27, line.portrait.key, line.portrait.frame).setScale(line.portrait.scale ?? 1);
      // Fit the portrait inside its frame.
      const s = Math.min(40 / img.width, 40 / img.height, line.portrait.scale ?? 2);
      img.setScale(s);
      layer.add([frame, img]);
      tx = 66;
    }
    const tag = scene.add.rectangle(tx - 2, boxY - 8, line.name.length * 6 + 8, 12, line.color ?? 0x5ef0c8).setOrigin(0);
    const name = pixelText(scene, tx + 2, boxY - 6, line.name, { color: '#0a0c18' });
    text = pixelText(scene, tx, boxY + 8, '', { color: '#fff1e0' });
    text.setMaxWidth(VIEW_W - tx - 20);
    layer.add([tag, name, text]);
    t = 0;
    shown = 0;
    hold = Math.max(120, playVoice(scene, line.voice ?? '') / 16.7 + 30);
    line.onOpen?.();
  };

  open((i = 0));
  return () => {
    if (i >= lines.length) return;
    t++;
    const full = lines[i].text;
    if (shown < full.length) {
      shown = Math.min(full.length, shown + 1);
      text?.setText(full.slice(0, shown));
      if (shown % 3 === 0) sfx.tick();
      if (next()) {
        shown = full.length;
        text?.setText(full);
      }
      return;
    }
    if (next() || t > hold + full.length) {
      i++;
      if (i >= lines.length) {
        layer.destroy(true);
        done();
      } else open(i);
    }
  };
}

/**
 * Warp out: the camera pixelates heavily (and the picture whites out a
 * little) over `ms`, then `then` runs. Falls back to a fade without WebGL.
 */
export function pixelateOut(scene: Phaser.Scene, ms: number, then: () => void): void {
  const cam = scene.cameras.main;
  sfx.glitch();
  const fx = (cam as unknown as { postFX?: { addPixelate: (n: number) => { amount: number } } }).postFX?.addPixelate(-1);
  if (!fx) {
    cam.fadeOut(ms, 255, 255, 255);
    cam.once('camerafadeoutcomplete', then);
    return;
  }
  scene.tweens.add({ targets: fx, amount: 24, duration: ms, ease: 'Quad.easeIn', onComplete: then });
  scene.tweens.add({ targets: cam, alpha: { from: 1, to: 0.15 }, duration: ms, ease: 'Quad.easeIn' });
}

/** Warp in: start heavily pixelated and sharpen up over `ms`. */
export function pixelateIn(scene: Phaser.Scene, ms: number): void {
  const cam = scene.cameras.main;
  const fx = (cam as unknown as { postFX?: { addPixelate: (n: number) => { amount: number } } }).postFX?.addPixelate(24);
  if (!fx) {
    cam.fadeIn(ms, 255, 255, 255);
    return;
  }
  cam.setAlpha(0.15);
  scene.tweens.add({ targets: fx, amount: -1, duration: ms, ease: 'Quad.easeOut', onComplete: () => cam.postFX.clear() });
  scene.tweens.add({ targets: cam, alpha: 1, duration: ms, ease: 'Quad.easeOut' });
}
