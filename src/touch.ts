/**
 * On-screen touch controls for phones and tablets. A DOM overlay on top of the
 * canvas: a d-pad on the left, JUMP / FIRE on the right, and small START,
 * BACK and weapon-switch buttons. Controls.poll() merges what's held here with
 * the keyboard and gamepad, so the game never knows the difference.
 *
 * Ultra Arena swaps in a shooter layout (setTouchMode('fps')): a floating
 * stick under the left thumb (move and strafe, analog), drag anywhere on the
 * right to look, a FIRE button you can also drag to aim, and WPN.
 *
 * TouchState is plain logic (unit tested); mountTouchControls() wires the DOM.
 */
import type { Action } from './settings';

/** Touch-only buttons that aren't game actions. */
export type TouchButton = Action | 'back';

type Dir = 'left' | 'right' | 'up' | 'down';

/**
 * Directions for a d-pad touch at (dx, dy) from its center, `r` = pad radius.
 * Cardinal directions get wide sectors; only a clear diagonal presses two.
 */
export function dpadDirs(dx: number, dy: number, r: number): Dir[] {
  const dead = r * 0.2;
  if (dx * dx + dy * dy < dead * dead) return [];
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const out: Dir[] = [];
  // tan(30°) ≈ 0.58: within 30° of an axis counts as straight.
  if (ax > ay * 0.58) out.push(dx < 0 ? 'left' : 'right');
  if (ay > ax * 0.58) out.push(dy < 0 ? 'up' : 'down');
  return out;
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** The arena stick for a thumb at (dx, dy) from where it landed: each axis -1..1, the length capped at 1. */
export function stickAxes(dx: number, dy: number, r: number): { x: number; y: number } {
  const len = Math.hypot(dx, dy);
  if (len < r * 0.12) return { x: 0, y: 0 };
  const k = Math.min(1, len / r) / len;
  return { x: dx * k, y: dy * k };
}

export class TouchState {
  /** The arena stick (analog, -1..1; `on` while a thumb is on it). */
  stick = { x: 0, y: 0, on: false };
  /** Look drag since the last read, in CSS pixels. */
  private look = 0;
  private byPointer = new Map<number, Set<TouchButton>>();
  private held = new Set<TouchButton>();
  private latched = new Set<TouchButton>();
  private backAt = -Infinity;

  /** Set what one finger is pressing (empty set = nothing). */
  setPointer(id: number, buttons: Iterable<TouchButton>): void {
    const set = new Set(buttons);
    if (set.size) this.byPointer.set(id, set);
    else this.byPointer.delete(id);
    const next = new Set<TouchButton>();
    for (const s of this.byPointer.values()) for (const b of s) next.add(b);
    for (const b of next) {
      if (this.held.has(b)) continue;
      if (b === 'back') this.backAt = now();
      else this.latched.add(b);
    }
    this.held = next;
  }

  release(id: number): void {
    this.setPointer(id, []);
  }

  releaseAll(): void {
    this.byPointer.clear();
    this.held.clear();
    this.stick = { x: 0, y: 0, on: false };
    this.look = 0;
  }

  addLook(dx: number): void {
    this.look += dx;
  }

  /** Look drag since the last call. */
  takeLook(): number {
    const v = this.look;
    this.look = 0;
    return v;
  }

  isHeld(b: TouchButton): boolean {
    return this.held.has(b);
  }

  heldActions(): Action[] {
    return [...this.held].filter((b): b is Action => b !== 'back');
  }

  /** Presses since the last call (so taps shorter than a frame still count). */
  takeLatched(): Action[] {
    const out = [...this.latched] as Action[];
    this.latched.clear();
    return out;
  }

  /**
   * True once per press of BACK. A press nobody reads soon (e.g. during a
   * stage) is dropped, so it can't fire later on another screen.
   */
  takeBack(): boolean {
    const fresh = now() - this.backAt < 250;
    this.backAt = -Infinity;
    return fresh;
  }
}

export const touch = new TouchState();

let enabled = false;
let mode: 'pad' | 'fps' = 'pad';
let modeHook: (() => void) | null = null;

/** Switch the on-screen layout: the platformer pad, or the arena's shooter controls. */
export function setTouchMode(m: 'pad' | 'fps'): void {
  if (mode === m) return;
  mode = m;
  touch.releaseAll();
  modeHook?.();
}

/** Whether the on-screen controls are showing. */
export function touchEnabled(): boolean {
  return enabled;
}

const CSS = `
#touch { position: fixed; inset: 0; pointer-events: none; z-index: 10; display: none;
  font-family: monospace; color: #fff1e0; -webkit-user-select: none; user-select: none;
  -webkit-touch-callout: none; }
#touch.on { display: block; }
#touch .t { position: absolute; pointer-events: auto; touch-action: none;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255, 241, 224, 0.14); border: 2px solid rgba(255, 241, 224, 0.35);
  box-sizing: border-box; font-weight: bold; }
#touch .t.down { background: rgba(94, 240, 200, 0.45); border-color: rgba(94, 240, 200, 0.8); }
#touch .pad { left: calc(env(safe-area-inset-left) + 18px); bottom: calc(env(safe-area-inset-bottom) + 18px);
  width: 150px; height: 150px; border-radius: 50%; }
#touch .pad i { position: absolute; width: 0; height: 0; border: 12px solid transparent; opacity: 0.7; }
#touch .pad .u { top: 10px; left: 63px; border-bottom: 16px solid #fff1e0; border-top: 0; }
#touch .pad .d { bottom: 10px; left: 63px; border-top: 16px solid #fff1e0; border-bottom: 0; }
#touch .pad .l { left: 10px; top: 63px; border-right: 16px solid #fff1e0; border-left: 0; }
#touch .pad .r { right: 10px; top: 63px; border-left: 16px solid #fff1e0; border-right: 0; }
#touch .pad .u.on { border-bottom-color: #5ef0c8; opacity: 1; }
#touch .pad .d.on { border-top-color: #5ef0c8; opacity: 1; }
#touch .pad .l.on { border-right-color: #5ef0c8; opacity: 1; }
#touch .pad .r.on { border-left-color: #5ef0c8; opacity: 1; }
#touch .big { width: 74px; height: 74px; border-radius: 50%; font-size: 13px; }
#touch .jump { right: calc(env(safe-area-inset-right) + 16px); bottom: calc(env(safe-area-inset-bottom) + 52px); }
#touch .fire { right: calc(env(safe-area-inset-right) + 100px); bottom: calc(env(safe-area-inset-bottom) + 16px); }
#touch .small { height: 30px; min-width: 52px; padding: 0 8px; border-radius: 15px; font-size: 11px; }
#touch .prev { right: calc(env(safe-area-inset-right) + 126px); bottom: calc(env(safe-area-inset-bottom) + 112px); }
#touch .next { right: calc(env(safe-area-inset-right) + 16px); bottom: calc(env(safe-area-inset-bottom) + 140px); }
#touch .start { right: calc(env(safe-area-inset-right) + 16px); top: calc(env(safe-area-inset-top) + 12px); }
#touch .back { left: calc(env(safe-area-inset-left) + 16px); top: calc(env(safe-area-inset-top) + 12px); }
#touch .full { left: calc(env(safe-area-inset-left) + 80px); top: calc(env(safe-area-inset-top) + 12px); }
/* Arena layout: two invisible halves under everything, a floating stick, FIRE and WPN. */
#touch .fps { display: none; }
#touch.arena .pad, #touch.arena .jump, #touch.arena .fire, #touch.arena .prev, #touch.arena .next { display: none; }
#touch.arena .fps { display: flex; }
#touch .zone { top: 0; bottom: 0; background: none; border: 0; }
#touch .zone.lz { left: 0; width: 42%; }
#touch .zone.rz { right: 0; width: 58%; }
#touch .stick { position: absolute; width: 120px; height: 120px; margin: -60px 0 0 -60px; border-radius: 50%;
  border: 2px solid rgba(255, 241, 224, 0.3); background: rgba(255, 241, 224, 0.08); pointer-events: none;
  left: calc(env(safe-area-inset-left) + 92px); bottom: calc(env(safe-area-inset-bottom) + 30px); top: auto; }
#touch .stick.live { border-color: rgba(94, 240, 200, 0.7); background: rgba(94, 240, 200, 0.12); }
#touch .knob { position: absolute; left: 50%; top: 50%; width: 48px; height: 48px; margin: -24px 0 0 -24px;
  border-radius: 50%; background: rgba(255, 241, 224, 0.35); border: 2px solid rgba(255, 241, 224, 0.6); }
#touch .ffire { right: calc(env(safe-area-inset-right) + 22px); bottom: calc(env(safe-area-inset-bottom) + 34px);
  width: 86px; height: 86px; border-radius: 50%; font-size: 13px; }
#touch .fwpn { right: calc(env(safe-area-inset-right) + 118px); bottom: calc(env(safe-area-inset-bottom) + 18px); }
`;

const BUTTONS: { cls: string; label: string; action: TouchButton }[] = [
  { cls: 'big jump', label: 'JUMP', action: 'jump' },
  { cls: 'big fire', label: 'FIRE', action: 'fire' },
  { cls: 'small prev', label: '◀ WPN', action: 'prev' },
  { cls: 'small next', label: 'WPN ▶', action: 'next' },
  { cls: 'small start', label: 'START', action: 'start' },
  { cls: 'small back', label: 'BACK', action: 'back' },
];

/**
 * Build the overlay. It turns on with the first touch (or right away on a
 * touch-first device) and hides again if a key is pressed.
 */
export function mountTouchControls(onFirstTouch: () => void, onLayout: () => void): void {
  if (typeof document === 'undefined' || document.getElementById('touch')) return;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'touch';
  const pad = document.createElement('div');
  pad.className = 't pad';
  const arrows: Record<Dir, HTMLElement> = { up: null!, down: null!, left: null!, right: null! };
  for (const [d, c] of [['up', 'u'], ['down', 'd'], ['left', 'l'], ['right', 'r']] as [Dir, string][]) {
    const i = document.createElement('i');
    i.className = c;
    pad.appendChild(i);
    arrows[d] = i;
  }
  root.appendChild(pad);
  // Arena layout (hidden until setTouchMode('fps')): the halves go first so every button sits above them.
  const div = (cls: string, text = ''): HTMLElement => {
    const el = document.createElement('div');
    el.className = cls;
    el.textContent = text;
    root.appendChild(el);
    return el;
  };
  const leftZone = div('t fps zone lz');
  const rightZone = div('t fps zone rz');
  const stick = div('fps stick');
  const knob = document.createElement('div');
  knob.className = 'knob';
  stick.appendChild(knob);
  const fpsFire = div('t fps ffire', 'FIRE');
  const fpsWpn = div('t fps small fwpn', 'WPN');
  fpsWpn.dataset.action = 'jump';
  const buttonEls: HTMLElement[] = [];
  for (const b of BUTTONS) {
    const el = document.createElement('div');
    el.className = `t ${b.cls}`;
    el.textContent = b.label;
    el.dataset.action = b.action;
    root.appendChild(el);
    buttonEls.push(el);
  }
  // Fullscreen where the browser allows it (not iPhone Safari).
  const docEl = document.documentElement;
  if (docEl.requestFullscreen) {
    const full = document.createElement('div');
    full.className = 't small full';
    full.textContent = 'FULL';
    full.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (document.fullscreenElement) void document.exitFullscreen();
      else {
        void docEl.requestFullscreen().then(() => {
          const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
          return o.lock?.('landscape');
        }).catch(() => undefined);
      }
    });
    root.appendChild(full);
  }
  document.body.appendChild(root);

  const enable = (on: boolean): void => {
    if (enabled === on) return;
    enabled = on;
    root.classList.toggle('on', on);
    document.body.classList.toggle('touch', on);
    if (!on) touch.releaseAll();
    requestAnimationFrame(onLayout); // re-fit the game around the controls
  };

  const padPointers = new Set<number>();
  const refresh = (): void => {
    for (const d of Object.keys(arrows) as Dir[]) arrows[d].classList.toggle('on', touch.isHeld(d));
    for (const el of buttonEls) el.classList.toggle('down', touch.isHeld(el.dataset.action as TouchButton));
    fpsFire.classList.toggle('down', touch.isHeld('fire'));
    fpsWpn.classList.toggle('down', touch.isHeld('jump'));
  };

  // Arena fingers: the stick thumb (where it landed), and fingers that look (the right half, FIRE).
  const STICK_R = 50;
  let stickId = -1;
  let stickO = { x: 0, y: 0 };
  const lookers = new Map<number, number>(); // pointer -> last x
  const placeStick = (x: number | null, y = 0, kx = 0, ky = 0): void => {
    const live = x !== null;
    stick.classList.toggle('live', live);
    if (live) {
      Object.assign(stick.style, { left: `${x}px`, top: `${y}px`, bottom: 'auto' });
    } else stick.removeAttribute('style');
    knob.style.transform = `translate(${kx}px, ${ky}px)`;
  };
  const trackStick = (e: PointerEvent): void => {
    let dx = e.clientX - stickO.x;
    let dy = e.clientY - stickO.y;
    // Past the rim, the stick follows the thumb.
    const len = Math.hypot(dx, dy);
    if (len > STICK_R * 1.4) {
      stickO = { x: e.clientX - (dx / len) * STICK_R * 1.4, y: e.clientY - (dy / len) * STICK_R * 1.4 };
      dx = e.clientX - stickO.x;
      dy = e.clientY - stickO.y;
    }
    const a = stickAxes(dx, dy, STICK_R);
    touch.stick = { x: a.x, y: a.y, on: true };
    // Clear pushes also count as d-pad presses (menus: choose the arena, and so on).
    touch.setPointer(e.pointerId, dpadDirs(a.x, a.y, 1.6));
    const k = Math.min(1, STICK_R / Math.max(1, Math.hypot(dx, dy)));
    placeStick(stickO.x, stickO.y, dx * k, dy * k);
  };

  const track = (e: PointerEvent): void => {
    if (e.pointerId === stickId) trackStick(e);
    else if (lookers.has(e.pointerId)) {
      touch.addLook(e.clientX - lookers.get(e.pointerId)!);
      lookers.set(e.pointerId, e.clientX);
    } else if (padPointers.has(e.pointerId)) {
      const r = pad.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      touch.setPointer(e.pointerId, dpadDirs(dx, dy, r.width / 2));
    } else {
      // Buttons: whatever is under the finger, so you can slide JUMP → FIRE.
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const a = el?.dataset.action as TouchButton | undefined;
      touch.setPointer(e.pointerId, a ? [a] : []);
    }
    refresh();
  };

  let first = true;
  root.addEventListener('pointerdown', (e) => {
    if (e.target === root) return;
    e.preventDefault();
    if (first) {
      first = false;
      onFirstTouch();
    }
    if (e.target === pad || pad.contains(e.target as Node)) padPointers.add(e.pointerId);
    if (mode === 'fps') {
      if (e.target === leftZone) {
        stickId = e.pointerId;
        stickO = { x: e.clientX, y: e.clientY };
        trackStick(e);
        refresh();
        return;
      }
      if (e.target === rightZone || e.target === fpsFire) {
        lookers.set(e.pointerId, e.clientX);
        touch.setPointer(e.pointerId, e.target === fpsFire ? ['fire'] : []);
        refresh();
        return;
      }
      if (e.target === fpsWpn) {
        touch.setPointer(e.pointerId, ['jump']);
        refresh();
        return;
      }
    }
    // Release implicit capture so a sliding finger can reach other buttons.
    const target = e.target as HTMLElement;
    try {
      if (target.hasPointerCapture?.(e.pointerId)) target.releasePointerCapture(e.pointerId);
    } catch {
      // Not captured; nothing to release.
    }
    track(e);
  });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' && enabled) track(e);
  });
  const end = (e: PointerEvent): void => {
    padPointers.delete(e.pointerId);
    lookers.delete(e.pointerId);
    if (e.pointerId === stickId) {
      stickId = -1;
      touch.stick = { x: 0, y: 0, on: false };
      placeStick(null);
    }
    touch.release(e.pointerId);
    refresh();
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  modeHook = () => {
    root.classList.toggle('arena', mode === 'fps');
    padPointers.clear();
    lookers.clear();
    stickId = -1;
    placeStick(null);
    refresh();
  };
  modeHook();
  window.addEventListener('blur', () => {
    touch.releaseAll();
    lookers.clear();
    stickId = -1;
    placeStick(null);
    refresh();
  });
  root.addEventListener('contextmenu', (e) => e.preventDefault());

  // Rotating the phone switches between the side-by-side and stacked layouts.
  window.addEventListener('orientationchange', () => setTimeout(onLayout, 150));

  // Show on any touch; hide when a physical key is used.
  window.addEventListener('touchstart', () => enable(true), { passive: true, capture: true });
  window.addEventListener('keydown', () => enable(false), true);
  if (window.matchMedia?.('(pointer: coarse)').matches) enable(true);
}
