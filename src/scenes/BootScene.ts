import Phaser from 'phaser';
import { loadAudio, preloadAudioManifest } from '../audio';
import { createHeroTextures, preloadHero } from '../heroSprites';
import { createSpriteTextures, preloadSprites } from '../sprites';
import { generateTextures } from '../textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    preloadHero(this);
    preloadSprites(this);
    preloadAudioManifest(this);
  }

  create(): void {
    generateTextures(this);
    createHeroTextures(this);
    createSpriteTextures(this);
    // Load generated music/sfx (if any), then go to the title.
    loadAudio(this, () => this.scene.start('title'));
  }
}
