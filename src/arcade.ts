import type { StageId } from './level/Level';

/**
 * The ARCADE (title menu): every boss's own game, replayable once you've won
 * it in the story. Listed in boss-select order, then the fortress's.
 */
export interface ArcadeGame {
  /** Scene key of the game. */
  scene: string;
  title: string;
  /** Whose game it is. */
  host: string;
  /** The stage it belongs to (what the game is started with, for its look and music). */
  stage: StageId;
  /**
   * Saves from before wins were recorded: having cleared any of these stages
   * means you must have won it (the old Boss Hall made you beat all eight).
   */
  seed: StageId[];
}

const HALL: StageId[] = ['gauntlet', 'finale'];

export const ARCADE_GAMES: ArcadeGame[] = [
  { scene: 'breaker', title: 'BRICK BREAKER', host: 'ANVIL', stage: 'foundry', seed: ['foundry', ...HALL] },
  { scene: 'hop', title: 'LILY PADS', host: 'MANTIS', stage: 'canopy', seed: ['canopy', ...HALL] },
  { scene: 'hockey', title: 'FACE OFF', host: 'FROSTLINE', stage: 'glacier', seed: ['glacier', ...HALL] },
  { scene: 'skies', title: 'HIGH SKIES', host: 'GALE', stage: 'stratos', seed: ['stratos', ...HALL] },
  { scene: 'race', title: 'RACE DAY', host: 'VOLT', stage: 'powerplant', seed: ['powerplant', ...HALL] },
  { scene: 'bomb', title: 'SHORT FUSE', host: 'MAGMA', stage: 'caldera', seed: ['caldera', ...HALL] },
  { scene: 'dungeon', title: 'JUNK MAZE', host: 'SCRAP', stage: 'scrapyard', seed: ['scrapyard', ...HALL] },
  { scene: 'trench', title: 'TRENCH DESCENT', host: 'TIDE', stage: 'reef', seed: ['reef', ...HALL] },
  { scene: 'boxing', title: 'TITLE BOUT', host: 'GATEKEEPER', stage: 'fortress1', seed: ['fortress1', 'finale'] },
  // The Overlord's armada: yours once you've beaten the game.
  { scene: 'shooter', title: 'DOGFIGHT', host: 'OVERLORD', stage: 'finale', seed: ['finale'] },
];

/** Games this save has unlocked: won in the story (the Overlord's armada comes with the ending). */
export function arcadeUnlocked(save: { arcade: string[]; cleared: StageId[] }): Set<string> {
  const have = new Set(save.arcade);
  if (save.cleared.includes('finale')) have.add('shooter');
  return have;
}
