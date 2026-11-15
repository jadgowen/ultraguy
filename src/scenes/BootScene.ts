import Phaser from 'phaser';
import { createHeroTextures, preloadHero } from '../heroSprites';
import { generateTextures } from '../textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    preloadHero(this);
  }

  create(): void {
    generateTextures(this);
    createHeroTextures(this);
    this.scene.start('title');
  }
}
