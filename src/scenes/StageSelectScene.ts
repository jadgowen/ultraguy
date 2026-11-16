import Phaser from 'phaser';
import { touch } from '../touch';
import { DEV_TOOLS, VIEW_H, VIEW_W } from '../constants';
import { heroFrames } from '../heroSprites';
import type { BossStageId } from '../level/Level';
import { ALL_BOSS_STAGES, BOSS_STAGES, STAGE_GRID } from '../level/stages';
import { THEMES } from '../level/themes';
import { exUnlocked, loadSave } from '../save';
import { sfx } from '../sfx';
import { WEAPONS, heroTexture } from '../weapons';
import type { GameSceneData } from './GameScene';
import { FONT, MenuScene } from './menu';
import { playMusic } from '../audio';
import { PixelText, pixelText } from '../pixelFont';

const PANEL_W = 104;
const PANEL_H = 58;
const COL_X = [VIEW_W / 2 - 122, VIEW_W / 2, VIEW_W / 2 + 122];
const ROW_Y = [62, 126, 190];
const CENTER = 4;

/**
 * Boss select: a 3x3 grid with the hero in the middle. Arrows move the
 * cursor. Once all eight bosses are beaten, the middle becomes FORTRESS.
 */
export class StageSelectScene extends MenuScene {
  private pick = 0;
  private frames: Phaser.GameObjects.Rectangle[] = [];
  private launching: { start: () => void; t: number } | null = null;
  private launchText!: PixelText;
  private backKey!: Phaser.Input.Keyboard.Key;
  private testKey!: Phaser.Input.Keyboard.Key;
  private fortressOpen = false;
  /** EX rematches: unlocked by beating the game; FIRE switches the grid over. */
  private exOpen = false;
  private exOn = false;
  private title!: PixelText;
  private exMarks: Phaser.GameObjects.GameObject[] = [];
  private normalMarks: Phaser.GameObjects.GameObject[] = [];
  private hintText!: PixelText;

  constructor() {
    super('select');
  }

