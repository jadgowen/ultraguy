// Music + sound effect generator (ElevenLabs).
//
//   ELEVENLABS_API_KEY=your-key npm run audio            # generate what's missing
//   ELEVENLABS_API_KEY=your-key npm run audio -- --force # regenerate everything
//   ELEVENLABS_API_KEY=your-key npm run audio -- reef boss shoot   # just these
//
// Writes public/assets/audio/<name>.mp3 and public/assets/audio/manifest.json
// (the list of files the game loads). The game plays these when present and
// falls back to its built-in synthesized sounds when they're not.
//
// The key is read from the environment only; it is never written to disk or printed.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './lib.mjs';

const OUT = join(ROOT, 'public/assets/audio');
const API = 'https://api.elevenlabs.io/v1';

const STYLE = 'instrumental 8-bit chiptune in the style of classic NES action games, square-wave lead, triangle bass, noise-channel drums, seamless loop';

/** Background music: one looping track per area. Keys match playMusic() calls in the game. */
const MUSIC = {
  title: 'Heroic, catchy title theme with a memorable lead melody, bright and energetic',
  select: 'Short, suspenseful stage-select loop with quick arpeggios, anticipation building',
  intro: 'Bright, driving city-street level theme, fast tempo, optimistic and fun',
  foundry: 'Industrial factory level theme, heavy pounding rhythm, metallic percussion, determined mood',
  canopy: 'Jungle level theme, mysterious minor key, tribal drum patterns, lush arpeggios',
  glacier: 'Ice level theme, cold and sparkling, bell-like arpeggios, steady groove',
  stratos: 'Sky level theme, soaring airy melody, uplifting, wide-open feeling',
  powerplant: 'Electric power-plant level theme, tense, fast buzzing arpeggios, high voltage energy',
  caldera: 'Volcano level theme, fiery and aggressive, minor key, fast driving bass',
  scrapyard: 'Junkyard level theme, gritty funky groove, clanky percussion',
  reef: 'Underwater level theme, calm flowing melody, gentle and dreamy, slow tempo',
  fortress: 'Final fortress level theme, dark and ominous, driving minor-key march, menacing',
  boss: 'Intense boss battle theme, urgent and fast, dramatic minor key',
  finalboss: 'Epic final boss battle theme, relentless and dramatic, the climax of the game',
  ending: 'Triumphant, emotional ending credits theme, warm and celebratory, slower tempo',
};

/** Music for the special modes, in a 16-bit console style. */
const STYLE16 = 'instrumental 16-bit chiptune in the style of classic SNES-era sports games, punchy FM-style lead, slap bass, sampled drums, seamless loop';
const MUSIC16 = {
  race: 'High-energy motocross race theme, fast tempo, revving rock energy, exciting and competitive',
  boxing: 'Boxing match theme, punchy and heroic, driving beat, tension and triumph, arena energy',
  rpg: 'Classic Japanese role-playing game battle theme, heroic and bouncy, brass and strings over a marching beat',
  fighter: 'One-on-one fighting game stage theme, intense and rhythmic, aggressive lead, rooftop showdown at night',
  shooter: 'Space shooter theme, urgent synth arpeggios, alien invasion, heroic and fast',
  bomb: 'Bomb battle maze theme, bouncy and mischievous with a hot volcanic flavor, fast tempo',
  hop: 'Light, playful jungle crossing theme, fast and cheerful, plucky bass and marimba-like lead',
};

