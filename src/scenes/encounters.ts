import Phaser from 'phaser';
import type { BossKind, StageId } from '../level/Level';
import type { PartId } from '../parts';
import { Line, pixelateOut } from './cutscene';
import { GUARDIANS } from './rpgGuardians';

/**
 * Encounters fought in another game style. Each starts with dialogue in the
 * stage, then the screen pixelates and that mode's scene takes over; when it
 * ends it returns to the stage with how it went (`Resume`).
 *
 *  - Boss Hall rematches (the capsules send some bosses into their own game),
 *  - minibosses,
 *  - guardians of hidden armor parts.
 */

export type EncounterKind = 'vault' | 'mini' | 'part';

export interface Encounter {
  /** Scene key of the mode. */
  scene: string;
  /** What's said before the warp. */
  lines: () => Line[];
}

/** Where a mode came from; sent back to the stage when it ends. */
export interface Ret {
  kind: EncounterKind;
  /** Boss Hall: which capsule this was. */
  step: number;
  /** Boss Hall: capsules already beaten before this one (so the hall remembers). */
  done?: number[];
}

export interface Resume extends Ret {
  won: boolean;
}

/** What every mode scene is started with. */
export interface ModeData {
  stage: StageId;
  ret: Ret;
}

/** End a mode: warp back to the stage with the result. */
export function returnToGame(scene: Phaser.Scene, data: ModeData, won: boolean): void {
  pixelateOut(scene, 800, () => scene.scene.start('game', { stage: data.stage, resume: { ...data.ret, won } }));
}

/**
 * Boss Hall rematches: stage bosses fight normally in their stages (where your
 * weapons and parts matter); in the Hall, these send you into their own game.
 */
export const VAULT_ENCOUNTERS: Partial<Record<BossKind, Encounter>> = {
  anvil: {
    scene: 'breaker',
    lines: () => [{ name: 'ANVIL', text: "You want a rematch? Then break through my forge wall. Every brick I lay, I lay twice as hard!", portrait: { key: 'anvil_idle' }, voice: 'anvil_challenge', color: 0xf28c28 }],
  },
  frostline: {
    scene: 'hockey',
    lines: () => [{ name: 'FROSTLINE', text: "No blasters on my ice. Puck, sticks, and nerves of steel. First to three takes it!", portrait: { key: 'frostline_idle' }, voice: 'frostline_challenge', color: 0x9ee8ff }],
  },
  scrap: {
    scene: 'puzzle',
    lines: () => [{ name: 'SCRAP', text: "Junk in, junk out, kid! Let's see who gets buried first!", portrait: { key: 'scrap_idle' }, voice: 'scrap_challenge', color: 0xc8ccd8 }],
  },
  gale: {
    scene: 'skies',
    lines: () => [{ name: 'GALE', text: "Up here, the wind decides who flies. Let's see if it decides for you!", portrait: { key: 'gale_idle' }, voice: 'gale_challenge', color: 0xa8e070 }],
  },
  tide: {
    scene: 'pinball',
    lines: () => [{ name: 'TIDE', text: "Welcome to my tide pool! Bounce, roll, and try not to wash out!", portrait: { key: 'tide_idle' }, voice: 'tide_challenge', color: 0x6ab8e8 }],
  },
  mantis: {
    scene: 'dungeon',
    lines: () => [{ name: 'MANTIS', text: "You found my thicket. Few find their way to its heart. Fewer leave.", portrait: { key: 'mantis_idle' }, voice: 'mantis_challenge', color: 0x6cc04a }],
  },
  volt: {
    scene: 'race',
    lines: () => [
      { name: 'VOLT', text: "Heh. You can't beat me in a fight... but maybe you can beat me in a race. Winner takes all!", portrait: { key: 'volt_idle' }, voice: 'volt_challenge', color: 0xf8e040 },
    ],
  },
  gatekeeper: {
    scene: 'boxing',
    lines: () => [{ name: 'GATEKEEPER', text: 'No weapons. No tricks. Just our hands.', portrait: { key: 'gatekeeper_idle' }, voice: 'gate_challenge', color: 0x8c4ad8 }],
  },
  magma: {
    scene: 'bomb',
    lines: () => [
      { name: 'MAGMA', text: "Too hot to handle, little bot? Then let's settle this the old way. Bombs, bricks, and nowhere to run!", portrait: { key: 'magma_idle' }, voice: 'magma_challenge', color: 0xff7a2a },
    ],
  },
  overlord: {
    scene: 'shooter',
    lines: () => [{ name: 'OVERLORD', text: 'Pathetic machine. My armada will blot you from the sky!', portrait: { key: 'overlord_idle' }, voice: 'overlord_challenge', color: 0xff5050 }],
  },
};

export const MINI_ENCOUNTERS: Partial<Record<StageId, Encounter>> = {
  canopy: {
    scene: 'hop',
    lines: () => [
        { name: 'BRIAR TOAD', text: 'Ribbit! You want past me? Hop across my thicket first, tin can. Fill all three lily pads before the time runs out!', portrait: { key: 'toad_idle' }, voice: 'toad_challenge', color: 0x5ab84a },
    ],
  },
};

/** Every hidden part has a guardian, fought in a turn-based RPG battle (see rpgGuardians.ts). */
export const PART_GUARDIANS: Partial<Record<PartId, Encounter>> = Object.fromEntries(
  Object.values(GUARDIANS).map((g) => [
    g.part,
    { scene: 'rpg', lines: () => [{ name: g.name, text: g.challenge, portrait: { key: g.sprite }, voice: `${g.id}_challenge`, color: g.color }] },
  ]),
);
