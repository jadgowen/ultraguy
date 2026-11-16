import Phaser from 'phaser';
import { loopSfx, playMusic, playVoice, stopMusic } from '../audio';
import { STEP_MS, VIEW_H, VIEW_W } from '../constants';
import { Controls } from '../input';
import type { StageId } from '../level/Level';
import { pixelText } from '../pixelFont';
import { sfx } from '../sfx';
import { Line, dialogue, pixelateIn } from './cutscene';
import { ModeData, returnToGame } from './encounters';

/**
 * THE GATEKEEPER, in the ring: a behind-the-back boxing match in place of the
 * Fortress Gate boss fight. Coach Jared works your corner between rounds.
 *
 * You: LEFT/RIGHT dodge, DOWN block, JUMP right punch, FIRE left punch (hold UP
 * to aim at the face), START star uppercut (needs stars).
 * Him: winds up before each punch (his eye flashes first: hit him then for a
 * star), guards high or low, and is wide open after you dodge a punch.
 */

export interface BoxingData {
  stage: StageId;
  ret?: ModeData['ret'];
}

const MAX_HP = 96;
const ROUND_FRAMES = 60 * 75;
const ROUNDS = 3;
const SCALE = 2;
const OPP_X = VIEW_W / 2;
const OPP_Y = 180;
const YOU_Y = VIEW_H - 2;

type OppState = 'idle' | 'wind' | 'punch' | 'recover' | 'open' | 'hit' | 'stun' | 'taunt' | 'down';
type Attack = 'L' | 'R' | 'U';
type YouState = 'idle' | 'punch' | 'dodge' | 'block' | 'hit' | 'star' | 'tired' | 'down';

export class BoxingScene extends Phaser.Scene {
  private controls!: Controls;
  private stageId: StageId = 'fortress1';
  private acc = 0;
  private frame = 0;
  private round = 1;
  private clock = 0;
  private phase: 'corner' | 'intro' | 'fight' | 'between' | 'over' = 'corner';
  private phaseT = 0;
  private story: (() => void) | null = null;

  // Opponent.
  private opp!: Phaser.GameObjects.Image;
  private oState: OppState = 'idle';
  private oT = 0;
  private oDur = 60;
  private attack: Attack = 'L';
  private guard: 'high' | 'low' = 'high';
  private oHp = MAX_HP;
  private oDowns = 0;
  private flash = 0;
  private getUpAt = 0;
  private eyeFlash!: Phaser.GameObjects.Rectangle;

  // You.
  private you!: Phaser.GameObjects.Image;
  private yState: YouState = 'idle';
  private yT = 0;
  private hp = MAX_HP;
  private hearts = 20;
  private stars = 0;
  private dodgeDir = 0;
  private punchHigh = false;
  private punchSide: 'L' | 'R' = 'R';
  private yDowns = 0;
  private roundDowns = 0;
  private mash = 0;

  private hud!: Phaser.GameObjects.Graphics;
  private banner!: ReturnType<typeof pixelText>;
  private info!: ReturnType<typeof pixelText>;
  private corner: Phaser.GameObjects.Container | null = null;
  private crowd: Phaser.Sound.BaseSound | null = null;
  private result: 'win' | 'lose' | null = null;

  constructor() {
    super('boxing');
  }

  /** Where we came from (sent back at the end). */
  private mode: ModeData = { stage: 'fortress1', ret: { kind: 'vault', step: 0 } };