/** Spoken lines: [voice id, text]. Played with the dialogue boxes. */
const VOICE = {
  volt_challenge: ['TX3LPaxmHKxFdv7VOQHJ', "Heh. You can't beat me in a fight... but maybe you can beat me in a race. Winner takes all!"],
  volt_wins: ['TX3LPaxmHKxFdv7VOQHJ', 'Too slow! Better luck next lap.'],
  volt_loses: ['TX3LPaxmHKxFdv7VOQHJ', 'No way... you actually beat me!'],
  race_go: ['pNInz6obpgDQGcFmaJgB', 'Three... two... one... GO!'],
  gate_challenge: ['2EiwWnXFnvU5JabPnv8n', 'No weapons. No tricks. Just our hands.'],
  gate_taunt1: ['2EiwWnXFnvU5JabPnv8n', 'Is that all you have got?'],
  gate_taunt2: ['2EiwWnXFnvU5JabPnv8n', "I will knock that helmet clean off!"],
  gate_wins: ['2EiwWnXFnvU5JabPnv8n', 'Stay down, little robot.'],
  gate_loses: ['2EiwWnXFnvU5JabPnv8n', 'Hmph. You hit harder than you look.'],
  jared_round1: ['iP95p4xoKVk53GoZ742B', "Alright champ, watch his shoulders! When he winds up, dodge... then hit him hard!"],
  jared_round2: ['iP95p4xoKVk53GoZ742B', 'He covers his face when you go high. Work the body!'],
  jared_round3: ['iP95p4xoKVk53GoZ742B', "Last round! When his eyes flash, that's your opening. Go get him!"],
  jared_getup: ['iP95p4xoKVk53GoZ742B', 'Get up! Get up, champ!'],
  box_fight: ['pNInz6obpgDQGcFmaJgB', 'Fight!'],
  box_ko: ['pNInz6obpgDQGcFmaJgB', 'Knockout!'],
  box_down: ['pNInz6obpgDQGcFmaJgB', 'Down he goes!'],
  magma_challenge: ['N2lVS1w4EtoT3dr4eOWO', "Too hot to handle, little bot? Then let's settle this the old way. Bombs, bricks, and nowhere to run!"],
  magma_wins: ['N2lVS1w4EtoT3dr4eOWO', 'Burned to a crisp!'],
  magma_loses: ['N2lVS1w4EtoT3dr4eOWO', "Argh... you've got a short fuse, and a long reach."],
  overlord_challenge: ['nPczCjzI2devNBz1zQrb', 'Pathetic machine. My armada will blot you from the sky!'],
  overlord_loses: ['nPczCjzI2devNBz1zQrb', 'Impossible... my fleet... destroyed!'],
  shade_challenge: ['bIHbv24MWmeRgasZH58o', "So you made it. No armor. No cannon. Just you and me... and only one of us walks away."],
  shade_wins: ['bIHbv24MWmeRgasZH58o', 'Two of us was always one too many.'],
  shade_loses: ['bIHbv24MWmeRgasZH58o', "Then... you're the real one."],
  fight_round1: ['cjVigY5qzO86Huf0OWal', 'Round one!'],
  fight_round2: ['cjVigY5qzO86Huf0OWal', 'Round two!'],
  fight_final: ['cjVigY5qzO86Huf0OWal', 'Final round!'],
  fight_go: ['cjVigY5qzO86Huf0OWal', 'Fight!'],
  fight_ko: ['cjVigY5qzO86Huf0OWal', 'K. O.!'],
  fight_perfect: ['cjVigY5qzO86Huf0OWal', 'Perfect!'],
  fight_youwin: ['cjVigY5qzO86Huf0OWal', 'You win!'],
  fight_youlose: ['cjVigY5qzO86Huf0OWal', 'You lose!'],
  toad_challenge: ['IKne3meq5aSn9XLyUdCD', 'Ribbit! You want past me? Hop across my thicket first, tin can. Fill all three lily pads before the time runs out!'],
  toad_wins: ['IKne3meq5aSn9XLyUdCD', 'Splash! Ha ha!'],
  toad_loses: ['IKne3meq5aSn9XLyUdCD', 'Ribbit... fine, fine. Go on through.'],
  sentry_challenge: ['onwK4e9ZLuTAKqWW03F9', 'Halt. The UltraBlaster is sealed. Prove your worth... in combat.'],
  sentry_loses: ['onwK4e9ZLuTAKqWW03F9', 'Access... granted.'],
};

