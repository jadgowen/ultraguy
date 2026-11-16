import { playMusic } from '../audio';
import { VIEW_W } from '../constants';
import { heroFrames } from '../heroSprites';
import { ALL_BOSS_STAGES } from '../level/stages';
import { loadSave } from '../save';
import { sfx, unlockAudio } from '../sfx';
import { touchEnabled } from '../touch';
import { heroTexture } from '../weapons';
import { FONT, MenuScene } from './menu';
import { pixelText } from '../pixelFont';

type Choice = 'start' | 'fortress' | 'settings';

export class TitleScene extends MenuScene {
  private choices: Choice[] = [];

  constructor() {
    super('title');
  }

  create(): void {
    this.initMenu();
    playMusic(this, 'title');
    this.backdrop('foundry', 0.35);
    // Logo: a deep shadow, a darker orange edge, then the face.
    pixelText(this, VIEW_W / 2 + 3, 51, 'ULTRAGUY', { fontSize: '32px', color: '#1a1428' }).setOrigin(0.5);
    pixelText(this, VIEW_W / 2 + 1, 49, 'ULTRAGUY', { fontSize: '32px', color: '#b85a1a' }).setOrigin(0.5);
    pixelText(this, VIEW_W / 2, 48, 'ULTRAGUY', { fontSize: '32px', color: '#ffb050' }).setOrigin(0.5);
    this.add.rectangle(VIEW_W / 2, 70, 150, 1, 0xf28c28);
    this.add.image(VIEW_W / 2, 104, heroTexture('buster'), heroFrames(this).idle_s).setScale(2);

    // FORTRESS appears once all eight bosses are beaten (in the last-played slot).
    const save = loadSave();
    const fortressOpen = ALL_BOSS_STAGES.every((id) => save.cleared.includes(id));
    this.choices = fortressOpen ? ['start', 'fortress', 'settings'] : ['start', 'settings'];
    const labels: Record<Choice, string> = { start: 'START', fortress: 'FORTRESS', settings: 'SETTINGS' };
    this.panel(VIEW_W / 2, 140 + (this.choices.length * 14) / 2 - 4, 120, this.choices.length * 14 + 14);
    this.list(VIEW_W / 2 - 34, 140, this.choices.map((c) => labels[c]), fortressOpen ? 1 : 0);

    pixelText(this, VIEW_W / 2, 222, touchEnabled() ? 'TAP JUMP to choose' : 'ENTER / Z to choose', { fontFamily: FONT, fontSize: '8px', color: '#8a8fa8' }).setOrigin(0.5);
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
