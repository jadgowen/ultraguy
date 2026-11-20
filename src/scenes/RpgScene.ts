import Phaser from 'phaser';
import { playMusic, playVoice, stopMusic } from '../audio';
import { STEP_MS, VIEW_W } from '../constants';
import { Controls } from '../input';
import { getStage } from '../level/stages';
import { PARTS } from '../parts';
import { pixelText } from '../pixelFont';
import { loadSave, setTanks } from '../save';
import { sfx } from '../sfx';
import { WEAPONS, type WeaponId } from '../weapons';
import { pixelateIn } from './cutscene';
import { ModeData, returnToGame } from './encounters';
import { makeRpgBackdrop, rpgWindow } from './rpgArt';
import { GUARDIANS, type Battle, type Guardian, type HurtOpts } from './rpgGuardians';

/**
 * A turn-based, first-person, one-on-one RPG battle against the guardian of a
 * hidden armor part (see rpgGuardians.ts). Pick a command, then he acts; it's
 * all told in the message window.
 *
 *   FIGHT  a basic attack (sometimes a terrific blow)
 *   SPELL  CHARGE SHOT, REPAIR, plus every boss weapon you've collected, each
 *          with its own effect; guardians are weak to some and shrug off others
 *   GUARD  halve the next hit (watch for his big telegraphed attacks)
 *   ITEM   use an E-TANK from your save: full HP and EN
 *   RUN    a guardian won't let you
 *
 * Your HELMET gives more HP and EN, your ARMOR takes a quarter off every hit.
 */

type Cmd = 'FIGHT' | 'SPELL' | 'GUARD' | 'ITEM' | 'RUN';
const CMDS: Cmd[] = ['FIGHT', 'SPELL', 'GUARD', 'ITEM', 'RUN'];

type SpellId = 'charge' | 'repair' | Exclude<WeaponId, 'buster'>;

interface Spell {
  id: SpellId;
  name: string;
  cost: number;
  /** The weapon it comes from (for weak spots and colors). */
  weapon?: WeaponId;
}

const SPELLS: Record<SpellId, Spell> = {
  charge: { id: 'charge', name: 'CHARGE SHOT', cost: 4 },
  repair: { id: 'repair', name: 'REPAIR', cost: 5 },
  quake: { id: 'quake', name: 'QUAKE WAVE', cost: 4, weapon: 'quake' },
  thorn: { id: 'thorn', name: 'THORN RANG', cost: 3, weapon: 'thorn' },
  frost: { id: 'frost', name: 'FROST SPIKE', cost: 4, weapon: 'frost' },
  cyclone: { id: 'cyclone', name: 'CYCLONE', cost: 4, weapon: 'cyclone' },
  spark: { id: 'spark', name: 'SPARK RING', cost: 4, weapon: 'spark' },
  flame: { id: 'flame', name: 'FLAME BURST', cost: 5, weapon: 'flame' },
  saw: { id: 'saw', name: 'SAW BLADE', cost: 5, weapon: 'saw' },
  bubble: { id: 'bubble', name: 'BUBBLE BOMB', cost: 4, weapon: 'bubble' },
};

const BASE_HP = 80;
const BASE_EN = 30;
const LIST_ROWS = 6;

interface Msg {
  text: string;
  /** Runs when this message starts showing. */
  fx?: () => void;
  voice?: string;
}

export class RpgScene extends Phaser.Scene {
  private controls!: Controls;
  private mode!: ModeData;
  private foeDef!: Guardian;
  private acc = 0;
  private maxHp = BASE_HP;
  private maxEn = BASE_EN;
  private armor = false;
  private hp = BASE_HP;
  private en = BASE_EN;
  private foeHp = 0;
  private guarding = false;
  private shield = false;
  private dazed = false;
  private hidden = false;
  private foeSkip = '';
  private foeSkipCooldown = false;
  private foeBlind = 0;
  private foeBurn = 0;
  private foeDef_ = 0;
  private flags: Record<string, number> = {};
  private known = new Set<SpellId>();
  private turn = 0;
  private spells: Spell[] = [];
  private menu: 'cmd' | 'spell' | 'msgs' | 'over' = 'msgs';
  private cursor = 0;
  private scroll = 0;
  private queue: Msg[] = [];
  private current = '';
  private shown = 0;
  private hold = 0;
  private minHold = 0;
  private voiceKey = '';
  private result: 'win' | 'lose' | null = null;
  private overT = 0;
  private afterMsgs: () => void = () => {};

