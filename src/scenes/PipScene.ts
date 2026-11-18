import Phaser from 'phaser';
import { playVoice } from '../audio';
import { VIEW_H, VIEW_W } from '../constants';
import { PIP_CATALOG, PipKind, PipPaint, PipShell, PipThing, PipTrail, makePipBits, pipOwns, pipTexture } from '../pip';
import { pupilOffset } from '../entities/Pip';
import { PixelText, pixelText } from '../pixelFont';
import { SaveData, buyPip, loadSave, setPip } from '../save';
import { sfx } from '../sfx';
import { touch } from '../touch';
import { FONT, MenuScene } from './menu';

const TABS: { kind: PipKind; label: string }[] = [
  { kind: 'module', label: 'UPGRADES' },
  { kind: 'shell', label: 'SHELL' },
  { kind: 'paint', label: 'PAINT' },
  { kind: 'trail', label: 'TRAIL' },
];

/**
 * PIP'S WORKSHOP (at Rivet's): upgrades for Pip, and shells, paints and
 * trails to dress it in. Pip floats on the left trying on whatever you point
 * at. LEFT/RIGHT change the tab. Upgrades you own can be switched on and off.
 */
export class PipScene extends MenuScene {
  private tab = 0;
  private pick = 0;
  private tabTexts: PixelText[] = [];
  private rows: PixelText[] = [];
  private arrow!: PixelText;
  private blurb!: PixelText;
  private boltsText!: PixelText;
  private note!: PixelText;
  private noteT = 0;
  private backKey!: Phaser.Input.Keyboard.Key;
  // The preview Pip.
  private body!: Phaser.GameObjects.Image;
  private pupil!: Phaser.GameObjects.Image;
  private bits: { img: Phaser.GameObjects.Image; vx: number; vy: number; life: number; max: number }[] = [];
  private px = 92;
  private py = 104;
  private pvx = 0;
  private pvy = 0;

  constructor() {
    super('pipshop');
  }

