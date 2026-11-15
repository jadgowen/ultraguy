/**
 * Player settings, shared by all save slots: volume mixer, key bindings and
 * which save slot is active. Kept free of Phaser so it can be unit tested.
 */

export type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'fire' | 'start' | 'prev' | 'next';

export const ACTIONS: Action[] = ['left', 'right', 'up', 'down', 'jump', 'fire', 'start', 'prev', 'next'];

/** What each action is called on the controls screen. */
export const ACTION_LABELS: Record<Action, string> = {
  left: 'LEFT',
  right: 'RIGHT',
  up: 'UP / CLIMB',
  down: 'DOWN',
  jump: 'JUMP',
  fire: 'FIRE / CHARGE',
  start: 'PAUSE / CONFIRM',
  prev: 'PREV WEAPON',
  next: 'NEXT WEAPON',
};

/** Browser key codes (same values as Phaser.Input.Keyboard.KeyCodes). */
export const KEY = {
  BACKSPACE: 8,
  ENTER: 13,
  ESC: 27,
  SPACE: 32,
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  A: 65,
  D: 68,
  E: 69,
  J: 74,
  K: 75,
  P: 80,
  Q: 81,
  S: 83,
  W: 87,
  X: 88,
  Z: 90,
} as const;

export const DEFAULT_KEYS: Record<Action, number[]> = {
  left: [KEY.LEFT, KEY.A],
  right: [KEY.RIGHT, KEY.D],
  up: [KEY.UP, KEY.W],
  down: [KEY.DOWN, KEY.S],
  jump: [KEY.Z, KEY.SPACE, KEY.K],
  fire: [KEY.X, KEY.J],
  start: [KEY.ENTER, KEY.ESC, KEY.P],
  prev: [KEY.Q],
  next: [KEY.E],
};

/** Keys that can't be bound: ESC cancels a rebind, Backspace is "back" in menus. */
export const RESERVED_KEYS: number[] = [KEY.ESC, KEY.BACKSPACE];

export const VOLUME_STEPS = 10;
export const SLOT_COUNT = 3;

export interface Settings {
  /** 0..VOLUME_STEPS */
  music: number;
  sfx: number;
  keys: Record<Action, number[]>;
  /** Active save slot, 1..SLOT_COUNT. */
  slot: number;
}

const KEY_NAME = 'ultraguy-settings-v1';

function defaults(): Settings {
  return { music: 8, sfx: 8, keys: cloneKeys(DEFAULT_KEYS), slot: 1 };
}

function cloneKeys(k: Record<Action, number[]>): Record<Action, number[]> {
  return Object.fromEntries(ACTIONS.map((a) => [a, [...k[a]]])) as Record<Action, number[]>;
}

const clampInt = (v: unknown, lo: number, hi: number, fallback: number): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

export function loadSettings(): Settings {
  const base = defaults();
  try {
    const raw = localStorage.getItem(KEY_NAME);
    if (!raw) return base;
    const data = JSON.parse(raw) as Partial<Settings>;
    const keys = cloneKeys(DEFAULT_KEYS);
    for (const a of ACTIONS) {
      const list = data.keys?.[a];
      // Reserved keys are only allowed where they're a default (ESC pauses).
      if (Array.isArray(list)) keys[a] = list.filter((k) => Number.isInteger(k) && (!RESERVED_KEYS.includes(k) || DEFAULT_KEYS[a].includes(k)));
    }
    return {
      music: clampInt(data.music, 0, VOLUME_STEPS, base.music),
      sfx: clampInt(data.sfx, 0, VOLUME_STEPS, base.sfx),
      keys,
      slot: clampInt(data.slot, 1, SLOT_COUNT, 1),
    };
  } catch {
    return base;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY_NAME, JSON.stringify(s));
  } catch {
    // Storage unavailable: settings last for this session only.
  }
}

/** Change settings in place and store them. */
export function updateSettings(change: (s: Settings) => void): Settings {
  const s = loadSettings();
  change(s);
  saveSettings(s);
  return s;
}

/**
 * Bind `code` as the main key for `action`. The action's other keys stay as
 * alternates; the key is taken away from any other action that had it.
 * Returns false for reserved keys.
 */
export function bindKey(keys: Record<Action, number[]>, action: Action, code: number): boolean {
  if (RESERVED_KEYS.includes(code)) return false;
  for (const a of ACTIONS) keys[a] = keys[a].filter((k) => k !== code);
  keys[action] = [code, ...keys[action]];
  return true;
}

export function resetKeys(s: Settings): void {
  s.keys = cloneKeys(DEFAULT_KEYS);
}

/** Volume 0..1 for a mixer level. */
export function volumeOf(level: number): number {
  return Math.min(VOLUME_STEPS, Math.max(0, level)) / VOLUME_STEPS;
}