  private foe!: Phaser.GameObjects.Image;
  private foeBar!: Phaser.GameObjects.Rectangle;
  private status!: ReturnType<typeof pixelText>;
  private msgText!: ReturnType<typeof pixelText>;
  private listTexts: ReturnType<typeof pixelText>[] = [];
  private cursorText!: ReturnType<typeof pixelText>;
  private listCursor!: ReturnType<typeof pixelText>;
  private flashRect!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('rpg');
  }

  create(data: ModeData): void {
    this.mode = { stage: data?.stage ?? 'foundry', ret: data?.ret ?? { kind: 'part', step: 0 } };
    const part = getStage(this.mode.stage).upgrade ?? 'blaster';
    this.foeDef = GUARDIANS[part];
    const save = loadSave();
    const helmet = save.parts.includes('helmet');
    this.maxHp = BASE_HP + (helmet ? 16 : 0);
    this.maxEn = BASE_EN + (helmet ? 8 : 0);
    this.armor = save.parts.includes('armor');
    const weapons = save.weapons.filter((w): w is Exclude<WeaponId, 'buster'> => w !== 'buster');
    this.spells = [SPELLS.charge, SPELLS.repair, ...weapons.map((w) => SPELLS[w])];
    Object.assign(this, {
      acc: 0, hp: this.maxHp, en: this.maxEn, foeHp: this.foeDef.hp, guarding: false, shield: false, dazed: false, hidden: false,
      foeSkip: '', foeSkipCooldown: false, foeBlind: 0, foeBurn: 0, foeDef_: 0, flags: {}, known: new Set(), turn: 0,
      menu: 'msgs', cursor: 0, scroll: 0, queue: [], current: '', shown: 0, hold: 0, minHold: 0, voiceKey: '', result: null, overT: 0,
      listTexts: [],
    });
    this.controls = new Controls(this);
    this.cameras.main.setBackgroundColor('#000000');

    // The battle window and the foe.
    this.window(VIEW_W / 2 - 110, 30, 220, 120);
    // The guardian's own backdrop, and a shadow at his feet.
    this.add.image(VIEW_W / 2 - 106, 34, makeRpgBackdrop(this, this.foeDef.id)).setOrigin(0);
    this.add.ellipse(VIEW_W / 2, 132, 70, 10, 0x000000, 0.4);
    this.foe = this.add.image(VIEW_W / 2, 90, this.foeDef.sprite).setScale(1.4);
    this.tweens.add({ targets: this.foe, y: 87, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.flashRect = this.add.rectangle(VIEW_W / 2 - 106, 34, 212, 112, 0xffffff).setOrigin(0).setAlpha(0);
    // His health: a thin bar under the battle window.
    this.add.rectangle(VIEW_W / 2 - 101, 140, 202, 5, 0x1a1428).setOrigin(0);
    this.add.rectangle(VIEW_W / 2 - 100, 141, 200, 3, 0x2b2540).setOrigin(0);
    this.foeBar = this.add.rectangle(VIEW_W / 2 - 100, 141, 200, 3, this.foeDef.color).setOrigin(0);
    this.add.rectangle(VIEW_W / 2 - 100, 141, 200, 1, 0xffffff, 0.35).setOrigin(0);
    pixelText(this, VIEW_W / 2 - 101, 38, this.foeDef.name, { color: '#ffffff', stroke: '#000000' });

    // Status (top), commands (bottom left), messages (bottom right).
    this.window(VIEW_W / 2 - 110, 4, 220, 22);
    this.status = pixelText(this, VIEW_W / 2 - 102, 11, '', { color: '#ffffff' });
    this.window(VIEW_W / 2 - 110, 156, 70, 78);
    this.cursorText = pixelText(this, 0, 0, '>', { color: '#ffffff' }).setVisible(false);
    this.window(VIEW_W / 2 - 36, 156, 146, 78);
    this.msgText = pixelText(this, VIEW_W / 2 - 28, 164, '', { color: '#ffffff' });
    this.msgText.setMaxWidth(132);
    this.listCursor = pixelText(this, 0, 0, '>', { color: '#ffffff' }).setVisible(false);
    CMDS.forEach((c, i) => pixelText(this, VIEW_W / 2 - 96, 166 + i * 13, c, { color: '#ffffff' }));

    stopMusic();
    pixelateIn(this, 800);
    this.time.delayedCall(400, () => playMusic(this, 'rpg'));
    this.say([{ text: this.foeDef.intro }]);
    this.updateStatus();
  }

  /** A 16-bit RPG window: a blue gradient with a silver bevel and gold corners (see rpgArt). */
  private window(x: number, y: number, w: number, h: number): void {
    this.add.image(x, y, rpgWindow(this, w, h)).setOrigin(0);
  }

  private updateStatus(): void {
    const tanks = loadSave().tanks;
    this.status.setText(`ULTRAGUY  HP ${this.hp}/${this.maxHp}  EN ${this.en}/${this.maxEn}  E ${tanks}`);
    this.status.setColor(this.hp <= this.maxHp / 4 ? '#ffb040' : '#ffffff');
    this.foeBar.width = 200 * Math.max(0, this.foeHp / this.foeDef.hp);
  }

  update(_t: number, delta: number): void {
    this.acc += Math.min(delta, 100);
    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS;
      this.step();
    }
  }

  // --- messages ------------------------------------------------------------------

  private say(msgs: Msg[], after?: () => void): void {
    this.queue = [...msgs];
    this.menu = 'msgs';
    this.cursorText.setVisible(false);
    this.showList(null);
    this.afterMsgs = after ?? (() => this.openCommands());
    this.nextMsg();
  }

  private nextMsg(): void {
    if (this.voiceKey) this.sound.stopByKey(this.voiceKey);
    this.voiceKey = '';
    const m = this.queue.shift();
    if (!m) {
      this.afterMsgs();
      return;
    }
    m.fx?.();
    this.minHold = 0;
    if (m.voice) {
      const ms = playVoice(this, m.voice);
      if (ms) {
        this.voiceKey = `voice_${m.voice}`;
        this.minHold = Math.ceil(ms / STEP_MS);
      }
    }
    this.msgText.setText('');
    this.current = m.text;
    this.shown = 0;
    this.hold = 0;
    this.updateStatus();
  }

  private openCommands(): void {
    if (this.result) return;
    if (this.dazed) {
      // Dazed: you lose this turn.
      this.dazed = false;
      this.turn++;
      this.guarding = false;
      this.say([{ text: "ULTRAGUY is still seeing stars! He can't move!" }], () => this.foeTurn());
      return;
    }
    this.menu = 'cmd';
    this.cursor = 0;
    this.cursorText.setVisible(true);
    this.msgText.setText('COMMAND?');
  }

  /** The spell list, drawn in the message window (null hides it). */
  private showList(list: Spell[] | null): void {
    for (const t of this.listTexts) t.destroy();
    this.listTexts = [];
    this.listCursor.setVisible(!!list);
    if (!list) return;
    this.msgText.setText('');
    const x = VIEW_W / 2 - 24;
    const rows = list.slice(this.scroll, this.scroll + LIST_ROWS);
    rows.forEach((s, i) => {
      const color = this.en < s.cost ? '#6a6f88' : this.known.has(s.id) ? '#ffe14a' : '#ffffff';
      this.listTexts.push(pixelText(this, x, 163 + i * 11, s.name, { color }));
      this.listTexts.push(pixelText(this, x + 116, 163 + i * 11, String(s.cost), { color }).setOrigin(1, 0));
    });
    if (this.scroll > 0) this.listTexts.push(pixelText(this, x + 124, 160, '^', { color: '#8a8fa8' }));
    if (this.scroll + LIST_ROWS < list.length) this.listTexts.push(pixelText(this, x + 124, 222, 'v', { color: '#8a8fa8' }));
    this.listCursor.setPosition(x - 8, 163 + (this.cursor - this.scroll) * 11);
  }

  // --- the loop ----------------------------------------------------------------------

  private step(): void {
    this.controls.poll();
    const c = this.controls;
    const ok = c.justPressed('jump') || c.justPressed('start');
    if (this.menu === 'over') {
      if (++this.overT === 200) returnToGame(this, this.mode, this.result === 'win');
      return;
    }
    if (this.menu === 'msgs') {
      if (this.shown < this.current.length) {
        this.shown = Math.min(this.current.length, this.shown + 1);
        this.msgText.setText(this.current.slice(0, this.shown));
        if (this.shown % 2 === 0) sfx.tick();
        if (ok) {
          this.shown = this.current.length;
          this.msgText.setText(this.current);
        }
        return;
      }
      // Wait for a press, or carry on by itself once he's done talking.
      if (ok || ++this.hold > Math.max(70, this.minHold + 15)) this.nextMsg();
      return;
    }
    const n = this.menu === 'spell' ? this.spells.length : CMDS.length;
    if (c.justPressed('down')) {
      this.cursor = (this.cursor + 1) % n;
      sfx.tick();
    }
    if (c.justPressed('up')) {
      this.cursor = (this.cursor + n - 1) % n;
      sfx.tick();
    }
    if (this.menu === 'spell') {
      if (this.cursor < this.scroll) this.scroll = this.cursor;
      if (this.cursor >= this.scroll + LIST_ROWS) this.scroll = this.cursor - LIST_ROWS + 1;
      this.showList(this.spells);
      if (c.justPressed('fire')) {
        this.showList(null);
        this.openCommands();
        this.cursor = 1;
        return;
      }
    }
    this.cursorText.setPosition(VIEW_W / 2 - 104, 166 + (this.menu === 'spell' ? 1 : this.cursor) * 13);
    if (!ok) return;
    sfx.select();
    if (this.menu === 'spell') {
      const spell = this.spells[this.cursor];
      if (this.en < spell.cost) {
        this.say([{ text: 'Not enough EN!' }]);
        return;
      }
      this.playerTurn({ spell });
      return;
    }
    const cmd = CMDS[this.cursor];
    if (cmd === 'SPELL') {
      this.menu = 'spell';
      this.cursor = 0;
      this.scroll = 0;
      this.showList(this.spells);
      return;
    }
    this.playerTurn({ cmd });
  }

  // --- your turn --------------------------------------------------------------------

  private flash(color: number): void {
    this.flashRect.setFillStyle(color).setAlpha(0.6);
    this.tweens.add({ targets: this.flashRect, alpha: 0, duration: 260 });
  }

  private playerTurn(act: { cmd?: Cmd; spell?: Spell }): void {
    const name = this.foeDef.name;
    const msgs: Msg[] = [];
    if (act.cmd === 'ITEM') {
      const tanks = loadSave().tanks;
      if (tanks <= 0) {
        this.say([{ text: 'ULTRAGUY has no E-TANKS!' }]);
        return;
      }
      msgs.push({ text: 'ULTRAGUY uses an E-TANK!', fx: () => setTanks(tanks - 1) });
      msgs.push({ text: 'HP and EN are fully restored!', fx: () => { this.hp = this.maxHp; this.en = this.maxEn; sfx.pickup(); } });
    }
    this.turn++;
    this.guarding = false;

    /** Damage him (lo..hi), with weak spots, resistances, his guard and the ghillie suit. */
    const strike = (lo: number, hi: number, spell?: Spell, pierce = false): boolean => {
      if (this.hidden && Math.random() < 0.5) {
        msgs.push({ text: `...but ${name} is nowhere to be seen. It misses!`, fx: () => sfx.deflect() });
        return false;
      }
      const w = spell?.weapon;
      let dmg = Phaser.Math.Between(lo, hi);
      if (w && this.foeDef.absorb.includes(w)) {
        this.known.add(spell!.id);
        msgs.push({ text: this.foeDef.absorbText ?? 'He soaks it right up!' });
        msgs.push({ text: `${name} recovers ${dmg} HP!`, fx: () => { this.foeHp = Math.min(this.foeDef.hp, this.foeHp + dmg); sfx.rpgSpell(); } });
        return false;
      }
      if (w && this.foeDef.weak.includes(w)) {
        dmg = Math.round(dmg * 1.6);
        this.known.add(spell!.id);
        msgs.push({ text: this.foeDef.weakText, fx: () => sfx.weakHit() });
      } else if (w && this.foeDef.resist.includes(w)) {
        dmg = Math.max(1, Math.round(dmg * 0.5));
        msgs.push({ text: this.foeDef.resistText });
      }
      if (this.foeDef_ > 0 && !pierce) dmg = Math.max(1, Math.round(dmg / 2));
      msgs.push({
        text: `${name} takes ${dmg} damage!`,
        fx: () => {
          this.foeHp = Math.max(0, this.foeHp - dmg);
          sfx.rpgHit();
          this.tweens.add({ targets: this.foe, alpha: 0.2, duration: 60, yoyo: true, repeat: 3 });
        },
      });
      return true;
    };
    /** A 'loses a turn' effect (can't be chained two turns in a row). */
    const skip = (chance: number, text: string) => {
      if (this.foeSkipCooldown || this.foeSkip || Math.random() >= chance) return;
      this.foeSkip = text;
      msgs.push({ text: `${name} ${text}!` });
    };

    if (act.cmd === 'FIGHT') {
      const crit = Math.random() < 0.1;
      msgs.push({ text: 'ULTRAGUY attacks!', fx: () => sfx.shoot() });
      if (crit) msgs.push({ text: 'A terrific blow!' });
      strike(11 * (crit ? 2 : 1), 15 * (crit ? 2 : 1));
    } else if (act.cmd === 'GUARD') {
      this.guarding = true;
      msgs.push({ text: 'ULTRAGUY braces for the next blow!' });
    } else if (act.cmd === 'RUN') {
      msgs.push({ text: 'ULTRAGUY tries to run...' });
      msgs.push({ text: `But ${name} blocks the way!` });
    } else if (act.spell) {
      const s = act.spell;
      this.en -= s.cost;
      const color = s.weapon ? WEAPONS[s.weapon].colors.main : 0xffffff;
      msgs.push({ text: `ULTRAGUY casts ${s.name}!`, fx: () => { sfx.rpgSpell(); this.flash(color); } });
      switch (s.id) {
        case 'charge':
          msgs.push({ text: 'A fully charged shot!', fx: () => sfx.chargeShot() });
          strike(20, 24);
          break;
        case 'repair': {
          const heal = Phaser.Math.Between(30, 36);
          msgs.push({ text: `ULTRAGUY recovers ${heal} HP!`, fx: () => (this.hp = Math.min(this.maxHp, this.hp + heal)) });
          break;
        }
        case 'quake':
          msgs.push({ text: 'The ground heaves!', fx: () => { sfx.quake(); this.cameras.main.shake(300, 0.01); } });
          if (strike(14, 18, s)) skip(0.35, 'is knocked off his feet');
          break;
        case 'thorn':
          msgs.push({ text: 'The thorn flies out...', fx: () => sfx.thorn() });
          strike(7, 9, s);
          msgs.push({ text: '...and comes back around!', fx: () => sfx.thorn() });
          strike(7, 9, s);
          break;
        case 'frost':
          msgs.push({ text: 'Icicles rain down!', fx: () => sfx.freeze() });
          if (strike(13, 17, s)) skip(0.35, 'is frozen solid');
          break;
        case 'cyclone':
          msgs.push({ text: 'A howling wind!', fx: () => sfx.cyclone() });
          if (strike(12, 16, s)) {
            this.foeBlind = 3;
            msgs.push({ text: `${name} can barely see! His attacks may miss.` });
          }
          break;
        case 'spark':
          msgs.push({ text: 'A ring of lightning!', fx: () => sfx.zap() });
          if (strike(13, 17, s)) skip(0.4, 'is stunned');
          break;
        case 'flame':
          msgs.push({ text: 'A burst of fire!', fx: () => sfx.flame() });
          if (strike(14, 18, s) && !this.foeDef.resist.includes('flame')) {
            this.foeBurn = 3;
            msgs.push({ text: `${name} is on fire!` });
          }
          break;
        case 'saw':
          msgs.push({ text: 'The blade cuts through everything!', fx: () => sfx.hit() });
          strike(19, 23, s, true);
          break;
        case 'bubble':
          msgs.push({ text: 'Bubbles burst all around!', fx: () => sfx.bubble() });
          if (strike(12, 16, s) || this.foeDef.absorb.includes('bubble')) {
            this.shield = true;
            msgs.push({ text: 'A bubble shield wraps around ULTRAGUY!' });
          }
          break;
      }
    }
    this.hidden = false;
    this.say(msgs, () => (this.foeHp <= 0 ? this.victory() : this.foeTurn()));
  }

  // --- his turn ------------------------------------------------------------------------

  private foeTurn(): void {
    const name = this.foeDef.name;
    const msgs: Msg[] = [];
    const scene = this;
    const battle: Battle = {
      turn: this.turn,
      foeHp: this.foeHp,
      foeMax: this.foeDef.hp,
      foeBlind: this.foeBlind,
      heroGuarding: this.guarding,
      flags: this.flags,
      say: (text, o) => msgs.push({ text, voice: o?.voice, fx: o?.fx }),
      hurt: (lo, hi, text, o: HurtOpts = {}) => {
        if (!o.sure && scene.foeBlind > 0 && Math.random() < 0.35) {
          msgs.push({ text: 'The wind throws off his aim. It misses!', fx: () => sfx.deflect() });
          return;
        }
        let dmg = Phaser.Math.Between(lo, hi);
        const notes: string[] = [];
        if (scene.guarding && !o.pierce) dmg = Math.ceil(dmg / 2);
        if (scene.shield) {
          dmg = Math.ceil(dmg / 2);
          scene.shield = false;
          notes.push('The bubble shield pops!');
        }
        if (scene.armor) dmg = Math.ceil(dmg * 0.75);
        msgs.push({ text, voice: o.voice, fx: o.sound });
        for (const n of notes) msgs.push({ text: n, fx: () => sfx.bubble() });
        msgs.push({
          text: `ULTRAGUY takes ${dmg} damage!`,
          fx: () => {
            this.hp = Math.max(0, this.hp - dmg);
            sfx.hurt();
            this.cameras.main.shake(180, 0.012);
          },
        });
        if (o.daze && Math.random() < o.daze) {
          scene.dazed = true;
          msgs.push({ text: 'ULTRAGUY is dazed!' });
        }
      },
      heal: (amount, text, voice) =>
        msgs.push({ text, voice, fx: () => { this.foeHp = Math.min(this.foeDef.hp, this.foeHp + amount); sfx.rpgSpell(); } }),
      defend: (turns) => {
        scene.foeDef_ = turns + 1;
        msgs.push({ text: `${name}'s defense goes up!` });
      },
      hide: () => (scene.hidden = true),
      flash: (color) => this.flash(color),
      shake: () => this.cameras.main.shake(200, 0.01),
    };

    if (this.foeSkip) {
      msgs.push({ text: `${name} ${this.foeSkip.replace(/^is /, 'is still ').replace('knocked off his feet', 'getting back up')}...` });
      this.foeSkip = '';
      this.foeSkipCooldown = true;
    } else {
      this.foeSkipCooldown = false;
      this.foeDef.act(battle);
    }
    // Burns tick at the end of his turn.
    if (this.foeBurn > 0) {
      this.foeBurn--;
      const burn = 5;
      msgs.push({ text: `${name} burns for ${burn} damage!`, fx: () => { this.foeHp = Math.max(0, this.foeHp - burn); sfx.flame(); } });
    }
    if (this.foeBlind > 0) this.foeBlind--;
    if (this.foeDef_ > 0) this.foeDef_--;
    this.say(msgs, () => (this.foeHp <= 0 ? this.victory() : this.hp <= 0 ? this.defeat() : this.openCommands()));
  }

  // --- the end -------------------------------------------------------------------------

  private victory(): void {
    this.result = 'win';
    stopMusic();
    this.tweens.add({ targets: this.foe, alpha: 0, scale: 1.8, duration: 900, delay: 1600 });
    sfx.victory();
    const d = this.foeDef;
    this.say(
      [
        { text: `"${d.loses}"`, voice: `${d.id}_loses` },
        { text: `${d.name} is defeated!` },
        { text: `ULTRAGUY gains 0 EXP. The ${PARTS[d.part].name} awaits!` },
      ],
      () => (this.menu = 'over'),
    );
  }

  private defeat(): void {
    this.result = 'lose';
    stopMusic();
    this.cameras.main.setBackgroundColor('#300000');
    const d = this.foeDef;
    this.say([{ text: 'ULTRAGUY has fallen...' }, { text: `"${d.wins}"`, voice: `${d.id}_wins` }], () => (this.menu = 'over'));
  }
}
