import Phaser from 'phaser';
import { playMusic, playVoice } from '../audio';
import { VIEW_H, VIEW_W } from '../constants';
import { Level } from '../level/Level';
import { ALL_BOSS_STAGES, getStage } from '../level/stages';
import { PixelText, pixelText } from '../pixelFont';
import { JUKEBOX_PRICE, buy, buyJukebox, loadSave, owned } from '../save';
import { SHOP_ITEMS } from '../shop';
import { pipUnlocked } from '../pip';
import { sfx } from '../sfx';
import { touch } from '../touch';
import { FONT, MenuScene } from './menu';
import { SHELF_Y } from '../shopArt';

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

/** Rows after the goods: the paint shop, Pip's workshop, the jukebox, the vault key (then LEAVE). */
const COLORS_ROW = SHOP_ITEMS.length;
const PIP_ROW = COLORS_ROW + 1;
const JUKEBOX_ROW = PIP_ROW + 1;
const VAULT_ROW = JUKEBOX_ROW + 1;

/** Each row's ware on the shelves (LEAVE has none). */
const WARES = [...SHOP_ITEMS.map((i) => (i.id === 'oneup' || i.id === 'etank' ? i.id : `ware_${i.id}`)), 'ware_paint', 'ware_pip', 'ware_jukebox', 'ware_key'];

/** Where Rivet stands (feet, behind the counter) and the speech bubble's box. */
const RIVET = { x: 58, y: 186 };
const BUBBLE = { x: 84, y: 92, w: 122, h: 36 };
/** Characters a bubble line holds. */
const BUBBLE_CHARS = 19;

/**
 * RIVET'S PARTS & PROVISIONS, opened from the stage select: inside the shop,
 * Rivet behind his counter on the left with his wares on the shelves behind
 * him (the one you're looking at lights up), the price list on the right.
 * More goods come in as you beat bosses. Bolts come from beaten enemies and caches.
 */
export class ShopScene extends MenuScene {
  private rivet!: Phaser.GameObjects.Image;
  private say!: PixelText;
  private boltsText!: PixelText;
  private blurb!: PixelText;
  private rows: PixelText[] = [];
  private talkT = 0;
  private wares: { img: Phaser.GameObjects.Image; y: number }[] = [];
  private glow!: Phaser.GameObjects.Graphics;
  private backKey!: Phaser.Input.Keyboard.Key;
  private leaving = 0;

  constructor() {
    super('shop');
  }

  create(): void {
    this.initMenu();
    this.add.image(0, 0, 'shop_room').setOrigin(0).setDepth(-20);
    playMusic(this, 'shop');
    this.backKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.BACKSPACE);
    this.talkT = 0;
    this.leaving = 0;
    const small = { fontFamily: FONT, fontSize: '8px', color: '#8a8fa8' };

    // The sign over the shelves.
    pixelText(this, 106, 9, "RIVET'S PARTS & PROVISIONS", { ...small, color: '#fff1e0' }).setOrigin(0.5, 0);

    // The wares on the shelves: five on the top shelf, four below.
    this.glow = this.add.graphics().setDepth(-11);
    this.wares = WARES.map((key, i) => {
      const top = i < 5;
      const x = top ? 34 + i * 36 : 46 + (i - 5) * 40;
      const y = SHELF_Y[top ? 0 : 1];
      return { img: this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(-10), y };
    });

    // Rivet behind the counter.
    this.rivet = this.add.image(RIVET.x, RIVET.y, 'rivet0').setOrigin(0.5, 1).setDepth(-8);
    this.add.image(4, 168, 'shop_counter2').setOrigin(0, 0).setDepth(-7);
    pixelText(this, 106, 198, 'OPEN', { ...small, color: '#fff1e0' }).setOrigin(0.5, 0).setDepth(-6);

    // Speech bubble, its tail pointing down at Rivet.
    const b = this.add.graphics().setDepth(-6);
    b.fillStyle(0x1a1428).fillRoundedRect(BUBBLE.x - 1, BUBBLE.y - 1, BUBBLE.w + 2, BUBBLE.h + 2, 6);
    b.fillTriangle(BUBBLE.x + 6, BUBBLE.y + BUBBLE.h - 2, BUBBLE.x + 18, BUBBLE.y + BUBBLE.h - 2, RIVET.x + 12, RIVET.y - 46);
    b.fillStyle(0xfff1e0).fillRoundedRect(BUBBLE.x, BUBBLE.y, BUBBLE.w, BUBBLE.h, 5);
    b.fillTriangle(BUBBLE.x + 8, BUBBLE.y + BUBBLE.h - 1, BUBBLE.x + 16, BUBBLE.y + BUBBLE.h - 1, RIVET.x + 13, RIVET.y - 48);
    this.say = pixelText(this, BUBBLE.x + 5, BUBBLE.y + 5, '', { ...small, color: '#1a1428' }).setDepth(-5);

    // The price list.
    this.panel(317, 115, 200, 178);
    pixelText(this, 236, 32, 'ITEM', small);
    pixelText(this, 332, 32, 'COST', small);
    pixelText(this, 374, 32, 'HAVE', small);
    const beaten = ALL_BOSS_STAGES.filter((id) => loadSave().cleared.includes(id)).length;
    const labels = [...SHOP_ITEMS.map((i) => (beaten >= i.unlock ? i.name : '???')), 'COLORS', 'PIP', 'JUKEBOX', 'VAULT KEY', 'LEAVE'];
    this.rows = this.list(236, 46, labels);
    // Your bolts, at the foot of the list.
    this.add.image(240, 191, 'nut').setScale(1.5);
    pixelText(this, 250, 187, 'BOLTS', small);
    this.boltsText = pixelText(this, 404, 187, '', { ...small, color: '#ffe14a' }).setOrigin(1, 0);

