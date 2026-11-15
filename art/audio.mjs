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
for (const [name, [text, seconds]] of Object.entries(SFX)) {
  await job('sfx', name, () => post('/sound-generation', { text, duration_seconds: seconds, prompt_influence: 0.6 }));
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`manifest: ${Object.keys(manifest.music).length} music, ${Object.keys(manifest.sfx).length} sfx`);
