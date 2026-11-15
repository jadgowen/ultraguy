import { VIEW_W } from '../constants';
import { heroFrames } from '../heroSprites';
import { sfx, unlockAudio } from '../sfx';
import { heroTexture } from '../weapons';
import { FONT, MenuScene } from './menu';

export class TitleScene extends MenuScene {
  constructor() {
    super('title');
  }

  create(): void {
    this.initMenu();
    this.cameras.main.setBackgroundColor('#141626');
    this.add.tileSprite(0, 0, VIEW_W, 240, 'bg_foundry').setOrigin(0);
    this.add.text(VIEW_W / 2, 56, 'ULTRAGUY', { fontFamily: FONT, fontSize: '32px', color: '#f28c28', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.image(VIEW_W / 2, 110, heroTexture('buster'), heroFrames(this).idle_s).setScale(2);
    this.list(VIEW_W / 2 - 34, 152, ['START', 'SETTINGS']);
    this.add.text(VIEW_W / 2, 222, 'ENTER / Z to choose', { fontFamily: FONT, fontSize: '8px', color: '#8a8fa8' }).setOrigin(0.5);
    // Any key unlocks audio (browser autoplay rules).
    this.input.keyboard!.once('keydown', unlockAudio);
  }

  protected tick(): boolean {
    if (!this.confirmed()) return false;
    unlockAudio();
    sfx.select();
    this.scene.start(this.selected === 0 ? 'select' : 'settings');
    return true;
  }
}
