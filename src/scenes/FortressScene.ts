import Phaser from 'phaser';
import { touch } from '../touch';
import { VIEW_H, VIEW_W } from '../constants';
import type { FortressStageId } from '../level/Level';
import { FORTRESS_ORDER, FORTRESS_STAGES } from '../level/stages';
import { loadSave } from '../save';
import { sfx } from '../sfx';
import type { GameSceneData } from './GameScene';
import { FONT, MenuScene } from './menu';
import { playMusic } from '../audio';
import { PixelText, pixelText } from '../pixelFont';

/**
 * The fortress map: three fortress stages and the final stage, unlocked in
 * order. Cleared ones can be replayed.
 */
export class FortressScene extends MenuScene {
  private pick = 0;
  private unlocked = 0;
  private marks: PixelText[] = [];
  private launching: { data: GameSceneData; t: number } | null = null;
  private launchText!: PixelText;
  private backKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('fortress');
  }

  create(): void {
    this.initMenu();
    playMusic(this, 'select');
    this.launching = null;
    this.marks = [];
    this.backKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.BACKSPACE);
    this.cameras.main.setBackgroundColor('#0c0612');
    this.backdrop('fortress', 0.45);
    const save = loadSave();
    // You can play every cleared stage plus the next one.
    const clearedCount = FORTRESS_ORDER.findIndex((id) => !save.cleared.includes(id));
    this.unlocked = clearedCount === -1 ? FORTRESS_ORDER.length - 1 : clearedCount;
    this.pick = this.unlocked;

    pixelText(this, VIEW_W / 2, 16, 'THE FORTRESS', { fontFamily: FONT, fontSize: '16px', color: '#ff5050' }).setOrigin(0.5);

    // A path up the tower: stage 1 at the bottom, the throne at the top.
    const ys = [204, 166, 128, 90, 52];
    const g = this.add.graphics();
    g.lineStyle(2, 0x3a2a4a, 1);
    for (let i = 0; i < ys.length - 1; i++) g.lineBetween(VIEW_W / 2, ys[i] - 10, VIEW_W / 2, ys[i + 1] + 10);
    FORTRESS_ORDER.forEach((id: FortressStageId, i) => {
      const stage = FORTRESS_STAGES[id];
      const cleared = save.cleared.includes(id);
      const locked = i > this.unlocked;
      const color = locked ? '#4a3a5a' : cleared ? '#5ef0c8' : '#fff1e0';
      g.fillStyle(locked ? 0x2a1a34 : i === FORTRESS_ORDER.length - 1 ? 0xff5050 : 0x6a4a8a, 1).fillRect(VIEW_W / 2 - 8, ys[i] - 8, 16, 16);
      pixelText(this, VIEW_W / 2 + 18, ys[i] - 5, locked ? '???' : stage.name, { fontFamily: FONT, fontSize: '8px', color });
      if (cleared) pixelText(this, VIEW_W / 2 - 22, ys[i] - 5, 'OK', { fontFamily: FONT, fontSize: '8px', color: '#5ef0c8' }).setOrigin(1, 0);
      this.marks.push(pixelText(this, VIEW_W / 2 - 34, ys[i] - 6, '>', { fontFamily: FONT, fontSize: '12px', color: '#5ef0c8' }).setOrigin(1, 0));
    });

    pixelText(this, VIEW_W / 2, VIEW_H - 10, 'UP/DOWN choose   ENTER/Z start   BKSP back', { fontFamily: FONT, fontSize: '8px', color: '#8a8fa8' }).setOrigin(0.5);
    this.launchText = pixelText(this, VIEW_W / 2, VIEW_H / 2, '', { fontFamily: FONT, fontSize: '16px', color: '#fff1e0', backgroundColor: '#000000', align: 'center', padding: { x: 8, y: 6 } })
      .setOrigin(0.5)
      .setDepth(10)
      .setVisible(false);
  }

  protected tick(): boolean {
    if (this.launching) {
      if (++this.launching.t >= 80) {
        this.scene.start('game', this.launching.data);
        return true;
      }
      return false;
    }
    const c = this.controls;
    // Up the tower = later stages.
    if (c.justPressed('up') && this.pick < this.unlocked) {
      this.pick++;
      sfx.tick();
    }
    if (c.justPressed('down') && this.pick > 0) {
      this.pick--;
      sfx.tick();
    }
    if (Phaser.Input.Keyboard.JustDown(this.backKey) || touch.takeBack()) {
      this.scene.start('title');
      return true;
    }
    if (this.confirmed()) {
      const id = FORTRESS_ORDER[this.pick];
      sfx.select();
      this.launching = { data: { stage: id }, t: 0 };
      this.launchText.setText(FORTRESS_STAGES[id].name).setVisible(true);
    }
    return false;
  }

  update(t: number, delta: number): void {
    super.update(t, delta);
    const blink = Math.floor(this.frame / 10) % 2 === 0;
    this.marks.forEach((m, i) => m.setVisible(i === this.pick && blink));
  }
}
