import Phaser from 'phaser';
import { nowPlaying, playMusic, stopMusic } from '../audio';
import { STEP_MS, VIEW_H, VIEW_W } from '../constants';
import { Controls } from '../input';
import { PipPaint, PipShell, pipTexture } from '../pip';
import { heroFrames } from '../heroSprites';
import { pixelText } from '../pixelFont';
import { loadSave, recordClear } from '../save';
import { sfx } from '../sfx';
import { WEAPONS, WeaponId, heroTexture } from '../weapons';
import { pixelateIn, pixelateOut } from './cutscene';
import { FINALE_ART, PaintLayer } from './paintLayer';
import { HIT_AT, SPELL_FRAMES, drawCast, drawSpell } from './spellFx';
import { rpgWindow } from './rpgArt';

/**
 * THE CREATOR: the game's last battle, after Shade falls in the Throne.
 *
 * An ATB party battle in the style of the 16-bit JRPG finales: UltraGuy (you
 * command him) and Pip (it acts on its own) against four forms in one long
 * battle, the arena transforming between them. The forms and backdrops are
 * painted art, shown at full resolution in a web layer behind the canvas
 * (paintLayer.ts); everything else is drawn here.
 *
 * You can't lose: Pip heals, shields, and revives UltraGuy every time he falls.
 * It's the closing cinematic, played. It ends with the creator's last words and
 * a reel of every stage, then the cast roll.
 */

type Status = 'freeze' | 'slow' | 'burn' | 'poison' | 'magnet' | 'dark' | 'reverse' | 'buff';
interface Attack {
  name: string;
  /** Damage per hit (before guard and barrier). */
  power: number;
  target: 'hero' | 'pip' | 'one' | 'both';
  hits?: number;
  /** Effect color, and an optional status on the hero. */
  color: number;
  status?: [Status, number];
  /** Announced a turn ahead (so GUARD and Pip's barrier can answer it). */
  big?: boolean;
  /** Tier 4: the memory he tells before casting it. */
  memory?: string;
  /** Something special this attack does (handled by name in doAttack). */
  special?: 'summon' | 'rush' | 'bomb' | 'coach' | 'reverse';
}
interface Line {
  who: string;
  text: string;
  color?: string;
}
interface Tier {
  name: string;
  art: string;
  backdrop: string;
  /** Who it is, short (on the popups). */
  short: string;
  /** Painting placement (game units): center x, bottom y, height. */
  box: [number, number, number];
  hp: number;
  /** ATB fill per step. */
  speed: number;
  weak: WeaponId[];
  attacks: Attack[];
  /** Said as it arrives. */
  intro: Line[];
  music: string;
}

const C = (who: string, text: string): Line => ({ who, text, color: '#ffe14a' });
const CREATOR = 'THE CREATOR';

const TIERS: Tier[] = [
  {
    name: 'THE ELEMENTAL CHIMERA',
    short: 'CHIMERA',
    art: 'chimera.png',
    backdrop: 'bg_storm.jpg',
    box: [124, 190, 160],
    hp: 900,
    speed: 0.0032,
    weak: ['spark', 'flame'],
    music: 'ascension',
    intro: [C(CREATOR, 'YOU BEAT THEM ONE AT A TIME.'), C(CREATOR, "LET'S SEE YOU FACE THEM TOGETHER.")],
    attacks: [
      { name: 'BLIZZARD', power: 70, target: 'both', color: 0x9ae8ff, status: ['freeze', 120] },
      { name: 'CYCLONE', power: 60, target: 'one', color: 0xd8ffe0, special: 'reverse' },
      { name: 'BUBBLE PRISON', power: 50, target: 'hero', color: 0x6ab8e8, status: ['slow', 360] },
      { name: 'FLAME BURST', power: 80, target: 'one', color: 0xff7a2a, status: ['burn', 300] },
      { name: 'ELEMENTAL STORM', power: 190, target: 'both', color: 0xffffff, big: true },
    ],
  },
  {
    name: 'THE IRON IDOL',
    short: 'IRON IDOL',
    art: 'idol.png',
    backdrop: 'bg_forge.jpg',
    box: [128, 190, 164],
    hp: 1100,
    speed: 0.003,
    weak: ['bubble', 'quake'],
    music: 'ascension',
    intro: [C(CREATOR, 'FIRE, ICE, WIND AND WATER. VERY POETIC.'), C(CREATOR, 'NOW THE MACHINES.')],
    attacks: [
      { name: 'QUAKE HAMMER', power: 110, target: 'both', color: 0xc8a070 },
      { name: 'SPARK CHAIN', power: 45, target: 'one', hits: 3, color: 0xf8e040 },
      { name: 'MAGNETIZE', power: 40, target: 'hero', color: 0xe83a3a, status: ['magnet', 2] },
      { name: 'THORN STORM', power: 22, target: 'one', hits: 6, color: 0x6cc04a },
      { name: 'MELTDOWN', power: 230, target: 'both', color: 0xfff4a0, big: true },
    ],
  },
  {
    name: 'BLACK JARED, SUPERSIZED',
    short: 'BLACK JARED',
    art: 'jared.png',
    backdrop: 'bg_store.jpg',
    box: [118, 192, 164],
    hp: 900,
    speed: 0.0035,
    weak: ['flame', 'saw'],
    music: 'ascension',
    intro: [
      C(CREATOR, 'BEFORE THE MASTERS, BEFORE THE FORTRESS, THERE WAS A HOT DOG STAND.'),
      C(CREATOR, 'EVERY HERO NEEDS A FIRST BOSS. I GAVE YOURS A SECOND HELPING.'),
      { who: 'BLACK JARED', text: 'TWO FOR THREE DOLLARS, BABY!! YOU WANT MUSTARD ON THAT?!', color: '#6cc04a' },
    ],
    attacks: [
      { name: 'CONDIMENT BARRAGE', power: 70, target: 'both', color: 0xf8d020 },
      { name: 'RELISH', power: 40, target: 'hero', color: 0x6cc04a, status: ['poison', 420] },
      { name: 'TWO FOR ONE', power: 0, target: 'hero', color: 0xe86a50, special: 'summon' },
      { name: 'LUNCH RUSH', power: 55, target: 'one', color: 0xc84a3a, special: 'rush' },
      { name: 'THE WORKS', power: 210, target: 'both', color: 0xff5050, big: true },
    ],
  },
  {
    name: CREATOR,
    short: CREATOR,
    art: 'creator.png',
    backdrop: 'bg_void.jpg',
    box: [128, 196, 172],
    hp: 1800,
    speed: 0.0034,
    weak: [],
    music: 'creator',
    intro: [
      C(CREATOR, 'SO. YOU MADE IT ALL THE WAY HERE.'),
      C(CREATOR, 'I BUILT EVERY ROOM YOU WALKED THROUGH. EVERY SPIKE. EVERY BOLT.'),
      C(CREATOR, 'NOT TO STOP YOU. TO REMEMBER.'),
    ],
    attacks: [
      { name: 'BRICK BREAKER', power: 40, target: 'one', hits: 4, color: 0xf28c28, memory: 'MY FIRST HIGH SCORE WAS A PADDLE AND A WALL OF BRICKS. I PLAYED UNTIL THE TV WAS WARM TO THE TOUCH.' },
      { name: 'LILY PADS', power: 130, target: 'one', color: 0x6cc04a, memory: 'CROSSING THE ROAD WAS THE HARDEST THING IN THE WORLD. I STILL LOOK BOTH WAYS FOR LOGS.' },
      { name: 'FACE OFF', power: 150, target: 'hero', color: 0x9ee8ff, memory: 'TWO PLAYERS, ONE COUCH. WHOEVER LOST HAD TO GET THE SNACKS.' },
      { name: 'HIGH SKIES', power: 24, target: 'one', hits: 7, color: 0xa8e070, memory: 'I LEARNED TO DODGE BEFORE I LEARNED LONG DIVISION.' },
      { name: 'RACE DAY', power: 60, target: 'both', color: 0xf8e040, special: 'reverse', memory: "I DIDN'T HAVE A BIKE THAT FAST. SO I MADE ONE." },
      { name: 'SHORT FUSE', power: 0, target: 'hero', color: 0xff7a2a, special: 'bomb', memory: 'BOMBS, BRICKS, AND YOUR BEST FRIEND SITTING THREE FEET AWAY. PURE DIPLOMACY.' },
      { name: 'JUNK MAZE', power: 50, target: 'hero', color: 0xc8ccd8, status: ['slow', 360], memory: 'SOME OF MY BEST AFTERNOONS WERE SPENT LOST, WITH A SWORD AND ONE MORE KEY TO FIND.' },
      { name: 'TRENCH DESCENT', power: 70, target: 'both', color: 0x3a78b8, status: ['dark', 600], memory: "THE DARK PARTS SCARED ME MOST. THAT'S HOW I KNEW THEY WERE GOOD." },
      { name: 'TITLE BOUT', power: 0, target: 'hero', color: 0x8c4ad8, special: 'coach', memory: "EVERY CHAMP NEEDS SOMEONE IN THE CORNER. GO ON. I'LL ALLOW IT." },
      { name: 'DOGFIGHT', power: 20, target: 'one', hits: 8, color: 0xff5050, memory: 'ONE QUARTER. ONE MORE TRY. ONE MORE QUARTER.' },
      { name: 'ULTRA ARENA', power: 200, target: 'one', color: 0xd83a4a, memory: 'FIRST ONE TO TEN FRAGS. I NEVER ONCE GOT TO TEN.' },
      {
        name: 'INSERT COIN', power: 360, target: 'both', color: 0xffffff, big: true,
        memory: 'THOSE GAMES WERE BUILT BY PEOPLE WHO DIDN\'T KNOW WHAT GAMES COULD BE YET. THEY FIGURED IT OUT FOR ALL OF US.',
      },
    ],
  },
];

