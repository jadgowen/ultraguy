import { describe, expect, it } from 'vitest';
import { BASE_MAX, HELMET_MAX, PARTS, PART_ORDER, armoredDamage } from '../src/parts';

describe('armor parts', () => {
  it('armor takes a quarter off, but every hit still hurts', () => {
    expect(armoredDamage(4)).toBe(3);
    expect(armoredDamage(8)).toBe(6);
    expect(armoredDamage(2)).toBe(2); // 1.5 rounds up
    expect(armoredDamage(1)).toBe(1);
  });

  it('the helmet raises capacity', () => {
    expect(HELMET_MAX).toBeGreaterThan(BASE_MAX);
  });

  it('every part has a name and a description', () => {
    for (const id of PART_ORDER) {
      expect(PARTS[id].name.length).toBeGreaterThan(0);
      expect(PARTS[id].blurb.length).toBeGreaterThan(0);
    }
  });
});
