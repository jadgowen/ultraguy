import Phaser from 'phaser';
import type { PartId } from '../parts';
import { sfx } from '../sfx';
import type { WeaponId } from '../weapons';

/**
 * The guardians of the hidden armor parts, each fought in a turn-based RPG
 * battle (RpgScene). A guardian is data plus an `act` function that queues up
 * what it does on its turn through the `Battle` interface.
 */

export interface HurtOpts {
  /** Goes right through GUARD. */
  pierce?: boolean;
  /** Chance to daze you (you lose your next turn). */
  daze?: number;
  /** This attack handles its own accuracy (skip the CYCLONE miss roll). */
  sure?: boolean;
  voice?: string;
  sound?: () => void;
}

/** What a guardian can do on its turn. Everything is queued as messages. */
export interface Battle {
  readonly turn: number;
  readonly foeHp: number;
  readonly foeMax: number;
  /** Turns left of CYCLONE winds: his attacks may miss. */
  readonly foeBlind: number;
  /** You chose GUARD this turn. */
  readonly heroGuarding: boolean;
  /** Per-fight scratch state for the guardian's AI. */
  flags: Record<string, number>;
  say(text: string, opts?: { voice?: string; fx?: () => void }): void;
  /** Hit you for lo..hi (GUARD halves it, unless it pierces). */
  hurt(lo: number, hi: number, text: string, opts?: HurtOpts): void;
  heal(amount: number, text: string, voice?: string): void;
  /** Halve the damage he takes for a few turns (SAW BLADE cuts through). */
  defend(turns: number): void;
  /** Make your next attack likely to miss. */
  hide(): void;
  /** Flash the battle window. */
  flash(color: number): void;
  shake(): void;
}

export interface Guardian {
  id: 'ceej' | 'juck' | 'hydro' | 'beard';
  part: PartId;
  name: string;
  /** Texture key (64 x 64 front view). */
  sprite: string;
  /** Name color in dialogue. */
  color: number;
  hp: number;
  weak: WeaponId[];
  resist: WeaponId[];
  /** Weapons that heal him. */
  absorb: WeaponId[];
  weakText: string;
  resistText: string;
  absorbText?: string;
  /** Said in the stage before the warp (voice `<id>_challenge`). */
  challenge: string;
  /** First battle message. */
  intro: string;
  /** He's beaten (voice `<id>_loses`). */
  loses: string;
  /** You're beaten (voice `<id>_wins`). */
  wins: string;
  act(b: Battle): void;
}

const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

/** Next index from a shuffled cycle kept in flags, so lines don't repeat until all are used. */
function nextLine(b: Battle, key: string, count: number): number {
  const i = b.flags[key] ?? 0;
  b.flags[key] = i + 1;
  if (i % count === 0) b.flags[`${key}_off`] = Math.floor(Math.random() * count);
  return (i + (b.flags[`${key}_off`] ?? 0)) % count;
}

// --- CEEJ GEIGAN ------------------------------------------------------------------------

export const CEEJ_FACTS = [
  'D-Day, June 6th, 1944! The largest seaborne invasion in history. Over five thousand ships, son!',
  'The beaches had code names: Utah, Omaha, Gold, Juno and Sword. Memorize them, private!',
  'Before D-Day, the Allies fooled the enemy with a fake army. Inflatable tanks! The Ghost Army!',
  'The invasion was pushed back a whole day for bad weather. Always check the forecast, recruit!',
  'D-Day paratroopers found each other in the dark with little clickers called crickets. Click-clack!',
  'The Allies towed their own floating harbors across the Channel. Mulberry harbors! Bring your own dock!',
  'At Midway, in 1942, codebreakers knew the enemy plan before their ships even sailed!',
  'In the Battle of Britain, radar helped a few brave pilots defend a whole island!',
  'The Battle of the Bulge was fought in a frozen forest. Bring a scarf, private!',
  'Wojtek the bear served with Polish troops and helped carry ammo at Monte Cassino. A real bear!',
];

