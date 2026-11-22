import Phaser from 'phaser';
import type { BossKind, StageId } from '../level/Level';
import type { PartId } from '../parts';
import { Line, pixelateOut } from './cutscene';
import { GUARDIANS } from './rpgGuardians';
import { recordArcadeWin } from '../save';

/**
 * Encounters fought in another game style. Each starts with dialogue in the
 * stage, then the screen pixelates and that mode's scene takes over; when it
 * ends it returns to the stage with how it went (`Resume`).
 *
 *  - stage bosses' own games, met two-thirds of the way through their stages,
 *  - the Boss Hall's bonus capsules (the Gatekeeper's boxing, the Overlord's armada),
 *  - minibosses,
 *  - guardians of hidden armor parts,
 *  - stage bosses fought only in their own game (the Gatekeeper's boxing match).
 */

/** Where a game was started from (`arcade`: the title menu's ARCADE, which it goes back to). */
export type EncounterKind = 'vault' | 'mini' | 'part' | 'boss' | 'challenge' | 'arcade';

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
  /** An EX rematch (so the stage comes back in EX mode). */
  ex?: boolean;
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
  if (data.ret.kind === 'arcade') {
    pixelateOut(scene, 800, () => scene.scene.start('arcade', { pick: scene.scene.key }));
    return;
  }
  // Won in the story: it's yours to replay in the ARCADE.
  if (won) recordArcadeWin(scene.scene.key);
  pixelateOut(scene, 800, () => scene.scene.start('game', { stage: data.stage, ex: data.ret.ex, resume: { ...data.ret, won } }));
}

/**
 * Each stage boss's own game. Two-thirds of the way through their stage they
 * wait in a room of their own ('A') and take you into it; you fight them for
 * real at the end of the stage (and again, harder, in the Boss Hall).
 */
export const BOSS_GAMES: Partial<Record<BossKind, Encounter>> = {
  anvil: {
    scene: 'breaker',
    lines: () => [{ name: 'ANVIL', text: "Think you can walk into my forge? Then break through my wall first. Every brick I lay, I lay twice as hard!", portrait: { key: 'anvil_idle' }, voice: 'anvil_challenge', color: 0xf28c28 }],
  },
  frostline: {
    scene: 'hockey',
    lines: () => [{ name: 'FROSTLINE', text: "No blasters on my ice. Puck, sticks, and nerves of steel. First to three takes it!", portrait: { key: 'frostline_idle' }, voice: 'frostline_challenge', color: 0x9ee8ff }],
  },
  scrap: {
    scene: 'dungeon',
    lines: () => [{ name: 'SCRAP', text: "Welcome to my junk maze, kid! Find the keys, find me... if you can!", portrait: { key: 'scrap_idle' }, voice: 'scrap_challenge', color: 0xc8ccd8 }],
  },
  gale: {
    scene: 'skies',
    lines: () => [{ name: 'GALE', text: "Up here, the wind decides who flies. Let's see if it decides for you!", portrait: { key: 'gale_idle' }, voice: 'gale_challenge', color: 0xa8e070 }],
  },
  tide: {
    scene: 'trench',
    lines: () => [{ name: 'TIDE', text: "Down in my trench, the light gives out long before the bottom. Dive, sweetie... if you dare.", portrait: { key: 'tide_idle' }, voice: 'tide_challenge', color: 0x6ab8e8 }],
  },
  mantis: {
    scene: 'hop',
    lines: () => [{ name: 'MANTIS', text: 'Cross my pond to reach me. Fill all three lily pads... and do not land where I wait.', portrait: { key: 'mantis_idle' }, voice: 'mantis_challenge', color: 0x6cc04a }],
  },
  volt: {
    scene: 'race',
    lines: () => [
      { name: 'VOLT', text: "Heh. Before you get anywhere near my generator, let's see how fast you really are. Race me. Winner takes all!", portrait: { key: 'volt_idle' }, voice: 'volt_challenge', color: 0xf8e040 },
    ],
  },
  magma: {
    scene: 'bomb',
    lines: () => [
      { name: 'MAGMA', text: "Too hot to handle, little bot? Then let's settle this the old way. Bombs, bricks, and nowhere to run!", portrait: { key: 'magma_idle' }, voice: 'magma_challenge', color: 0xff7a2a },
    ],
  },
};

/**
 * The Boss Hall's bonus capsules, which send you into their own game (the
 * eight stage bosses there are platform refights, a notch harder).
 */
export const VAULT_ENCOUNTERS: Partial<Record<BossKind, Encounter>> = {
  gatekeeper: {
    scene: 'boxing',
    lines: () => [{ name: 'GATEKEEPER', text: 'No weapons. No tricks. Just our hands.', portrait: { key: 'gatekeeper_idle' }, voice: 'gate_challenge', color: 0x8c4ad8 }],
  },
  overlord: {
    scene: 'shooter',
    lines: () => [{ name: 'OVERLORD', text: 'Pathetic machine. My armada will blot you from the sky!', portrait: { key: 'overlord_idle' }, voice: 'overlord_challenge', color: 0xff5050 }],
  },
};

/**
 * Stage bosses fought in their own game, in the stage itself as well as in the
 * Hall: walking into the room starts the dialogue and the warp.
 */
export const BOSS_ENCOUNTERS: Partial<Record<BossKind, Encounter>> = {
  gatekeeper: VAULT_ENCOUNTERS.gatekeeper,
};

/**
 * After a few losses to a boss's game, they let you choose: try again, or
 * push past (no bolts) and settle it at the end of the stage.
 */
export const CHALLENGE_MERCY = 2;

/** Bolts for beating a boss at their own game. */
export const CHALLENGE_BOLTS = 50;

/** Minibosses fought in another game style (none now: Briar Toad's crossing became Mantis's Boss Hall game). */
export const MINI_ENCOUNTERS: Partial<Record<StageId, Encounter>> = {};

/** Every hidden part has a guardian, fought in a turn-based RPG battle (see rpgGuardians.ts). */
export const PART_GUARDIANS: Partial<Record<PartId, Encounter>> = Object.fromEntries(
  Object.values(GUARDIANS).map((g) => [
    g.part,
    { scene: 'rpg', lines: () => [{ name: g.name, text: g.challenge, portrait: { key: g.sprite }, voice: `${g.id}_challenge`, color: g.color }] },
  ]),
);