  create(): void {
    this.initMenu();
    playMusic(this, 'select');
    this.backKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.BACKSPACE);
    this.testKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B);
    this.launching = null;
    this.backdrop('fortress', 0.6);
    this.frames = [];
    this.cameras.main.setBackgroundColor('#0b0d1a');
    const save = loadSave();
    this.fortressOpen = ALL_BOSS_STAGES.every((id) => save.cleared.includes(id));
    this.exOpen = exUnlocked(save);
    this.exMarks = [];
    this.normalMarks = [];
    const small = { fontFamily: FONT, fontSize: '8px', color: '#8a8fa8' };

    this.title = pixelText(this, VIEW_W / 2, 14, 'SELECT STAGE', { fontFamily: FONT, fontSize: '12px', color: '#f28c28' }).setOrigin(0.5);

    STAGE_GRID.forEach((id, i) => {
      const x = COL_X[i % 3];
      const y = ROW_Y[Math.floor(i / 3)];
      this.add.rectangle(x, y, PANEL_W, PANEL_H, 0x141626);
      const frame = this.add.rectangle(x, y, PANEL_W, PANEL_H).setStrokeStyle(2, 0x3a3f66);
      this.frames.push(frame);

      if (!id) {
        // Middle: the hero, or the way into the fortress once it's open.
        this.add.image(x, y + 6, heroTexture('buster'), heroFrames(this).idle).setOrigin(0.5, 1);
        if (this.fortressOpen) {
          this.normalMarks.push(
            pixelText(this, x, y + 9, 'FORTRESS', { fontFamily: FONT, fontSize: '8px', color: '#ff5050' }).setOrigin(0.5, 0),
            pixelText(this, x, y + 18, 'all bosses beaten', small).setOrigin(0.5, 0),
          );
        }
        this.exMarks.push(
          pixelText(this, x, y + 9, 'EX MODE', { fontFamily: FONT, fontSize: '8px', color: '#ff5050' }).setOrigin(0.5, 0),
          pixelText(this, x, y + 18, `${ALL_BOSS_STAGES.filter((s) => save.exCleared.includes(s)).length}/${ALL_BOSS_STAGES.length} beaten`, small).setOrigin(0.5, 0),
        );
        return;
      }
      const stage = BOSS_STAGES[id];
      const cleared = save.cleared.includes(id);
      this.add.rectangle(x, y - PANEL_H / 2 + 2, PANEL_W, 3, Phaser.Display.Color.HexStringToColor(THEMES[stage.theme].sky).color);
      const boss = this.add.image(x, y + 6, `${stage.boss}_idle`).setOrigin(0.5, 1);
      if (cleared) boss.setTint(0x9a9ab0);
      pixelText(this, x, y + 9, stage.bossName ?? '', { fontFamily: FONT, fontSize: '8px', color: '#fff1e0' }).setOrigin(0.5, 0);
      this.normalMarks.push(
        pixelText(this, x, y + 18, cleared ? `${stage.name} - CLEAR` : stage.name, { ...small, color: cleared ? '#5ef0c8' : '#8a8fa8' }).setOrigin(0.5, 0),
      );
      const exWon = save.exCleared.includes(id);
      this.exMarks.push(pixelText(this, x, y + 18, exWon ? 'EX - CLEAR' : 'EX', { ...small, color: exWon ? '#ffe14a' : '#ff5050' }).setOrigin(0.5, 0));
      // A star in the corner for each EX rematch won.
      if (exWon) pixelText(this, x + PANEL_W / 2 - 8, y - PANEL_H / 2 + 6, '*', { fontFamily: FONT, fontSize: '8px', color: '#ffe14a' }).setOrigin(0.5, 0);
    });

    this.hintText = pixelText(this, VIEW_W / 2, VIEW_H - 10, '', small).setOrigin(0.5);
    this.exOn = false;
    this.showMode();
    this.launchText = pixelText(this, VIEW_W / 2, VIEW_H / 2, '', { fontFamily: FONT, fontSize: '16px', color: '#fff1e0', backgroundColor: '#000000', align: 'center', padding: { x: 8, y: 6 } })
      .setOrigin(0.5)
      .setDepth(10)
      .setVisible(false);

    // Start on the first stage not yet cleared (or the fortress, once open).
    const firstOpen = STAGE_GRID.findIndex((id) => id && !save.cleared.includes(id));
    this.pick = this.fortressOpen ? CENTER : Math.max(0, firstOpen);
  }

  /** Normal or EX: labels, title and the hint line. */
  private showMode(): void {
    for (const o of this.normalMarks) (o as PixelText).setVisible(!this.exOn);
    for (const o of this.exMarks) (o as PixelText).setVisible(this.exOn);
    this.title.setText(this.exOn ? 'EX REMATCH' : 'SELECT STAGE').setColor(this.exOn ? '#ff5050' : '#f28c28');
    const toggle = this.exOpen ? (this.exOn ? '   X normal' : '   X EX mode') : '';
    const test = DEV_TOOLS ? '   B boss test' : '';
    this.hintText.setText(`ARROWS choose   ENTER/Z start${toggle}${test}   BKSP back`);
    if (this.exOn && this.pick === CENTER) this.pick = 0;
  }

  private move(dx: number, dy: number): void {
    let col = this.pick % 3;
    let row = Math.floor(this.pick / 3);
    col = (col + dx + 3) % 3;
    row = (row + dy + 3) % 3;
    let next = row * 3 + col;
    // The middle is only selectable once the fortress is open (and not in EX); skip over it.
    if (next === CENTER && (!this.fortressOpen || this.exOn)) {
      col = (col + dx + 3) % 3;
      row = (row + dy + 3) % 3;
      next = row * 3 + col;
    }
    if (next !== this.pick) {
      this.pick = next;
      sfx.tick();
    }
  }

  protected tick(): boolean {
    if (this.launching) {
      if (++this.launching.t >= 90) {
        this.launching.start();
        return true;
      }
      return false;
    }
    const c = this.controls;
    if (c.justPressed('left')) this.move(-1, 0);
    if (c.justPressed('right')) this.move(1, 0);
    if (c.justPressed('up')) this.move(0, -1);
    if (c.justPressed('down')) this.move(0, 1);
    // ESC is a 'start' key here, so Backspace goes back to the title.
    if (Phaser.Input.Keyboard.JustDown(this.backKey) || touch.takeBack()) {
      this.scene.start('title');
      return true;
    }
    if (this.exOpen && c.justPressed('fire')) {
      this.exOn = !this.exOn;
      sfx.select();
      this.showMode();
      return false;
    }
    const id = STAGE_GRID[this.pick];
    if (!id) {
      if (this.fortressOpen && this.confirmed()) {
        sfx.select();
        this.scene.start('fortress');
        return true;
      }
      return false;
    }
    if (this.confirmed()) this.launch(id, false);
    else if (DEV_TOOLS && Phaser.Input.Keyboard.JustDown(this.testKey)) this.launch(id, true); // boss test: dev server only
    return false;
  }

  private launch(id: BossStageId, bossTest: boolean): void {
    const stage = BOSS_STAGES[id];
    sfx.select();
    const data: GameSceneData = { stage: id, bossTest, ex: this.exOn };
    this.launching = { start: () => this.scene.start('game', data), t: 0 };
    const weapon = stage.bossWeapon ? WEAPONS[stage.bossWeapon].name : '';
    if (this.exOn) this.launchText.setText(`${stage.bossName} EX\n\nno E-tanks`).setVisible(true);
    else this.launchText.setText(`${stage.bossName}\n${bossTest ? 'BOSS TEST' : stage.name}\n\nholds: ${weapon}`).setVisible(true);
  }

  update(t: number, delta: number): void {
    super.update(t, delta);
    const blink = Math.floor(this.frame / 8) % 2 === 0;
    this.frames.forEach((f, i) => f.setStrokeStyle(2, i === this.pick ? (blink ? 0x5ef0c8 : 0xfff1e0) : 0x3a3f66));
  }
}
