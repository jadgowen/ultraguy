import Phaser from 'phaser';
import { playMusic } from '../audio';
import { ARCADE_GAMES, arcadeUnlocked } from '../arcade';
import { VIEW_H, VIEW_W } from '../constants';
import { getStage } from '../level/stages';
import { PixelText, pixelText } from '../pixelFont';
import { loadSave } from '../save';
import { sfx } from '../sfx';
import { touch } from '../touch';
import { pixelateOut } from './cutscene';
import { ensureScene, startScene } from './lazy';
import { FONT, MenuScene } from './menu';

/**
 * ARCADE (title menu): replay any boss's game you've won in the story, plus
 * the Overlord's armada once you've beaten the game. Ones you haven't won yet
 * show as ??? with where to find them. A game played from here comes back here.
 */
export class ArcadeScene extends MenuScene {
  private rows: PixelText[] = [];
  private arrow!: PixelText;
  private portrait!: Phaser.GameObjects.Image;
  private nameText!: PixelText;
  private hostText!: PixelText;
  private noteText!: PixelText;
  private pick = 0;
  private unlocked = new Set<string>();
  private backKey!: Phaser.Input.Keyboard.Key;
  private leaving = false;

  constructor() {
    super('arcade');
  }

  create(data?: { pick?: string }): void {
    this.initMenu();
    this.backdrop('city', 0.75);
    this.backKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.BACKSPACE);
    this.leaving = false;
    this.unlocked = arcadeUnlocked(loadSave());
    // Back from a game: the cursor stays on it.
    this.pick = Math.max(0, ARCADE_GAMES.findIndex((g) => g.scene === data?.pick));
    playMusic(this, 'title');
    const small = { fontFamily: FONT, fontSize: '8px', color: '#8a8fa8' };
    pixelText(this, VIEW_W / 2, 10, 'ARCADE', { fontFamily: FONT, fontSize: '16px', color: '#ffe14a', stroke: '#000000' }).setOrigin(0.5, 0);
    pixelText(this, VIEW_W / 2, 30, `${this.unlocked.size}/${ARCADE_GAMES.length} GAMES`, small).setOrigin(0.5, 0);
    this.panel(130, 128, 230, 160);
    this.rows = ARCADE_GAMES.map((_, i) => pixelText(this, 34, 56 + i * 14, '', { fontFamily: FONT, fontSize: '12px', color: '#8a8fa8' }));
    this.arrow = pixelText(this, 22, 56, '>', { fontFamily: FONT, fontSize: '12px', color: '#5ef0c8' });
    // The card: whose game it is, its name, and what's on it.
    this.panel(VIEW_W - 76, 124, 132, 156);
    this.portrait = this.add.image(VIEW_W - 76, 98, '__DEFAULT').setOrigin(0.5, 1);
    this.hostText = pixelText(this, VIEW_W - 76, 110, '', { fontFamily: FONT, fontSize: '8px', color: '#ffe14a' }).setOrigin(0.5, 0);
    this.nameText = pixelText(this, VIEW_W - 76, 126, '', { fontFamily: FONT, fontSize: '8px', color: '#fff1e0' }).setOrigin(0.5, 0);
    this.noteText = pixelText(this, VIEW_W - 76, 148, '', { fontFamily: FONT, fontSize: '8px', color: '#8a8fa8', align: 'center' }).setOrigin(0.5, 0);
    pixelText(this, VIEW_W / 2, VIEW_H - 12, 'UP/DOWN choose   ENTER/Z play   X/BKSP back', small).setOrigin(0.5, 0);
    this.draw();
    // Fetch the chosen game's code early.
    void ensureScene(this.game, ARCADE_GAMES[this.pick].scene);
  }

  private draw(): void {
    ARCADE_GAMES.forEach((g, i) => {
      const open = this.unlocked.has(g.scene);
      this.rows[i].setText(open ? g.title : '???').setColor(i === this.pick ? '#fff1e0' : open ? '#8a8fa8' : '#4a4e68');
    });
    this.arrow.setY(56 + this.pick * 14);
    const g = ARCADE_GAMES[this.pick];
    const open = this.unlocked.has(g.scene);
    const key = `${g.host.toLowerCase()}_idle`;
    this.portrait.setTexture(this.textures.exists(key) ? key : '__DEFAULT').setVisible(this.textures.exists(key));
    // Fit the portrait in the card (some bosses are big).
    const s = Math.min(2, 56 / this.portrait.height, 110 / this.portrait.width);
    this.portrait.setScale(Math.max(0.5, s));
    if (open) this.portrait.clearTint().setAlpha(1);
    else this.portrait.setTintFill(0x1a1428).setAlpha(0.9);
    this.hostText.setText(open ? g.host : '???');
    this.nameText.setText(open ? g.title : '');
    const where = getStage(g.stage).name;
    this.noteText.setText(open ? `${where}\nZ TO PLAY` : g.scene === 'shooter' ? 'BEAT THE GAME\nTO UNLOCK' : `WIN IT IN\n${where}`);
  }

  protected tick(): boolean {
    if (this.leaving) return false;
    if (Phaser.Input.Keyboard.JustDown(this.backKey) || touch.takeBack() || this.controls.justPressed('fire')) {
      sfx.select();
      this.scene.start('title');
      return true;
    }
    const dy = this.controls.justPressed('down') ? 1 : this.controls.justPressed('up') ? -1 : 0;
    if (dy) {
      this.pick = (this.pick + dy + ARCADE_GAMES.length) % ARCADE_GAMES.length;
      sfx.tick();
      this.draw();
      void ensureScene(this.game, ARCADE_GAMES[this.pick].scene);
    }
    if (this.confirmed()) {
      const g = ARCADE_GAMES[this.pick];
      if (!this.unlocked.has(g.scene)) {
        sfx.hurt();
        return false;
      }
      sfx.select();
      this.leaving = true;
      pixelateOut(this, 700, () => startScene(this, g.scene, { stage: g.stage, ret: { kind: 'arcade', step: 0 } }));
      return true;
    }
    return false;
  }
}
