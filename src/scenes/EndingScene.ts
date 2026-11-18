import Phaser from 'phaser';
import { playMusic } from '../audio';
import { VIEW_H, VIEW_W } from '../constants';
import { heroFrames } from '../heroSprites';
import type { BossKind } from '../level/Level';
import { ALL_BOSS_STAGES, BOSS_STAGES } from '../level/stages';
import { makePipBits, pipTexture, pipUnlocked } from '../pip';
import { pixelText } from '../pixelFont';
import { loadSave, wearSavedSkin } from '../save';
import { sfx } from '../sfx';
import { WEAPON_ORDER, heroTexture } from '../weapons';
import { BOSS_INTROS } from './bossIntro';
import { FONT, MenuScene } from './menu';

/** One line of the cast roll: a heading, a character (sprite, name, title), or plain text. */
type Entry =
  | { heading: string }
  | { tex: string; frame?: number; name: string; title: string }
  | { text: string; color?: string; size?: string };

const MINIS: { kind: string; name: string; stage: string }[] = [
  { kind: 'press', name: 'PRESS TITAN', stage: 'FOUNDRY' },
  { kind: 'mammoth', name: 'TUSK MAMMOTH', stage: 'GLACIER' },
  { kind: 'kite', name: 'STORM KITE', stage: 'STRATOS' },
  { kind: 'angler', name: 'ANGLER', stage: 'REEF' },
];

const GUARDIANS: { tex: string; name: string; title: string }[] = [
  { tex: 'beard_front', name: 'BEARDSMITH', title: 'FORGE-MASTER, KEEPER OF THE ULTRABLASTER' },
  { tex: 'juck_front', name: 'JUCK MCBUCK', title: 'BEST SHOT IN THE COUNTY (MOSTLY)' },
  { tex: 'hydro_front', name: 'THE HYDRONATOR', title: 'HAVE YOU HAD ENOUGH WATER TODAY?' },
  { tex: 'ceej_front', name: 'CEEJ GEIGAN', title: 'GENERAL, AND HISTORY TEACHER' },
];

const title = (kind: BossKind) => BOSS_INTROS[kind]?.title ?? '';

/**
 * Ending: the cast roll. Every boss, miniboss and guardian scrolls by with
 * their sprite, name and title, then Rivet, then UltraGuy himself, then your
 * run. Hold JUMP to speed it up; ENTER returns to the title once it's done
 * (or any time after the first few seconds).
 */
export class EndingScene extends MenuScene {
  private roll!: Phaser.GameObjects.Container;
  private rollH = 0;
  private hero!: Phaser.GameObjects.Image;
  /** Pip keeps up with him along the bottom (if you've met). */
  private pip: Phaser.GameObjects.Image | null = null;
  private pipSparks: { img: Phaser.GameObjects.Image; vy: number; life: number }[] = [];

  constructor() {
    super('ending');
  }

