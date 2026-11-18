import Phaser from 'phaser';
import { nowPlaying, playJingle, playMusic } from '../audio';
import { VIEW_H, VIEW_W } from '../constants';
import { PixelText, pixelText } from '../pixelFont';
import { SaveData, loadSave } from '../save';
import { sfx } from '../sfx';
import { touch } from '../touch';
import { FONT, MenuScene } from './menu';

/** Every track, in the order the jukebox lists them, with its name on the label. */
export const TRACKS: { key: string; title: string }[] = [
  { key: 'title', title: 'ULTRAGUY!' },
  { key: 'intro', title: 'MAIN STREET' },
  { key: 'select', title: 'PICK YOUR FIGHT' },
  { key: 'foundry', title: 'FOUNDRY' },
  { key: 'canopy', title: 'CANOPY' },
  { key: 'glacier', title: 'GLACIER' },
  { key: 'stratos', title: 'STRATOS' },
  { key: 'powerplant', title: 'POWER PLANT' },
  { key: 'caldera', title: 'CALDERA' },
  { key: 'scrapyard', title: 'SCRAPYARD' },
  { key: 'reef', title: 'REEF' },
  { key: 'climb', title: 'THE GREAT CLIMB' },
  { key: 'chase', title: 'COMPACTOR CHASE' },
  { key: 'boss', title: 'ROBOT MASTER' },
  { key: 'jingle_victory', title: 'VICTORY!' },
  { key: 'fortress', title: 'THE FORTRESS' },
  { key: 'finalboss', title: 'OVERLORD' },
  { key: 'ending', title: 'THE END?' },
  { key: 'shop', title: "RIVET'S" },
  { key: 'dojo', title: 'THE DOJO' },
  { key: 'vault', title: 'MEGAMART' },
  { key: 'race', title: 'RACE DAY' },
  { key: 'boxing', title: 'TITLE BOUT' },
  { key: 'rpg', title: 'HISTORY CLASS' },
  { key: 'shooter', title: 'DOGFIGHT' },
  { key: 'bomb', title: 'SHORT FUSE' },
  { key: 'hop', title: 'LILY PADS' },
  { key: 'breaker', title: 'BRICK BREAKER' },
  { key: 'hockey', title: 'FACE OFF' },
  { key: 'skies', title: 'HIGH SKIES' },
  { key: 'pinball', title: 'TILT!' },
  { key: 'dungeon', title: 'JUNK MAZE' },
];

const ROWS = 10;

/**
 * Tracks this save can play: every one it has heard, plus the ones its
 * progress shows it must have (saves from before the jukebox didn't record
 * what they heard).
 */
export function knownTracks(save: SaveData): Set<string> {
  const known = new Set(save.heard);
  for (const k of ['title', 'select', 'intro', 'shop']) known.add(k);
  for (const id of save.cleared) known.add(id === 'fortress1' || id === 'fortress2' || id === 'fortress3' || id === 'gauntlet' ? 'fortress' : id);
  if (save.cleared.some((id) => id !== 'intro')) {
    known.add('boss');
    known.add('jingle_victory');
  }
  if (save.cleared.includes('finale')) {
    known.add('finalboss');
    known.add('ending');
  }
  return known;
}

/**
 * RIVET'S JUKEBOX (bought at the shop): play any track you've heard. The
 * ones you haven't come across yet show as ???. Leaving goes back to the shop
 * (and its music).
 */
