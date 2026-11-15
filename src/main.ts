import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from './constants';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { EndingScene } from './scenes/EndingScene';
import { FortressScene } from './scenes/FortressScene';
import { SettingsScene } from './scenes/SettingsScene';
import { StageSelectScene } from './scenes/StageSelectScene';
import { TitleScene } from './scenes/TitleScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW_W,
  height: VIEW_H,
  pixelArt: true, // nearest-neighbor scaling keeps pixels crisp
  roundPixels: true,
  backgroundColor: '#000000',
  input: { gamepad: true },
  // Stretch to fill the window (exact on 16:9; letterboxed otherwise).
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, TitleScene, SettingsScene, StageSelectScene, FortressScene, GameScene, EndingScene],
});

// Handy for debugging in the browser console.
(window as unknown as { game: Phaser.Game }).game = game;