const OMEN = [
  'ULTRAGUY.',
  'YOU CROSSED EVERY STAGE.',
  'YOU BEAT EVERY MASTER, AND EVERY GAME THEY THREW AT YOU.',
  'YOU EVEN BEAT YOURSELF.',
  'BUT THERE IS ONE THING YOU CANNOT OVERCOME.',
  '...',
  'THE ONE WHO MADE YOU.',
];

const LAST_WORDS: Line[] = [
  C(CREATOR, '...HA. THERE IT IS.'),
  C(CREATOR, 'THIS WHOLE PLACE WAS NEVER A FORTRESS. IT WAS A THANK-YOU NOTE.'),
  C(CREATOR, 'TO THE GAMES THAT RAISED ME, AND THE PEOPLE WHO MADE THEM.'),
  C(CREATOR, 'YOU WIN, ULTRAGUY.'),
  C(CREATOR, 'NOW GO PLAY SOMETHING OLD.'),
];

const REVIVES = ["NOT TODAY!", 'GET UP, ULTRAGUY!', "I'VE GOT YOU!", 'REBOOTING YOU... NOW!', "YOU'RE NOT DONE YET!", 'ONE MORE TIME!'];
const STILL = ['STILL STANDING? GOOD.', 'THAT LITTLE ROBOT OF YOURS IS SOMETHING.', "YOU DON'T QUIT. I LIKE THAT.", 'AGAIN. GOOD.'];

/** The reel at the end: every stage, a boss shot from each (public/assets/finale/shots). */
const REEL: { shot: string; title: string; line: string }[] = [
  { shot: 'intro', title: 'DOWNTOWN', line: 'A HOT DOG STAND, A CITY STREET, AND THE FIRST JUMP.' },
  { shot: 'foundry', title: 'FOUNDRY  -  ANVIL', line: 'MIND THE PRESSES.' },
  { shot: 'canopy', title: 'CANOPY  -  MANTIS', line: 'BOUNCE HIGH. THE BRAMBLES ARE COMING.' },
  { shot: 'glacier', title: 'GLACIER  -  FROSTLINE', line: "THE ICE WOULDN'T HOLD. YOU DID." },
  { shot: 'stratos', title: 'STRATOS  -  GALE', line: 'YOU RODE THE WIND.' },
  { shot: 'powerplant', title: 'POWER PLANT  -  VOLT', line: 'LIGHTS OUT, AND YOU KEPT GOING.' },
  { shot: 'caldera', title: 'CALDERA  -  MAGMA', line: "DON'T STOP CLIMBING." },
  { shot: 'scrapyard', title: 'SCRAPYARD  -  SCRAP', line: 'EVERYTHING MOVED. SO DID YOU.' },
  { shot: 'reef', title: 'REEF  -  TIDE', line: 'YOU WENT WITH THE FLOW.' },
];

const HERO_MAX = 620;
const PIP_MAX = 300;
const WE_MAX = 28;

export class CreatorScene extends Phaser.Scene {
  private controls!: Controls;
  private paint!: PaintLayer;
  private acc = 0;
  private frame = 0;
  private phase: 'omen' | 'tear' | 'talk' | 'fight' | 'fall' | 'end' | 'reel' = 'omen';
  private phaseT = 0;
  private tier = 0;
  private bossHp = 0;
  private bossAtb = 0;
  private pendingBig: Attack | null = null;
  private lastAttack = '';
  private halfway = { at66: false, at33: false };
  // The party.
  private hero = { hp: HERO_MAX, atb: 0, guard: false, charged: false, revives: 0 };
  private pip = { hp: PIP_MAX, atb: 0.4 };
  private barrier = false;
  private status = new Map<Status, number>();
  private bomb = 0;
  private bombDamage = 0;
  private we: Partial<Record<WeaponId, number>> = {};
  private items = { etank: 2, wtank: 1 };
  // Hotdog minions (tier 3).
  private dogs: Dog[] = [];
  private dogSerial = 0;
  /** Rings from weapon impacts, and frames of hit-freeze left. */
  private rings: { x: number; y: number; r: number; max: number; color: number; life: number }[] = [];
  private freeze = 0;
  // Menus.
  private menu: { kind: 'main' | 'weapon' | 'item' | 'target'; options: string[]; sel: number; pending?: string } | null = null;
  // Talking: a queue of lines in the top box; play waits while it's open.
  private lines: Line[] = [];
  private lineT = 0;
  private after: (() => void) | null = null;
  // Display.
  private gfx!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private heroImg!: Phaser.GameObjects.Image;
  private pipImg!: Phaser.GameObjects.Image;
  private topBox!: Phaser.GameObjects.Image;
  private topText!: ReturnType<typeof pixelText>;
  private topName!: ReturnType<typeof pixelText>;
  private texts: ReturnType<typeof pixelText>[] = [];
  private menuTexts: ReturnType<typeof pixelText>[] = [];
  private omenText!: ReturnType<typeof pixelText>;
  private effects: { x: number; y: number; vx: number; vy: number; life: number; color: number; size: number }[] = [];
  private reelImg: Phaser.GameObjects.Image | null = null;
  /** The reel's frames: a window around each shot, and a caption window under it. */
  private reelFrame: Phaser.GameObjects.Image | null = null;
  private reelCaption: Phaser.GameObjects.Container | null = null;
  private winL!: Phaser.GameObjects.Image;
  private winR!: Phaser.GameObjects.Image;
  private pipLook!: { shell: PipShell; paint: PipPaint };
  /** The hero's pose ('idle' bobs through idle1-4; 'hurt' for a moment). */
  private pose: 'idle' | 'hurt' = 'idle';

