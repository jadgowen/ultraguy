// Sound effects. Each is synthesized with WebAudio, unless a generated sample
// with the same name was loaded (see src/audio.ts / art/audio.mjs), in which
// case the sample plays instead. Callers only use the names in `sfx`.

import { loadSettings, volumeOf } from './settings';

let ctx: AudioContext | null = null;

/** Sound-effect level from the mixer (0..1). */
let sfxLevel = volumeOf(loadSettings().sfx);

export function setSfxLevel(level: number): void {
  sfxLevel = level;
}

export function getSfxLevel(): number {
  return sfxLevel;
}

/** Browsers need a user gesture before audio plays; call from a key press. */
export function unlockAudio(): void {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
}

function tone(f0: number, f1: number, dur: number, type: OscillatorType = 'square', vol = 0.06): void {
  if (!ctx || sfxLevel <= 0) return;
  vol *= sfxLevel;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

function noise(dur: number, vol = 0.08): void {
  if (!ctx || sfxLevel <= 0) return;
  vol *= sfxLevel;
  const t = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  src.buffer = buf;
  gain.gain.value = vol;
  src.connect(gain).connect(ctx.destination);
  src.start(t);
}

const synth = {
  shoot: () => tone(1200, 500, 0.06),
  hit: () => tone(300, 120, 0.08),
  deflect: () => tone(2000, 1800, 0.05, 'triangle', 0.08),
  enemyDie: () => noise(0.2),
  hurt: () => tone(500, 80, 0.25, 'sawtooth', 0.07),
  die: () => {
    noise(0.5, 0.12);
    tone(400, 40, 0.6, 'square', 0.06);
  },
  land: () => tone(120, 60, 0.04, 'triangle', 0.05),
  pickup: () => tone(600, 1400, 0.12, 'square', 0.05),
  enemyShot: () => tone(700, 300, 0.05, 'triangle', 0.05),
  select: () => tone(900, 900, 0.05),
  quake: () => {
    noise(0.15, 0.08);
    tone(160, 60, 0.15, 'square', 0.06);
  },
  wind: () => noise(0.35, 0.05),
  charge: (level: number) => tone(level > 1 ? 900 : 500, level > 1 ? 1800 : 900, 0.12, 'triangle', 0.05),
  chargeShot: () => {
    tone(300, 1400, 0.12, 'sawtooth', 0.06);
    noise(0.1, 0.05);
  },
  freeze: () => tone(2400, 1200, 0.1, 'triangle', 0.06),
  thorn: () => tone(700, 1100, 0.06, 'triangle', 0.05),
  cyclone: () => noise(0.25, 0.06),
  weakHit: () => {
    tone(200, 80, 0.12, 'square', 0.08);
    noise(0.08, 0.06);
  },
  flame: () => {
    noise(0.18, 0.07);
    tone(220, 90, 0.15, 'sawtooth', 0.04);
  },
  bubble: () => tone(400, 900, 0.08, 'sine', 0.07),
  zap: () => tone(1800, 300, 0.12, 'sawtooth', 0.04),
  tick: () => tone(1500, 1500, 0.02, 'square', 0.03),
  clear: () => {
    tone(523, 523, 0.15);
    setTimeout(() => tone(659, 659, 0.15), 150);
    setTimeout(() => tone(784, 1046, 0.4), 300);
  },
  // Stage mechanics and events.
  crush: () => {
    noise(0.25, 0.1);
    tone(160, 50, 0.2, 'square', 0.07);
  },
  spring: () => tone(300, 1200, 0.18, 'triangle', 0.08),
  switchBlock: () => tone(1100, 1600, 0.05, 'square', 0.03),
  crumble: () => noise(0.18, 0.06),
  lavaRise: () => tone(90, 40, 1.0, 'sawtooth', 0.05),
  splash: () => noise(0.15, 0.05),
  chute: () => tone(140, 70, 0.1, 'triangle', 0.07),
  checkpoint: () => {
    tone(880, 880, 0.08, 'square', 0.04);
    setTimeout(() => tone(1320, 1320, 0.12, 'square', 0.04), 90);
  },
  door: () => tone(200, 80, 0.5, 'sawtooth', 0.04),
  ready: () => {
    tone(392, 392, 0.1);
    setTimeout(() => tone(523, 523, 0.1), 110);
    setTimeout(() => tone(659, 784, 0.25), 220);
  },
  jump: () => tone(400, 700, 0.06, 'square', 0.025),
  // Race and boxing modes.
  engine: () => tone(110, 130, 0.2, 'sawtooth', 0.02),
  rev: () => tone(120, 420, 0.4, 'sawtooth', 0.04),
  bikeCrash: () => {
    noise(0.5, 0.1);
    tone(300, 60, 0.4, 'square', 0.05);
  },
  bikeLand: () => tone(160, 70, 0.1, 'triangle', 0.06),
  overheat: () => noise(0.8, 0.05),
  crowd: () => noise(1.2, 0.03),
  bell: () => {
    tone(1600, 1600, 0.25, 'triangle', 0.06);
    setTimeout(() => tone(1600, 1600, 0.25, 'triangle', 0.06), 280);
  },
  punch: () => {
    noise(0.08, 0.1);
    tone(180, 80, 0.08, 'square', 0.06);
  },
  punchBlock: () => tone(220, 160, 0.06, 'triangle', 0.05),
  whoosh: () => noise(0.12, 0.04),
  bodyFall: () => {
    noise(0.3, 0.1);
    tone(90, 40, 0.3, 'triangle', 0.07);
  },
  starPunch: () => {
    tone(300, 1500, 0.3, 'square', 0.05);
    setTimeout(() => noise(0.3, 0.12), 300);
  },
  fuse: () => noise(0.25, 0.03),
  explode: () => {
    noise(0.45, 0.12);
    tone(140, 40, 0.35, 'square', 0.06);
  },
  laser: () => tone(1400, 600, 0.07, 'square', 0.03),
  alienDie: () => {
    noise(0.12, 0.07);
    tone(600, 120, 0.1, 'square', 0.04);
  },
  rpgHit: () => {
    noise(0.08, 0.08);
    tone(500, 200, 0.08, 'square', 0.05);
  },
  rpgSpell: () => {
    for (let i = 0; i < 5; i++) setTimeout(() => tone(800 + i * 200, 1200 + i * 200, 0.06, 'triangle', 0.04), i * 50);
  },
  victory: () => {
    tone(523, 523, 0.12);
    setTimeout(() => tone(659, 659, 0.12), 130);
    setTimeout(() => tone(784, 784, 0.12), 260);
    setTimeout(() => tone(1046, 1046, 0.4), 390);
  },
  glitch: () => {
    for (let i = 0; i < 6; i++) setTimeout(() => tone(200 + Math.random() * 1800, 100, 0.05, 'square', 0.03), i * 60);
  },
};

/** Plays a loaded sample by name; returns false if there isn't one. */
let samplePlayer: ((name: string) => boolean) | null = null;

export function setSamplePlayer(fn: (name: string) => boolean): void {
  samplePlayer = fn;
}

type Synth = typeof synth;

export const sfx = Object.fromEntries(
  Object.entries(synth).map(([name, play]) => [
    name,
    (...args: unknown[]) => {
      if (!samplePlayer?.(name)) (play as (...a: unknown[]) => void)(...args);
    },
  ]),
) as Synth;