export class JukeboxScene extends MenuScene {
  private rows: PixelText[] = [];
  private arrow!: PixelText;
  private nowText!: PixelText;
  private eq!: Phaser.GameObjects.Graphics;
  private pick = 0;
  private top = 0;
  private playing: string | null = null;
  private backKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('jukebox');
  }

  create(): void {
    this.initMenu();
    this.backdrop('city', 0.75);
    this.backKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.BACKSPACE);
    this.pick = 0;
    this.top = 0;
    this.playing = nowPlaying();
    const small = { fontFamily: FONT, fontSize: '8px', color: '#8a8fa8' };
    pixelText(this, VIEW_W / 2, 10, "RIVET'S JUKEBOX", { fontFamily: FONT, fontSize: '12px', color: '#4ab8a8', stroke: '#000000' }).setOrigin(0.5, 0);
    const heard = knownTracks(loadSave());
    const have = TRACKS.filter((t) => heard.has(t.key)).length;
    pixelText(this, VIEW_W / 2, 26, `${have}/${TRACKS.length} TRACKS`, small).setOrigin(0.5, 0);
    this.panel(VIEW_W / 2 - 50, 112, 220, 150);
    this.rows = Array.from({ length: ROWS }, (_, i) => pixelText(this, 60, 44 + i * 14, '', { fontFamily: FONT, fontSize: '12px', color: '#8a8fa8' }));
    this.arrow = pixelText(this, 46, 44, '>', { fontFamily: FONT, fontSize: '12px', color: '#5ef0c8' });
    // The record player: a spinning disc and a little equalizer.
    this.panel(VIEW_W - 72, 112, 112, 150);
    this.eq = this.add.graphics();
    pixelText(this, VIEW_W - 72, 46, 'NOW PLAYING', small).setOrigin(0.5, 0);
    this.nowText = pixelText(this, VIEW_W - 72, 162, '', { fontFamily: FONT, fontSize: '8px', color: '#fff1e0' }).setOrigin(0.5, 0);
    pixelText(this, VIEW_W / 2, VIEW_H - 12, 'UP/DOWN choose   ENTER/Z play   BKSP back', small).setOrigin(0.5, 0);
    this.draw();
  }

  private draw(): void {
    const heard = knownTracks(loadSave());
    for (let i = 0; i < ROWS; i++) {
      const t = TRACKS[this.top + i];
      const row = this.rows[i];
      if (!t) {
        row.setText('');
        continue;
      }
      const known = heard.has(t.key);
      const n = String(this.top + i + 1).padStart(2, '0');
      row.setText(`${n} ${known ? t.title : '???'}${t.key === this.playing ? ' *' : ''}`);
      row.setColor(this.top + i === this.pick ? '#fff1e0' : known ? '#8a8fa8' : '#4a4e68');
    }
    this.arrow.setY(44 + (this.pick - this.top) * 14);
    const now = TRACKS.find((t) => t.key === this.playing);
    this.nowText.setText(now ? now.title : '-');
  }

  protected tick(): boolean {
    // The disc spins and the bars bounce while something's on.
    const g = this.eq.clear();
    const cx = VIEW_W - 72;
    const cy = 100;
    const spin = this.playing ? this.frame * 0.12 : 0;
    g.fillStyle(0x141418).fillCircle(cx, cy, 34);
    for (const r of [30, 24, 18]) g.lineStyle(1, 0x2a2a34).strokeCircle(cx, cy, r);
    g.fillStyle(0xd83a4a).fillCircle(cx, cy, 9);
    g.fillStyle(0xfff1e0).fillCircle(cx + Math.cos(spin) * 5, cy + Math.sin(spin) * 5, 1.5);
    for (let i = 0; i < 8; i++) {
      const h = this.playing ? 3 + Math.abs(Math.sin(this.frame * (0.11 + i * 0.03) + i * 1.7)) * 14 : 2;
      g.fillStyle(i % 2 ? 0x5ef0c8 : 0x4ab8a8).fillRect(cx - 28 + i * 7, 156 - h, 5, h);
    }

    if (Phaser.Input.Keyboard.JustDown(this.backKey) || touch.takeBack() || this.controls.justPressed('fire')) {
      sfx.select();
      this.scene.start('shop');
      return true;
    }
    const dy = this.controls.justPressed('down') ? 1 : this.controls.justPressed('up') ? -1 : 0;
    if (dy) {
      this.pick = (this.pick + dy + TRACKS.length) % TRACKS.length;
      if (this.pick < this.top) this.top = this.pick;
      if (this.pick >= this.top + ROWS) this.top = this.pick - ROWS + 1;
      sfx.tick();
      this.draw();
    }
    if (this.confirmed()) {
      const t = TRACKS[this.pick];
      if (!knownTracks(loadSave()).has(t.key)) {
        sfx.hurt();
        return false;
      }
      sfx.select();
      if (t.key.startsWith('jingle_')) playJingle(this, t.key);
      else playMusic(this, t.key);
      this.playing = t.key;
      this.draw();
    }
    return false;
  }
}
