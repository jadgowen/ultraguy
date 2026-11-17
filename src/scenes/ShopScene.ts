import Phaser from 'phaser';
import { playMusic, playVoice } from '../audio';
import { VIEW_H, VIEW_W } from '../constants';
import { Level } from '../level/Level';
import { ALL_BOSS_STAGES, getStage } from '../level/stages';
import { PixelText, pixelText } from '../pixelFont';
import { buy, loadSave, owned } from '../save';
import { SHOP_ITEMS } from '../shop';
import { sfx } from '../sfx';
import { touch } from '../touch';
import { FONT, MenuScene } from './menu';

/** Every hidden 1-UP in the boss stages ("stage:x:y", as GameScene records them). */
let secretOneUps: string[] | null = null;
function allSecretOneUps(): string[] {
  secretOneUps ??= ALL_BOSS_STAGES.flatMap((id) => new Level(getStage(id)).oneUps.map((o) => `${id}:${o.x - 7}:${o.y - 12}`));
  return secretOneUps;
}

/** How many of the hidden 1-UPs have been found, of how many. */
export function secretProgress(): { found: number; total: number } {
  const all = allSecretOneUps();
  const have = new Set(loadSave().oneUpsFound);
  return { found: all.filter((k) => have.has(k)).length, total: all.length };
}

/**
 * RIVET'S PARTS & PROVISIONS, opened from the stage select. Rivet stands
 * behind the counter on the left; the goods are on the right. More goods
 * come in as you beat bosses. Bolts come from beaten enemies and caches.
 */
export class ShopScene extends MenuScene {
  private rivet!: Phaser.GameObjects.Image;
  private say!: PixelText;
  private boltsText!: PixelText;
  private blurb!: PixelText;
  private rows: PixelText[] = [];
  private talkT = 0;
  private backKey!: Phaser.Input.Keyboard.Key;
  private leaving = 0;

  constructor() {
    super('shop');
  }

  create(): void {
    this.initMenu();
    this.backdrop('city', 0.7);
    playMusic(this, 'shop');
    this.backKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.BACKSPACE);
    this.talkT = 0;
    this.leaving = 0;
    const small = { fontFamily: FONT, fontSize: '8px', color: '#8a8fa8' };

    pixelText(this, VIEW_W / 2, 12, "RIVET'S PARTS & PROVISIONS", { fontFamily: FONT, fontSize: '12px', color: '#4ab8a8', stroke: '#000000' }).setOrigin(0.5, 0);

    // Rivet behind the counter.
    this.rivet = this.add.image(96, 152, 'rivet0').setOrigin(0.5, 1).setScale(2);
    this.add.image(16, 146, 'shop_counter').setOrigin(0, 0);
    pixelText(this, 96, 166, 'OPEN', { ...small, color: '#fff1e0' }).setOrigin(0.5, 0);
    // Speech bubble.
    this.panel(100, 46, 168, 30);
    this.say = pixelText(this, 22, 35, '', { ...small, color: '#fff1e0' });

