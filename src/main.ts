import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from './constants';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
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
  scale: { mode: Phaser.Scale.NONE },
  scene: [BootScene, TitleScene, GameScene],
});

// Integer scaling only, so every game pixel is the same size on screen.
function fit(): void {
  const k = Math.max(1, Math.floor(Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H)));
  game.scale.setZoom(k);
}
window.addEventListener('resize', fit);
fit();

// Handy for debugging in the browser console.
(window as unknown as { game: Phaser.Game }).game = game;