  create(): void {
    wearSavedSkin();
    this.initMenu();
    playMusic(this, 'ending');
    this.backdrop('sky', 0.45);

    const save = loadSave();
    makePipBits(this);
    const entries: Entry[] = [
      { text: 'THE FORTRESS HAS FALLEN', color: '#f28c28', size: '16px' },
      { text: '' },
      { heading: 'THE ROBOT MASTERS' },
      ...ALL_BOSS_STAGES.map((id) => {
        const kind = BOSS_STAGES[id].boss!;
        return { tex: `${kind}_idle`, name: BOSS_STAGES[id].bossName ?? kind.toUpperCase(), title: title(kind) };
      }),
      { heading: 'WHO STARTED IT ALL' },
      { tex: 'jared_idle', name: 'BLACK JARED', title: title('jared') },
      { heading: 'STANDING IN THE WAY' },
      ...MINIS.map((m) => ({ tex: `${m.kind}_idle`, name: m.name, title: `${m.stage} MINIBOSS` })),
      { heading: 'THE PART GUARDIANS' },
      ...GUARDIANS,
      { heading: 'THE FORTRESS' },
      { tex: 'gatekeeper_idle', name: 'GATEKEEPER', title: title('gatekeeper') },
      { tex: 'abyss_idle', name: 'ABYSS EYE', title: title('abyss') },
      { tex: 'warden_idle', name: 'SPIRE WARDEN', title: title('warden') },
      { tex: 'overlord_idle', name: 'OVERLORD', title: title('overlord') },
      { tex: 'hero_shade', frame: heroFrames(this).idle, name: 'SHADE', title: title('shade') },
      { heading: 'THE SECRET' },
      save.cleared.includes('vault')
        ? { tex: 'baron_idle', name: 'BARGAIN BARON', title: title('baron') }
        : { tex: '', name: '???', title: 'A 1-UP HIDES IN EVERY STAGE...' },
      { heading: 'AROUND TOWN' },
      { tex: 'rivet0', name: 'RIVET', title: "PROPRIETOR, RIVET'S PARTS & PROVISIONS" },
      ...(pipUnlocked(save) ? [{ tex: pipTexture(this, save.pipShell, save.pipPaint, 0), name: 'PIP', title: "RIVET'S BEST WORK, AND YOUR PAL" }] : []),
      { heading: 'STARRING' },
      { tex: heroTexture('buster'), frame: heroFrames(this).idle, name: 'ULTRAGUY', title: 'THE HERO' },
      { text: '' },
      { text: '' },
      { text: `BOSSES BEATEN  ${ALL_BOSS_STAGES.filter((id) => save.cleared.includes(id)).length}/8` },
      { text: `EX REMATCHES  ${save.exCleared.length}/8` },
      { text: `BOLTS ON HAND  ${save.bolts}` },
      { text: '' },
      { text: 'THANK YOU FOR PLAYING', color: '#5ef0c8', size: '16px' },
    ];

    this.roll = this.add.container(0, VIEW_H + 8);
    let y = 0;
    for (const e of entries) {
      if ('heading' in e) {
        y += 14;
        this.roll.add(pixelText(this, VIEW_W / 2, y, e.heading, { fontFamily: FONT, fontSize: '8px', color: '#f28c28' }).setOrigin(0.5, 0));
        this.roll.add(this.add.rectangle(VIEW_W / 2, y + 12, 120, 1, 0xf28c28, 0.6));
        y += 22;
      } else if ('tex' in e) {
        if (this.textures.exists(e.tex)) {
          const img = this.add.image(VIEW_W / 2 - 70, y + 40, e.tex, e.frame).setOrigin(0.5, 1);
          img.setScale(Math.min(1, 38 / img.height, 56 / img.width));
          this.roll.add(img);
        }
        this.roll.add(pixelText(this, VIEW_W / 2 - 36, y + 12, e.name, { fontFamily: FONT, fontSize: '12px', color: '#fff1e0', stroke: '#000000' }));
        this.roll.add(pixelText(this, VIEW_W / 2 - 36, y + 27, e.title, { fontFamily: FONT, fontSize: '8px', color: '#8a8fa8', stroke: '#000000' }));
        y += 46;
      } else {
        this.roll.add(pixelText(this, VIEW_W / 2, y, e.text, { fontFamily: FONT, fontSize: e.size ?? '8px', color: e.color ?? '#fff1e0', stroke: '#000000' }).setOrigin(0.5, 0));
        y += e.size === '16px' ? 26 : 14;
      }
    }
    this.rollH = y;

    // UltraGuy runs along the bottom, trying on every weapon's colors.
    this.add.rectangle(0, VIEW_H - 22, VIEW_W, 22, 0x05060c, 0.7).setOrigin(0, 0);
    this.hero = this.add.image(36, VIEW_H - 22, heroTexture('buster'), heroFrames(this).run1).setOrigin(0.5, 1).setScale(1);
    this.pipSparks = [];
    this.pip = pipUnlocked(save) ? this.add.image(14, VIEW_H - 40, pipTexture(this, save.pipShell, save.pipPaint, 0)) : null;
    pixelText(this, VIEW_W - 8, VIEW_H - 14, 'HOLD JUMP: FASTER   ENTER: TITLE', { fontFamily: FONT, fontSize: '8px', color: '#8a8fa8' }).setOrigin(1, 0);
    sfx.clear();
  }

  protected tick(): boolean {
    const fast = this.controls.isDown('jump') ? 4 : 1;
    // Scroll until the last line sits in the middle of the screen.
    if (this.roll.y + this.rollH > VIEW_H / 2 + 20) this.roll.y -= 0.5 * fast;
    const frames = heroFrames(this);
    const w = WEAPON_ORDER[Math.floor(this.frame / 90) % WEAPON_ORDER.length];
    this.hero.setTexture(heroTexture(w), frames[`run${1 + (Math.floor(this.frame / 4) % 8)}`]);
    if (this.pip) {
      // Just behind his shoulder, bobbing, fins flapping, thruster sparking.
      const save = loadSave();
      const f = this.frame;
      const x = this.hero.x - 18 + Math.sin(f * 0.03) * 4;
      const y = VIEW_H - 46 + Math.sin(f * 0.12) * 2;
      this.pip.setTexture(pipTexture(this, save.pipShell, save.pipPaint, Math.floor(f / 5) % 2 === 0 ? 0 : 1)).setPosition(Math.round(x), Math.round(y)).setRotation(0.12);
      if (f % 3 === 0) this.pipSparks.push({ img: this.add.image(x + (Math.random() - 0.5) * 3, y + 7, Math.random() < 0.5 ? 'pip_flame' : 'pip_dot'), vy: 0.6 + Math.random() * 0.5, life: 12 });
      for (const s of this.pipSparks) {
        s.life--;
        s.img.y += s.vy;
        s.img.x -= 0.6;
        s.img.setAlpha(s.life / 12);
        if (s.life <= 0) s.img.destroy();
      }
      this.pipSparks = this.pipSparks.filter((s) => s.life > 0);
    }
    if (this.frame > 90 && (this.controls.justPressed('start') || (this.controls.justPressed('jump') && this.roll.y + this.rollH <= VIEW_H / 2 + 21))) {
      sfx.select();
      this.scene.start('title');
      return true;
    }
    return false;
  }
}