    // The goods.
    this.panel(312, 108, 200, 132);
    const beaten = ALL_BOSS_STAGES.filter((id) => loadSave().cleared.includes(id)).length;
    const labels = [...SHOP_ITEMS.map((i) => (beaten >= i.unlock ? i.name : '???')), 'VAULT KEY', 'LEAVE'];
    this.rows = this.list(230, 50, labels);
    this.boltsText = pixelText(this, 230, 196, '', { fontFamily: FONT, fontSize: '12px', color: '#c8ccd8' });
    this.add.image(222, 202, 'nut').setScale(1.5);
    this.blurb = pixelText(this, VIEW_W / 2, VIEW_H - 22, '', { ...small, color: '#5ef0c8' }).setOrigin(0.5, 0);
    pixelText(this, VIEW_W / 2, VIEW_H - 10, 'UP/DOWN choose   ENTER/Z buy   BKSP leave', small).setOrigin(0.5, 0);
    this.refresh();
    this.speak("Welcome to Rivet's! Bolts in, goodies out!", 'shop_welcome');
  }

  /** Prices, how many you hold, and the selected item's description. */
  private refresh(): void {
    const save = loadSave();
    const beaten = ALL_BOSS_STAGES.filter((id) => save.cleared.includes(id)).length;
    SHOP_ITEMS.forEach((item, i) => {
      const row = this.rows[i];
      const open = beaten >= item.unlock;
      const have = owned(save, item.id);
      const tag = !open ? '' : item.max === 1 ? (have ? ' OWNED' : ` ${item.price}`) : ` ${item.price}  ${have}/${item.max}`;
      row.setText(`${open ? item.name.padEnd(12) : '???'.padEnd(12)}${tag}`);
    });
    // The secret: Rivet's rival's vault, once every hidden 1-UP is found.
    const secret = secretProgress();
    const vaultOpen = secret.found >= secret.total;
    this.rows[SHOP_ITEMS.length].setText(vaultOpen ? 'VAULT KEY'.padEnd(12) + ' FREE' : `???`.padEnd(12) + ` ${secret.found}/${secret.total}`);
    this.select(this.selected);
    this.boltsText.setText(String(save.bolts));
    const item = SHOP_ITEMS[this.selected];
    if (this.selected === SHOP_ITEMS.length) this.blurb.setText(vaultOpen ? "the key to Rivet's rival's megastore" : 'find every hidden 1-UP (one per stage)');
    else if (!item) this.blurb.setText('back to the stage select');
    else if (beaten < item.unlock) this.blurb.setText(`in stock once you've beaten ${item.unlock} bosses`);
    else this.blurb.setText(item.blurb);
  }

  /** Rivet says something (with a voice line, if there is one). */
  private speak(text: string, voice?: string): void {
    // Wrap to the bubble (26 characters a line).
    const lines: string[] = [''];
    for (const word of text.split(' ')) {
      const line = lines[lines.length - 1];
      if (line && line.length + 1 + word.length > 26) lines.push(word);
      else lines[lines.length - 1] = line ? `${line} ${word}` : word;
    }
    this.say.setText(lines.join('\n'));
    const ms = voice ? playVoice(this, voice) : 0;
    this.talkT = Math.max(40, Math.round((ms / 1000) * 60) || text.length * 2);
  }

  protected tick(): boolean {
    if (this.talkT > 0) this.talkT--;
    // Blink now and then; flap the mouth while talking.
    const blink = this.frame % 180 > 172;
    this.rivet.setTexture(this.talkT > 0 && this.frame % 10 < 5 ? 'rivet_talk' : blink ? 'rivet1' : 'rivet0');
    this.rivet.setY(152 + (Math.floor(this.frame / 30) % 2));
    if (this.leaving > 0) {
      if (--this.leaving === 0) this.scene.start('select');
      return this.leaving === 0;
    }
    if (this.frame % 4 === 0) this.refresh();
    if (Phaser.Input.Keyboard.JustDown(this.backKey) || touch.takeBack() || this.controls.justPressed('fire')) {
      this.leave();
      return false;
    }
    if (!this.confirmed()) return false;
    const item = SHOP_ITEMS[this.selected];
    if (this.selected === SHOP_ITEMS.length) {
      const secret = secretProgress();
      if (secret.found < secret.total) {
        sfx.tick();
        this.speak(`Psst... a 1-UP hides in every stage. Find all ${secret.total} for a secret!`);
        return false;
      }
      sfx.pickup();
      this.speak("Found them all? Take this key to my rival's megastore. Teach him a lesson!", 'shop_vault');
      this.time.delayedCall(3200, () => this.scene.start('game', { stage: 'vault' }));
      this.leaving = 999; // (the delayed call takes over)
      return false;
    }
    if (!item) {
      this.leave();
      return false;
    }
    const beaten = ALL_BOSS_STAGES.filter((id) => loadSave().cleared.includes(id)).length;
    if (beaten < item.unlock) {
      sfx.tick();
      this.speak('Still on order! Beat a few more bosses and I will have it in.');
      return false;
    }
    const result = buy(item.id);
    if (result === 'ok') {
      sfx.pickup();
      this.speak('Pleasure doing business, sugar!', 'shop_thanks');
    } else if (result === 'broke') {
      sfx.hurt();
      this.speak("Ooh, you're a few bolts short. Go bust some bots!", 'shop_broke');
    } else {
      sfx.tick();
      this.speak("Whoa there, you can't carry any more of those!", 'shop_full');
    }
    this.refresh();
    return false;
  }

  private leave(): void {
    sfx.select();
    this.speak('Come back soon! Bring bolts!', 'shop_bye');
    this.leaving = 70;
  }
}
