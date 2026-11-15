import Phaser from 'phaser';
import { VIEW_W } from '../constants';
import { clearSave, loadSave } from '../save';
import { sfx } from '../sfx';
import { FONT, MenuScene } from './menu';
import { playMusic } from '../audio';

const CONTROLS = [
  ['MOVE / CLIMB', 'ARROWS or WASD', 'D-PAD / STICK'],
  ['JUMP', 'Z  SPACE  K', 'A'],
  ['FIRE', 'X  J', 'B / X'],
  ['CHARGE', 'hold FIRE, release', ''],
  ['PAUSE / WEAPONS', 'ENTER  ESC  P', 'START'],
];

/** Controls reference and save management. */
export class SettingsScene extends MenuScene {
  private labels: Phaser.GameObjects.Text[] = [];
  private progress!: Phaser.GameObjects.Text;
  private confirmClear = false;

  constructor() {
    super('settings');
  }

  create(): void {
    this.initMenu();
    playMusic(this, 'title');
    this.confirmClear = false;
    this.cameras.main.setBackgroundColor('#141626');
    const small = { fontFamily: FONT, fontSize: '8px', color: '#8a8fa8' };
    this.add.text(VIEW_W / 2, 20, 'SETTINGS', { fontFamily: FONT, fontSize: '16px', color: '#f28c28' }).setOrigin(0.5);

    this.add.text(40, 42, 'CONTROLS', { ...small, color: '#5ef0c8' });
    this.add.text(150, 42, 'KEYBOARD', small);
    this.add.text(290, 42, 'GAMEPAD', small);
    CONTROLS.forEach(([what, keys, pad], i) => {
      const y = 56 + i * 13;
      this.add.text(40, y, what, { ...small, color: '#fff1e0' });
      this.add.text(150, y, keys, small);
      this.add.text(290, y, pad, small);
    });

    this.add.text(40, 132, 'SAVE DATA', { ...small, color: '#5ef0c8' });
    this.progress = this.add.text(150, 132, '', small);
    this.updateProgress();

    this.labels = this.list(VIEW_W / 2 - 40, 168, ['CLEAR SAVE', 'BACK']);
    this.add.text(VIEW_W / 2, 222, 'UP/DOWN  ENTER / Z', small).setOrigin(0.5);
  }

  private updateProgress(): void {
    const save = loadSave();
    this.progress.setText(`${save.cleared.length}/4 stages cleared, ${save.weapons.length - 1} boss weapons`);
  }

  protected select(i: number): void {
    super.select(i);
    if (this.confirmClear) {
      this.confirmClear = false;
      this.labels[0]?.setText('CLEAR SAVE');
    }
  }

  protected tick(): boolean {
    const back = this.controls.justPressed('fire');
    if (!this.confirmed() && !back) return false;
    if (back || this.selected === 1) {
      sfx.select();
      this.scene.start('title');
      return true;
    }
    if (!this.confirmClear) {
      // Two-step confirm so a stray key press can't wipe progress.
      this.confirmClear = true;
      this.labels[0].setText('PRESS AGAIN TO CONFIRM').setColor('#ff9a7a');
      sfx.tick();
    } else {
      clearSave();
      this.confirmClear = false;
      this.labels[0].setText('SAVE CLEARED').setColor('#fff1e0');
      this.updateProgress();
      sfx.select();
    }
    return false;
  }
}