const CEEJ: Guardian = {
  id: 'ceej',
  part: 'armor',
  name: 'CEEJ GEIGAN',
  sprite: 'ceej_front',
  color: 0xa8b060,
  hp: 150,
  weak: ['frost'],
  resist: ['quake'],
  absorb: [],
  weakText: 'General Winter strikes! A weak spot!',
  resistText: "He's dug in. It barely rattles him.",
  challenge: "Ten-hut! General Ceej Geigan, commanding! You want this armor, private? You'll have to survive... a history lesson!",
  intro: 'CEEJ GEIGAN stands at attention!',
  loses: "Well, I'll be. You earned that armor, soldier. Class dismissed!",
  wins: 'Dismissed! Hit the books, private.',
  act(b) {
    const f = b.flags;
    if (f.barrage) {
      f.barrage = 0;
      b.hurt(20, 26, 'The ARTILLERY BARRAGE lands!', { sound: () => sfx.explode() });
      return;
    }
    if (!f.rallied && b.foeHp < b.foeMax * 0.4) {
      f.rallied = 1;
      b.say('CEEJ GEIGAN rallies the troops!', { fx: () => sfx.rpgSpell() });
      b.heal(25, 'CEEJ GEIGAN recovers 25 HP!');
      return;
    }
    const r = Math.random();
    if (b.turn >= 2 && r < 0.22) {
      f.barrage = 1;
      b.say('CEEJ GEIGAN radios for artillery!', { fx: () => sfx.zap() });
      b.say('(Shells are on the way. Better GUARD!)');
      return;
    }
    if (b.turn >= 2 && r < 0.36 && !f.dugIn) {
      f.dugIn = 1;
      b.say('CEEJ GEIGAN digs in!', { fx: () => sfx.quake() });
      b.defend(2);
      return;
    }
    f.dugIn = 0;
    // BLITZKRIEG: a history lesson, delivered at speed.
    const i = nextLine(b, 'fact', CEEJ_FACTS.length);
    b.say('CEEJ GEIGAN launches a BLITZKRIEG!', { fx: () => { sfx.whoosh(); b.flash(0xa8b060); } });
    b.say(`"${CEEJ_FACTS[i]}"`, { voice: `ceej_fact${i + 1}` });
    b.hurt(8, 11, pick(['ULTRAGUY is buried in trivia!', 'The facts hit like a tank!', 'ULTRAGUY is overwhelmed by history!']), { sound: () => sfx.punch() });
  },
};

// --- JUCK MCBUCK -------------------------------------------------------------------------

export const JUCK_MISSES = [
  "Dang it! The wind's all wrong!",
  'Hold still, would ya?!',
  'That was a warning shot. Yep. Totally meant that.',
  "Who's been messin' with my scope?!",
  'Aw, shucks. Sun was in my eyes.',
  'I swear this thing pulls left!',
  'You got lucky, tin man!',
  "My dad's never gonna let me hear the end of this...",
];