/** Sound effects. Keys match the names in src/sfx.ts. */
const SFX = {
  shoot: ['retro 8-bit arcade blaster shot, short bright pew', 0.5],
  chargeShot: ['retro 8-bit charged energy cannon blast, powerful whoosh', 0.8],
  hit: ['retro 8-bit hit sound, short metallic tink', 0.5],
  weakHit: ['retro 8-bit heavy critical hit, crunchy impact', 0.6],
  deflect: ['retro 8-bit ricochet, bullet deflecting off a metal shield', 0.5],
  enemyDie: ['retro 8-bit small explosion, robot destroyed', 0.7],
  hurt: ['retro 8-bit player damage sound, descending buzz', 0.6],
  die: ['retro 8-bit player death, shattering explosion with falling tone', 1.5],
  pickup: ['retro 8-bit power-up pickup chime, rising', 0.6],
  enemyShot: ['retro 8-bit enemy laser shot, low zap', 0.5],
  select: ['retro 8-bit menu confirm blip', 0.5],
  clear: ['retro 8-bit victory fanfare jingle, short triumphant', 3],
  quake: ['retro 8-bit ground shockwave rumble, short', 0.8],
  thorn: ['retro 8-bit spinning boomerang whoosh', 0.6],
  freeze: ['retro 8-bit ice crystal shot, sparkling chime', 0.6],
  cyclone: ['retro 8-bit tornado whoosh, swirling wind', 1],
  flame: ['retro 8-bit flamethrower burst, short roar', 0.8],
  bubble: ['retro 8-bit bubble pop shot, watery bloop', 0.5],
  zap: ['retro 8-bit electric zap, crackling arc', 0.6],
  wind: ['retro 8-bit gust of wind, airy rush', 1],
  // Stage mechanics and events (16-bit console style).
  crush: ['16-bit SNES game sound, heavy hydraulic press slamming down, metal clang with a thud', 0.7],
  spring: ['16-bit SNES game sound, springy boing, bouncy launch', 0.5],
  switchBlock: ['16-bit SNES game sound, energy blocks phasing in, short electronic shimmer click', 0.5],
  crumble: ['16-bit SNES game sound, brittle block cracking and crumbling apart, short debris', 0.6],
  lavaRise: ['16-bit SNES game sound, deep ominous volcanic rumble, lava starting to rise', 1.5],
  splash: ['16-bit SNES game sound, small water splash, diving in', 0.5],
  chute: ['16-bit SNES game sound, heavy barrel dropped out of a pipe, hollow thunk', 0.5],
  checkpoint: ['16-bit SNES game sound, checkpoint reached, bright two-note chime', 0.7],
  door: ['16-bit SNES game sound, heavy boss door sliding open, mechanical whoosh', 1.2],
  ready: ['16-bit SNES game sound, short stage start jingle, heroic and punchy', 1.8],
  jump: ['16-bit SNES game sound, short light jump, quick upward swish', 0.5],
  land: ['16-bit SNES game sound, soft metal boots landing, short thud', 0.5],
  // Race mode.
  engine: ['16-bit SNES game sound, small dirt bike engine buzzing at speed, steady', 1.0],
  rev: ['16-bit SNES game sound, dirt bike engine revving up hard', 0.8],
  bikeCrash: ['16-bit SNES game sound, motorbike crash and tumble, metal clatter', 1.0],
  bikeLand: ['16-bit SNES game sound, motorbike landing from a jump, suspension thump', 0.5],
  overheat: ['16-bit SNES game sound, engine overheating, steam hiss and sputter', 1.2],
  crowd: ['16-bit SNES game sound, stadium crowd cheering', 2.5],
  // Boxing mode.
  bell: ['boxing ring bell, ding ding ding', 1.5],
  punch: ['16-bit SNES game sound, heavy boxing punch landing, meaty thwack', 0.5],
  punchBlock: ['16-bit SNES game sound, punch blocked by boxing gloves, soft thud', 0.5],
  whoosh: ['16-bit SNES game sound, quick dodge whoosh', 0.5],
  bodyFall: ['16-bit SNES game sound, heavy body falling onto a boxing ring canvas', 0.8],
  starPunch: ['16-bit SNES game sound, super power uppercut, charging whoosh then huge impact', 1.0],
  glitch: ['16-bit SNES game sound, screen pixelating, digital warp transition', 1.2],
  // Bomb battle, shooter, fighter, RPG.
  fuse: ['16-bit SNES game sound, bomb dropped, short fuse fizz', 0.6],
  explode: ['16-bit SNES game sound, bomb explosion, punchy boom', 0.8],
  laser: ['16-bit SNES game sound, small spaceship laser shot', 0.5],
  alienDie: ['16-bit SNES game sound, alien invader destroyed, crunchy pop', 0.5],
  fireball: ['16-bit SNES game sound, energy fireball special move launched, whoosh', 0.7],
  uppercut: ['16-bit SNES game sound, rising uppercut special move, powerful swoosh', 0.6],
  rpgHit: ['16-bit SNES game sound, turn-based RPG attack hit, sharp slash', 0.5],
  rpgSpell: ['16-bit SNES game sound, RPG magic spell cast, shimmering', 0.8],
  victory: ['16-bit SNES game sound, short RPG victory fanfare jingle', 3],
};

