import { CANOPY } from './canopy';
import { FOUNDRY } from './foundry';
import { GLACIER } from './glacier';
import type { StageData, StageId } from './Level';
import { STRATOS } from './stratos';

export const STAGES: Record<StageId, StageData> = {
  foundry: FOUNDRY,
  canopy: CANOPY,
  glacier: GLACIER,
  stratos: STRATOS,
};

/** Boss select layout: up, left, right, down around the hero. */
export const STAGE_SELECT_ORDER: StageId[] = ['foundry', 'canopy', 'glacier', 'stratos'];