const JUCK: Guardian = {
  id: 'juck',
  part: 'boots',
  name: 'JUCK MCBUCK',
  sprite: 'juck_front',
  color: 0xf28c28,
  hp: 110,
  weak: ['cyclone'],
  resist: ['thorn'],
  absorb: [],
  weakText: 'The wind throws him clean off balance! A weak spot!',
  resistText: "He's right at home in the brambles.",
  challenge: "Well, well. Juck McBuck, best shot in the county. Them boots are mine to guard... now hold real still.",
  intro: 'JUCK MCBUCK takes aim!',
  loses: "Well, shoot. Go on, take the boots. Don't tell my dad.",
  wins: 'Yee-haw! Bagged me a robot!',
  act(b) {
    const f = b.flags;
    if (!f.jerky && b.foeHp < b.foeMax * 0.4) {
      f.jerky = 1;
      b.say('JUCK MCBUCK chews some beef jerky.', { fx: () => sfx.pickup() });
      b.heal(25, 'JUCK MCBUCK recovers 25 HP!');
      return;
    }
    if (f.aimed) {
      f.aimed = 0;
      b.say('JUCK MCBUCK squeezes the trigger...', { fx: () => sfx.laser() });
      b.hurt(26, 32, 'A dead-center hit!', { sure: true, voice: 'juck_hit', sound: () => sfx.explode() });
      return;
    }
    const r = Math.random();
    if (b.turn >= 2 && r < 0.2) {
      f.aimed = 1;
      b.say('JUCK MCBUCK takes careful aim...');
      b.say("(He won't miss this one. Better GUARD!)");
      return;
    }
    if (r < 0.32 && !f.hid) {
      f.hid = 1;
      b.say('JUCK MCBUCK throws on a ghillie suit and vanishes into the brush!', { fx: () => sfx.whoosh() });
      b.hide();
      return;
    }
    f.hid = 0;
    // The rifle: usually misses... but it hurts when it hits.
    const hitChance = b.foeBlind > 0 ? 0.2 : 0.4;
    b.say('JUCK MCBUCK fires his rifle!', { fx: () => sfx.laser() });
    if (Math.random() < hitChance) {
      b.hurt(20, 26, 'Direct hit!', { sure: true, voice: 'juck_hit', sound: () => sfx.explode() });
    } else {
      const i = nextLine(b, 'miss', JUCK_MISSES.length);
      b.say('...and misses by a mile!', { fx: () => sfx.deflect() });
      b.say(`"${JUCK_MISSES[i]}"`, { voice: `juck_miss${i + 1}` });
    }
  },
};

// --- THE HYDRONATOR ----------------------------------------------------------------------

export const HYDRO_OFFERS = [
  'Here, have a glass of water!',
  'Stay hydrated, my friend!',
  "Eight glasses a day, buddy. That's the rule.",
  'You look a little parched. Drink up!',
  "Water! Nature's favorite beverage!",
  "Another one? Don't mind if you do!",
];

const HYDRO: Guardian = {
  id: 'hydro',
  part: 'helmet',
  name: 'THE HYDRONATOR',
  sprite: 'hydro_front',
  color: 0x6ab8e8,
  hp: 110,
  weak: ['flame'],
  resist: [],
  absorb: ['bubble'],
  weakText: 'The water boils away! A weak spot!',
  resistText: '',
  absorbText: 'He drinks it right up!',
  challenge: "Hey, buddy! You look thirsty. Have you been drinking enough water today? I'm the Hydronator... and I insist.",
  intro: 'THE HYDRONATOR offers a friendly wave!',
  loses: "Okay, okay! You win. The helmet's yours. Grab a water on the way out!",
  wins: 'See? You just needed to hydrate.',
  act(b) {
    const f = b.flags;
    // Once a fight, at half health: chapstick. Full heal.
    if (!f.chapstick && b.foeHp <= b.foeMax / 2) {
      f.chapstick = 1;
      b.say('THE HYDRONATOR pauses. His lips look dry...');
      b.say('"Hold on... chapstick. Ahh, good as new!"', { voice: 'hydro_chapstick', fx: () => sfx.rpgSpell() });
      b.heal(b.foeMax, 'THE HYDRONATOR is fully restored!');
      return;
    }
    if (b.turn >= 2 && !f.toppedOff && Math.random() < 0.2) {
      f.toppedOff = 1;
      f.water = (f.water ?? 0) + 2;
      b.say('THE HYDRONATOR tops off the pitcher.', { fx: () => sfx.splash() });
      b.say('(The next glass will be HUGE. Maybe politely GUARD?)');
      return;
    }
    f.toppedOff = 0;
    // Each glass is bigger than the last. GUARD politely declines and resets it.
    f.water = (f.water ?? 0) + 1;
    const n = f.water;
    const i = nextLine(b, 'offer', HYDRO_OFFERS.length);
    b.say(`"${HYDRO_OFFERS[i]}"`, { voice: `hydro_offer${i + 1}`, fx: () => sfx.splash() });
    const base = Math.min(26, 2 + n * 3);
    if (b.heroGuarding) {
      f.water = 0;
      b.hurt(base, base, 'ULTRAGUY politely declines... most of it.', { sound: () => sfx.splash() });
      b.say('(The water stops piling up.)');
    } else {
      b.hurt(base, base + 2, n === 1 ? 'ULTRAGUY is hydrated!' : `Hydration builds up! (x${n})`, { sound: () => sfx.bubble() });
    }
  },
};

