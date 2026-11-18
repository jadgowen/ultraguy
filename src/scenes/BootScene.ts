import Phaser from 'phaser';
import { loadAudio, preloadAudioManifest, setMusicListener } from '../audio';
import { recordHeard } from '../save';
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
    // Every track heard goes in the save, for Rivet's jukebox.
    setMusicListener(recordHeard);
    // The rest of the audio streams in behind the title (see audio.ts).
    this.scene.launch('audiostream');
    loadAudio(this, this.scene.get('audiostream'), () => this.scene.start('title'));
  }
}

/** Runs behind every other scene for the whole game: its loader streams in the audio. */
export class AudioStreamScene extends Phaser.Scene {
  constructor() {
    super({ key: 'audiostream', active: false });
  }
}
