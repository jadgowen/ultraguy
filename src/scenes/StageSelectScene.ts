import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../constants';
import { heroFrames } from '../heroSprites';
import type { StageId } from '../level/Level';
import { STAGES, STAGE_SELECT_ORDER } from '../level/stages';
import { THEMES } from '../level/themes';
import { loadSave } from '../save';
import { sfx } from '../sfx';
import { WEAPONS, heroTexture } from '../weapons';
import type { GameSceneData } from './GameScene';
import { FONT, MenuScene } from './menu';

const PANEL_W = 72;
const PANEL_H = 52;

/** Panel positions: up, left, right, down around the hero (matches STAGE_SELECT_ORDER). */
const SLOTS: { x: number; y: number; dir: 'up' | 'left' | 'right' | 'down' }[] = [
  { x: VIEW_W / 2, y: 62, dir: 'up' },
  { x: VIEW_W / 2 - 124, y: 124, dir: 'left' },
  { x: VIEW_W / 2 + 124, y: 124, dir: 'right' },
  { x: VIEW_W / 2, y: 186, dir: 'down' },
];

/** Pick one of the four boss stages. Arrow keys point at a boss. */
export class StageSelectScene extends MenuScene {
  private pick = 0;
  private frames: Phaser.GameObjects.Rectangle[] = [];
  private launching: { data: GameSceneData; t: number } | null = null;
  private launchText!: Phaser.GameObjects.Text;
  private backKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('select');
  }

  create(): void {
    this.initMenu();
    this.backKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.BACKSPACE);
    this.launching = null;
    this.frames = [];
    this.cameras.main.setBackgroundColor('#0b0d1a');
    const save = loadSave();
    const small = { fontFamily: FONT, fontSize: '8px', color: '#8a8fa8' };

    this.add.text(VIEW_W / 2, 14, 'SELECT STAGE', { fontFamily: FONT, fontSize: '12px', color: '#f28c28' }).setOrigin(0.5);
    this.add.image(VIEW_W / 2, 136, heroTexture('buster'), heroFrames(this).idle).setScale(2);

    STAGE_SELECT_ORDER.forEach((id, i) => {
      const stage = STAGES[id];
      const { x, y } = SLOTS[i];
      const cleared = save.cleared.includes(id);
      const theme = THEMES[stage.theme];
      this.add.rectangle(x, y, PANEL_W, PANEL_H, Phaser.Display.Color.HexStringToColor(theme.sky).color);
      const frame = this.add.rectangle(x, y, PANEL_W, PANEL_H).setStrokeStyle(2, 0x3a3f66);
      this.frames.push(frame);
      const boss = this.add.image(x, y + 4, `${stage.boss}_idle`).setOrigin(0.5, 1);
      if (cleared) boss.setTint(0x555566);
      this.add.text(x, y + 9, stage.bossName, { fontFamily: FONT, fontSize: '8px', color: '#fff1e0' }).setOrigin(0.5, 0);
      this.add.text(x, y + 18, stage.name, small).setOrigin(0.5, 0);
      if (cleared) {
        this.add.text(x, y - 14, 'CLEAR', { fontFamily: FONT, fontSize: '8px', color: '#5ef0c8', backgroundColor: '#000000' }).setOrigin(0.5);
      }
    });

    this.add.text(VIEW_W / 2, VIEW_H - 14, 'ARROWS choose   ENTER/Z start   X boss test   BKSP back', small).setOrigin(0.5);
    this.launchText = this.add
      .text(VIEW_W / 2, VIEW_H / 2, '', { fontFamily: FONT, fontSize: '16px', color: '#fff1e0', backgroundColor: '#000000', align: 'center', padding: { x: 8, y: 6 } })
      .setOrigin(0.5)
      .setDepth(10)
      .setVisible(false);

    // Start on the first stage not yet cleared.
    const firstOpen = STAGE_SELECT_ORDER.findIndex((id) => !save.cleared.includes(id));
    this.pick = Math.max(0, firstOpen);
  }

  protected tick(): boolean {
    if (this.launching) {
      if (++this.launching.t >= 90) {
        this.scene.start('game', this.launching.data);
        return true;
      }
      return false;
    }
    const c = this.controls;
    for (let i = 0; i < SLOTS.length; i++) {
      if (c.justPressed(SLOTS[i].dir) && this.pick !== i) {
        this.pick = i;
        sfx.tick();
      }
    }
    // ESC is a 'start' key here, so Backspace goes back to the title.
    if (Phaser.Input.Keyboard.JustDown(this.backKey)) {
      this.scene.start('title');
      return true;
    }
    const id: StageId = STAGE_SELECT_ORDER[this.pick];
    if (this.confirmed()) this.launch({ stage: id });
    else if (c.justPressed('fire')) this.launch({ stage: id, bossTest: true });
    return false;
  }

  private launch(data: GameSceneData): void {
    const stage = STAGES[data.stage];
    sfx.select();
    this.launching = { data, t: 0 };
    const weapon = WEAPONS[stage.bossWeapon].name;
    this.launchText.setText(`${stage.bossName}\n${data.bossTest ? 'BOSS TEST' : stage.name}\n\nholds: ${weapon}`).setVisible(true);
  }

  update(t: number, delta: number): void {
    super.update(t, delta);
    // Highlight the chosen panel.
    const blink = Math.floor(this.frame / 8) % 2 === 0;
    this.frames.forEach((f, i) => f.setStrokeStyle(2, i === this.pick ? (blink ? 0x5ef0c8 : 0xfff1e0) : 0x3a3f66));
  }
}
