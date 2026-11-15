import Phaser from 'phaser';
import { STEP_MS, VIEW_H, VIEW_W } from '../constants';
import { Controls } from '../input';
import { sfx, unlockAudio } from '../sfx';
import type { GameSceneData } from './GameScene';

const OPTIONS: { label: string; data: GameSceneData }[] = [
  { label: 'START', data: {} },
  { label: 'BOSS TEST', data: { bossTest: true } },
];

export class TitleScene extends Phaser.Scene {
  private controls!: Controls;
  private items: Phaser.GameObjects.Text[] = [];
  private cursor!: Phaser.GameObjects.Text;
  private selected = 0;
  private acc = 0;
  private frame = 0;

  constructor() {
    super('title');
  }

  create(): void {
    this.acc = 0;
    this.frame = 0;
    this.controls = new Controls(this);
    this.cameras.main.setBackgroundColor('#141626');
    this.add.tileSprite(0, 0, VIEW_W, VIEW_H, 'bg').setOrigin(0);

    const font = 'monospace';
    this.add.text(VIEW_W / 2, 50, 'ULTRAGUY', { fontFamily: font, fontSize: '32px', color: '#f28c28', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.image(VIEW_W / 2, 100, 'p_idle_s').setScale(2);

    this.items = OPTIONS.map((o, i) =>
      this.add.text(VIEW_W / 2 - 30, 136 + i * 14, o.label, { fontFamily: font, fontSize: '12px', color: '#fff1e0' }),
    );
    this.cursor = this.add.text(VIEW_W / 2 - 44, 136, '>', { fontFamily: font, fontSize: '12px', color: '#5ef0c8' });
    this.select(this.selected);

    const help = ['ARROWS / WASD  move, climb', 'Z / SPACE      jump', 'X / J          fire', 'ENTER          start / pause'];
    this.add.text(VIEW_W / 2, 202, help.join('\n'), { fontFamily: font, fontSize: '8px', color: '#8a8fa8', lineSpacing: 2 }).setOrigin(0.5);

    // Any key unlocks audio (browser autoplay rules).
    this.input.keyboard!.once('keydown', unlockAudio);
  }

  private select(i: number): void {
    this.selected = (i + OPTIONS.length) % OPTIONS.length;
    this.cursor.setY(this.items[this.selected].y);
    this.items.forEach((t, j) => t.setColor(j === this.selected ? '#fff1e0' : '#8a8fa8'));
  }

  update(_t: number, delta: number): void {
    this.acc += Math.min(delta, 100);
    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS;
      this.frame++;
      const c = this.controls;
      c.poll();
      if (c.justPressed('up')) {
        this.select(this.selected - 1);
        sfx.tick();
      }
      if (c.justPressed('down')) {
        this.select(this.selected + 1);
        sfx.tick();
      }
      if (c.justPressed('start') || c.justPressed('jump')) {
        unlockAudio();
        sfx.select();
        this.scene.start('game', OPTIONS[this.selected].data);
        return;
      }
    }
    this.cursor.setVisible(Math.floor(this.frame / 20) % 3 !== 0);
  }
}