  constructor() {
    super('creator');
  }

  create(): void {
    this.controls = new Controls(this);
    const save = loadSave();
    Object.assign(this, {
      acc: 0, frame: 0, phase: 'omen', phaseT: 0, tier: 0, bossAtb: 0, pendingBig: null, lastAttack: '',
      barrier: false, bomb: 0, bombDamage: 0, rings: [], freeze: 0, dogSerial: 0, spell: null, lines: [], lineT: 0, after: null, menu: null, effects: [], dogs: [], reelImg: null,
    });
    this.halfway = { at66: false, at33: false };
    this.hero = { hp: HERO_MAX, atb: 0, guard: false, charged: false, revives: 0 };
    this.pip = { hp: PIP_MAX, atb: 0.4 };
    this.status = new Map();
    this.we = {};
    for (const w of save.weapons) if (w !== 'buster') this.we[w] = WE_MAX;
    this.items = { etank: Math.max(2, save.tanks), wtank: Math.max(1, save.wtanks) };
    this.pipLook = { shell: save.pipShell, paint: save.pipPaint };

    this.paint = new PaintLayer(this.game);
    this.events.once('shutdown', () => this.paint.destroy());
    // Preload the paintings so each tier appears without a pop.
    for (const t of TIERS) {
      new Image().src = FINALE_ART(t.art);
      new Image().src = FINALE_ART(t.backdrop);
      new Image().src = FINALE_ART('hotdog.png');
    }

    this.gfx = this.add.graphics().setDepth(44);
    this.dim = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x05040c, 1).setOrigin(0).setDepth(5).setAlpha(0);
    this.spellSolid = this.add.graphics().setDepth(28);
    this.spellAdd = this.add.graphics().setDepth(29).setBlendMode(Phaser.BlendModes.ADD);
    this.fx = this.add.graphics().setDepth(30).setBlendMode(Phaser.BlendModes.ADD);
    this.pose = 'idle';
    this.heroImg = this.add.image(352, 172, heroTexture('buster'), heroFrames(this).idle).setOrigin(0.5, 1).setScale(1.5).setFlipX(true).setDepth(10).setVisible(false);
    this.pipImg = this.add.image(390, 136, pipTexture(this, this.pipLook.shell, this.pipLook.paint, 0)).setScale(1.5).setDepth(10).setVisible(false);
    this.topBox = this.add.image(VIEW_W / 2, 22, rpgWindow(this, 400, 36)).setDepth(40).setVisible(false);
    this.topName = pixelText(this, 22, 8, '', { color: '#ffe14a' }).setDepth(41);
    this.topText = pixelText(this, 22, 19, '', { color: '#fff1e0' }).setDepth(41).setMaxWidth(380);
    this.winL = this.add.image(4, 186, rpgWindow(this, 150, 50)).setOrigin(0).setDepth(39).setVisible(false);
    this.winR = this.add.image(158, 186, rpgWindow(this, 265, 50)).setOrigin(0).setDepth(39).setVisible(false);
    this.omenText = pixelText(this, VIEW_W / 2, VIEW_H / 2, '', { color: '#ffffff' }).setOrigin(0.5).setDepth(60).setAlign('center');
    // (The camera stays transparent: the painted layer is behind the canvas.)
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    stopMusic(600);
    pixelateIn(this, 600);
  }

  update(_t: number, delta: number): void {
    this.acc += Math.min(delta, 100);
    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS;
      this.frame++;
      this.controls.poll();
      this.step();
    }
    this.draw();
  }

  // --- flow -----------------------------------------------------------------------

  private step(): void {
    this.paint.step();
    this.stepEffects();
    // A weapon's impact freezes the action for a beat.
    if (this.freeze > 0) {
      this.freeze--;
      return;
    }
    this.phaseT++;
    if (this.lines.length) {
      this.stepTalk();
      return;
    }
    if (this.spell) {
      // The battle waits for the spell (the gauges hold).
      this.stepSpell();
      return;
    }
    switch (this.phase) {
      case 'omen':
        this.stepOmen();
        return;
      case 'tear':
        this.stepTear();
        return;
      case 'fight':
        this.stepFight();
        return;
      case 'fall':
        this.stepFall();
        return;
      case 'reel':
        this.stepReel();
        return;
    }
  }

  /** The text on black, one line at a time. */
  private stepOmen(): void {
    const per = 130;
    const i = Math.floor(this.phaseT / per);
    const t = this.phaseT % per;
    if (i >= OMEN.length) {
      this.omenText.setText('');
      this.phase = 'tear';
      this.phaseT = 0;
      return;
    }
    const line = OMEN[i];
    const shown = Math.min(line.length, Math.floor(t / 2));
    this.omenText.setText(line.slice(0, shown)).setAlpha(t > per - 20 ? (per - t) / 20 : 1);
    if (t === 1 && i === OMEN.length - 1) {
      this.cameras.main.shake(400, 0.01);
      sfx.lavaRise();
    }
    if (shown > 0 && shown < line.length && t % 4 === 0 && line[shown - 1] !== ' ') sfx.tick();
    if (this.controls.justPressed('start')) this.phaseT = OMEN.length * per; // skip
  }

  /** The screen tears like a broken cartridge, and the first form arrives. */
  private stepTear(): void {
    if (this.phaseT === 1) {
      sfx.glitch?.();
      playMusic(this, 'ascension');
    }
    if (this.phaseT === 50) this.startTier(0);
  }

  private startTier(i: number): void {
    this.tier = i;
    const t = TIERS[i];
    this.bossHp = t.hp;
    this.bossAtb = 0;
    this.pendingBig = null;
    this.status.delete('dark');
    this.paint.setDim(0);
    this.paint.setBackdrop(FINALE_ART(t.backdrop));
    this.paint.setBoss(FINALE_ART(t.art), t.box[0], t.box[1], t.box[2]);
    // Keep the music going between forms; switch only when the track changes (or if nothing's on).
    if (nowPlaying() !== t.music) playMusic(this, t.music);
    this.heroImg.setVisible(true);
    this.pipImg.setVisible(true);
    this.phase = 'fight';
    this.phaseT = 0;
    this.say(t.intro);
  }

  /** Lines in the top box; play pauses until they're read. */
  private say(lines: Line[], then?: () => void): void {
    this.lines.push(...lines);
    this.lineT = 0;
    if (then) this.after = then;
  }

  private stepTalk(): void {
    const line = this.lines[0];
    this.lineT++;
    const shown = Math.min(line.text.length, Math.floor(this.lineT / 1.5));
    if (shown < line.text.length && this.lineT % 3 === 0) sfx.tick();
    const done = shown >= line.text.length;
    if ((done && this.lineT > line.text.length * 1.5 + 90) || (this.controls.justPressed('jump') && done)) {
      this.lines.shift();
      this.lineT = 0;
      if (!this.lines.length && this.after) {
        const a = this.after;
        this.after = null;
        a();
      }
    } else if (this.controls.justPressed('jump')) this.lineT = line.text.length * 1.5; // finish typing
  }

  // --- the fight --------------------------------------------------------------------

  private stepFight(): void {
    const tier = TIERS[this.tier];
    // Statuses tick down; burn and poison hurt.
    for (const [s, n] of [...this.status]) {
      if (s === 'magnet') continue; // this counts the hero's turns
      if ((s === 'burn' || s === 'poison') && n % 60 === 0) this.hurtHero(s === 'burn' ? 18 : 14, s === 'burn' ? 0xff7a2a : 0x6cc04a, true);
      if (n <= 1) this.clearStatus(s);
      else this.status.set(s, n - 1);
    }
    // The bomb counts down.
    if (this.bomb > 0 && --this.bomb === 0) {
      this.flash(0xff7a2a);
      this.shake(0.02);
      sfx.explode?.();
      this.hurtHero(260, 0xff7a2a);
      this.popText('BOOM!', 352, 120, '#ff7a2a');
    }
    // Gauges fill (hero's runs backward while reversed, freezes while frozen, crawls while slowed).
    if (!this.menu) {
      const rate = this.status.has('freeze') ? 0 : this.status.has('slow') ? 0.0028 : 0.0063;
      this.hero.atb = this.status.has('reverse') ? Math.max(0, this.hero.atb - 0.006) : Math.min(1, this.hero.atb + rate);
      if (this.hero.atb >= 1) this.openMenu();
    }
    this.pip.atb = Math.min(1, this.pip.atb + 0.0045);
    if (this.pip.atb >= 1) this.pipActs();
    this.bossAtb += tier.speed * (this.tier === 3 && this.bossHp < tier.hp / 3 ? 0.8 : 1);
    if (this.bossAtb >= 1) {
      this.bossAtb = 0;
      this.bossActs();
    }
    for (const d of this.dogs) {
      d.atb += 0.0028;
      if (d.atb >= 1) {
        d.atb = 0;
        this.showName('MUSTARD SQUIRT', 'enemy', 'HOTDOG');
        this.hurtHero(30, 0xe86a50);
      }
    }
    if (this.menu) this.stepMenu();
  }

  // --- UltraGuy ------------------------------------------------------------------

  /** Always in this order. */
  private mainOptions(): string[] {
    return ['FIGHT', 'WEAPON', 'GUARD', 'ITEM'];
  }

  /** The weapon list: CHARGE first, then each weapon with its energy left and what a use costs. */
  private weaponOptions(): string[] {
    return ['CHARGE', ...(Object.keys(this.we) as WeaponId[]).map((w) => `${WEAPONS[w].name} ${this.we[w]} -${WEAPONS[w].cost * 2}`)];
  }

  private openMenu(): void {
    this.hero.guard = false;
    this.menu = { kind: 'main', options: this.mainOptions(), sel: 0 };
    sfx.select();
  }

  private stepMenu(): void {
    const m = this.menu!;
    const c = this.controls;
    if (c.justPressed('down') || c.justPressed('up')) {
      m.sel = (m.sel + (c.justPressed('down') ? 1 : m.options.length - 1)) % m.options.length;
      sfx.tick();
    }
    if (c.justPressed('fire') && m.kind !== 'main') {
      this.menu = { kind: 'main', options: this.mainOptions(), sel: 0 };
      sfx.tick();
      return;
    }
    if (!c.justPressed('jump')) return;
    const pick = m.options[m.sel];
    if (m.kind === 'main') {
      if (pick === 'WEAPON') {
        if (this.status.has('magnet')) {
          sfx.hurt();
          this.popText('MAGNETIZED!', 352, 110, '#e83a3a');
          return;
        }
        this.menu = { kind: 'weapon', options: this.weaponOptions(), sel: 0 };
      } else if (pick === 'ITEM') this.menu = { kind: 'item', options: [`E-TANK  x${this.items.etank}`, `W-TANK  x${this.items.wtank}`], sel: 0 };
      else if (pick === 'FIGHT' && this.dogs.length) this.menu = { kind: 'target', options: this.targets(), sel: 0, pending: 'FIGHT' };
      else this.heroActs(pick);
      return;
    }
    if (m.kind === 'weapon') {
      if (m.sel === 0) return void this.heroActs('CHARGE');
      const w = (Object.keys(this.we) as WeaponId[])[m.sel - 1];
      const cost = WEAPONS[w].cost * 2;
      if ((this.we[w] ?? 0) < cost) return void sfx.hurt();
      // Spark Ring, Quake Wave and Cyclone hit everything, so there's nothing to aim.
      if (this.dogs.length && !AOE.has(w)) this.menu = { kind: 'target', options: this.targets(), sel: 0, pending: `W:${w}` };
      else this.heroActs(`W:${w}`);
      return;
    }
    if (m.kind === 'item') {
      this.heroActs(m.sel === 0 ? 'ETANK' : 'WTANK');
      return;
    }
    if (m.kind === 'target') this.heroActs(m.pending!, m.sel - 1); // 0 = the boss, 1.. = hotdogs
  }

  private targets(): string[] {
    return [TIERS[this.tier].short, ...this.dogs.map((_, i) => `HOTDOG ${String.fromCharCode(65 + i)}`)];
  }

  /** UltraGuy does it. `dog` is a hotdog's index (or -1 for the boss). */
  private heroActs(act: string, dog = -1): void {
    this.menu = null;
    this.hero.atb = 0;
    for (const s of ['magnet'] as Status[]) {
      const n = this.status.get(s);
      if (n !== undefined) n <= 1 ? this.clearStatus(s) : this.status.set(s, n - 1);
    }
    const buff = this.status.has('buff') ? 1.5 : 1;
    const miss = this.status.has('dark') && Math.random() < 0.35;
    if (act === 'GUARD') {
      this.hero.guard = true;
      this.popText('GUARD', 352, 120, '#9aa8c8');
      sfx.select();
      return;
    }
    if (act === 'CHARGE') {
      this.hero.charged = true;
      this.popText('CHARGING...', 352, 120, '#ffe14a');
      sfx.charge?.(2);
      return;
    }
    if (act === 'ETANK') {
      if (this.items.etank <= 0) return void sfx.hurt();
      this.items.etank--;
      this.hero.hp = HERO_MAX;
      this.popText(`${HERO_MAX}`, 352, 120, '#5ef0c8');
      sfx.pickup();
      return;
    }
    if (act === 'WTANK') {
      if (this.items.wtank <= 0) return void sfx.hurt();
      this.items.wtank--;
      for (const w of Object.keys(this.we) as WeaponId[]) this.we[w] = WE_MAX;
      this.popText('WEAPONS FULL', 352, 120, '#5ef0c8');
      sfx.pickup();
      return;
    }
    // FIGHT or a weapon: a shot across to the target (or, for the sweeping weapons, at everything).
    this.tweens.add({ targets: this.heroImg, x: 340, duration: 90, yoyo: true });
    const t = TIERS[this.tier];
    const bossAt = { x: t.box[0], y: t.box[1] - t.box[2] * 0.5 };
    if (act === 'FIGHT') {
      const dmg = Math.round(Phaser.Math.Between(24, 34) * (this.hero.charged ? 3 : 1) * buff);
      const charged = this.hero.charged;
      this.hero.charged = false;
      if (charged) this.showName('CHARGE SHOT', 'ally', 'ULTRAGUY');
      sfx.shoot();
      const target = dog >= 0 ? this.dogs[dog] : null;
      const at = target ? { x: target.x, y: target.y - 16 } : bossAt;
      this.shot(340, 148, at.x, at.y, charged ? 0xffe14a : 0xfff4a0, () => {
        if (miss) return void this.popText('MISS', at.x, at.y - 10, '#8a8fa8');
        if (charged) this.impact(at.x, at.y, 0xffe14a, true);
        if (target) this.hitDog(target, dmg, 0xfff4a0);
        else this.hitBoss(dmg, 0xfff4a0);
      }, charged ? 'charge2' : 'bullet');
      return;
    }
    const w = act.slice(2) as WeaponId;
    this.we[w] = (this.we[w] ?? 0) - WEAPONS[w].cost * 2;
    const color = WEAPON_COLOR[w] ?? 0xffffff;
    this.showName(WEAPONS[w].name, 'ally', 'ULTRAGUY');
    sfx.chargeShot?.();
    const weakHit = t.weak.includes(w);
    const roll = () => Math.round(Phaser.Math.Between(38, 50) * buff);
    // Cast like a spell: on the form and every hotdog for the sweeping weapons, else the one target.
    const target = dog >= 0 ? this.dogs[dog] : null;
    const hits: { x: number; y: number; dog: Dog | null }[] = AOE.has(w)
      ? [{ x: bossAt.x, y: bossAt.y, dog: null }, ...this.dogs.map((d) => ({ x: d.x, y: d.y - 16, dog: d }))]
      : [{ x: target ? target.x : bossAt.x, y: target ? target.y - 16 : bossAt.y, dog: target }];
    this.spell = {
      w, color, t: 0, targets: hits, landed: hits.map(() => false),
      land: (k) => {
        const a = hits[k];
        if (miss) return void this.popText('MISS', a.x, a.y - 10, '#8a8fa8');
        this.impact(a.x, a.y, color, !AOE.has(w));
        const dmg = Math.round(roll() * (AOE.has(w) ? 0.8 : 1) * (a.dog ? 1 : weakHit ? 2.2 : 1));
        if (a.dog) {
          if (this.dogs.includes(a.dog)) this.hitDog(a.dog, dmg, color);
        } else this.hitBoss(dmg, color, weakHit);
      },
    };
  }

  /** The weapon being cast (gathering, then the spell over its targets), or null. */
  private spell: { w: WeaponId; color: number; t: number; targets: { x: number; y: number }[]; landed: boolean[]; land: (k: number) => void } | null = null;
  /** The arena darkens while a spell plays (it's drawn under the party). */
  private dim!: Phaser.GameObjects.Rectangle;
  private spellAdd!: Phaser.GameObjects.Graphics;
  private spellSolid!: Phaser.GameObjects.Graphics;

  /** One step of a spell: the gathering, then the show; damage lands at its moment, per target. */
  private stepSpell(): void {
    const sp = this.spell!;
    sp.t++;
    const k = (sp.t - CAST_FRAMES) / SPELL_FRAMES;
    if (sp.t === 1) sfx.charge?.(2);
    if (sp.t === CAST_FRAMES) sfx.chargeShot?.();
    if (k >= 0) {
      sp.targets.forEach((_, i) => {
        // Each target's hit time, matching drawSpell's stagger.
        const at = (HIT_AT + i * 0.08) / (1 + sp.targets.length * 0.08);
        if (!sp.landed[i] && k >= at) {
          sp.landed[i] = true;
          sp.land(i);
        }
      });
    }
    if (k >= 1.15) this.spell = null;
  }

  private drawSpellLayer(): void {
    const a = this.spellAdd.clear();
    const s = this.spellSolid.clear();
    const sp = this.spell;
    // The darkness fades in for the cast and out after.
    const target = sp ? (sp.t < CAST_FRAMES ? (sp.t / CAST_FRAMES) * 0.55 : (sp.t - CAST_FRAMES) / SPELL_FRAMES > 1 ? 0.55 * (1 - ((sp.t - CAST_FRAMES) / SPELL_FRAMES - 1) / 0.15) : 0.55) : 0;
    this.dim.setAlpha(Math.max(0, target));
    if (!sp) return;
    if (sp.t < CAST_FRAMES + 10) drawCast(a, this.heroImg.x, this.heroImg.y - 22, sp.t / CAST_FRAMES, sp.color, this.frame);
    const k = (sp.t - CAST_FRAMES) / SPELL_FRAMES;
    if (k >= 0 && k <= 1) drawSpell(a, s, sp.w, k, sp.targets, this.frame);
  }

  /** A weapon landing: a ring, a burst, a colored flash, a shake, and a beat of freeze. */
  private impact(x: number, y: number, color: number, heavy: boolean): void {
    this.rings.push({ x, y, r: 4, max: heavy ? 46 : 32, color, life: 22 });
    this.rings.push({ x, y, r: 2, max: heavy ? 26 : 18, color: 0xffffff, life: 14 });
    this.burst(x, y, color, heavy ? 34 : 22);
    this.cameras.main.flash(90, (color >> 16) & 255, (color >> 8) & 255, color & 255, true);
    this.cameras.main.shake(heavy ? 200 : 140, heavy ? 0.008 : 0.005);
    this.freeze = heavy ? 5 : 3;
  }

  private hitDog(d: Dog, dmg: number, color: number): void {
    d.hp -= dmg;
    this.paint.flashMinion(d.id);
    this.burst(d.x, d.y - 16, color, 12);
    this.popText(`${dmg}`, d.x, d.y - 30, '#fff1e0', true);
    if (d.hp <= 0) this.killDog(d);
  }

  private hitBoss(dmg: number, color: number, weak = false): void {
    const t = TIERS[this.tier];
    if (this.phase !== 'fight') return;
    this.bossHp = Math.max(0, this.bossHp - dmg);
    this.paint.flashBoss();
    this.paint.shakeBoss(weak ? 5 : 2, weak ? 16 : 8);
    const x = t.box[0] + Phaser.Math.Between(-30, 30);
    const y = t.box[1] - t.box[2] * Phaser.Math.FloatBetween(0.35, 0.7);
    this.burst(x, y, color, weak ? 30 : 16);
    this.popText(`${dmg}`, x, y - 8, weak ? '#ff6a5a' : '#fff1e0', true);
    sfx.hit();
    if (weak) {
      // A weakness staggers it: its gauge resets.
      this.bossAtb = 0;
      this.popText('WEAK!', x, y - 22, '#ffe14a');
    }
    if (this.bomb > 0 && (this.bombDamage -= dmg) <= 0) {
      this.bomb = 0;
      this.popText('DEFUSED!', 352, 110, '#5ef0c8');
      sfx.pickup();
    }
    this.checkPhases();
    if (this.bossHp === 0) this.tierFalls();
  }

  /** The creator's last form changes as it's hurt. */
  private checkPhases(): void {
    if (this.tier !== 3) return;
    const t = TIERS[3];
    if (!this.halfway.at66 && this.bossHp < t.hp * 0.66) {
      this.halfway.at66 = true;
      this.say([C(CREATOR, "YOU KNOW WHAT? LET'S PLAY TWO AT ONCE. WE ALWAYS DID.")]);
    }
    if (!this.halfway.at33 && this.bossHp < t.hp * 0.33) {
      this.halfway.at33 = true;
      this.say([
        C(CREATOR, 'I WAS A KID ONCE, TOO. A TV, A CONTROLLER, AND ALL THE TIME IN THE WORLD.'),
        C(CREATOR, "EVERYTHING HERE IS SOMETHING I PLAYED. SOMETHING THAT MADE ME WHO I AM."),
      ]);
    }
  }

  // --- Pip ---------------------------------------------------------------------------

  private pipActs(): void {
    this.pip.atb = 0;
    const low = this.hero.hp < HERO_MAX * 0.45;
    if (low) {
      const heal = 200;
      this.hero.hp = Math.min(HERO_MAX, this.hero.hp + heal);
      this.showName('REPAIR', 'ally', 'PIP');
      this.burst(352, 140, 0x5ef0c8, 16);
      this.popText(`${heal}`, 352, 120, '#5ef0c8');
      this.clearStatus('burn');
      this.clearStatus('poison');
      sfx.pickup();
      return;
    }
    if (this.pendingBig && !this.barrier) {
      this.barrier = true;
      this.showName('BARRIER', 'ally', 'PIP');
      sfx.charge?.(1);
      return;
    }
    // Zap: at the boss, or a hotdog if any are about.
    const dog = this.dogs[0];
    const dmg = Phaser.Math.Between(14, 24);
    if (dog) {
      this.shot(390, 136, dog.x, dog.y - 16, 0x5ef0c8, () => this.hitDog(dog, dmg * 2, 0x5ef0c8));
    } else {
      const t = TIERS[this.tier];
      this.shot(390, 136, t.box[0], t.box[1] - t.box[2] * 0.5, 0x5ef0c8, () => this.hitBoss(dmg, 0x5ef0c8));
    }
    sfx.zap();
  }

  // --- the enemy -------------------------------------------------------------------------

  private bossActs(): void {
    const t = TIERS[this.tier];
    if (this.pendingBig) {
      const a = this.pendingBig;
      this.pendingBig = null;
      this.cast(a);
      return;
    }
    const pool = t.attacks.filter((a) => a.name !== this.lastAttack && !(a.special === 'summon' && this.dogs.length >= 3));
    // Big ones only now and then, and announced first.
    const pick = Phaser.Utils.Array.GetRandom(pool.filter((a) => !a.big || Math.random() < 0.35)) as Attack;
    this.lastAttack = pick.name;
    if (pick.big) {
      this.pendingBig = pick;
      this.say([{ who: t.name, text: pick.memory ?? `${t.name.split(',')[0]} IS GATHERING POWER... (GUARD!)`, color: '#ff6a5a' }]);
      this.paint.shakeBoss(2, 40);
      return;
    }
    // At 66% the creator casts two at once.
    if (this.tier === 3 && this.halfway.at66 && Math.random() < 0.5) {
      const second = Phaser.Utils.Array.GetRandom(pool.filter((a) => !a.big && a.name !== pick.name)) as Attack;
      this.cast(pick, () => this.cast(second));
      return;
    }
    this.cast(pick);
  }

  /** Say its memory (tier 4), show its name, then do it. */
  private cast(a: Attack, then?: () => void): void {
    const go = () => {
      this.showName(a.name, 'enemy', TIERS[this.tier].short);
      this.time.delayedCall(450, () => {
        this.doAttack(a);
        then?.();
      });
    };
    if (a.memory && !a.big) this.say([C(CREATOR, a.memory)], go);
    else go();
  }

  private doAttack(a: Attack): void {
    this.paint.shakeBoss(3, 10);
    if (a.special === 'summon') {
      for (let i = 0; i < 2 && this.dogs.length < 3; i++) this.addDog();
      sfx.spring?.();
      return;
    }
    if (a.special === 'coach') {
      // Coach Jared, from the void, in YOUR corner.
      this.say([{ who: 'COACH JARED', text: 'YOU GOT THIS, CHAMP! HANDS UP, HIT HARDER!', color: '#6cc04a' }]);
      this.status.set('buff', 900);
      this.popText('POWER UP!', 352, 110, '#ffe14a');
      sfx.pickup();
      return;
    }
    if (a.special === 'bomb') {
      this.bomb = 720;
      this.bombDamage = 260;
      this.popText('A BOMB! DEAL 260 TO DEFUSE IT', 300, 110, '#ff7a2a');
      return;
    }
    if (a.special === 'rush') {
      const n = Math.max(1, this.dogs.length);
      for (let i = 0; i < n; i++) this.time.delayedCall(i * 180, () => this.hurtHero(a.power, a.color));
      return;
    }
    if (a.special === 'reverse') this.status.set('reverse', 150);
    const hits = a.hits ?? 1;
    for (let i = 0; i < hits; i++) {
      this.time.delayedCall(i * 120, () => {
        const who = a.target === 'one' ? (Math.random() < 0.6 ? 'hero' : 'pip') : a.target;
        if (who === 'hero' || who === 'both') this.hurtHero(a.power, a.color);
        if (who === 'pip' || who === 'both') this.hurtPip(a.power, a.color);
      });
    }
    if (a.status) this.status.set(a.status[0], a.status[1]);
    if (a.status?.[0] === 'dark') this.paint.setDim(0.6);
    if (a.big) {
      this.flash(a.color);
      this.shake(0.02);
      this.barrier = false;
    }
  }

  private hurtHero(power: number, color: number, quiet = false): void {
    let dmg = power;
    if (this.hero.guard) dmg *= 0.5;
    if (this.barrier && !quiet) dmg *= 0.5;
    dmg = Math.round(dmg * Phaser.Math.FloatBetween(0.9, 1.1));
    this.hero.hp = Math.max(0, this.hero.hp - dmg);
    this.burst(352, 140, color, 10);
    this.popText(`${dmg}`, 352, 124, '#fff1e0');
    if (!quiet) {
      this.pose = 'hurt';
      this.time.delayedCall(260, () => (this.pose = 'idle'));
      sfx.hurt();
    }
    if (this.hero.hp === 0) this.pipRevives();
  }

  private hurtPip(power: number, color: number): void {
    const dmg = Math.round(power * (this.barrier ? 0.5 : 1) * 0.8);
    // Pip can't fall: it's the one keeping you up.
    this.pip.hp = Math.max(1, this.pip.hp - dmg);
    this.burst(392, 132, color, 8);
    this.popText(`${dmg}`, 392, 114, '#fff1e0');
    if (this.pip.hp < PIP_MAX * 0.3) this.time.delayedCall(800, () => (this.pip.hp = Math.min(PIP_MAX, this.pip.hp + 120)));
  }

  /** UltraGuy falls; Pip brings him right back. */
  private pipRevives(): void {
    this.hero.revives++;
    this.hero.hp = Math.round(HERO_MAX * 0.6);
    this.status.clear();
    this.paint.setDim(0);
    this.bomb = 0;
    this.burst(352, 140, 0x5ef0c8, 28);
    this.cameras.main.flash(200, 94, 240, 200);
    sfx.powerUp?.();
    const lines: Line[] = [{ who: 'PIP', text: REVIVES[(this.hero.revives - 1) % REVIVES.length], color: '#5ef0c8' }];
    if (this.hero.revives % 2 === 1) lines.push(C(CREATOR, STILL[Math.floor(this.hero.revives / 2) % STILL.length]));
    this.say(lines);
  }

  /** A hotdog (painted, like the forms) runs in at Jared's feet, in the first free spot. */
  private addDog(): void {
    const slot = DOG_SLOTS.findIndex((_, i) => !this.dogs.some((d) => d.slot === i));
    if (slot < 0) return;
    const [x, y] = DOG_SLOTS[slot];
    const id = `dog${this.dogSerial++}`;
    this.paint.addMinion(id, FINALE_ART('hotdog.png'), x, y, 44);
    this.dogs.push({ id, slot, x, y, hp: 120, atb: Math.random() * 0.4 });
  }

  private killDog(d: Dog): void {
    this.burst(d.x, d.y - 16, 0xe86a50, 18);
    sfx.enemyDie();
    this.paint.removeMinion(d.id);
    this.dogs = this.dogs.filter((x) => x !== d);
  }

  // --- a form falls -----------------------------------------------------------------

  private tierFalls(): void {
    this.phase = 'fall';
    this.phaseT = 0;
    this.menu = null;
    this.pendingBig = null;
    for (const d of [...this.dogs]) this.killDog(d);
    this.paint.setDim(0);
    this.status.clear();
    if (this.tier === TIERS.length - 1) stopMusic(2500);
  }

  private stepFall(): void {
    const t = TIERS[this.tier];
    if (this.phaseT < 140 && this.phaseT % 8 === 0) {
      this.burst(t.box[0] + Phaser.Math.Between(-60, 60), t.box[1] - Phaser.Math.Between(20, t.box[2] - 20), 0xffffff, 12);
      this.paint.flashBoss();
      this.paint.shakeBoss(4, 8);
      sfx.enemyDie();
    }
    if (this.phaseT === 140) {
      this.paint.dissolveBoss();
      this.cameras.main.flash(500, 255, 255, 255);
      sfx.explode?.();
    }
    if (this.phaseT !== 260) return;
    if (this.tier < TIERS.length - 1) {
      this.hero.atb = Math.max(this.hero.atb, 0.5);
      this.startTier(this.tier + 1);
      return;
    }
    // The end.
    this.phase = 'end';
    this.say(LAST_WORDS, () => this.startReel());
  }

  // --- the reel -------------------------------------------------------------------------

  private startReel(): void {
    recordClear('finale');
    this.phase = 'reel';
    this.phaseT = 0;
    this.heroImg.setVisible(false);
    this.pipImg.setVisible(false);
    this.paint.show(false);
    this.cameras.main.fadeIn(1200, 255, 255, 255);
    playMusic(this, 'memories');
    for (const r of REEL) if (!this.textures.exists(`reel_${r.shot}`)) this.load.image(`reel_${r.shot}`, FINALE_ART(`shots/${r.shot}.png`));
    this.load.start();
  }

  private stepReel(): void {
    const per = 300;
    const i = Math.floor(this.phaseT / per);
    const t = this.phaseT % per;
    if (i >= REEL.length) {
      if (this.phaseT === REEL.length * per + 60) pixelateOut(this, 1200, () => this.scene.start('ending'));
      return;
    }
    if (t === 1) {
      const r = REEL[i];
      this.reelImg?.destroy();
      this.reelImg = this.textures.exists(`reel_${r.shot}`) ? this.add.image(VIEW_W / 2, 94, `reel_${r.shot}`).setScale(0.72).setDepth(50) : null;
      // The shot sits in a window like the battle's, the caption in another under it.
      this.reelFrame ??= this.add.image(VIEW_W / 2, 94, rpgWindow(this, 318, 182)).setDepth(49);
      this.reelCaption?.destroy();
      const box = this.add.image(0, 0, rpgWindow(this, 330, 36));
      const title = pixelText(this, 0, -12, r.title, { color: '#ffe14a' }).setOrigin(0.5, 0);
      const line = pixelText(this, 0, 2, r.line, { color: '#fff1e0' }).setOrigin(0.5, 0);
      this.reelCaption = this.add.container(VIEW_W / 2, 210, [box, title, line]).setDepth(50);
    }
    const a = t < 40 ? t / 40 : t > per - 40 ? (per - t) / 40 : 1;
    this.reelImg?.setAlpha(a);
    this.reelFrame?.setAlpha(i === 0 ? Math.min(1, t / 40) : 1);
    this.reelCaption?.setAlpha(a);
    if (this.controls.justPressed('start')) this.phaseT = REEL.length * per;
  }

  // --- effects --------------------------------------------------------------------------

  /**
   * What's being cast, in a little window at the top (FF style): who's casting it
   * on top, the spell under it. The enemy's in white, yours and Pip's in teal. It
   * pops in, holds a few seconds, and fades.
   */
  private popup: Phaser.GameObjects.Container | null = null;
  private showName(name: string, who: 'enemy' | 'ally', caster: string): void {
    this.popup?.destroy();
    const w = Math.max(90, Math.max(name.length, caster.length) * 6 + 30);
    const box = this.add.image(0, 0, rpgWindow(this, w, 30));
    const by = pixelText(this, 0, -10, caster, { color: who === 'enemy' ? '#ff9a7a' : '#ffe14a' }).setOrigin(0.5, 0);
    const text = pixelText(this, 0, 1, name, { color: who === 'enemy' ? '#fff1e0' : '#5ef0c8' }).setOrigin(0.5, 0);
    const c = this.add.container(VIEW_W / 2, 66, [box, by, text]).setDepth(45).setScale(0.6, 0.2).setAlpha(0);
    this.popup = c;
    this.tweens.add({ targets: c, scaleX: 1, scaleY: 1, alpha: 1, duration: 120, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, delay: 2600, duration: 300, onComplete: () => (c.destroy(), this.popup === c && (this.popup = null)) });
  }

  private popText(text: string, x: number, y: number, color: string, big = false): void {
    const t = pixelText(this, x, y, text, { color, stroke: '#000000', fontSize: big ? '16px' : '8px' }).setOrigin(0.5).setDepth(46);
    this.tweens.add({ targets: t, y: y - 18, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  /** A projectile across: the weapon's own sprite (spinning), or a glowing orb, with a trail. */
  private shot(x0: number, y0: number, x1: number, y1: number, color: number, hit: () => void, tex?: string): void {
    const b: Phaser.GameObjects.Image | Phaser.GameObjects.Arc =
      tex && this.textures.exists(tex) ? this.add.image(x0, y0, tex).setScale(2).setDepth(31).setFlipX(x1 < x0) : this.add.circle(x0, y0, 3, color).setDepth(31).setBlendMode(Phaser.BlendModes.ADD);
    const trail = this.time.addEvent({ delay: 30, loop: true, callback: () => this.effects.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 10, color, size: 2 }) });
    this.tweens.add({ targets: b, x: x1, y: y1, angle: tex ? 540 : 0, duration: 300, ease: 'Quad.easeIn', onComplete: () => (trail.remove(), b.destroy(), hit()) });
  }

  private burst(x: number, y: number, color: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 0.6 + Math.random() * 2.6;
      this.effects.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.6, life: 20 + Math.random() * 20, color, size: Math.random() < 0.3 ? 3 : 2 });
    }
  }

  private flash(color: number): void {
    this.cameras.main.flash(260, (color >> 16) & 255, (color >> 8) & 255, color & 255);
  }

  private shake(k: number): void {
    this.cameras.main.shake(300, k);
    this.paint.shakeBoss(6, 20);
  }

  private stepEffects(): void {
    for (const e of this.effects) {
      e.x += e.vx;
      e.y += e.vy;
      e.vy += 0.05;
      e.life--;
    }
    this.effects = this.effects.filter((e) => e.life > 0);
    for (const r of this.rings) {
      r.life--;
      r.r += (r.max - r.r) * 0.25;
    }
    this.rings = this.rings.filter((r) => r.life > 0);
  }

  private clearStatus(s: Status): void {
    this.status.delete(s);
    if (s === 'dark') this.paint.setDim(0);
  }

  // --- drawing -----------------------------------------------------------------------------

  private draw(): void {
    this.drawSpellLayer();
    const g = this.gfx.clear();
    const f = this.fx.clear();
    for (const e of this.effects) f.fillStyle(e.color, Math.min(1, e.life / 20)).fillRect(e.x, e.y, e.size, e.size);
    for (const r of this.rings) f.lineStyle(2, r.color, Math.min(1, r.life / 12)).strokeCircle(r.x, r.y, r.r);
    for (const t of this.texts) t.destroy();
    this.texts = [];
    for (const t of this.menuTexts) t.destroy();
    this.menuTexts = [];
    // The tear: glitch blocks across the screen.
    if (this.phase === 'tear') {
      for (let i = 0; i < 18; i++) {
        const y = Math.random() * VIEW_H;
        g.fillStyle([0x5ef0c8, 0xff5050, 0xffe14a, 0xffffff, 0x8a7aff][i % 5], 0.7).fillRect(Math.random() * VIEW_W - 40, y, 40 + Math.random() * 160, 2 + Math.random() * 6);
      }
    }
    // The top box.
    const line = this.lines[0];
    this.topBox.setVisible(!!line);
    this.topName.setText(line ? line.who : '').setColor(line?.color ?? '#ffe14a');
    this.topText.setText(line ? line.text.slice(0, Math.floor(this.lineT / 1.5)) : '');
    const battle = !(this.phase === 'omen' || this.phase === 'tear' || this.phase === 'reel');
    this.winL.setVisible(battle);
    this.winR.setVisible(battle);
    if (!battle) return;
    // The party.
    const bob = Math.floor(this.frame / 14) % 4;
    const fr = heroFrames(this);
    this.heroImg.setFrame(this.pose === 'hurt' ? fr.hurt : fr[`idle${1 + bob}`] ?? fr.idle);
    this.heroImg.setTint(this.hero.charged && this.frame % 6 < 3 ? 0xfff080 : this.status.has('freeze') ? 0x9ae8ff : 0xffffff);
    this.pipImg.setTexture(pipTexture(this, this.pipLook.shell, this.pipLook.paint, (Math.floor(this.frame / 8) % 2) as 0 | 1)).setY(136 + Math.sin(this.frame * 0.08) * 3);
    if (this.barrier) g.lineStyle(1, 0x5ef0c8, 0.6 + Math.sin(this.frame * 0.2) * 0.3).strokeEllipse(370, 140, 90, 70);
    // The bottom windows: the enemy, and the party with HP and gauges.
    const wy = 186;
    const tier = TIERS[this.tier];
    if (!this.menu) {
      this.txt(12, wy + 8, tier.name.length > 22 ? tier.name.split(',')[0] : tier.name, '#fff1e0');
      if (this.dogs.length) this.txt(12, wy + 20, `HOTDOG x${this.dogs.length}`, '#e86a50');
      if (this.pendingBig) this.txt(12, wy + 32, '!! GATHERING POWER', this.frame % 20 < 10 ? '#ff6a5a' : '#ffe14a');
      else if (this.bomb > 0) this.txt(12, wy + 32, `BOMB ${Math.ceil(this.bomb / 60)}  (${Math.max(0, this.bombDamage)} TO GO)`, '#ff7a2a');
    }
    const rows: [string, number, number, number, string][] = [
      ['ULTRAGUY', this.hero.hp, HERO_MAX, this.hero.atb, this.statusLine()],
      ['PIP', this.pip.hp, PIP_MAX, this.pip.atb, this.barrier ? 'BARRIER' : ''],
    ];
    rows.forEach(([name, hp, max, atb, st], i) => {
      const y = wy + 9 + i * 16;
      this.txt(166, y, name, '#fff1e0');
      this.txt(226, y, `${hp}/${max}`, hp < max * 0.3 ? '#ffe14a' : '#fff1e0');
      g.fillStyle(0x0a0c18).fillRect(300, y + 1, 70, 6);
      g.fillStyle(atb >= 1 ? 0xffe14a : 0x5ef0c8).fillRect(300, y + 1, 70 * atb, 6);
      g.lineStyle(1, 0x8a8fa8).strokeRect(300, y + 1, 70, 6);
      if (st) this.txt(376, y, st, '#8a8fa8');
    });
    // The command menu: it takes over the enemy's window (so nothing covers the paintings);
    // longer lists scroll, four rows at a time.
    const m = this.menu;
    if (m) {
      const rows = 4;
      const top = Math.max(0, Math.min(m.sel - rows + 1, m.options.length - rows));
      const first = Math.max(0, m.sel >= rows ? top : 0);
      m.options.slice(first, first + rows).forEach((o, k) => {
        const i = first + k;
        this.menuTexts.push(pixelText(this, 24, wy + 7 + k * 10, o, { color: i === m.sel ? '#ffe14a' : '#fff1e0' }).setDepth(43));
      });
      this.menuTexts.push(pixelText(this, 13, wy + 7 + (m.sel - first) * 10, '>', { color: '#5ef0c8' }).setDepth(43));
      if (first > 0) this.menuTexts.push(pixelText(this, 140, wy + 5, '^', { color: '#8a8fa8' }).setDepth(43));
      if (first + rows < m.options.length) this.menuTexts.push(pixelText(this, 140, wy + 38, 'v', { color: '#8a8fa8' }).setDepth(43));
    }
  }

  private statusLine(): string {
    const s: Status[] = [...this.status.keys()].filter((k) => k !== 'buff');
    if (this.status.has('buff')) s.unshift('buff');
    return s.slice(0, 2).map((k) => k.toUpperCase()).join(' ');
  }

  private txt(x: number, y: number, text: string, color: string): void {
    this.texts.push(pixelText(this, x, y, text, { color }).setDepth(41));
  }
}

interface Dog {
  id: string;
  slot: number;
  /** Where it stands (game units): center x, feet y. */
  x: number;
  y: number;
  hp: number;
  atb: number;
}

/** Where hotdogs stand: in a ragged line at Jared's feet, between him and the party. */
const DOG_SLOTS: [number, number][] = [
  [178, 200],
  [204, 194],
  [228, 202],
];

/** Steps UltraGuy gathers power before a spell goes off. */
const CAST_FRAMES = 36;

/** The weapons that hit everything on the field. */
const AOE = new Set<WeaponId>(['spark', 'quake', 'cyclone']);

const WEAPON_COLOR: Partial<Record<WeaponId, number>> = {
  quake: 0xc8a070, thorn: 0x6cc04a, frost: 0x9ae8ff, cyclone: 0xd8ffe0, spark: 0xf8e040, flame: 0xff7a2a, saw: 0xc8ccd8, bubble: 0x6ab8e8,
};
