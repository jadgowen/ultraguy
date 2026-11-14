// Fixed internal resolution (NES-like). Scaled up by integer factors in main.ts.
export const VIEW_W = 256;
export const VIEW_H = 240;

export const TILE = 16;
export const SCREEN_COLS = VIEW_W / TILE; // 16
export const SCREEN_ROWS = VIEW_H / TILE; // 15

// One simulation step = 1/60 s. All speeds below are in pixels per step.
export const STEP_MS = 1000 / 60;

export const PHYS = {
  run: 1.375, // instant full speed, instant stop: no acceleration
  jump: 5.0, // initial upward speed (~3 tiles of height)
  gravity: 0.25,
  maxFall: 7,
  climb: 0.75,
  bulletSpeed: 4,
  maxBullets: 3,
  hurtFrames: 24, // loss of control after a hit
  invulnFrames: 90, // flashing invincibility after a hit
  knockback: 0.6,
};

export const PLAYER_MAX_HP = 28;