// Same lookup as the other local projects: env var first, then ~/.elevenlabs_api_key.
const keyFile = join(homedir(), '.elevenlabs_api_key');
const key = process.env.ELEVENLABS_API_KEY || (existsSync(keyFile) ? readFileSync(keyFile, 'utf8').trim() : '');
if (!key) {
  console.error('Set ELEVENLABS_API_KEY or create ~/.elevenlabs_api_key first.');
  process.exit(1);
}

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = new Set(args.filter((a) => !a.startsWith('--')));
const wanted = (name) => only.size === 0 || only.has(name);

mkdirSync(OUT, { recursive: true });
const manifestPath = join(OUT, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { music: {}, sfx: {} };
manifest.voice ??= {};

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function job(kind, name, make) {
  const file = `${kind}_${name}.mp3`;
  const path = join(OUT, file);
  if (!wanted(name) || (!force && existsSync(path))) {
    if (existsSync(path)) manifest[kind][name] = file;
    return;
  }
  process.stdout.write(`${kind} ${name} ... `);
  try {
    writeFileSync(path, await make());
    manifest[kind][name] = file;
    console.log('ok');
  } catch (e) {
    console.log(`failed: ${e.message}`);
  }
}

for (const [name, mood] of Object.entries(MUSIC)) {
  await job('music', name, () =>
    post('/music', { prompt: `${mood}. ${STYLE}.`, music_length_ms: 60000, force_instrumental: true, model_id: 'music_v1' }),
  );
}
for (const [name, mood] of Object.entries(MUSIC16)) {
  await job('music', name, () =>
    post('/music', { prompt: `${mood}. ${STYLE16}.`, music_length_ms: 60000, force_instrumental: true, model_id: 'music_v1' }),
  );
}
for (const [name, [voice, text]] of Object.entries(VOICE)) {
  await job('voice', name, () => post(`/text-to-speech/${voice}`, { text, model_id: 'eleven_multilingual_v2' }));
}
for (const [name, [text, seconds]] of Object.entries(SFX)) {
  await job('sfx', name, () => post('/sound-generation', { text, duration_seconds: seconds, prompt_influence: 0.6 }));
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`manifest: ${Object.keys(manifest.music).length} music, ${Object.keys(manifest.sfx).length} sfx, ${Object.keys(manifest.voice).length} voice`);