    // The selected ware's description, and the keys.
    this.add.rectangle(0, 212, VIEW_W, VIEW_H - 212, 0x05060c, 0.85).setOrigin(0).setDepth(-4);
    this.blurb = pixelText(this, VIEW_W / 2, 217, '', { ...small, color: '#5ef0c8' }).setOrigin(0.5, 0);
    pixelText(this, VIEW_W / 2, 229, 'UP/DOWN choose   ENTER/Z buy   BKSP leave', small).setOrigin(0.5, 0);
    this.refresh();
    this.speak("Welcome to Rivet's! Bolts in, goodies out!", 'shop_welcome');
  }

  /** A row's text: the name, then its cost and how many you hold, in columns. */
  private row(name: string, cost = '', have = ''): string {
    return name.padEnd(16) + cost.padStart(4) + '   ' + have;
  }

  /** Prices, how many you hold, and the selected item's description. */
  private refresh(): void {
    const save = loadSave();
    const beaten = ALL_BOSS_STAGES.filter((id) => save.cleared.includes(id)).length;
    SHOP_ITEMS.forEach((item, i) => {
      const row = this.rows[i];
      const open = beaten >= item.unlock;
      const have = owned(save, item.id);
      if (!open) row.setText(this.row('???'));
      else if (item.max === 1) row.setText(this.row(item.name, have ? '' : String(item.price), have ? 'OWN' : ''));
      else row.setText(this.row(item.name, String(item.price), `${have}/${item.max}`));
      this.dark(i, !open);
    });
    this.rows[COLORS_ROW].setText(this.row('PAINT SHOP', '', '>'));
    this.rows[PIP_ROW].setText(pipUnlocked(save) ? this.row("PIP'S WORKSHOP", '', '>') : this.row('???'));
    this.dark(PIP_ROW, !pipUnlocked(save));
    this.rows[JUKEBOX_ROW].setText(save.jukebox ? this.row('JUKEBOX', '', '>') : this.row('JUKEBOX', String(JUKEBOX_PRICE)));
    // The secret: Rivet's rival's vault, once every hidden 1-UP is found.
    const secret = secretProgress();
    const vaultOpen = secret.found >= secret.total;
    this.rows[VAULT_ROW].setText(vaultOpen ? this.row('VAULT KEY', 'FREE') : this.row('???', '', `${secret.found}/${secret.total}`));
    this.dark(VAULT_ROW, !vaultOpen);
    this.select(this.selected);
    this.boltsText.setText(String(save.bolts));
    const item = SHOP_ITEMS[this.selected];
    if (this.selected === COLORS_ROW) this.blurb.setText('new colors for UltraGuy');
    else if (this.selected === PIP_ROW) this.blurb.setText(pipUnlocked(save) ? 'upgrades and new looks for your drone' : 'Rivet is building something... beat a boss');
    else if (this.selected === JUKEBOX_ROW) this.blurb.setText(save.jukebox ? 'play any track you have heard' : 'replay the music: any track you have heard');
    else if (this.selected === VAULT_ROW) this.blurb.setText(vaultOpen ? "the key to Rivet's rival's megastore" : 'find every hidden 1-UP (one per stage)');
    else if (!item) this.blurb.setText('back to the stage select');
    else if (beaten < item.unlock) this.blurb.setText(`in stock once you've beaten ${item.unlock} bosses`);
    else this.blurb.setText(item.blurb);
  }

  /** Wares not yet in stock are dark shapes on the shelf. */
  private dark(i: number, on: boolean): void {
    const w = this.wares[i];
    if (!w) return;
    if (on) w.img.setTint(0x0c0a14).setAlpha(0.8);
    else w.img.clearTint().setAlpha(1);
  }

  /** Rivet says something (with a voice line, if there is one). */
  private speak(text: string, voice?: string): void {
    // Wrap to the bubble.
    const lines: string[] = [''];
    for (const word of text.split(' ')) {
      const line = lines[lines.length - 1];
      if (line && line.length + 1 + word.length > BUBBLE_CHARS) lines.push(word);
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
    this.rivet.setY(RIVET.y + (Math.floor(this.frame / 30) % 2));
    // The ware you're looking at glows and bobs on its shelf.
    this.glow.clear();
    this.wares.forEach((w, i) => {
      const on = i === this.selected;
      w.img.setY(w.y - (on ? 2 + Math.round(Math.sin(this.frame / 8)) : 0));
      if (on) {
        const a = 0.22 + Math.sin(this.frame / 10) * 0.08;
        this.glow.fillStyle(0xffe14a, a).fillCircle(w.img.x, w.y - 8, 12);
        this.glow.fillStyle(0xfff1a0, a).fillCircle(w.img.x, w.y - 8, 7);
      }
    });
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
    if (this.selected === COLORS_ROW) {
      sfx.select();
      this.scene.start('wardrobe');
      return true;
    }
    if (this.selected === PIP_ROW) {
      if (!pipUnlocked(loadSave())) {
        sfx.tick();
        this.speak("Shh, it's a surprise! Beat a boss and come see me.");
        return false;
      }
      sfx.select();
      this.scene.start('pipshop');
      return true;
    }
    if (this.selected === JUKEBOX_ROW) {
      if (loadSave().jukebox) {
        sfx.select();
        this.scene.start('jukebox');
        return true;
      }
      const r = buyJukebox();
      if (r === 'ok') {
        sfx.pickup();
        this.speak('One jukebox! Pick a tune, any tune you have heard.', 'shop_thanks');
      } else {
        sfx.hurt();
        this.speak("Ooh, you're a few bolts short. Go bust some bots!", 'shop_broke');
      }
      this.refresh();
      return false;
    }
    if (this.selected === VAULT_ROW) {
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
