import { describe, expect, it } from 'vitest';
import { ALL_STAGE_IDS, Level, Tile } from '../src/level/Level';
import { ALL_BOSS_STAGES, BOSS_STAGES, FORTRESS_ORDER, STAGE_GRID, getStage } from '../src/level/stages';
import { PART_ORDER } from '../src/parts';
import { WEAPON_ORDER } from '../src/weapons';
import { reach } from './reach';

describe('every stage', () => {
  for (const id of ALL_STAGE_IDS) {
    const stage = getStage(id);

    it(`${id}: parses (15x16 screens, known characters)`, () => {
      expect(() => new Level(stage)).not.toThrow();
    });

    it(`${id}: the main path is reachable with no parts`, () => {
      const r = reach(stage);
      expect(r.ok, `stuck near column ${r.stuck?.c}, row ${r.stuck?.r}`).toBe(true);
    });

    it(`${id}: ends at a boss or a goal`, () => {
      const L = new Level(stage);
      if (stage.boss) {
        expect(L.boss).not.toBeNull();
      } else {
        expect(L.goal).not.toBeNull();
      }
      expect(L.checkpoints.length + 1).toBeGreaterThan(0);
    });
  }
});

describe('boss stages', () => {
  it('fill the 3x3 select grid around the hero', () => {
    expect(STAGE_GRID.filter(Boolean).sort()).toEqual([...ALL_BOSS_STAGES].sort());
    expect(STAGE_GRID[4]).toBeNull();
  });

  it('each give a different boss weapon, covering every special weapon', () => {
    const rewards = ALL_BOSS_STAGES.map((id) => BOSS_STAGES[id].bossWeapon);
    expect(new Set(rewards).size).toBe(ALL_BOSS_STAGES.length);
    expect([...rewards].sort()).toEqual(WEAPON_ORDER.filter((w) => w !== 'buster').sort());
  });

  for (const id of ALL_BOSS_STAGES) {
    const stage = BOSS_STAGES[id];
    it(`${id}: has a boss door, a miniboss, an energy tank and checkpoints`, () => {
      const L = new Level(stage);
      expect(L.doors.length).toBe(1);
      expect(stage.miniboss).toBeDefined();
      expect(L.miniboss).not.toBeNull();
      expect(L.tanks.length).toBeGreaterThanOrEqual(1);
      expect(L.checkpoints.length).toBeGreaterThanOrEqual(3);
      expect(L.bossTestStart).not.toBeNull();
    });

    it(`${id}: the miniboss sits on a flat, safe floor`, () => {
      const L = new Level(stage);
      const m = L.miniboss!;
      const row = m.y / 16; // the floor row under the miniboss
      const col = Math.floor(m.x / 16);
      // The arena runs ~24 tiles left of the marker: no pits, spikes or lava.
      for (let c = col - 20; c <= col + 2; c++) {
        expect(L.isSolid(c, row), `floor at column ${c}`).toBe(true);
        expect(L.isSpike(c, row)).toBe(false);
        expect(L.isLava(c, row - 1)).toBe(false);
      }
    });
  }
});

describe('armor parts', () => {
  const holders = ALL_STAGE_IDS.map(getStage).filter((s) => s.upgrade);

  it('each part is hidden in exactly one stage', () => {
    expect(holders.map((s) => s.upgrade).sort()).toEqual([...PART_ORDER].sort());
    for (const s of holders) expect(new Level(s).upgrade).not.toBeNull();
  });

  // What each part should need to reach: [nothing, boots, flame].
  const NEEDS = {
    blaster: { nothing: true, boots: true, flame: true },
    boots: { nothing: true, boots: true, flame: true },
    armor: { nothing: false, boots: true, flame: false },
    helmet: { nothing: false, boots: false, flame: true },
  } as const;

  for (const s of holders) {
    const part = s.upgrade!;
    it(`${part} (${s.id}) needs exactly what it should`, () => {
      expect(reach(s, { toUpgrade: true }).ok).toBe(NEEDS[part].nothing);
      expect(reach(s, { toUpgrade: true, boots: true }).ok).toBe(NEEDS[part].boots);
      expect(reach(s, { toUpgrade: true, flame: true }).ok).toBe(NEEDS[part].flame);
    });
  }

  it('frozen blocks only appear where they guard something', () => {
    const withMelt = ALL_STAGE_IDS.filter((id) => new Level(getStage(id)).findTiles(Tile.Melt).length);
    expect(withMelt).toEqual(['glacier']);
  });
});

describe('fortress', () => {
  it('plays the three stages, the boss hall, then the throne', () => {
    expect(FORTRESS_ORDER).toEqual(['fortress1', 'fortress2', 'fortress3', 'gauntlet', 'finale']);
  });

  it('the boss hall has one teleporter per stage boss and a hidden exit', () => {
    const L = new Level(getStage('gauntlet'));
    expect(L.teleporters.length).toBe(ALL_BOSS_STAGES.length);
    expect(L.goal).not.toBeNull();
    expect(L.boss).not.toBeNull();
  });

  it('each of the three fortress stages ends with its own guardian boss and no weapon', () => {
    const ids = ['fortress1', 'fortress2', 'fortress3'] as const;
    const kinds = ids.map((id) => getStage(id).boss);
    expect(kinds).toEqual(['gatekeeper', 'abyss', 'warden']);
    for (const id of ids) {
      const stage = getStage(id);
      const L = new Level(stage);
      expect(stage.bossWeapon).toBeUndefined();
      expect(L.boss).not.toBeNull();
      expect(L.goal).toBeNull();
      expect(L.bossTestStart).not.toBeNull();
    }
  });
});
