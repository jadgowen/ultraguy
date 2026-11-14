import Phaser from 'phaser';
import { STEP_MS, VIEW_H, VIEW_W } from '../constants';
import { Controls } from '../input';
import { sfx, unlockAudio } from '../sfx';

export class TitleScene extends Phaser.Scene {
  private controls!: Controls;
  private prompt!: Phaser.GameObjects.Text;
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
    this.add.text(VIEW_W / 2, 60, 'ULTRAGUY', { fontFamily: font, fontSize: '32px', color: '#f28c28', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.image(VIEW_W / 2, 112, 'p_idle_s').setScale(2);
    this.prompt = this.add.text(VIEW_W / 2, 160, 'PRESS START', { fontFamily: font, fontSize: '12px', color: '#fff1e0' }).setOrigin(0.5);

    const help = ['ARROWS / WASD  move, climb', 'Z / SPACE      jump', 'X / J          fire', 'ENTER          start / pause'];
    this.add.text(VIEW_W / 2, 196, help.join('\n'), { fontFamily: font, fontSize: '8px', color: '#8a8fa8', lineSpacing: 2 }).setOrigin(0.5);

    // Any key unlocks audio (browser autoplay rules).
    this.input.keyboard!.once('keydown', unlockAudio);
  }

  update(_t: number, delta: number): void {
    this.acc += Math.min(delta, 100);
    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS;
      this.frame++;
      this.controls.poll();
      if (this.controls.justPressed('start') || this.controls.justPressed('jump')) {
        unlockAudio();
        sfx.select();
        this.scene.start('game');
        return;
      }
    }
    this.prompt.setVisible(Math.floor(this.frame / 30) % 2 === 0);
  }
}
