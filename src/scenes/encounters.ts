import Phaser from 'phaser';
import type { StageId } from '../level/Level';
import type { PartId } from '../parts';
import { Line, pixelateOut } from './cutscene';

/**
 * Encounters fought in another game style. Each starts with dialogue in the
 * stage, then the screen pixelates and that mode's scene takes over; when it
 * ends it returns to the stage with how it went (`Resume`).
 *
 *  - stage bosses (a list: the finale has two in a row),
 *  - minibosses,
 *  - guardians of hidden armor parts.
 */

export type EncounterKind = 'boss' | 'mini' | 'part';

export interface Encounter {
  /** Scene key of the mode. */
  scene: string;
  /** What's said before the warp. */
  lines: () => Line[];
}

/** Where a mode came from; sent back to the stage when it ends. */
export interface Ret {
  kind: EncounterKind;
  step: number;
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

export const BOSS_ENCOUNTERS: Partial<Record<StageId, Encounter[]>> = {
  powerplant: [
    {
      scene: 'race',
      lines: () => [
        { name: 'VOLT', text: "Heh. You can't beat me in a fight... but maybe you can beat me in a race. Winner takes all!", portrait: { key: 'volt_idle' }, voice: 'volt_challenge', color: 0xf8e040 },
      ],
    },
  ],
  fortress1: [
    {
      scene: 'boxing',
      lines: () => [{ name: 'GATEKEEPER', text: 'No weapons. No tricks. Just our hands.', portrait: { key: 'gatekeeper_idle' }, voice: 'gate_challenge', color: 0x8c4ad8 }],
    },
  ],
  caldera: [
    {
      scene: 'bomb',
      lines: () => [
        { name: 'MAGMA', text: "Too hot to handle, little bot? Then let's settle this the old way. Bombs, bricks, and nowhere to run!", portrait: { key: 'magma_idle' }, voice: 'magma_challenge', color: 0xff7a2a },
      ],
    },
  ],
  finale: [
    {
      scene: 'shooter',
      lines: () => [{ name: 'OVERLORD', text: 'Pathetic machine. My armada will blot you from the sky!', portrait: { key: 'overlord_idle' }, voice: 'overlord_challenge', color: 0xff5050 }],
    },
    {
      scene: 'fighter',
      lines: () => [
        { name: 'SHADE', text: 'So you made it. No armor. No cannon. Just you and me... and only one of us walks away.', portrait: { key: 'shade_portrait' }, voice: 'shade_challenge', color: 0xff3050 },
      ],
    },
  ],
};

export const MINI_ENCOUNTERS: Partial<Record<StageId, Encounter>> = {
  canopy: {
    scene: 'hop',
    lines: () => [
        { name: 'BRIAR TOAD', text: 'Ribbit! You want past me? Hop across my thicket first, tin can. Fill all three lily pads before the time runs out!', portrait: { key: 'toad_idle' }, voice: 'toad_challenge', color: 0x5ab84a },
    ],
  },
};

export const PART_GUARDIANS: Partial<Record<PartId, Encounter>> = {
  blaster: {
    scene: 'rpg',
    lines: () => [
      { name: 'VAULT SENTRY', text: 'Halt. The UltraBlaster is sealed. Prove your worth... in combat.', portrait: { key: 'sentry_front' }, voice: 'sentry_challenge', color: 0x5ef0c8 },
    ],
  },
};
