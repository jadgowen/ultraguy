import Phaser from 'phaser';
import { playMusic } from '../audio';
import { VIEW_H, VIEW_W } from '../constants';
import { heroFrames } from '../heroSprites';
import { makePipBits, pipTexture } from '../pip';
import { pixelText } from '../pixelFont';
import { loadSave, meetPip, wearSavedSkin } from '../save';
import { sfx } from '../sfx';
import { heroTexture } from '../weapons';
import { dialogue } from './cutscene';
import { FONT, MenuScene } from './menu';

/**
 * Meet Pip (once, the first time you come back to the stage select after
 * beating a boss). In Rivet's shop a crate on the counter rattles, the lid
 * pops off, and out comes Pip in a shower of sparks. It zips around the shop,
 * looks UltraGuy over, and Rivet makes the introductions. Then Pip comes
 * along for good.
 */
export class PipIntroScene extends MenuScene {
  private pip!: Phaser.GameObjects.Image;
  private pupil!: Phaser.GameObjects.Image;
  private lid!: Phaser.GameObjects.Rectangle;
  private rivet!: Phaser.GameObjects.Image;
  private hero!: Phaser.GameObjects.Image;
  private bits: { img: Phaser.GameObjects.Image; vx: number; vy: number; life: number; max: number }[] = [];
  private px = 0;
  private py = 0;
  private vx = 0;
  private vy = 0;
  private phase: 'rattle' | 'pop' | 'zip' | 'talk' | 'leave' = 'rattle';
  private t = 0;
  private story: (() => void) | null = null;
  private talking = false;

  constructor() {
    super('pipintro');
  }

  create(): void {
    this.initMenu();
    wearSavedSkin();
    makePipBits(this);
    this.backdrop('city', 0.7);
    playMusic(this, 'shop');
    this.phase = 'rattle';
    this.t = 0;
    this.bits = [];
    this.story = null;
    this.talking = false;
    pixelText(this, VIEW_W / 2, 12, "RIVET'S PARTS & PROVISIONS", { fontFamily: FONT, fontSize: '12px', color: '#4ab8a8', stroke: '#000000' }).setOrigin(0.5, 0);
    // The shop floor.
    const floor = this.add.graphics();
    floor.fillStyle(0x2a2a40).fillRect(0, 186, VIEW_W, VIEW_H - 186);
    floor.fillStyle(0x4a4e68).fillRect(0, 186, VIEW_W, 2);
    for (let x = 0; x < VIEW_W; x += 24) floor.fillStyle(0x22223a).fillRect(x, 190, 1, VIEW_H - 190);
    this.rivet = this.add.image(96, 152, 'rivet0').setOrigin(0.5, 1).setScale(2);
    this.add.image(16, 146, 'shop_counter').setOrigin(0, 0);
    // The crate on the counter, stenciled for the hero.
    const g = this.add.graphics();
    g.fillStyle(0x1a1428).fillRect(136, 122, 30, 24);
    g.fillStyle(0x9a6a3a).fillRect(137, 123, 28, 22);
    g.fillStyle(0xc89a5a).fillRect(137, 123, 28, 2);
    g.fillStyle(0x6a4422).fillRect(137, 133, 28, 1).fillRect(150, 123, 2, 22);
    pixelText(this, 151, 136, 'U.G.', { fontFamily: FONT, fontSize: '8px', color: '#3a2412' }).setOrigin(0.5, 0.5);
    this.lid = this.add.rectangle(151, 121, 32, 4, 0xc89a5a).setStrokeStyle(1, 0x1a1428);
    this.hero = this.add.image(330, 187, heroTexture('buster'), heroFrames(this).idle).setOrigin(0.5, 1).setScale(2).setFlipX(true);
    const save = loadSave();
    this.pip = this.add.image(151, 132, pipTexture(this, save.pipShell, save.pipPaint, 0)).setScale(2).setVisible(false).setDepth(5);
    this.pupil = this.add.image(151, 132, 'pip_pupil').setScale(2).setVisible(false).setDepth(5.1);
    this.px = 151;
    this.py = 132;
    this.vx = this.vy = 0;
    pixelText(this, VIEW_W / 2, VIEW_H - 10, 'Z / ENTER: next', { fontFamily: FONT, fontSize: '8px', color: '#8a8fa8' }).setOrigin(0.5, 0);
  }

