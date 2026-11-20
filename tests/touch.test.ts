import { describe, expect, it } from 'vitest';
import { TouchState, dpadDirs, stickAxes } from '../src/touch';

describe('dpadDirs', () => {
  it('ignores the dead zone in the middle', () => {
    expect(dpadDirs(5, 5, 75)).toEqual([]);
  });
  it('reads straight directions with some slop', () => {
    expect(dpadDirs(60, 0, 75)).toEqual(['right']);
    expect(dpadDirs(-60, 20, 75)).toEqual(['left']);
    expect(dpadDirs(10, -60, 75)).toEqual(['up']);
    expect(dpadDirs(0, 60, 75)).toEqual(['down']);
  });
  it('presses two directions on a clear diagonal', () => {
    expect(dpadDirs(50, -50, 75)).toEqual(['right', 'up']);
  });
});

describe('TouchState', () => {
  it('combines fingers and latches new presses', () => {
    const t = new TouchState();
    t.setPointer(1, ['right']);
    t.setPointer(2, ['jump']);
    expect(t.heldActions().sort()).toEqual(['jump', 'right']);
    expect(t.takeLatched().sort()).toEqual(['jump', 'right']);
    expect(t.takeLatched()).toEqual([]);
    t.release(2);
    expect(t.heldActions()).toEqual(['right']);
  });
  it('keeps a tap that ends before the next poll', () => {
    const t = new TouchState();
    t.setPointer(1, ['fire']);
    t.release(1);
    expect(t.heldActions()).toEqual([]);
    expect(t.takeLatched()).toEqual(['fire']);
  });
  it('sliding between buttons presses the new one', () => {
    const t = new TouchState();
    t.setPointer(1, ['jump']);
    t.takeLatched();
    t.setPointer(1, ['fire']);
    expect(t.heldActions()).toEqual(['fire']);
    expect(t.takeLatched()).toEqual(['fire']);
  });
  it('BACK fires once and is not a game action', () => {
    const t = new TouchState();
    t.setPointer(1, ['back']);
    expect(t.heldActions()).toEqual([]);
    expect(t.takeLatched()).toEqual([]);
    expect(t.takeBack()).toBe(true);
    expect(t.takeBack()).toBe(false);
  });
});

describe('stickAxes', () => {
  it('ignores a tiny wobble where the thumb landed', () => {
    expect(stickAxes(3, -2, 50)).toEqual({ x: 0, y: 0 });
  });
  it('scales with the push and caps at the rim', () => {
    const half = stickAxes(25, 0, 50);
    expect(half.x).toBeCloseTo(0.5);
    const far = stickAxes(0, -200, 50);
    expect(far.y).toBeCloseTo(-1);
    const diag = stickAxes(100, 100, 50);
    expect(Math.hypot(diag.x, diag.y)).toBeCloseTo(1);
  });
});

describe('TouchState look', () => {
  it('hands back the drag once, then resets', () => {
    const t = new TouchState();
    t.addLook(12);
    t.addLook(-4);
    expect(t.takeLook()).toBe(8);
    expect(t.takeLook()).toBe(0);
  });
});
