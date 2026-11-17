import type { BossKind } from '../level/Level';

/**
 * Stage-boss intro cards: the title under each boss's name, and the voice
 * line it calls out as it strikes its pose (`voice_<voice>.mp3`, see
 * art/audio.mjs). Bosses without a voice line just pose.
 */
export interface IntroCard {
  title: string;
  voice?: string;
  /** Card stripe color (default: the stage theme's light color). */
  color?: number;
  /** Signature flourish as it strikes its pose: particles thrown off it, and a sound. */
  fx?: { tex: 'spark' | 'shard' | 'bubble_fx' | 'dust' | 'windline'; sound: FxSound; n?: number };
}

export type FxSound = 'crush' | 'thorn' | 'freeze' | 'wind' | 'zap' | 'flame' | 'crumble' | 'bubble' | 'weakHit' | 'pickup';

export const BOSS_INTROS: Partial<Record<BossKind, IntroCard>> = {
  jared: { title: 'NIGHT SHIFT AT THE QUIK MART', voice: 'jared_intro', fx: { tex: 'dust', sound: 'pickup', n: 4 } },
  anvil: { title: 'HAMMER OF THE FOUNDRY', voice: 'anvil_intro', fx: { tex: 'spark', sound: 'crush', n: 10 } },
  mantis: { title: 'BLADE OF THE CANOPY', voice: 'mantis_intro', fx: { tex: 'shard', sound: 'thorn', n: 6 } },
  frostline: { title: 'TERROR OF THE GLACIER', voice: 'frostline_intro', fx: { tex: 'spark', sound: 'freeze', n: 8 } },
  gale: { title: 'QUEEN OF THE HIGH WINDS', voice: 'gale_intro', fx: { tex: 'windline', sound: 'wind', n: 8 } },
  volt: { title: 'THE LIVE WIRE', voice: 'volt_intro', fx: { tex: 'spark', sound: 'zap', n: 12 } },
  magma: { title: 'HEART OF THE CALDERA', voice: 'magma_intro', fx: { tex: 'shard', sound: 'flame', n: 10 } },
  scrap: { title: 'KING OF THE JUNK HEAP', voice: 'scrap_intro', fx: { tex: 'shard', sound: 'crumble', n: 8 } },
  tide: { title: 'TERROR OF THE REEF', voice: 'tide_intro', fx: { tex: 'bubble_fx', sound: 'bubble', n: 10 } },
  gatekeeper: { title: 'KEEPER OF THE FORTRESS GATE', voice: 'gate_intro', fx: { tex: 'dust', sound: 'crush', n: 6 } },
  baron: { title: "RIVET'S RIVAL, KING OF CUT-RATE", voice: 'baron_intro', color: 0xf8d040, fx: { tex: 'spark', sound: 'pickup', n: 12 } },
  abyss: { title: 'THE EYE IN THE DARK' },
  warden: { title: 'GUARDIAN OF THE SPIRE' },
  overlord: { title: 'MASTER OF THE FORTRESS', voice: 'overlord_intro', color: 0xff5050, fx: { tex: 'spark', sound: 'weakHit', n: 12 } },
  shade: { title: 'YOUR DARK REFLECTION', color: 0x9a7ad8, fx: { tex: 'shard', sound: 'zap', n: 8 } },
};

/** Intro timing (steps since the boss landed). */
export const INTRO = {
  /** The name card starts sliding in. */
  cardIn: 6,
  /** The name starts typing (a letter every 2 steps). */
  type: 22,
  /** The voice line. */
  voice: 28,
  /** The health bar starts filling (it takes about 84 steps). */
  fill: 64,
  /** Earliest the fight can start. */
  hold: 152,
};
