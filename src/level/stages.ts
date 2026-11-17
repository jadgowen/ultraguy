import { CALDERA } from './caldera';
import { CANOPY } from './canopy';
import { DOJO } from './dojo';
import { FINALE, FORTRESS_1, FORTRESS_2, FORTRESS_3, GAUNTLET } from './fortress';
import { FOUNDRY } from './foundry';
import { GLACIER } from './glacier';
import { INTRO } from './intro';
import type { BossStageId, FortressStageId, StageData, StageId } from './Level';
import { POWERPLANT } from './powerplant';
import { REEF } from './reef';
import { SCRAPYARD } from './scrapyard';
import { STRATOS } from './stratos';

export const BOSS_STAGES: Record<BossStageId, StageData> = {
  foundry: FOUNDRY,
  canopy: CANOPY,
  glacier: GLACIER,
  stratos: STRATOS,
  powerplant: POWERPLANT,
  caldera: CALDERA,
  scrapyard: SCRAPYARD,
  reef: REEF,
};

export const FORTRESS_STAGES: Record<FortressStageId, StageData> = {
  fortress1: FORTRESS_1,
  fortress2: FORTRESS_2,
  fortress3: FORTRESS_3,
  gauntlet: GAUNTLET,
  finale: FINALE,
};

/** Fortress stages in play order. */
export const FORTRESS_ORDER: FortressStageId[] = ['fortress1', 'fortress2', 'fortress3', 'gauntlet', 'finale'];

const OTHER_STAGES: Partial<Record<StageId, StageData>> = { ...FORTRESS_STAGES, intro: INTRO, dojo: DOJO };

export function hasStage(id: StageId): boolean {
  return id in BOSS_STAGES || id in OTHER_STAGES;
}

export function getStage(id: StageId): StageData {
  const s = (BOSS_STAGES as Partial<Record<StageId, StageData>>)[id] ?? OTHER_STAGES[id];
  if (!s) throw new Error(`Unknown stage "${id}"`);
  return s;
}

/**
 * Boss select grid (3x3, row by row); null is the hero in the middle.
 */
export const STAGE_GRID: (BossStageId | null)[] = [
  'foundry', 'canopy', 'glacier',
  'stratos', null, 'powerplant',
  'caldera', 'scrapyard', 'reef',
];

export const ALL_BOSS_STAGES = Object.keys(BOSS_STAGES) as BossStageId[];
