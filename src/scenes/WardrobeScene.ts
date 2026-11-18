import Phaser from 'phaser';
import { playVoice } from '../audio';
import { VIEW_H, VIEW_W } from '../constants';
import { heroFrames } from '../heroSprites';
import { PixelText, pixelText } from '../pixelFont';
import { buySkin, loadSave, setSkin, wearSavedSkin } from '../save';
import { SHOP_SKINS, currentSkin, skinTexture } from '../skins';
import { sfx } from '../sfx';
import { touch } from '../touch';
import { FONT, MenuScene } from './menu';

/**
 * RIVET'S PAINT SHOP (COLORS at the shop): new color schemes for UltraGuy,
 * bought with bolts. The hero on the left tries on whichever one you point
 * at. Pick one you own to wear it; bought ones also show up in the stage
 * select's color picker.
 */
export class WardrobeScene extends MenuScene {
  private hero!: Phaser.GameObjects.Image;
  private rows: PixelText[] = [];
  private boltsText!: PixelText;
  private note!: PixelText;
  private backKey!: Phaser.Input.Keyboard.Key;
  /** A message from the last purchase stays up this long. */
  private noteT = 0;

  constructor() {
    super('wardrobe');
  }

  create(): void {
    this.initMenu();
    wearSavedSkin();
    this.backdrop('city', 0.7);
    this.backKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.BACKSPACE);
    const small = { fontFamily: FONT, fontSize: '8px', color: '#8a8fa8' };
    pixelText(this, VIEW_W / 2, 10, "RIVET'S PAINT SHOP", { fontFamily: FONT, fontSize: '12px', color: '#4ab8a8', stroke: '#000000' }).setOrigin(0.5, 0);
    // A spotlight and a plinth for the hero to model on.
    this.panel(92, 120, 130, 156);
    const g = this.add.graphics();
    g.fillStyle(0xfff1e0, 0.06).fillTriangle(92, 44, 52, 170, 132, 170);
    g.fillStyle(0x2a2a40).fillRect(60, 170, 64, 8);
    g.fillStyle(0x4a4e68).fillRect(60, 170, 64, 2);
    this.hero = this.add.image(92, 170, skinTexture(currentSkin()), heroFrames(this).idle).setOrigin(0.5, 1).setScale(3);
    this.panel(300, 112, 220, 150);
    const labels = [...SHOP_SKINS.map((s) => s.name), 'BACK'];
    this.rows = this.list(208, 44, labels);
    this.boltsText = pixelText(this, 208, 188, '', { fontFamily: FONT, fontSize: '12px', color: '#c8ccd8' });
    this.add.image(200, 194, 'nut').setScale(1.5);
    this.note = pixelText(this, VIEW_W / 2, VIEW_H - 24, '', { ...small, color: '#5ef0c8' }).setOrigin(0.5, 0);
    pixelText(this, VIEW_W / 2, VIEW_H - 12, 'UP/DOWN choose   ENTER/Z buy or wear   BKSP back', small).setOrigin(0.5, 0);
    this.refresh();
  }

  private refresh(): void {
    const save = loadSave();
    SHOP_SKINS.forEach((s, i) => {
      const tag = currentSkin() === s.id ? 'WEARING' : save.boughtSkins.includes(s.id) ? 'OWNED' : String(s.price);
      this.rows[i].setText(`${s.name.padEnd(10)} ${tag}`);
    });
    this.select(this.selected);
    this.boltsText.setText(String(save.bolts));
    const s = SHOP_SKINS[this.selected];
    if (this.noteT > 0) return;
    if (s) this.note.setText(save.boughtSkins.includes(s.id) ? 'yours: ENTER to wear it' : `${s.price} bolts`);
    if (!s) this.note.setText('back to the counter');
  }

  protected tick(): boolean {
    const frames = heroFrames(this);
    const s = SHOP_SKINS[this.selected];
    // The hero tries on whatever you're pointing at (and runs in place now and then).
    const tex = skinTexture(s ? s.id : currentSkin());
    const run = Math.floor(this.frame / 120) % 3 === 1;
    this.hero.setTexture(tex, run ? frames[`run${1 + (Math.floor(this.frame / 4) % 8)}`] : frames.idle);
    if (this.noteT > 0) this.noteT--;
    if (this.frame % 4 === 0) this.refresh();
    if (Phaser.Input.Keyboard.JustDown(this.backKey) || touch.takeBack() || this.controls.justPressed('fire')) {
      this.back();
      return true;
    }
    if (!this.confirmed()) return false;
    if (!s) {
      this.back();
      return true;
    }
    const save = loadSave();
    if (save.boughtSkins.includes(s.id)) {
      setSkin(s.id);
      sfx.select();
      this.note.setText(`wearing ${s.name}`);
      this.noteT = 90;
      return false;
    }
    const r = buySkin(s.id);
    if (r === 'ok') {
      setSkin(s.id);
      sfx.pickup();
      playVoice(this, 'shop_thanks');
      this.note.setText(`${s.name}: yours, and on!`);
      this.noteT = 90;
    } else {
      sfx.hurt();
      playVoice(this, 'shop_broke');
      this.note.setText(`a few bolts short (${s.price})`);
      this.noteT = 90;
    }
    this.refresh();
    return false;
  }

  private back(): void {
    sfx.select();
    this.scene.start('shop');
  }
}
