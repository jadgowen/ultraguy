import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../constants';
import { ACTIONS, ACTION_LABELS, Action, KEY, bindKey, loadSettings, resetKeys, saveSettings, updateSettings } from '../settings';
import { sfx } from '../sfx';
import { FONT, MenuScene } from './menu';
import { PixelText, pixelText } from '../pixelFont';

/** Readable name for a key code ("LEFT", "Z", "SPACE"...). */
const KEY_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(Phaser.Input.Keyboard.KeyCodes).map(([name, code]) => [code, name.replace(/_/g, ' ')]),
);
export function keyName(code: number): string {
  return KEY_NAMES[code] ?? `KEY ${code}`;
}

/**
 * Key remapping. Pick an action, then press the key to use for it. The new
 * key becomes the action's main key (its other keys stay as alternates) and
 * is taken off any other action. ESC cancels; ESC and Backspace can't be bound.
 */
export class ControlsScene extends MenuScene {
  private labels: PixelText[] = [];
  private prompt!: PixelText;
  private capturing: Action | null = null;
  private captureListener: ((e: KeyboardEvent) => void) | null = null;
  /** Frames to ignore input after a capture ends (so ESC doesn't also count as "confirm"). */
  private cooldown = 0;

  constructor() {
    super('controls');
  }

  create(data?: { index?: number }): void {
    this.initMenu();
    this.capturing = null;
    this.cooldown = 10;
    this.backdrop('power', 0.65);
    const small = { fontFamily: FONT, fontSize: '8px', color: '#8a8fa8' };
    pixelText(this, VIEW_W / 2, 14, 'CONTROLS', { fontFamily: FONT, fontSize: '16px', color: '#f28c28' }).setOrigin(0.5);
    const rows = [...ACTIONS.map(() => ''), 'RESET TO DEFAULTS', 'BACK'];
    this.labels = this.list(56, 32, rows, data?.index ?? 0);
    this.labels.forEach((t) => t.setFontSize(10));
    this.refresh();
    pixelText(this, VIEW_W / 2, VIEW_H - 26, 'GAMEPAD (fixed): D-PAD move  A jump  B/X fire  START pause  L1/R1 weapon', small).setOrigin(0.5);
    pixelText(this, VIEW_W / 2, VIEW_H - 12, 'SLIDE: DOWN + JUMP (or double-tap)    ENTER / Z: rebind   X: back', small).setOrigin(0.5);
    this.prompt = pixelText(this, VIEW_W / 2, VIEW_H / 2, '', { fontFamily: FONT, fontSize: '12px', color: '#fff1e0', backgroundColor: '#000000', align: 'center', padding: { x: 10, y: 8 } })
      .setOrigin(0.5)
      .setDepth(10)
      .setVisible(false);
    this.events.once('shutdown', () => this.stopCapture());
  }

  private refresh(): void {
    const keys = loadSettings().keys;
    ACTIONS.forEach((a, i) => {
      const names = keys[a].slice(0, 3).map(keyName).join('  ') || '(none)';
      this.labels[i].setText(`${ACTION_LABELS[a].padEnd(16)} ${names}`);
    });
  }

  private startCapture(action: Action): void {
    this.capturing = action;
    this.inputLocked = true;
    this.prompt.setText(`PRESS A KEY FOR\n${ACTION_LABELS[action]}\n\nESC to cancel`).setVisible(true);
    this.captureListener = (e: KeyboardEvent) => {
      if (e.repeat) return; // the held confirm key auto-repeating
      e.preventDefault();
      if (e.keyCode === KEY.ESC) {
        this.finishCapture();
        return;
      }
      const s = loadSettings();
      if (!bindKey(s.keys, action, e.keyCode)) {
        this.prompt.setText(`${keyName(e.keyCode)} can't be used\n\nPRESS ANOTHER KEY\nESC to cancel`);
        return;
      }
      saveSettings(s);
      sfx.select();
      this.finishCapture(true);
    };
    window.addEventListener('keydown', this.captureListener, true);
  }

  private stopCapture(): void {
    if (this.captureListener) window.removeEventListener('keydown', this.captureListener, true);
    this.captureListener = null;
  }

  private finishCapture(changed = false): void {
    this.stopCapture();
    this.capturing = null;
    // Restart so this screen's own controls pick up the new bindings.
    if (changed) this.time.delayedCall(120, () => this.scene.restart({ index: this.selected }));
    else {
      this.inputLocked = false;
      this.cooldown = 10;
      this.prompt.setVisible(false);
    }
  }

  protected tick(): boolean {
    if (this.capturing || this.captureListener) return false;
    if (this.cooldown > 0) {
      this.cooldown--;
      return false;
    }
    if (this.controls.justPressed('fire')) {
      sfx.select();
      this.scene.start('settings');
      return true;
    }
    if (!this.confirmed()) return false;
    const i = this.selected;
    if (i < ACTIONS.length) {
      sfx.tick();
      this.startCapture(ACTIONS[i]);
    } else if (i === ACTIONS.length) {
      updateSettings(resetKeys);
      sfx.select();
      this.scene.restart({ index: i });
      return true;
    } else {
      sfx.select();
      this.scene.start('settings');
      return true;
    }
    return false;
  }
}