// --- BEARDSMITH --------------------------------------------------------------------------

type Tool = 'drill' | 'saw' | 'hammer' | 'nails';

const BEARD: Guardian = {
  id: 'beard',
  part: 'blaster',
  name: 'BEARDSMITH',
  sprite: 'beard_front',
  color: 0xc8ccd8,
  hp: 120,
  weak: ['spark', 'bubble'],
  resist: ['flame', 'saw'],
  absorb: [],
  weakText: 'His circuits fizz! A weak spot!',
  resistText: 'Forge-tempered. It barely scratches him.',
  challenge: 'Halt, tinker! Beardsmith, forge-master of these halls. Ye want the UltraBlaster? Then face me toolbelt!',
  intro: 'BEARDSMITH hefts his hammer!',
  loses: "Hah! Fine craftsmanship, lad. Take the blaster. Ye've earned it.",
  wins: 'Back to the scrap heap with ye!',
  act(b) {
    const f = b.flags;
    if (f.forge) {
      f.forge = 0;
      b.say('BEARDSMITH swings the MOLTEN HAMMER!', { fx: () => { sfx.flame(); b.flash(0xf28c28); } });
      b.hurt(22, 28, 'KA-WHANG!', { sound: () => sfx.crush() });
      return;
    }
    if (!f.wrench && b.foeHp < b.foeMax * 0.35) {
      f.wrench = 1;
      b.say('BEARDSMITH tightens a few bolts with his wrench.', { fx: () => sfx.rpgSpell() });
      b.heal(25, 'BEARDSMITH recovers 25 HP!');
      return;
    }
    if (b.turn >= 2 && Math.random() < 0.2) {
      f.forge = 1;
      b.say('"Into the forge she goes!"', { voice: 'beard_forge', fx: () => sfx.flame() });
      b.say('(His hammer glows white-hot. Better GUARD!)');
      return;
    }
    // A tool from the belt, never the same one twice in a row.
    const tools: Tool[] = ['drill', 'saw', 'hammer', 'nails'];
    const last = tools[f.lastTool ?? -1];
    const tool = pick(tools.filter((t) => t !== last));
    f.lastTool = tools.indexOf(tool);
    b.say('BEARDSMITH reaches for his toolbelt...');
    if (tool === 'drill') {
      b.say('"Drill\'s spinnin\'!"', { voice: 'beard_drill', fx: () => sfx.charge(2) });
      b.hurt(8, 11, 'The DRILL bores right through any guard!', { pierce: true, sound: () => sfx.crush() });
    } else if (tool === 'saw') {
      b.say('"Measure twice, cut once!"', { voice: 'beard_saw' });
      b.hurt(10, 13, 'The BUZZ SAW rips into ULTRAGUY!', { sound: () => sfx.hit() });
    } else if (tool === 'hammer') {
      b.say('"Hammer and anvil!"', { voice: 'beard_hammer' });
      b.hurt(11, 14, 'The HAMMER comes down hard!', { daze: 0.25, sound: () => sfx.crush() });
    } else {
      const nails = Phaser.Math.Between(3, 5);
      b.say('"Nail gun! Hold still!"', { voice: 'beard_nails' });
      b.hurt(nails * 2, nails * 3, `${nails} nails hit!`, { sound: () => sfx.shoot() });
    }
  },
};

export const GUARDIANS: Record<PartId, Guardian> = {
  blaster: BEARD,
  boots: JUCK,
  armor: CEEJ,
  helmet: HYDRO,
};
