import Phaser from 'phaser';
import { playMusic } from '../audio';
import { VIEW_W } from '../constants';
import { heroFrames } from '../heroSprites';
import { wearSavedSkin } from '../save';
import { sfx, unlockAudio } from '../sfx';
import { touchEnabled } from '../touch';
import { heroTexture } from '../weapons';
import { FONT, MenuScene } from './menu';
import { pixelText } from '../pixelFont';
import { startScene } from './lazy';

type Choice = 'start' | 'arcade' | 'arena' | 'settings' | 'dojo';

export class TitleScene extends MenuScene {
  private choices: Choice[] = [];
  private hero!: Phaser.GameObjects.Image;
  private shine!: Phaser.GameObjects.Rectangle;
  private glow!: Phaser.GameObjects.Ellipse;
  private sparks: { img: Phaser.GameObjects.Rectangle; vy: number; vx: number }[] = [];

  constructor() {
    super('title');
  }

  create(): void {
    wearSavedSkin();
    this.initMenu();
    playMusic(this, 'title');
    this.backdrop('foundry', 0.35);
    // Logo: a warm glow behind it, a deep shadow, a darker orange edge, the face, and a shine that sweeps across.
    this.glow = this.add.ellipse(VIEW_W / 2, 48, 230, 46, 0xff8a2a, 0.12).setBlendMode(Phaser.BlendModes.ADD);
    pixelText(this, VIEW_W / 2 + 3, 51, 'ULTRAGUY', { fontSize: '32px', color: '#1a1428' }).setOrigin(0.5);
    pixelText(this, VIEW_W / 2 + 1, 49, 'ULTRAGUY', { fontSize: '32px', color: '#b85a1a' }).setOrigin(0.5);
    const face = pixelText(this, VIEW_W / 2, 48, 'ULTRAGUY', { fontSize: '32px', color: '#ffb050' }).setOrigin(0.5);
    pixelText(this, VIEW_W / 2, 46, 'ULTRAGUY', { fontSize: '32px', color: '#ffe0a0' }).setOrigin(0.5).setAlpha(0.35).setMask(face.createBitmapMask());
    this.shine = this.add.rectangle(-60, 48, 14, 60, 0xffffff, 0.75).setAngle(20).setBlendMode(Phaser.BlendModes.ADD);
    this.shine.setMask(face.createBitmapMask());
    // A rule under the logo, brightest in the middle.
    for (let i = 0; i < 75; i++) this.add.rectangle(VIEW_W / 2 - 75 + i * 2, 70, 2, 1, 0xf28c28, 1 - Math.abs(i - 37) / 40);
    this.add.ellipse(VIEW_W / 2, 122, 40, 6, 0x000000, 0.35);
    const fr = heroFrames(this);
    this.hero = this.add.image(VIEW_W / 2, 104, heroTexture('buster'), fr.idle1_s ?? fr.idle_s).setScale(2);
    // Embers drifting up past the logo.
    this.sparks = Array.from({ length: 14 }, () => ({
      img: this.add.rectangle(Math.random() * VIEW_W, Math.random() * 240, 1, 1, Math.random() < 0.5 ? 0xffe14a : 0xf28c28, 0.8).setBlendMode(Phaser.BlendModes.ADD),
      vy: -0.2 - Math.random() * 0.4,
      vx: (Math.random() - 0.5) * 0.2,
    }));

    // ARCADE: replay the minigames you've won (the fortress is reached from the middle of boss select).
    this.choices = ['start', 'arcade', 'arena', 'dojo', 'settings'];
    const labels: Record<Choice, string> = { start: 'START', arcade: 'ARCADE', arena: 'ULTRA ARENA', dojo: 'DOJO', settings: 'SETTINGS' };
    this.panel(VIEW_W / 2, 140 + (this.choices.length * 14) / 2 - 4, 120, this.choices.length * 14 + 14);
    this.list(VIEW_W / 2 - 34, 140, this.choices.map((c) => labels[c]), 0);

    pixelText(this, VIEW_W / 2, 222, touchEnabled() ? 'TAP JUMP to choose' : 'ENTER / Z to choose', { fontFamily: FONT, fontSize: '8px', color: '#8a8fa8' }).setOrigin(0.5);
    // Any key unlocks audio (browser autoplay rules).
    this.input.keyboard!.once('keydown', unlockAudio);
  }

  protected tick(): boolean {
    // The shine crosses the logo every few seconds; UltraGuy idles; the glow breathes; embers drift.
    const t = this.frame % 240;
    this.shine.setX(t < 50 ? VIEW_W / 2 - 110 + t * 4.4 : -60);
    this.glow.setAlpha(0.1 + Math.sin(this.frame / 30) * 0.04);
    const fr = heroFrames(this);
    const idle = fr[`idle${1 + (Math.floor(this.frame / 14) % 4)}_s`];
    if (idle !== undefined) this.hero.setFrame(idle);
    for (const s of this.sparks) {
      s.img.x += s.vx;
      s.img.y += s.vy;
      if (s.img.y < -4) s.img.setPosition(Math.random() * VIEW_W, 244);
    }
    if (!this.confirmed()) return false;
    unlockAudio();
    sfx.select();
    const choice = this.choices[this.selected];
    // START goes to the save select (which starts the intro on a new game); DOJO is a stage of its own.
    if (choice === 'dojo') this.scene.start('game', { stage: 'dojo' });
    else if (choice === 'arena') startScene(this, 'arena');
    else this.scene.start(choice === 'start' ? 'slots' : choice);
    return true;
  }
}
