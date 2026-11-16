import Phaser from 'phaser';
import { playMusic } from '../audio';
import { VIEW_H, VIEW_W } from '../constants';
import { ALL_BOSS_STAGES, hasStage } from '../level/stages';
import { MAX_TANKS, SLOTS, SaveData, clearSave, loadSave, slotUsed } from '../save';
import { loadSettings, updateSettings } from '../settings';
import { sfx } from '../sfx';
import { touch } from '../touch';
import { FONT, MenuScene } from './menu';
import { PixelText, pixelText } from '../pixelFont';

/** One line describing a slot's progress. */
export function slotSummary(save: SaveData, used: boolean): string {
  if (!used) return 'NEW GAME';
  if (save.cleared.includes('finale')) return 'COMPLETE!';
  const bosses = ALL_BOSS_STAGES.filter((id) => save.cleared.includes(id)).length;
  return `${bosses}/${ALL_BOSS_STAGES.length} BOSSES  ${save.parts.length}/4 PARTS  ${save.tanks}/${MAX_TANKS} E-TANKS`;
}

/**
 * Save select: three slots. ENTER / Z plays a slot (a new game starts with
 * the intro stage); X twice erases one.
 */
export class SlotScene extends MenuScene {
  private labels: PixelText[] = [];
  private confirmErase = -1;

  constructor() {
    super('slots');
  }

  create(): void {
    this.initMenu();
    playMusic(this, 'title');
    this.confirmErase = -1;
    this.backdrop('power', 0.6);
    const small = { fontFamily: FONT, fontSize: '8px', color: '#8a8fa8' };
    pixelText(this, VIEW_W / 2, 26, 'SELECT SAVE', { fontFamily: FONT, fontSize: '16px', color: '#f28c28' }).setOrigin(0.5);
    this.labels = this.list(60, 70, [...SLOTS.map(() => ''), 'BACK'], loadSettings().slot - 1);
    this.refresh();
    pixelText(this, VIEW_W / 2, VIEW_H - 26, 'ENTER / Z play   X erase   BKSP back', small).setOrigin(0.5);
    const back = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.BACKSPACE);
    back.once('down', () => this.scene.start('title'));
  }

  private refresh(): void {
    // Rows are spaced out; reapply highlight colors (without clearing the erase prompt).
    this.labels.forEach((t, i) => t.setY(70 + i * 26));
    super.select(this.selected);
    SLOTS.forEach((slot, i) => {
      const text = this.confirmErase === slot ? 'PRESS X AGAIN TO ERASE' : slotSummary(loadSave(slot), slotUsed(slot));
      this.labels[i].setText(`SLOT ${slot}   ${text}`);
      if (this.confirmErase === slot) this.labels[i].setColor('#ff9a7a');
    });
  }

  protected select(i: number): void {
    super.select(i);
    // Moving the cursor cancels a pending erase.
    if (this.confirmErase >= 0 && this.labels.length) {
      this.confirmErase = -1;
      this.refresh();
    }
  }

  protected tick(): boolean {
    if (touch.takeBack()) {
      this.scene.start('title');
      return true;
    }
    const slot = SLOTS[this.selected];
    if (this.controls.justPressed('fire')) {
      if (!slot || !slotUsed(slot)) return false;
      if (this.confirmErase !== slot) {
        this.confirmErase = slot;
        sfx.tick();
      } else {
        clearSave(slot);
        this.confirmErase = -1;
        sfx.select();
      }
      this.refresh();
      return false;
    }
    if (!this.confirmed()) return false;
    sfx.select();
    if (!slot) {
      this.scene.start('title');
      return true;
    }
    updateSettings((s) => {
      s.slot = slot;
    });
    // A new game opens with the intro stage; after that, boss select.
    if (!loadSave(slot).cleared.includes('intro') && hasStage('intro')) this.scene.start('game', { stage: 'intro' });
    else this.scene.start('select');
    return true;
  }
}
