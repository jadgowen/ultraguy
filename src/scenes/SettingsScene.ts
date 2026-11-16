import Phaser from 'phaser';
import { playMusic, setMusicLevel } from '../audio';
import { VIEW_W } from '../constants';
import { VOLUME_STEPS, loadSettings, updateSettings, volumeOf } from '../settings';
import { setSfxLevel, sfx } from '../sfx';
import { FONT, MenuScene } from './menu';
import { PixelText, pixelText } from '../pixelFont';

const ROWS = ['MUSIC', 'SOUND FX', 'CONTROLS', 'BACK'] as const;

/** Settings: volume mixer (music / sound effects) and the way into key remapping. */
export class SettingsScene extends MenuScene {
  private labels: PixelText[] = [];

  constructor() {
    super('settings');
  }

  create(): void {
    this.initMenu();
    playMusic(this, 'title');
    this.backdrop('power', 0.6);
    const small = { fontFamily: FONT, fontSize: '8px', color: '#8a8fa8' };
    pixelText(this, VIEW_W / 2, 24, 'SETTINGS', { fontFamily: FONT, fontSize: '16px', color: '#f28c28' }).setOrigin(0.5);
    pixelText(this, VIEW_W / 2, 50, 'MIXER', { ...small, color: '#5ef0c8' }).setOrigin(0.5);
    this.labels = this.list(VIEW_W / 2 - 110, 70, ROWS.map(() => ''));
    this.refresh();
    pixelText(this, VIEW_W / 2, 200, 'LEFT/RIGHT change volume', small).setOrigin(0.5);
    pixelText(this, VIEW_W / 2, 214, 'UP/DOWN choose   ENTER / Z select   X back', small).setOrigin(0.5);
  }

  private bar(level: number): string {
    return '#'.repeat(level) + '-'.repeat(VOLUME_STEPS - level) + ` ${String(level * 10).padStart(3)}%`;
  }

  private refresh(): void {
    const s = loadSettings();
    this.labels[0].setText(`MUSIC      ${this.bar(s.music)}`);
    this.labels[1].setText(`SOUND FX   ${this.bar(s.sfx)}`);
    this.labels[2].setText('CONTROLS');
    this.labels[3].setText('BACK');
  }

  private adjust(dir: number): void {
    const row = ROWS[this.selected];
    if (row !== 'MUSIC' && row !== 'SOUND FX') return;
    const s = updateSettings((st) => {
      if (row === 'MUSIC') st.music = Phaser.Math.Clamp(st.music + dir, 0, VOLUME_STEPS);
      else st.sfx = Phaser.Math.Clamp(st.sfx + dir, 0, VOLUME_STEPS);
    });
    setMusicLevel(volumeOf(s.music));
    setSfxLevel(volumeOf(s.sfx));
    sfx.select(); // a sample at the new level
    this.refresh();
  }

  protected tick(): boolean {
    const c = this.controls;
    if (c.justPressed('left')) this.adjust(-1);
    if (c.justPressed('right')) this.adjust(1);
    if (c.justPressed('fire')) {
      sfx.select();
      this.scene.start('title');
      return true;
    }
    if (!this.confirmed()) return false;
    const row = ROWS[this.selected];
    if (row === 'CONTROLS') {
      sfx.select();
      this.scene.start('controls');
      return true;
    }
    if (row === 'BACK') {
      sfx.select();
      this.scene.start('title');
      return true;
    }
    return false;
  }
}
