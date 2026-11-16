import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from './constants';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { EndingScene } from './scenes/EndingScene';
import { FortressScene } from './scenes/FortressScene';
import { ControlsScene } from './scenes/ControlsScene';
import { SettingsScene } from './scenes/SettingsScene';
import { SlotScene } from './scenes/SlotScene';
import { StageSelectScene } from './scenes/StageSelectScene';
import { TitleScene } from './scenes/TitleScene';
import { RaceScene } from './scenes/RaceScene';
import { BoxingScene } from './scenes/BoxingScene';
import { BombScene } from './scenes/BombScene';
import { HopScene } from './scenes/HopScene';
import { RpgScene } from './scenes/RpgScene';
import { ShooterScene } from './scenes/ShooterScene';
import { BreakerScene } from './scenes/BreakerScene';
import { HockeyScene } from './scenes/HockeyScene';
import { PuzzleScene } from './scenes/PuzzleScene';
import { SkiesScene } from './scenes/SkiesScene';
import { PinballScene } from './scenes/PinballScene';
import { DungeonScene } from './scenes/DungeonScene';
import { unlockAudio } from './sfx';
import { mountTouchControls } from './touch';

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
  scene: [BootScene, TitleScene, SlotScene, SettingsScene, ControlsScene, StageSelectScene, FortressScene, GameScene, RaceScene, BoxingScene, RpgScene, HopScene, BombScene, ShooterScene, BreakerScene, HockeyScene, PuzzleScene, SkiesScene, PinballScene, DungeonScene, EndingScene],
});

// Handy for debugging in the browser console.
(window as unknown as { game: Phaser.Game }).game = game;

// On-screen controls for phones; the first touch also unlocks audio.
mountTouchControls(unlockAudio, () => game.scale.refresh());