  create(data: BoxingData): void {
    this.stageId = data?.stage ?? 'fortress1';
    this.mode = { stage: this.stageId, ret: data?.ret ?? { kind: 'vault', step: 0 } };
    this.controls = new Controls(this);
    Object.assign(this, {
      acc: 0, frame: 0, round: 1, clock: ROUND_FRAMES, phase: 'corner', phaseT: 0, story: null,
      oState: 'idle', oT: 0, oDur: 60, guard: 'high', oHp: MAX_HP, oDowns: 0, flash: 0,
      yState: 'idle', yT: 0, hp: MAX_HP, hearts: 20, stars: 0, dodgeDir: 0, yDowns: 0, roundDowns: 0, mash: 0, result: null, corner: null,
      hudLeft: undefined, hudMid: undefined, hudRight: undefined,
    });
    this.drawArena();
    this.opp = this.add.image(OPP_X, OPP_Y, 'gbox_idle').setOrigin(0.5, 1).setScale(SCALE).setDepth(5);
    this.eyeFlash = this.add.rectangle(0, 0, 6, 6, 0xffffff).setDepth(6).setVisible(false);
    this.you = this.add.image(OPP_X, YOU_Y, 'ubox_idle').setOrigin(0.5, 1).setScale(SCALE).setDepth(8);
    this.hud = this.add.graphics().setDepth(40);
    this.banner = pixelText(this, VIEW_W / 2, 70, '', { fontSize: '16px', color: '#fff1e0', stroke: '#000000' }).setOrigin(0.5).setDepth(41);
    this.info = pixelText(this, VIEW_W / 2, 28, '', { color: '#fff1e0', stroke: '#000000' }).setOrigin(0.5, 0).setDepth(41);
    pixelText(this, 6, VIEW_H - 12, 'L/R DODGE  DOWN BLOCK  JUMP/FIRE PUNCH (+UP FACE)  START STAR', { color: '#8a8fa8', stroke: '#000000' }).setDepth(41);

    stopMusic();
    pixelateIn(this, 900);
    this.crowd = loopSfx(this, 'crowd', 0.15);
    this.events.once('shutdown', () => this.crowd?.stop());
    this.time.delayedCall(700, () => this.openCorner());
  }

