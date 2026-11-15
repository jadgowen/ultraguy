import { playMusic } from '../audio';
import { VIEW_W } from '../constants';
import { heroFrames } from '../heroSprites';
import { ALL_BOSS_STAGES } from '../level/stages';
import { loadSave } from '../save';
import { sfx, unlockAudio } from '../sfx';
import { heroTexture } from '../weapons';
import { FONT, MenuScene } from './menu';

type Choice = 'start' | 'fortress' | 'settings';

export class TitleScene extends MenuScene {
  private choices: Choice[] = [];

  constructor() {
    super('title');
  }

  create(): void {
    this.initMenu();
    playMusic(this, 'title');
    this.cameras.main.setBackgroundColor('#141626');
    this.add.tileSprite(0, 0, VIEW_W, 240, 'bg_foundry').setOrigin(0);
    this.add.text(VIEW_W / 2, 50, 'ULTRAGUY', { fontFamily: FONT, fontSize: '32px', color: '#f28c28', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.image(VIEW_W / 2, 104, heroTexture('buster'), heroFrames(this).idle_s).setScale(2);

    // FORTRESS appears once all eight bosses are beaten (in the last-played slot).
    const save = loadSave();
    const fortressOpen = ALL_BOSS_STAGES.every((id) => save.cleared.includes(id));
    this.choices = fortressOpen ? ['start', 'fortress', 'settings'] : ['start', 'settings'];
    const labels: Record<Choice, string> = { start: 'START', fortress: 'FORTRESS', settings: 'SETTINGS' };
    this.list(VIEW_W / 2 - 34, 140, this.choices.map((c) => labels[c]), fortressOpen ? 1 : 0);

    this.add.text(VIEW_W / 2, 222, 'ENTER / Z to choose', { fontFamily: FONT, fontSize: '8px', color: '#8a8fa8' }).setOrigin(0.5);
    // Any key unlocks audio (browser autoplay rules).
    this.input.keyboard!.once('keydown', unlockAudio);
  }

  protected tick(): boolean {
    if (!this.confirmed()) return false;
    unlockAudio();
    sfx.select();
    const choice = this.choices[this.selected];
    // START goes to the save select (which starts the intro on a new game).
    this.scene.start(choice === 'start' ? 'slots' : choice);
    return true;
  }
}
