import Phaser from 'phaser';
import { playMusic, playVoice, stopMusic } from '../audio';
import { STEP_MS, VIEW_W } from '../constants';
import { Controls } from '../input';
import { pixelText } from '../pixelFont';
import { loadSave, setTanks } from '../save';
import { sfx } from '../sfx';
import { pixelateIn } from './cutscene';
import { ModeData, returnToGame } from './encounters';

/**
 * A turn-based, first-person, one-on-one RPG battle (the UltraBlaster's
 * guardian). Pick a command, then both sides act, told in the message window.
 *
 *   FIGHT  a basic attack (sometimes a terrific blow)
 *   SPELL  SHOCK (may stun), ULTRA BEAM (big damage), REPAIR (heal); cost EN
 *   GUARD  halve the next hit (his charged OMEGA BEAM is the one to guard)
 *   ITEM   use an E-TANK from your save: full HP and EN
 *   RUN    a guardian won't let you
 */

type Cmd = 'FIGHT' | 'SPELL' | 'GUARD' | 'ITEM' | 'RUN';
const CMDS: Cmd[] = ['FIGHT', 'SPELL', 'GUARD', 'ITEM', 'RUN'];
const SPELLS = [
  { name: 'SHOCK', cost: 3 },
  { name: 'ULTRA BEAM', cost: 6 },
  { name: 'REPAIR', cost: 5 },
];

const HERO_HP = 64;
const HERO_EN = 24;
const FOE_HP = 130;

interface Msg {
  text: string;
  /** Runs when this message starts showing. */
  fx?: () => void;
}

export class RpgScene extends Phaser.Scene {
  private controls!: Controls;
  private mode!: ModeData;
  private acc = 0;
  private hp = HERO_HP;
  private en = HERO_EN;
  private foeHp = FOE_HP;
  private guarding = false;
  private charging = false;
  private stunned = false;
  private healed = false;
  private turn = 0;
  private menu: 'cmd' | 'spell' | 'msgs' | 'over' = 'msgs';
  private cursor = 0;
  private queue: Msg[] = [];
  private shown = 0;
  private hold = 0;
  private result: 'win' | 'lose' | null = null;
  private overT = 0;

  private foe!: Phaser.GameObjects.Image;
  private status!: ReturnType<typeof pixelText>;
  private msgText!: ReturnType<typeof pixelText>;
  private cmdTexts: ReturnType<typeof pixelText>[] = [];
  private cursorText!: ReturnType<typeof pixelText>;
  private cmdWin!: Phaser.GameObjects.Container;

  constructor() {
    super('rpg');
  }

