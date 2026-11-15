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
