import Phaser from 'phaser';
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
  }

  create(): void {
    generateTextures(this);
    createHeroTextures(this);
    createSpriteTextures(this);
    this.scene.start('title');
  }
}