  private spark(x: number, y: number, n: number, sp = 2): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const img = this.add.image(x, y, Math.random() < 0.5 ? 'pip_flame' : 'pip_dot').setScale(2).setDepth(4.9);
      const life = 16 + Math.floor(Math.random() * 12);
      this.bits.push({ img, vx: Math.cos(a) * sp * (0.4 + Math.random()), vy: Math.sin(a) * sp * (0.4 + Math.random()) - 0.6, life, max: life });
    }
  }

  protected tick(): boolean {
    this.t++;
    const f = this.t;
    const save = loadSave();
    // Rivet talks while the box is up.
    this.rivet.setTexture(this.talking && f % 10 < 5 ? 'rivet_talk' : f % 180 > 172 ? 'rivet1' : 'rivet0');
    if (this.phase === 'rattle') {
      // The crate rattles (harder and harder), with a muffled beep or two.
      const k = Math.min(1, f / 70);
      this.lid.setPosition(151 + (f % 4 < 2 ? 1 : -1) * k * 2, 121 - (f % 6 < 3 ? k * 2 : 0));
      if (f === 25 || f === 50) sfx.pip_chirp();
      if (f >= 80) {
        this.phase = 'pop';
        this.t = 0;
        sfx.pip_trill();
        this.spark(151, 120, 18, 2.5);
        this.pip.setVisible(true);
        this.pupil.setVisible(true);
        this.vy = -5;
        this.tweens.add({ targets: this.lid, x: 190, y: 60, angle: 200, alpha: 0, duration: 700, ease: 'Quad.easeOut' });
      }
    } else if (this.phase === 'pop' || this.phase === 'zip') {
      // Out it zips: a loop around the shop, then over to look the hero over.
      const tgt = this.phase === 'pop' ? { x: 210 + Math.cos(f * 0.07) * 70, y: 80 + Math.sin(f * 0.07) * 30 } : { x: 290, y: 128 };
      if (this.phase === 'pop' && f > 100) this.phase = 'zip';
      if (this.phase === 'zip' && f > 150 && !this.story) {
        this.phase = 'talk';
        this.startTalk();
      }
      this.steer(tgt.x, tgt.y);
    } else if (this.phase === 'talk') {
      // Hovering between them, bobbing, looking at whoever's talking.
      this.steer(220, 104);
      this.story?.();
    } else {
      // Off it goes, into the hero's corner.
      this.steer(312, 132);
      if (f > 60) {
        meetPip();
        this.scene.start('select');
        return true;
      }
    }
    // UltraGuy turns to watch it.
    this.hero.setFlipX(this.px < this.hero.x);
    // Draw Pip: tilt into the motion, flap, bob, thruster sparks.
    const fr: 0 | 1 = Math.floor(f / 5) % 2 === 0 ? 0 : 1;
    const y = this.py + Math.sin(f * 0.12) * 2;
    this.pip.setTexture(pipTexture(this, save.pipShell, save.pipPaint, fr)).setPosition(Math.round(this.px), Math.round(y)).setRotation(Phaser.Math.Clamp(this.vx * 0.08, -0.4, 0.4));
    if (this.pip.visible) {
      const lookRight = this.phase === 'talk' ? f % 240 < 120 : this.vx > 0;
      this.pip.setFlipX(!lookRight);
      this.pupil.setPosition(Math.round(this.px + (lookRight ? 2 : -2)), Math.round(y - 2)).setRotation(this.pip.rotation);
      if (f % 2 === 0) {
        const img = this.add.image(this.px + (Math.random() - 0.5) * 6, y + 14, Math.random() < 0.5 ? 'pip_flame' : 'pip_dot').setScale(2).setDepth(4.9);
        this.bits.push({ img, vx: (Math.random() - 0.5) * 0.8, vy: 1.2 + Math.random(), life: 14, max: 14 });
      }
    }
    for (const b of this.bits) {
      b.life--;
      b.vy += 0.04;
      b.img.x += b.vx;
      b.img.y += b.vy;
      b.img.setAlpha(Math.min(1, (b.life / b.max) * 1.6));
      if (b.life <= 0) b.img.destroy();
    }
    this.bits = this.bits.filter((b) => b.life > 0);
    return false;
  }

  /** Spring toward a spot (like Pip in the game, a bit livelier). */
  private steer(x: number, y: number): void {
    this.vx = (this.vx + (x - this.px) * 0.04) * 0.88;
    this.vy = (this.vy + (y - this.py) * 0.04) * 0.88;
    this.px += this.vx;
    this.py += this.vy;
  }

  private startTalk(): void {
    const save = loadSave();
    const rivet = { key: 'rivet0' };
    const pip = { key: pipTexture(this, save.pipShell, save.pipPaint, 0), scale: 2 };
    const teal = 0x4ab8a8;
    this.talking = true;
    this.story = dialogue(
      this,
      [
        { name: 'RIVET', text: "Hey, hero! Saw you flatten that robot master. Look what I've been tinkering on.", portrait: rivet, voice: 'pip_intro1', color: teal },
        { name: 'RIVET', text: 'Meet PIP! It has a lamp for the dark, and I can bolt on more gadgets if you bring me bolts.', portrait: rivet, voice: 'pip_intro2', color: teal },
        { name: 'PIP', text: 'Bweep! Bwee-dee-boop!', portrait: pip, color: 0x5ef0c8, onOpen: () => {
          sfx.pip_trill();
          this.spark(this.px, this.py, 10, 2);
          this.vy -= 3;
        } },
        { name: 'RIVET', text: 'Ha! It likes you. Go on, take it along. Come see me for upgrades, sugar!', portrait: rivet, voice: 'pip_intro3', color: teal },
      ],
      () => this.controls.justPressed('jump') || this.controls.justPressed('start'),
      () => {
        this.talking = false;
        this.phase = 'leave';
        this.t = 0;
        sfx.pip_chirp();
      },
    );
  }
}
