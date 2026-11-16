export const TILE = 16;

// Level "screens": the chunks stages are built from (16x15 tiles). Camera
// sections and vertical transitions are measured in these.
export const SCREEN_W = 256;
export const SCREEN_H = 240;
export const SCREEN_COLS = SCREEN_W / TILE; // 16
export const SCREEN_ROWS = SCREEN_H / TILE; // 15

// Internal render resolution: one screen tall, 16:9 wide (~26.7 tiles).
// Scaled to fill the window with nearest-neighbor filtering (main.ts).
export const VIEW_H = SCREEN_H;
export const VIEW_W = Math.round((VIEW_H * 16) / 9); // 427

// One simulation step = 1/60 s. All speeds below are in pixels per step.
export const STEP_MS = 1000 / 60;

export const PHYS = {
  run: 1.375, // instant full speed, instant stop: no acceleration
  // Slide (DOWN + JUMP, or double-tap a direction): fast and low, under shots and through 1-tile gaps.
  slide: 2.75,
  slideFrames: 26,
  slideHeight: 14,
  jump: 5.0, // initial upward speed (~3 tiles of height)
  gravity: 0.25,
  maxFall: 7,
  climb: 0.75,
  bulletSpeed: 4,
  maxBullets: 3,
  hurtFrames: 24, // loss of control after a hit
  invulnFrames: 90, // flashing invincibility after a hit
  knockback: 0.6,
  // Ice: speed changes by at most this much per step, so you slide.
  iceAccel: 0.035,
  // Ultra Gun charge: frames of holding fire for a half / full charge.
  chargeMid: 28,
  chargeFull: 72,
  // Water: floaty jumps, slow falls.
  waterGravity: 0.12,
  waterMaxFall: 2.5,
  waterJump: 4.3,
  // Conveyor belts push you this much per step while you stand on them.
  conveyor: 0.8,
  // Live electric barriers.
  electricDamage: 4,
  // Updrafts: extra upward pull per step, top rising speed, and the jump you get inside one.
  updraftLift: 0.55,
  updraftMax: 2.6,
  updraftJump: 4.2,
  // Wind gusts (Stratos): push per step in the air; on the ground it's scaled by gustGrip.
  gust: 0.8,
  gustGrip: 0.65,
  // Springs: launch speed (about 4.5 tiles high), or about 6.5 tiles if you hold jump.
  spring: 6.0,
  springHigh: 7.2,
  // Water currents push you this much per step.
  current: 0.9,
  /** Fastest you sink while a current is carrying you (hold DOWN to sink normally). */
  currentSink: 0.06,
  // Crushers: damage, and how long one waits at the top before it slams.
  crusherDamage: 6,
};

export const PLAYER_MAX_HP = 28;

/**
 * Testing shortcuts (boss test from boss select). On in the dev server
 * (`npm run dev`), off in builds, so the hosted game doesn't have them.
 */
export const DEV_TOOLS = import.meta.env.DEV;
