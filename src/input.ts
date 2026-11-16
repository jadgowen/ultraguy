import Phaser from 'phaser';
import { ACTIONS, Action, loadSettings } from './settings';
import { touch } from './touch';

/**
 * Input layer: the game only ever asks about Actions, never about keys.
 * Key bindings come from the player's settings (see settings.ts).
 * Remapping, gamepads and new "special" buttons all happen here.
 */
export type { Action } from './settings';
export { DEFAULT_KEYS } from './settings';

export class Controls {
  private keys = new Map<Action, Phaser.Input.Keyboard.Key[]>();
  private held = new Set<Action>();
  private prev = new Set<Action>();
  // Presses seen by keydown events since the last poll, so a tap shorter
  // than one step is never lost.
  private latched = new Set<Action>();
  private pressed = new Set<Action>();
  private released = new Set<Action>();

  constructor(private scene: Phaser.Scene, bindings: Record<Action, number[]> = loadSettings().keys) {
    // A touch button still held from the previous screen isn't a new press
    // (keyboard keys get this for free: new Key objects start released).
    this.held = new Set(touch.heldActions());
    touch.takeLatched();
    const kb = scene.input.keyboard!;
    for (const action of ACTIONS) {
      const keys = bindings[action].map((code) => {
        const key = kb.addKey(code, true);
        key.on('down', () => this.latched.add(action));
        return key;
      });
      this.keys.set(action, keys);
    }
    scene.events.once('shutdown', () => {
      for (const keys of this.keys.values()) for (const k of keys) kb.removeKey(k, true);
      this.keys.clear();
    });
  }

  /** Call once per simulation step, before reading. */
  poll(): void {
    this.prev = new Set(this.held);
    this.held.clear();

    for (const [action, keys] of this.keys) {
      if (keys.some((k) => k.isDown)) this.held.add(action);
    }

    const pad = this.scene.input.gamepad?.pad1;
    if (pad) {
      const sx = pad.leftStick.x;
      const sy = pad.leftStick.y;
      if (pad.left || sx < -0.5) this.held.add('left');
      if (pad.right || sx > 0.5) this.held.add('right');
      if (pad.up || sy < -0.5) this.held.add('up');
      if (pad.down || sy > 0.5) this.held.add('down');
      if (pad.A) this.held.add('jump');
      if (pad.B || pad.X) this.held.add('fire');
      if (pad.buttons[9]?.pressed) this.held.add('start');
      if (pad.L1) this.held.add('prev');
      if (pad.R1) this.held.add('next');
    }

    // On-screen touch controls (see touch.ts).
    for (const a of touch.heldActions()) this.held.add(a);
    for (const a of touch.takeLatched()) this.latched.add(a);

    this.pressed.clear();
    for (const a of ACTIONS) {
      if ((this.held.has(a) && !this.prev.has(a)) || this.latched.has(a)) this.pressed.add(a);
    }
    this.latched.clear();
    this.released.clear();
    for (const a of this.prev) if (!this.held.has(a)) this.released.add(a);
  }

  isDown(a: Action): boolean {
    return this.held.has(a);
  }

  justPressed(a: Action): boolean {
    return this.pressed.has(a);
  }

  justReleased(a: Action): boolean {
    return this.released.has(a);
  }
}
