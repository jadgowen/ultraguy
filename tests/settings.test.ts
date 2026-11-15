import { describe, expect, it } from 'vitest';
import { ACTIONS, DEFAULT_KEYS, KEY, VOLUME_STEPS, bindKey, loadSettings, resetKeys, saveSettings, updateSettings, volumeOf } from '../src/settings';

describe('settings', () => {
  it('defaults: both volumes up, default keys, slot 1', () => {
    const s = loadSettings();
    expect(s.slot).toBe(1);
    expect(s.music).toBeGreaterThan(0);
    expect(s.sfx).toBeGreaterThan(0);
    expect(s.keys).toEqual(DEFAULT_KEYS);
  });

  it('default keys never share a key between two actions', () => {
    const all = ACTIONS.flatMap((a) => DEFAULT_KEYS[a]);
    expect(new Set(all).size).toBe(all.length);
  });

  it('persists and clamps mixer levels and slot', () => {
    updateSettings((s) => {
      s.music = 3;
      s.sfx = 0;
    });
    expect(loadSettings().music).toBe(3);
    expect(loadSettings().sfx).toBe(0);
    localStorage.setItem('ultraguy-settings-v1', JSON.stringify({ music: 99, sfx: -4, slot: 7 }));
    const s = loadSettings();
    expect(s.music).toBe(VOLUME_STEPS);
    expect(s.sfx).toBe(0);
    expect(s.slot).toBe(3);
  });

  it('maps mixer levels to 0..1', () => {
    expect(volumeOf(0)).toBe(0);
    expect(volumeOf(VOLUME_STEPS)).toBe(1);
    expect(volumeOf(5)).toBeCloseTo(0.5);
  });

  it('falls back to defaults on corrupt data', () => {
    localStorage.setItem('ultraguy-settings-v1', '{oops');
    expect(loadSettings().keys).toEqual(DEFAULT_KEYS);
  });
});

describe('key remapping', () => {
  it('makes the new key the main one and keeps alternates', () => {
    const s = loadSettings();
    expect(bindKey(s.keys, 'jump', KEY.D)).toBe(true);
    expect(s.keys.jump[0]).toBe(KEY.D);
    expect(s.keys.jump).toContain(KEY.Z);
  });

  it('takes the key away from whichever action had it', () => {
    const s = loadSettings();
    bindKey(s.keys, 'fire', KEY.Z); // Z was jump's
    expect(s.keys.fire[0]).toBe(KEY.Z);
    expect(s.keys.jump).not.toContain(KEY.Z);
    const all = ACTIONS.flatMap((a) => s.keys[a]);
    expect(new Set(all).size).toBe(all.length);
  });

  it('refuses ESC and Backspace', () => {
    const s = loadSettings();
    expect(bindKey(s.keys, 'jump', KEY.ESC)).toBe(false);
    expect(bindKey(s.keys, 'jump', KEY.BACKSPACE)).toBe(false);
    expect(s.keys.jump).toEqual(DEFAULT_KEYS.jump);
  });

  it('saves, reloads and resets bindings', () => {
    const s = loadSettings();
    bindKey(s.keys, 'next', KEY.P);
    saveSettings(s);
    expect(loadSettings().keys.next[0]).toBe(KEY.P);
    expect(loadSettings().keys.start).not.toContain(KEY.P);
    updateSettings(resetKeys);
    expect(loadSettings().keys).toEqual(DEFAULT_KEYS);
  });

  it('drops reserved keys smuggled into storage, but keeps ESC for pause', () => {
    localStorage.setItem('ultraguy-settings-v1', JSON.stringify({ keys: { jump: [KEY.BACKSPACE, KEY.Z], start: [KEY.ESC] } }));
    const s = loadSettings();
    expect(s.keys.jump).toEqual([KEY.Z]);
    expect(s.keys.start).toEqual([KEY.ESC]);
  });
});
