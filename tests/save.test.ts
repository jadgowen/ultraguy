import { describe, expect, it } from 'vitest';
import { MAX_TANKS, clearSave, exUnlocked, loadSave, recordClear, recordExClear, recordPart, setTanks, slotKey, slotUsed } from '../src/save';
import { updateSettings } from '../src/settings';

const useSlot = (slot: number) =>
  updateSettings((s) => {
    s.slot = slot;
  });

describe('save data', () => {
  it('starts fresh: just the Ultra Gun, nothing cleared', () => {
    expect(loadSave()).toEqual({ weapons: ['buster'], cleared: [], tanks: 0, parts: [], exCleared: [] });
  });

  it('records cleared stages and weapons once, in weapon order', () => {
    expect(recordClear('canopy', 'thorn')).toBe(true);
    expect(recordClear('foundry', 'quake')).toBe(true);
    expect(recordClear('canopy', 'thorn')).toBe(false);
    const s = loadSave();
    expect(s.weapons).toEqual(['buster', 'quake', 'thorn']);
    expect(s.cleared).toEqual(['canopy', 'foundry']);
  });

  it('keeps energy tanks between 0 and the maximum', () => {
    setTanks(99);
    expect(loadSave().tanks).toBe(MAX_TANKS);
    setTanks(-3);
    expect(loadSave().tanks).toBe(0);
  });

  it('records parts in canonical order without duplicates', () => {
    recordPart('helmet');
    recordPart('boots');
    recordPart('helmet');
    expect(loadSave().parts).toEqual(['boots', 'helmet']);
  });

  it('survives corrupt or hand-edited data', () => {
    localStorage.setItem(slotKey(1), '{not json');
    expect(loadSave().weapons).toEqual(['buster']);
    localStorage.setItem(slotKey(1), JSON.stringify({ weapons: ['laser', 'frost'], cleared: ['moon', 'reef'], tanks: 'lots' }));
    const s = loadSave();
    expect(s.weapons).toEqual(['buster', 'frost']);
    expect(s.cleared).toEqual(['reef']);
    expect(s.tanks).toBe(0);
  });
});

describe('older saves', () => {
  it('get all four parts if they had beaten a boss', () => {
    localStorage.setItem(slotKey(1), JSON.stringify({ weapons: ['buster', 'quake'], cleared: ['intro', 'foundry'] }));
    expect(loadSave().parts).toEqual(['blaster', 'boots', 'armor', 'helmet']);
  });

  it('get no parts if they had only cleared the intro', () => {
    localStorage.setItem(slotKey(1), JSON.stringify({ weapons: ['buster'], cleared: ['intro'] }));
    expect(loadSave().parts).toEqual([]);
  });
});

describe('save slots', () => {
  it('slot 1 keeps the original storage key', () => {
    expect(slotKey(1)).toBe('ultraguy-save-v1');
    expect(slotKey(2)).not.toBe(slotKey(3));
  });

  it('keep progress separate per slot', () => {
    useSlot(1);
    recordClear('reef', 'bubble');
    useSlot(2);
    expect(loadSave().cleared).toEqual([]);
    recordClear('glacier', 'frost');
    expect(loadSave(1).cleared).toEqual(['reef']);
    expect(loadSave(2).cleared).toEqual(['glacier']);
    expect(slotUsed(3)).toBe(false);
  });

  it('erasing one slot leaves the others alone', () => {
    useSlot(1);
    recordClear('reef');
    useSlot(2);
    recordClear('glacier');
    clearSave(1);
    expect(slotUsed(1)).toBe(false);
    expect(loadSave(1).cleared).toEqual([]);
    expect(loadSave(2).cleared).toEqual(['glacier']);
  });

  it('records EX clears and unlocks EX after the finale', () => {
    useSlot(1);
    expect(exUnlocked()).toBe(false);
    recordClear('finale');
    expect(exUnlocked()).toBe(true);
    recordExClear('reef');
    recordExClear('reef');
    expect(loadSave().exCleared).toEqual(['reef']);
  });
});
