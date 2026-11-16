import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../constants';
import { heroFrames } from '../heroSprites';
import { sfx } from '../sfx';
import { WEAPON_ORDER, heroTexture } from '../weapons';
import { FONT, MenuScene } from './menu';
import { playMusic } from '../audio';
import { PixelText, pixelText } from '../pixelFont';

const CREDITS = [
  'THE FORTRESS HAS FALLEN',
  '',
  'ANVIL     MANTIS',
  'FROSTLINE GALE',
  'VOLT      MAGMA',
  'SCRAP     TIDE',
  '',
  'OVERLORD',
  'SHADE',
  '',
  'THANK YOU FOR PLAYING',
  '',
  'ULTRAGUY',
];

/** Ending: the hero cycles through every weapon color while the credits roll. */
export class EndingScene extends MenuScene {
  private hero!: Phaser.GameObjects.Image;
  private credits!: PixelText;

  constructor() {
    super('ending');
  }

  create(): void {
    this.initMenu();
    playMusic(this, 'ending');
    this.backdrop('sky', 0.3);
    this.hero = this.add.image(VIEW_W / 2, VIEW_H - 40, heroTexture('buster'), heroFrames(this).idle).setScale(2).setOrigin(0.5, 1);
    this.credits = pixelText(this, VIEW_W / 2, VIEW_H + 10, CREDITS.join('\n'), { fontFamily: FONT, fontSize: '12px', color: '#fff1e0', align: 'center', lineSpacing: 6 })
      .setOrigin(0.5, 0);
    pixelText(this, VIEW_W / 2, VIEW_H - 12, 'ENTER to return to the title', { fontFamily: FONT, fontSize: '8px', color: '#8a8fa8' }).setOrigin(0.5);
    sfx.clear();
  }

  protected tick(): boolean {
    // Scroll the credits up and stop with the last line near the top.
    if (this.credits.y + this.credits.height > 70) this.credits.y -= 0.35;
    const w = WEAPON_ORDER[Math.floor(this.frame / 40) % WEAPON_ORDER.length];
    this.hero.setTexture(heroTexture(w), heroFrames(this).idle);
    if (this.frame > 60 && this.confirmed()) {
      sfx.select();
      this.scene.start('title');
      return true;
    }
    return false;
  }
}