  create(data: ModeData): void {
    this.mode = { stage: data?.stage ?? 'foundry', ret: data?.ret ?? { kind: 'part', step: 0 } };
    this.controls = new Controls(this);
    Object.assign(this, { acc: 0, hp: HERO_HP, en: HERO_EN, foeHp: FOE_HP, guarding: false, charging: false, stunned: false, healed: false, turn: 0, menu: 'msgs', cursor: 0, queue: [], shown: 0, hold: 0, result: null, overT: 0, cmdTexts: [] });
    this.cameras.main.setBackgroundColor('#000000');

    // The battle window and the foe.
    this.window(VIEW_W / 2 - 110, 30, 220, 120);
    this.add.rectangle(VIEW_W / 2 - 106, 34, 212, 112, 0x0a1430).setOrigin(0);
    for (let i = 0; i < 6; i++) this.add.rectangle(VIEW_W / 2 - 106, 34 + i * 20, 212, 1, 0x14224a).setOrigin(0);
    this.foe = this.add.image(VIEW_W / 2, 92, 'sentry_front').setScale(1.4);
    this.tweens.add({ targets: this.foe, y: 88, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Status (top), commands (bottom left), messages (bottom right).
    this.window(VIEW_W / 2 - 110, 4, 220, 22);
    this.status = pixelText(this, VIEW_W / 2 - 102, 11, '', { color: '#ffffff' });
    this.cmdWin = this.add.container(0, 0);
    const cw = this.window(VIEW_W / 2 - 110, 156, 70, 78, this.cmdWin);
    void cw;
    this.cursorText = pixelText(this, 0, 0, '>', { color: '#ffffff' });
    this.cmdWin.add(this.cursorText);
    this.window(VIEW_W / 2 - 36, 156, 146, 78);
    this.msgText = pixelText(this, VIEW_W / 2 - 28, 164, '', { color: '#ffffff' });
    this.msgText.setMaxWidth(132);
    this.setCommands(CMDS);

    stopMusic();
    pixelateIn(this, 800);
    this.time.delayedCall(400, () => playMusic(this, 'rpg'));
    this.say([{ text: 'VAULT SENTRY blocks the way!' }]);
    this.updateStatus();
  }

  /** A Dragon-Quest-style window: black with a double white border. */
  private window(x: number, y: number, w: number, h: number, into?: Phaser.GameObjects.Container): Phaser.GameObjects.Rectangle {
    const outer = this.add.rectangle(x, y, w, h, 0x000000).setOrigin(0).setStrokeStyle(2, 0xffffff);
    const inner = this.add.rectangle(x + 3, y + 3, w - 6, h - 6).setOrigin(0).setStrokeStyle(1, 0x8a8fa8);
    into?.add([outer, inner]);
    return outer;
  }

  private setCommands(list: string[]): void {
    for (const t of this.cmdTexts) t.destroy();
    this.cmdTexts = list.map((c, i) => pixelText(this, VIEW_W / 2 - 96, 166 + i * 13, c, { color: '#ffffff' }));
    this.cmdWin.add(this.cmdTexts);
    this.cursor = 0;
  }

  private updateStatus(): void {
    const tanks = loadSave().tanks;
    this.status.setText(`ULTRAGUY  HP ${this.hp}/${HERO_HP}  EN ${this.en}/${HERO_EN}  E ${tanks}`);
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
    this.afterMsgs = after ?? (() => this.openCommands());
    this.nextMsg();
  }

  private afterMsgs: () => void = () => {};

  private nextMsg(): void {
    const m = this.queue.shift();
    if (!m) {
      this.afterMsgs();
      return;
    }
    m.fx?.();
    this.msgText.setText('');
    this.current = m.text;
    this.shown = 0;
    this.hold = 0;
    this.updateStatus();
  }

  private current = '';

  private openCommands(): void {
    if (this.result) return;
    this.menu = 'cmd';
    this.setCommands(CMDS);
    this.msgText.setText('COMMAND?');
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
      if (ok || ++this.hold > 70) this.nextMsg();
      return;
    }
    // Menus.
    const n = this.cmdTexts.length;
    if (c.justPressed('down')) {
      this.cursor = (this.cursor + 1) % n;
      sfx.tick();
    }
    if (c.justPressed('up')) {
      this.cursor = (this.cursor + n - 1) % n;
      sfx.tick();
    }
    this.cursorText.setPosition(VIEW_W / 2 - 104, 166 + this.cursor * 13);
    if (this.menu === 'spell' && c.justPressed('fire')) {
      this.menu = 'cmd';
      this.setCommands(CMDS);
      return;
    }
    if (!ok) return;
    sfx.select();
    if (this.menu === 'spell') {
      const spell = SPELLS[this.cursor];
      if (this.en < spell.cost) {
        this.say([{ text: 'Not enough EN!' }], () => this.openCommands());
        return;
      }
      this.playerTurn(spell.name);
      return;
    }
    const cmd = CMDS[this.cursor];
    if (cmd === 'SPELL') {
      this.menu = 'spell';
      this.setCommands(SPELLS.map((s) => `${s.name} ${s.cost}`));
      this.msgText.setText('Which spell?  (FIRE: back)');
      return;
    }
    this.playerTurn(cmd);
  }

  // --- turns ------------------------------------------------------------------------

  private playerTurn(action: string): void {
    this.turn++;
    this.guarding = false;
    const msgs: Msg[] = [];
    const hit = (lo: number, hi: number, crit = false) => {
      const dmg = Phaser.Math.Between(lo, hi) * (crit ? 2 : 1);
      return dmg;
    };
    const damageFoe = (dmg: number, text: string) => {
      msgs.push({
        text,
        fx: () => {
          this.foeHp = Math.max(0, this.foeHp - dmg);
          sfx.rpgHit();
          this.tweens.add({ targets: this.foe, alpha: 0.2, duration: 60, yoyo: true, repeat: 3 });
        },
      });
    };
    if (action === 'FIGHT') {
      const crit = Math.random() < 0.1;
      const dmg = hit(9, 13, crit);
      msgs.push({ text: 'ULTRAGUY attacks!' });
      if (crit) msgs.push({ text: 'A terrific blow!' });
      damageFoe(dmg, `VAULT SENTRY takes ${dmg} damage!`);
    } else if (action === 'SHOCK') {
      this.en -= 3;
      const dmg = hit(10, 14);
      msgs.push({ text: 'ULTRAGUY casts SHOCK!', fx: () => sfx.rpgSpell() });
      damageFoe(dmg, `VAULT SENTRY takes ${dmg} damage!`);
      if (Math.random() < 0.45) {
        this.stunned = true;
        this.charging = false;
        msgs.push({ text: 'VAULT SENTRY is stunned!' });
      }
    } else if (action === 'ULTRA BEAM') {
      this.en -= 6;
      const dmg = hit(22, 28);
      msgs.push({ text: 'ULTRAGUY fires the ULTRA BEAM!', fx: () => { sfx.rpgSpell(); this.cameras.main.flash(200, 255, 255, 255); } });
      damageFoe(dmg, `VAULT SENTRY takes ${dmg} damage!`);
    } else if (action === 'REPAIR') {
      this.en -= 5;
      const heal = Phaser.Math.Between(24, 30);
      msgs.push({ text: 'ULTRAGUY casts REPAIR!', fx: () => sfx.rpgSpell() });
      msgs.push({ text: `ULTRAGUY recovers ${heal} HP!`, fx: () => (this.hp = Math.min(HERO_HP, this.hp + heal)) });
    } else if (action === 'GUARD') {
      this.guarding = true;
      msgs.push({ text: 'ULTRAGUY braces for the next blow!' });
    } else if (action === 'ITEM') {
      const tanks = loadSave().tanks;
      if (tanks <= 0) {
        this.say([{ text: 'ULTRAGUY has no E-TANKS!' }], () => this.openCommands());
        return;
      }
      msgs.push({ text: 'ULTRAGUY uses an E-TANK!', fx: () => setTanks(tanks - 1) });
      msgs.push({ text: 'HP and EN are fully restored!', fx: () => { this.hp = HERO_HP; this.en = HERO_EN; sfx.pickup(); } });
    } else if (action === 'RUN') {
      msgs.push({ text: 'ULTRAGUY tries to run...' });
      msgs.push({ text: 'But VAULT SENTRY blocks the way!' });
    }
    this.say(msgs, () => (this.foeHp <= 0 ? this.victory() : this.foeTurn()));
  }

  private foeTurn(): void {
    const msgs: Msg[] = [];
    const hurt = (lo: number, hi: number, text: string) => {
      let dmg = Phaser.Math.Between(lo, hi);
      if (this.guarding) dmg = Math.ceil(dmg / 2);
      msgs.push({ text });
      msgs.push({
        text: `ULTRAGUY takes ${dmg} damage!`,
        fx: () => {
          this.hp = Math.max(0, this.hp - dmg);
          sfx.hurt();
          this.cameras.main.shake(180, 0.012);
        },
      });
    };
    if (this.stunned) {
      this.stunned = false;
      msgs.push({ text: 'VAULT SENTRY is still twitching!' });
    } else if (this.charging) {
      this.charging = false;
      hurt(26, 32, 'VAULT SENTRY unleashes the OMEGA BEAM!');
    } else if (!this.healed && this.foeHp < FOE_HP * 0.35) {
      this.healed = true;
      msgs.push({ text: 'VAULT SENTRY runs a repair cycle!', fx: () => sfx.rpgSpell() });
      msgs.push({ text: 'VAULT SENTRY recovers 20 HP!', fx: () => (this.foeHp = Math.min(FOE_HP, this.foeHp + 20)) });
    } else {
      const r = Math.random();
      if (this.turn >= 2 && r < 0.25) {
        this.charging = true;
        msgs.push({ text: 'VAULT SENTRY is charging its core!' });
        msgs.push({ text: "(Its eye glows white-hot. Better GUARD!)" });
      } else if (r < 0.65) hurt(8, 12, 'VAULT SENTRY fires its cannon!');
      else hurt(5, 9, 'VAULT SENTRY swings its shield!');
    }
    this.say(msgs, () => (this.hp <= 0 ? this.defeat() : this.openCommands()));
  }

  private victory(): void {
    this.result = 'win';
    stopMusic();
    this.tweens.add({ targets: this.foe, alpha: 0, scale: 1.8, duration: 900 });
    sfx.victory();
    playVoice(this, 'sentry_loses');
    this.say(
      [{ text: 'VAULT SENTRY is destroyed!' }, { text: 'ULTRAGUY gains 0 EXP. The UltraBlaster awaits!' }],
      () => (this.menu = 'over'),
    );
  }

  private defeat(): void {
    this.result = 'lose';
    stopMusic();
    this.cameras.main.setBackgroundColor('#300000');
    this.say([{ text: 'ULTRAGUY has fallen...' }], () => (this.menu = 'over'));
  }
}