  update(_t: number, delta: number): void {
    this.acc += Math.min(delta, 100);
    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS;
      this.step();
    }
    this.draw();
  }

  // --- the arena ------------------------------------------------------------------

  private drawArena(): void {
    const g = this.add.graphics().setDepth(0);
    // Crowd in the dark.
    g.fillStyle(0x0a0812).fillRect(0, 0, VIEW_W, 100);
    const colors = [0x3a2a4a, 0x4a3a5a, 0x2a2440, 0x5a3a4a];
    for (let y = 10; y < 96; y += 7) for (let x = (y % 14) / 2; x < VIEW_W; x += 9) g.fillStyle(colors[(x * 3 + y) % colors.length]).fillRect(x, y, 5, 4).fillRect(x + 1, y - 2, 3, 2);
    // Lights.
    for (const x of [60, 160, 270, 370]) {
      g.fillStyle(0xfff4d0, 0.08).fillTriangle(x - 6, 0, x + 6, 0, x + 40, 150);
      g.fillStyle(0xfff4d0).fillRect(x - 4, 0, 8, 3);
    }
    // Ring mat with a lit center.
    g.fillStyle(0x24345a).fillRect(0, 140, VIEW_W, VIEW_H - 140);
    g.fillStyle(0x2e4472).fillEllipse(VIEW_W / 2, 190, 360, 90);
    g.fillStyle(0x3a5488).fillEllipse(VIEW_W / 2, 186, 220, 50);
    g.fillStyle(0x1a2444).fillRect(0, 140, VIEW_W, 3);
    // Ropes and posts.
    for (const [y, c] of [[96, 0xd83a4a], [112, 0xfff1e0], [128, 0x3a78d8]] as const) {
      g.fillStyle(0x0a0812).fillRect(0, y + 2, VIEW_W, 3);
      g.fillStyle(c).fillRect(0, y, VIEW_W, 3);
      g.fillStyle(0xffffff, 0.4).fillRect(0, y, VIEW_W, 1);
    }
    for (const x of [24, VIEW_W - 34]) {
      g.fillStyle(0x8a8fa8).fillRect(x, 86, 10, 60);
      g.fillStyle(0xc8ccd8).fillRect(x, 86, 3, 60);
      g.fillStyle(0xd83a4a).fillRect(x - 2, 94, 14, 6);
    }
  }

  // --- flow ------------------------------------------------------------------------

  private next = () => this.controls.justPressed('start') || this.controls.justPressed('jump') || this.controls.justPressed('fire');

  /** Corner: the Gatekeeper's taunt (after round 1), then Coach Jared's tip. */
  private openCorner(): void {
    this.phase = 'corner';
    const c = this.add.container(0, 0).setDepth(30);
    const shade = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x05040a, 0.85).setOrigin(0);
    const post = this.add.rectangle(VIEW_W - 70, 40, 14, 150, 0x8a8fa8).setOrigin(0);
    const rope1 = this.add.rectangle(0, 70, VIEW_W, 3, 0xd83a4a).setOrigin(0);
    const rope2 = this.add.rectangle(0, 96, VIEW_W, 3, 0xfff1e0).setOrigin(0);
    const stool = this.add.rectangle(VIEW_W / 2 - 30, 160, 60, 10, 0x6a4a30).setOrigin(0);
    const legs = this.add.rectangle(VIEW_W / 2 - 24, 170, 48, 30, 0x4a3020).setOrigin(0);
    const hero = this.add.image(VIEW_W / 2, 168, 'ubox_idle').setOrigin(0.5, 1).setScale(3);
    const coach = this.add.image(VIEW_W / 2 + 90, 176, 'jared_idle').setOrigin(0.5, 1).setScale(2.4).setFlipX(true);
    const towel = this.add.rectangle(VIEW_W / 2 + 66, 100, 10, 26, 0xfff1e0).setOrigin(0);
    const title = pixelText(this, VIEW_W / 2, 12, this.round === 1 ? 'YOUR CORNER' : `END OF ROUND ${this.round - 1}`, { fontSize: '16px', color: '#f8e040', stroke: '#000000' }).setOrigin(0.5, 0);
    c.add([shade, post, rope1, rope2, stool, legs, hero, coach, towel, title]);
    this.corner = c;
    const lines: Line[] = [];
    if (this.round > 1) {
      lines.push({ name: 'GATEKEEPER', text: this.round === 2 ? 'Is that all you have got?' : 'I will knock that helmet clean off!', portrait: { key: 'gbox_idle' }, voice: this.round === 2 ? 'gate_taunt1' : 'gate_taunt2', color: 0x8c4ad8 });
    }
    const tips = [
      "Alright champ, watch his shoulders! When he winds up, dodge... then hit him hard!",
      'He covers his face when you go high. Work the body!',
      "Last round! When his eyes flash, that's your opening. Go get him!",
    ];
    lines.push({ name: 'COACH JARED', text: tips[this.round - 1], portrait: { key: 'jared_idle' }, voice: `jared_round${this.round}`, color: 0x2e9a4a });
    // A breather between rounds.
    if (this.round > 1) this.hp = Math.min(MAX_HP, this.hp + MAX_HP * 0.3);
    this.hearts = 20;
    this.story = dialogue(this, lines, this.next, () => {
      this.story = null;
      this.corner?.destroy(true);
      this.corner = null;
      this.startRound();
    });
  }

  private startRound(): void {
    this.phase = 'intro';
    this.phaseT = 0;
    this.clock = ROUND_FRAMES;
    this.roundDowns = 0;
    this.yState = 'idle';
    this.oState = 'idle';
    this.oT = 0;
    this.oDur = 80;
    this.banner.setText(`ROUND ${this.round}`);
    sfx.bell();
    playMusic(this, 'boxing');
  }

  private endRound(): void {
    sfx.bell();
    if (this.round < ROUNDS) {
      this.round++;
      this.phase = 'between';
      this.phaseT = 0;
      this.banner.setText('');
      this.time.delayedCall(900, () => this.openCorner());
      return;
    }
    // Decision: more knockdowns wins; then whoever is less hurt.
    const won = this.oDowns > this.yDowns || (this.oDowns === this.yDowns && this.oHp <= this.hp);
    this.finishFight(won, won ? 'DECISION: ULTRAGUY' : 'DECISION: GATEKEEPER');
  }

  private finishFight(won: boolean, text: string): void {
    if (this.result) return;
    this.result = won ? 'win' : 'lose';
    this.phase = 'over';
    this.phaseT = 0;
    this.banner.setText(text);
    if (won) {
      playVoice(this, 'box_ko');
      this.time.delayedCall(1300, () => playVoice(this, 'gate_loses'));
    } else playVoice(this, 'gate_wins');
    sfx.crowd();
    stopMusic();
  }

  // --- simulation -------------------------------------------------------------------

  private step(): void {
    this.frame++;
    this.controls.poll();
    if (this.story) {
      this.story();
      return;
    }
    this.phaseT++;
    if (this.phase === 'intro') {
      if (this.phaseT === 60) {
        this.banner.setText('FIGHT!');
        if (this.round === 1) playVoice(this, 'box_fight');
      }
      if (this.phaseT === 100) {
        this.banner.setText('');
        this.phase = 'fight';
      }
      return;
    }
    if (this.phase === 'over') {
      if (this.phaseT === 240) {
        const won = this.result === 'win';
        returnToGame(this, this.mode, won);
      }
      return;
    }
    if (this.phase !== 'fight') return;
    if (this.oState !== 'down' && this.yState !== 'down' && --this.clock <= 0) {
      this.endRound();
      return;
    }
    this.stepYou();
    this.stepOpp();
  }

  private stepYou(): void {
    const c = this.controls;
    this.yT++;
    switch (this.yState) {
      case 'idle':
      case 'block': {
        if (c.isDown('down')) this.yState = 'block';
        else if (this.yState === 'block') this.yState = 'idle';
        if (this.yState === 'block') return;
        if (c.justPressed('left') || c.justPressed('right')) {
          this.yState = 'dodge';
          this.yT = 0;
          this.dodgeDir = c.justPressed('left') ? -1 : 1;
          sfx.whoosh();
        } else if (c.justPressed('start') && this.stars > 0) {
          this.yState = 'star';
          this.yT = 0;
          sfx.starPunch();
        } else if (c.justPressed('jump') || c.justPressed('fire')) {
          if (this.hearts <= 0) return;
          this.yState = 'punch';
          this.yT = 0;
          this.punchSide = c.justPressed('jump') ? 'R' : 'L';
          this.punchHigh = c.isDown('up');
        }
        return;
      }
      case 'dodge':
        if (this.yT >= 22) this.toIdle();
        return;
      case 'punch':
        if (this.yT === 5) this.landPunch();
        if (this.yT >= 13) this.toIdle();
        return;
      case 'star':
        if (this.yT === 14) this.landStar();
        if (this.yT >= 28) this.toIdle();
        return;
      case 'hit':
        if (this.yT >= 26) this.toIdle();
        return;
      case 'tired':
        // Out of hearts: winded for a moment (no punches), then a few back.
        if (this.yT >= 80) {
          this.hearts = 8;
          this.toIdle();
        }
        return;
      case 'down': {
        // Mash to get up before the count of ten.
        if (c.justPressed('jump') || c.justPressed('fire')) this.mash++;
        const count = Math.floor(this.yT / 50) + 1;
        this.info.setText(`${Math.min(count, 10)}...   MASH JUMP/FIRE TO GET UP!`);
        if (this.yT % 50 === 0) sfx.tick();
        if (this.mash >= 12 + this.yDowns * 4) {
          this.hp = Math.round(MAX_HP * 0.4);
          // Back up with your wind back: fresh hearts, not winded.
          this.hearts = Math.max(this.hearts, 12);
          this.mash = 0;
          this.info.setText('');
          this.toIdle();
          this.oState = 'idle';
          this.oT = 0;
          this.oDur = 80;
        } else if (count > 10) this.finishFight(false, 'KNOCKOUT...');
        return;
      }
    }
  }

  private toIdle(): void {
    this.yState = this.hearts <= 0 ? 'tired' : 'idle';
    this.yT = 0;
  }

  /** Your punch reaches him: blocked if he's guarding that height, else it lands. */
  private landPunch(): void {
    const o = this.oState;
    if (o === 'down') return;
    const open = o === 'open' || o === 'stun' || o === 'taunt' || o === 'hit';
    const guarded = !open && o !== 'wind' && o !== 'punch' && (this.guard === 'high') === this.punchHigh;
    if (guarded) {
      sfx.punchBlock();
      this.hearts = Math.max(0, this.hearts - 1);
      // He likes to answer a blocked punch.
      if (Math.random() < 0.35) this.startAttack();
      return;
    }
    let dmg = this.punchHigh ? 4 : 3;
    // A hit while his eye flashes (the start of a wind-up) or while he taunts: a star.
    if ((o === 'wind' && this.flash > 0) || o === 'taunt') {
      this.stars = Math.min(3, this.stars + 1);
      dmg += 3;
      sfx.pickup();
    }
    if (o === 'open' || o === 'stun') dmg *= 2;
    this.hurtOpp(dmg);
  }

  private landStar(): void {
    if (this.oState === 'down') return;
    const dmg = 10 + this.stars * 8;
    this.stars = 0;
    this.cameras.main.shake(250, 0.015);
    this.hurtOpp(dmg);
    // (hurtOpp may have knocked him down.)
    if ((this.oState as OppState) !== 'down') {
      this.oState = 'stun';
      this.oT = 0;
      this.oDur = 70;
    }
  }

  private hurtOpp(dmg: number): void {
    sfx.punch();
    this.oHp = Math.max(0, this.oHp - dmg);
    if (this.oHp === 0) {
      this.knockDown();
      return;
    }
    if (this.oState !== 'stun' && this.oState !== 'open') {
      this.oState = 'hit';
      this.oT = 0;
      this.oDur = 12;
    }
  }

  private knockDown(): void {
    this.oDowns++;
    this.oState = 'down';
    this.oT = 0;
    sfx.bodyFall();
    playVoice(this, 'box_down');
    this.cameras.main.shake(300, 0.012);
    // Gets up at a later count each time; the third time he stays down.
    this.getUpAt = this.oDowns >= 3 ? 99 : Phaser.Math.Between(3 + this.oDowns * 2, 6 + this.oDowns * 2);
  }

  private stepOpp(): void {
    this.oT++;
    if (this.flash > 0) this.flash--;
    switch (this.oState) {
      case 'idle':
        if (this.oT >= this.oDur) {
          const r = Math.random();
          if (r < 0.62) this.startAttack();
          else if (r < 0.9) {
            this.guard = this.guard === 'high' ? 'low' : 'high';
            this.oT = 0;
            this.oDur = Phaser.Math.Between(40, 80);
          } else {
            this.oState = 'taunt';
            this.oT = 0;
            this.oDur = 60;
          }
        }
        return;
      case 'wind':
        if (this.oT >= this.oDur) {
          this.oState = 'punch';
          this.oT = 0;
        }
        return;
      case 'punch':
        if (this.oT === 6) this.resolveAttack();
        return;
      case 'recover':
      case 'open':
      case 'hit':
      case 'stun':
      case 'taunt':
        if (this.oT >= this.oDur) {
          this.oState = 'idle';
          this.oT = 0;
          this.oDur = Phaser.Math.Between(30, 70) - (this.oDowns > 0 ? 15 : 0);
          // Coming out of a flinch he covers where you hit him.
          if (Math.random() < 0.5) this.guard = this.punchHigh ? 'high' : 'low';
        }
        return;
      case 'down': {
        const count = Math.floor(this.oT / 50) + 1;
        if (this.oT % 50 === 1) sfx.tick();
        this.info.setText(count <= 10 ? `${count}` : '');
        if (count > 10 || (this.oDowns >= 3 && count >= 10)) {
          this.info.setText('');
          this.finishFight(true, 'KNOCKOUT!');
        } else if (count >= this.getUpAt && this.oDowns < 3) {
          this.oHp = Math.round(MAX_HP * (this.oDowns === 1 ? 0.6 : 0.4));
          this.info.setText('');
          this.oState = 'idle';
          this.oT = 0;
          this.oDur = 60;
        }
        return;
      }
    }
  }

  private startAttack(): void {
    const fast = this.oDowns > 0 || this.round > 1;
    this.attack = Math.random() < (fast ? 0.3 : 0.2) ? 'U' : Math.random() < 0.5 ? 'L' : 'R';
    this.oState = 'wind';
    this.oT = 0;
    this.oDur = (this.attack === 'U' ? 40 : 30) - (fast ? 8 : 0) - (this.round === 3 ? 4 : 0);
    this.flash = 10;
  }

  /** His punch arrives: dodged (he's left open), blocked (not uppercuts), or it lands. */
  private resolveAttack(): void {
    const dodging = this.yState === 'dodge' && this.yT >= 2 && this.yT <= 20;
    if (dodging) {
      sfx.whoosh();
      this.oState = 'open';
      this.oT = 0;
      this.oDur = 50;
      return;
    }
    if (this.yState === 'block' && this.attack !== 'U') {
      sfx.punchBlock();
      this.hp = Math.max(1, this.hp - 3);
      this.hearts = Math.max(0, this.hearts - 1);
      this.oState = 'recover';
      this.oT = 0;
      this.oDur = 20;
      return;
    }
    if (this.yState === 'down') return;
    sfx.punch();
    this.cameras.main.shake(160, 0.01);
    this.hp = Math.max(0, this.hp - (this.attack === 'U' ? 18 : 10));
    this.hearts = Math.max(0, this.hearts - 3);
    this.oState = 'recover';
    this.oT = 0;
    this.oDur = 30;
    if (this.hp === 0) {
      this.yDowns++;
      this.roundDowns++;
      this.yState = 'down';
      this.yT = 0;
      this.mash = 0;
      sfx.bodyFall();
      if (this.roundDowns >= 3) this.finishFight(false, 'T.K.O.');
      else if (this.yDowns === 1) playVoice(this, 'jared_getup');
    } else {
      this.yState = 'hit';
      this.yT = 0;
    }
  }

  // --- drawing ---------------------------------------------------------------------

  private draw(): void {
    // Opponent pose.
    const o = this.oState;
    let pose = 'idle';
    if (o === 'idle') pose = this.guard === 'high' ? 'guardHigh' : 'guardLow';
    else if (o === 'wind') pose = this.attack === 'U' ? 'upWind' : this.attack === 'L' ? 'windL' : 'windR';
    else if (o === 'punch') pose = this.attack === 'U' ? 'upper' : this.attack === 'L' ? 'punchL' : 'punchR';
    else if (o === 'hit') pose = this.punchHigh ? 'hitFace' : 'hitBody';
    else if (o === 'open' || o === 'stun') pose = 'dizzy';
    else if (o === 'taunt') pose = 'idle';
    else if (o === 'down') pose = 'down';
    this.opp.setTexture(`gbox_${pose}`);
    const bob = o === 'idle' || o === 'taunt' ? Math.round(Math.sin(this.frame / 10) * 1.5) : 0;
    const lunge = o === 'punch' ? 6 : o === 'wind' ? -2 : 0;
    this.opp.setPosition(OPP_X + (o === 'taunt' ? Math.sin(this.frame / 6) * 4 : 0), OPP_Y + bob + lunge);
    this.opp.setTint(o === 'hit' && this.oT < 4 ? 0xffb0b0 : 0xffffff);
    // His eye flashes white at the start of a wind-up.
    this.eyeFlash.setVisible(this.flash > 0 && this.flash % 4 < 3).setPosition(OPP_X - 24 * SCALE + 24.5 * SCALE, OPP_Y + bob - 60 * SCALE + 12.5 * SCALE);

    // You.
    const y = this.yState;
    let yp = 'idle';
    if (y === 'block') yp = 'block';
    else if (y === 'punch' && this.yT < 10) yp = this.punchHigh ? `punchH${this.punchSide}` : `punch${this.punchSide}`;
    else if (y === 'star' && this.yT >= 8) yp = 'star';
    else if (y === 'down') yp = 'down';
    this.you.setTexture(`ubox_${yp}`);
    const dx = y === 'dodge' ? this.dodgeDir * Math.sin((Math.min(this.yT, 22) / 22) * Math.PI) * 34 : 0;
    const dy = y === 'hit' ? Math.max(0, 8 - this.yT) : y === 'star' && this.yT < 8 ? 6 : y === 'punch' && this.yT < 6 ? -3 : 0;
    this.you.setPosition(OPP_X + dx, YOU_Y + dy).setAngle(y === 'dodge' ? this.dodgeDir * 8 : 0);
    this.you.setTint(y === 'hit' && this.yT % 6 < 3 ? 0xff9090 : y === 'tired' && this.frame % 20 < 10 ? 0xb0b0ff : 0xffffff);

    // HUD.
    const h = this.hud;
    h.clear();
    h.fillStyle(0x05040a, 0.8).fillRect(0, 0, VIEW_W, 24);
    const bar = (x: number, val: number, col: number, label: string, right = false) => {
      h.fillStyle(0x1a1428).fillRect(x, 13, 100, 7);
      const w = Math.round((val / MAX_HP) * 98);
      h.fillStyle(col).fillRect(right ? x + 1 + 98 - w : x + 1, 14, w, 5);
      h.fillStyle(0xffffff, 0.3).fillRect(right ? x + 1 + 98 - w : x + 1, 14, w, 1);
      void label;
    };
    bar(6, this.hp, 0xf28c28, 'ULTRAGUY');
    bar(VIEW_W - 106, this.oHp, 0x8c4ad8, 'GATEKEEPER', true);
    for (let i = 0; i < 3; i++) h.fillStyle(i < this.stars ? 0xf8e040 : 0x3a3450).fillRect(112 + i * 8, 13, 6, 6);
    const secs = Math.ceil((this.clock / ROUND_FRAMES) * 180);
    this.info.setText(this.oState === 'down' || this.yState === 'down' ? this.info.text : '');
    this.hudText(`ULTRAGUY  HEARTS ${this.hearts}`, `R${this.round}  ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, 'GATEKEEPER');
  }

  private hudLeft?: ReturnType<typeof pixelText>;
  private hudMid?: ReturnType<typeof pixelText>;
  private hudRight?: ReturnType<typeof pixelText>;

  private hudText(left: string, mid: string, right: string): void {
    this.hudLeft ??= pixelText(this, 6, 3, '', { color: '#f28c28' }).setDepth(41);
    this.hudMid ??= pixelText(this, VIEW_W / 2, 3, '', { color: '#fff1e0' }).setOrigin(0.5, 0).setDepth(41);
    this.hudRight ??= pixelText(this, VIEW_W - 6, 3, '', { color: '#b88aff' }).setOrigin(1, 0).setDepth(41);
    this.hudLeft.setText(left);
    this.hudMid.setText(mid);
    this.hudRight.setText(right);
  }
}