  create(): void {
    this.initMenu();
    makePipBits(this);
    this.backdrop('city', 0.7);
    this.backKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.BACKSPACE);
    this.tab = 0;
    this.pick = 0;
    this.bits = [];
    const small = { fontFamily: FONT, fontSize: '8px', color: '#8a8fa8' };
    pixelText(this, VIEW_W / 2, 10, "PIP'S WORKSHOP", { fontFamily: FONT, fontSize: '12px', color: '#4ab8a8', stroke: '#000000' }).setOrigin(0.5, 0);
    this.panel(92, 116, 140, 148);
    // A workbench under Pip.
    const g = this.add.graphics();
    g.fillStyle(0x3a2a20).fillRect(36, 166, 112, 10);
    g.fillStyle(0x6a4a30).fillRect(36, 166, 112, 2);
    g.fillStyle(0x2a1e18).fillRect(44, 176, 6, 12).fillRect(134, 176, 6, 12);
    this.body = this.add.image(this.px, this.py, 'pip_pupil').setScale(4).setDepth(2);
    this.pupil = this.add.image(this.px, this.py, 'pip_pupil').setScale(4).setDepth(2.1);
    this.panel(300, 116, 224, 148);
    this.tabTexts = TABS.map((t, i) => pixelText(this, 196 + i * 52, 46, t.label, { ...small }));
    this.rows = Array.from({ length: 6 }, (_, i) => pixelText(this, 210, 62 + i * 14, '', { fontFamily: FONT, fontSize: '12px', color: '#8a8fa8' }));
    this.arrow = pixelText(this, 198, 62, '>', { fontFamily: FONT, fontSize: '12px', color: '#5ef0c8' });
    this.boltsText = pixelText(this, 210, 172, '', { fontFamily: FONT, fontSize: '12px', color: '#c8ccd8' });
    this.add.image(202, 178, 'nut').setScale(1.5);
    this.blurb = pixelText(this, VIEW_W / 2, VIEW_H - 34, '', { ...small, color: '#5ef0c8' }).setOrigin(0.5, 0);
    this.note = pixelText(this, VIEW_W / 2, VIEW_H - 24, '', { ...small, color: '#ffe14a' }).setOrigin(0.5, 0);
    pixelText(this, VIEW_W / 2, VIEW_H - 12, 'LEFT/RIGHT tab   UP/DOWN choose   ENTER/Z buy or use   BKSP back', small).setOrigin(0.5, 0);
    this.refresh();
  }

  private get things(): PipThing[] {
    return PIP_CATALOG[TABS[this.tab].kind];
  }

  private status(save: SaveData, kind: PipKind, t: PipThing): string {
    const own = pipOwns(save, kind, t.id);
    if (kind === 'module') return own ? (save.pipOff.includes(t.id as never) ? 'OFF' : 'ON') : String(t.price);
    const worn = kind === 'shell' ? save.pipShell : kind === 'paint' ? save.pipPaint : save.pipTrail;
    if (worn === t.id) return 'WEARING';
    if (own) return 'OWNED';
    return t.price === undefined ? 'EARN IT' : String(t.price);
  }

  private refresh(): void {
    const save = loadSave();
    const kind = TABS[this.tab].kind;
    this.tabTexts.forEach((t, i) => t.setColor(i === this.tab ? '#fff1e0' : '#4a4e68'));
    this.rows.forEach((row, i) => {
      const t = this.things[i];
      row.setText(t ? `${t.name.padEnd(8)} ${this.status(save, kind, t)}` : '');
      row.setColor(i === this.pick ? '#fff1e0' : '#8a8fa8');
    });
    this.arrow.setY(62 + this.pick * 14);
    this.boltsText.setText(String(save.bolts));
    const t = this.things[this.pick];
    this.blurb.setText(t ? t.blurb : '');
  }

  /** What the preview wears: the saved look, with whatever you're pointing at tried on. */
  private previewLook(): { shell: PipShell; paint: PipPaint; trail: PipTrail } {
    const save = loadSave();
    const look = { shell: save.pipShell, paint: save.pipPaint, trail: save.pipTrail };
    const kind = TABS[this.tab].kind;
    const t = this.things[this.pick];
    if (t && kind === 'shell') look.shell = t.id as PipShell;
    if (t && kind === 'paint') look.paint = t.id as PipPaint;
    if (t && kind === 'trail') look.trail = t.id as PipTrail;
    return look;
  }

  private say(text: string): void {
    this.note.setText(text);
    this.noteT = 100;
  }

  protected tick(): boolean {
    this.stepPreview();
    if (this.noteT > 0 && --this.noteT === 0) this.note.setText('');
    if (Phaser.Input.Keyboard.JustDown(this.backKey) || touch.takeBack() || this.controls.justPressed('fire')) {
      sfx.select();
      this.scene.start('shop');
      return true;
    }
    const dx = this.controls.justPressed('right') ? 1 : this.controls.justPressed('left') ? -1 : 0;
    const dy = this.controls.justPressed('down') ? 1 : this.controls.justPressed('up') ? -1 : 0;
    if (dx) {
      this.tab = (this.tab + dx + TABS.length) % TABS.length;
      this.pick = 0;
      sfx.tick();
      this.refresh();
    }
    if (dy) {
      this.pick = (this.pick + dy + this.things.length) % this.things.length;
      sfx.tick();
      // A little hop when it tries something on.
      this.pvy -= 1.5;
      this.refresh();
    }
    if (this.confirmed()) this.choose();
    return false;
  }

  private choose(): void {
    const kind = TABS[this.tab].kind;
    const t = this.things[this.pick];
    const save = loadSave();
    if (pipOwns(save, kind, t.id)) {
      setPip(kind, t.id);
      sfx.select();
      this.say(kind === 'module' ? `${t.name} ${loadSave().pipOff.includes(t.id as never) ? 'OFF' : 'ON'}` : `PIP IS WEARING ${t.name}`);
    } else {
      const r = buyPip(kind, t.id);
      if (r === 'ok') {
        if (kind !== 'module') setPip(kind, t.id);
        sfx.pickup();
        playVoice(this, 'shop_thanks');
        this.say(`${t.name}: YOURS!`);
        this.pvy -= 3; // a happy bounce
      } else if (r === 'earned') {
        sfx.tick();
        this.say('NOT FOR SALE: ' + t.blurb.toUpperCase());
      } else {
        sfx.hurt();
        playVoice(this, 'shop_broke');
        this.say(`A FEW BOLTS SHORT (${t.price})`);
      }
    }
    this.refresh();
  }

  /** The preview: Pip bobs on a spring over the bench, flaps, sparks, and wears its trail. */
  private stepPreview(): void {
    const look = this.previewLook();
    const f = this.frame;
    const tx = 92 + Math.sin(f * 0.02) * 10;
    const ty = 104 + Math.sin(f * 0.031) * 6;
    this.pvx = (this.pvx + (tx - this.px) * 0.03) * 0.88;
    this.pvy = (this.pvy + (ty - this.py) * 0.03) * 0.88;
    this.px += this.pvx;
    this.py += this.pvy;
    const frame: 0 | 1 = Math.floor(f / 6) % 2 === 0 ? 0 : 1;
    const y = this.py + Math.sin(f * 0.12) * 3;
    this.body.setTexture(pipTexture(this, look.shell, look.paint, frame)).setPosition(Math.round(this.px), Math.round(y)).setRotation(Phaser.Math.Clamp(this.pvx * 0.15, -0.4, 0.4));
    const o = pupilOffset(look.shell, Math.sin(f * 0.013), Math.sin(f * 0.009) > 0.6 ? 1 : 0);
    const blink = f % 200 > 194;
    this.pupil.setPosition(Math.round(this.body.x + o.x * 4), Math.round(this.body.y + o.y * 4)).setScale(4, blink ? 2 : 4).setRotation(this.body.rotation);
    // Thruster sparks, and the trail.
    const add = (tex: string, vx: number, vy: number, life: number, dx = 0, dy = 0) => {
      const img = this.add.image(this.px + dx, y + dy, tex).setScale(3).setDepth(1.9);
      this.bits.push({ img, vx, vy, life, max: life });
    };
    if (f % 2 === 0) add(Math.random() < 0.5 ? 'pip_flame' : 'pip_dot', (Math.random() - 0.5) * 1.2, 1.5 + Math.random(), 14, (Math.random() - 0.5) * 8, 26);
    if (look.trail === 'sparks' && f % 2 === 0) add('pip_flame', (Math.random() - 0.5) * 4, -1.5 - Math.random() * 2, 22);
    if (look.trail === 'bubbles' && f % 7 === 0) add('pip_bubble', (Math.random() - 0.5), -1, 50, (Math.random() - 0.5) * 30, 6);
    if (look.trail === 'notes' && f % 16 === 0) add('pip_note', (Math.random() - 0.5), -1.1, 55, -20, 0);
    if (look.trail === 'stars' && f % 6 === 0) add('pip_star', 0, 0.2, 30, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 30);
    for (const b of this.bits) {
      b.life--;
      b.img.x += b.vx;
      b.img.y += b.vy;
      b.img.setAlpha(Math.min(1, (b.life / b.max) * 1.6));
      if (b.life <= 0) b.img.destroy();
    }
    this.bits = this.bits.filter((b) => b.life > 0);
  }
}
