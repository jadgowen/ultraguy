import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from './constants';
import { AudioStreamScene, BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { EndingScene } from './scenes/EndingScene';
import { FortressScene } from './scenes/FortressScene';
import { ControlsScene } from './scenes/ControlsScene';
import { SettingsScene } from './scenes/SettingsScene';
import { SlotScene } from './scenes/SlotScene';
import { JukeboxScene } from './scenes/JukeboxScene';
import { ArcadeScene } from './scenes/ArcadeScene';
import { PipIntroScene } from './scenes/PipIntroScene';
import { PipScene } from './scenes/PipScene';
import { ShopScene } from './scenes/ShopScene';
import { WardrobeScene } from './scenes/WardrobeScene';
import { StageSelectScene } from './scenes/StageSelectScene';
import { TitleScene } from './scenes/TitleScene';
import { unlockAudio } from './sfx';
import { mountTouchControls } from './touch';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW_W,
  height: VIEW_H,
  pixelArt: true, // nearest-neighbor scaling keeps pixels crisp
  roundPixels: true,
  // Transparent, so the finale's painted art (a web layer behind the canvas, at full
  // resolution) shows through; the page behind is black, so everything else looks the same.
  transparent: true,
  input: { gamepad: true },
  // Stretch to fill the window (exact on 16:9; letterboxed otherwise).
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, AudioStreamScene, TitleScene, SlotScene, SettingsScene, ControlsScene, StageSelectScene, ShopScene, WardrobeScene, PipScene, PipIntroScene, JukeboxScene, ArcadeScene, FortressScene, GameScene, EndingScene],
});

// Handy for debugging in the browser console.
(window as unknown as { game: Phaser.Game }).game = game;

// On-screen controls for phones; the first touch also unlocks audio.
mountTouchControls(unlockAudio, () => game.scale.refresh());
