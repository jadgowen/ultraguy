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

  it("each have the boss's challenge room past the midpoint, with a checkpoint just before it", () => {
    for (const id of ALL_BOSS_STAGES) {
      const L = new Level(BOSS_STAGES[id]);
      const at = L.challenge;
      expect(at, id).not.toBeNull();
      const sec = L.sectionAt(at!.x, at!.y - 1)!;
      // The checkpoint in the room's first screen, in the same section, just before the boss.
      expect(L.checkpoints.some((c) => c.x < at!.x && at!.x - c.x < 512 && L.sectionAt(c.x, c.y - 1) === sec), id).toBe(true);
      // Before the boss door, after the miniboss (where there is one).
      expect(at!.x, id).toBeLessThan(L.boss!.x);
      if (L.miniboss && L.sectionAt(L.miniboss.x, L.miniboss.y - 1) === sec) expect(at!.x, id).toBeGreaterThan(L.miniboss.x);
    }
  });

  it('each give a different boss weapon, covering every special weapon', () => {
    const rewards = ALL_BOSS_STAGES.map((id) => BOSS_STAGES[id].bossWeapon);
    expect(new Set(rewards).size).toBe(ALL_BOSS_STAGES.length);
    expect([...rewards].sort()).toEqual(WEAPON_ORDER.filter((w) => w !== 'buster').sort());
  });

  for (const id of ALL_BOSS_STAGES) {
    const stage = BOSS_STAGES[id];
    it(`${id}: has a hallway and a boss door, a midpoint (miniboss or set piece), an energy tank and checkpoints`, () => {
      const L = new Level(stage);
      // Two doors: into the hallway before the boss, and the boss door at its end.
      expect(L.doors.length).toBe(2);
      expect(stage.layout.some((row) => row.includes('|56|XY')), 'hallway before the boss room').toBe(true);
      // A miniboss, or a set piece in its place.
      const MIDPOINT: Record<string, () => boolean> = {
        canopy: () => !!stage.rise, // the great climb
        powerplant: () => L.generators.length === 3 && L.shutters.length > 0, // blackout
        caldera: () => L.elevator !== null, // magma elevator
        scrapyard: () => !!stage.compactor, // compactor escape
      };
      if (MIDPOINT[id]) expect(MIDPOINT[id](), 'set piece').toBe(true);
      else expect(L.miniboss).not.toBeNull();
      expect(L.tanks.length).toBeGreaterThanOrEqual(1);
      expect(L.checkpoints.length).toBeGreaterThanOrEqual(3);
      expect(L.bossTestStart).not.toBeNull();
    });

    // (The Storm Kite fights over open sky: no floor there on purpose.)
    it.skipIf(!stage.miniboss || id === 'stratos')(`${id}: the miniboss sits on a flat, safe floor`, () => {
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

  it('the boss hall has one teleporter per stage boss, two bonus ones, and a hidden exit', () => {
    const L = new Level(getStage('gauntlet'));
    expect(L.teleporters.length).toBe(ALL_BOSS_STAGES.length + 2);
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

describe('sky mechanics', () => {
  const L = new Level(getStage('stratos'));

  it('Stratos has horizontal and vertical moving clouds with real tracks', () => {
    const horizontal = L.movers.filter((m) => m.y0 === m.y1);
    const vertical = L.movers.filter((m) => m.x0 === m.x1);
    expect(horizontal.length).toBeGreaterThanOrEqual(3);
    expect(vertical.length).toBeGreaterThanOrEqual(1);
    for (const m of L.movers) expect(Math.hypot(m.x1 - m.x0, m.y1 - m.y0)).toBeGreaterThanOrEqual(32);
  });

  it('a moving-cloud track can run across two screens', () => {
    // A's cloud ends in B: its far end is past A's right edge.
    const first = L.movers.find((m) => m.y0 === m.y1 && m.x0 < 256)!;
    expect(first.x1).toBeGreaterThan(256);
  });

  it('wind blows only on the screens that name it', () => {
    expect(getStage('stratos').wind?.screens).toBe('DEFLMN23');
    expect(L.screenIdAt(3 * 256 + 10, 3 * 240 + 10)).toBe('D');
    expect(L.screenIdAt(0, 0)).toBe('');
  });

  it('the climb needs its updrafts', () => {
    const stage = getStage('stratos');
    const still = { ...stage, screens: { ...stage.screens, W: stage.screens.W.map((r) => r.replace(/y/g, '.')) } };
    expect(reach(still).ok).toBe(false);
  });
});

describe('each boss stage is built around its own mechanic', () => {
  const has = (id: Parameters<typeof getStage>[0], t: Tile) => new Level(getStage(id)).findTiles(t).length > 0;
  it('Foundry: crushers and a lift', () => {
    const L = new Level(getStage('foundry'));
    expect(L.crushers.length).toBeGreaterThanOrEqual(8);
    expect(L.movers.some((m) => m.x0 === m.x1)).toBe(true);
  });
  it('Canopy: bounce flowers and breaking branches', () => {
    expect(new Level(getStage('canopy')).findTiles(Tile.Spring).length).toBeGreaterThanOrEqual(6);
    expect(has('canopy', Tile.Crumble)).toBe(true);
  });
  it('Glacier: cracking ice and snowball chutes', () => {
    expect(new Level(getStage('glacier')).findTiles(Tile.Crumble).length).toBeGreaterThanOrEqual(20);
    expect(new Level(getStage('glacier')).rollers.length).toBeGreaterThanOrEqual(2);
  });
  it('Power Plant: switch blocks and dark rooms', () => {
    expect(has('powerplant', Tile.SwitchA) && has('powerplant', Tile.SwitchB)).toBe(true);
    expect(getStage('powerplant').dark?.length).toBeGreaterThanOrEqual(3);
  });
  it('Caldera: rising lava through a climb', () => {
    expect(getStage('caldera').rise?.screens).toBe('DE');
  });
  it('Scrapyard: barrel chutes, presses and cranes', () => {
    const L = new Level(getStage('scrapyard'));
    expect(L.rollers.length).toBeGreaterThanOrEqual(3);
    expect(L.crushers.length).toBeGreaterThanOrEqual(5);
    expect(L.movers.length).toBeGreaterThanOrEqual(3);
  });
  it('Reef: currents both ways and bubble columns', () => {
    expect(has('reef', Tile.CurrentL) && has('reef', Tile.CurrentR) && has('reef', Tile.Updraft)).toBe(true);
  });
});
