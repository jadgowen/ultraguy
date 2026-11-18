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
  vault: 'Flashy, cheeky megastore boss-stage theme, funky slap bass, brassy stabs, cash-register percussion, upbeat and mischievous, loopable',
  shop: 'Cozy robot shop theme, light jazzy bossa nova groove, plucky bass, warm keys, friendly and relaxed, loopable',
  dojo: 'Calm martial-arts training hall theme, steady mid-tempo groove, wooden percussion, focused and motivating, loopable',
  breaker: 'Forge brick-breaker theme, bouncy and metallic, steady driving beat, hammer-like percussion',
  hockey: 'Ice hockey arena theme, upbeat and cool, crisp percussion, organ-like stabs, sporty energy',
  skies: 'Vertical sky shooter theme, soaring and fast, heroic lead over rushing wind-like arpeggios',
  pinball: 'Undersea pinball table theme, bouncy and bubbly, playful bass and sparkling lead',
  dungeon: 'Top-down junkyard dungeon theme, mysterious and clanky, metallic percussion, minor key, steady exploration groove with a mischievous edge',
  race: 'High-energy motocross race theme, fast tempo, revving rock energy, exciting and competitive',
  boxing: 'Boxing match theme, punchy and heroic, driving beat, tension and triumph, arena energy',
  rpg: 'Classic Japanese role-playing game battle theme, heroic and bouncy, brass and strings over a marching beat',
  shooter: 'Space shooter theme, urgent synth arpeggios, alien invasion, heroic and fast',
  bomb: 'Bomb battle maze theme, bouncy and mischievous with a hot volcanic flavor, fast tempo',
  hop: 'Light, playful jungle crossing theme, fast and cheerful, plucky bass and marimba-like lead',
  // Set pieces.
  chase: 'Frantic escape chase theme, a giant machine closing in, urgent pounding drums, rising tension, fast and relentless, loopable',
  climb: 'Desperate climbing theme up a giant jungle tree, thorny vines rising below, driving tribal drums, urgent ascending melody, loopable',
};

/** Spoken lines: [voice id, text]. Played with the dialogue boxes. */
const VOICE = {
  anvil_challenge: ['VR6AewLTigWG4xSOukaG', "You want a rematch? Then break through my forge wall. Every brick I lay, I lay twice as hard!"],
  anvil_wins: ['VR6AewLTigWG4xSOukaG', "Hammered flat. Back to the anvil with you."],
  anvil_loses: ['VR6AewLTigWG4xSOukaG', "My wall... my beautiful wall. Fine work, little bot."],
  frostline_challenge: ['D38z5RcWu1voky8WS1ja', "No blasters on my ice. Puck, sticks, and nerves of steel. First to three takes it!"],
  frostline_wins: ['D38z5RcWu1voky8WS1ja', "Ha! Put that one on ice."],
  frostline_loses: ['D38z5RcWu1voky8WS1ja', "Brrr... you skate like a pro. Good game."],
  scrap_challenge: ['CYw3kZ02Hs0563khs1Fj', 'Welcome to my junk maze, kid! Find the keys, find me... if you can!'],
  scrap_wins: ['CYw3kZ02Hs0563khs1Fj', 'Lost in the junk! Straight to the scrap heap!'],
  scrap_loses: ['CYw3kZ02Hs0563khs1Fj', 'Aw, nuts and bolts... you found your way right to me.'],
  gale_challenge: ['XB0fDUnXU5powFXDhCwa', "Up here, the wind decides who flies. Let's see if it decides for you!"],
  gale_wins: ['XB0fDUnXU5powFXDhCwa', "Grounded. Try flapping harder."],
  gale_loses: ['XB0fDUnXU5powFXDhCwa', "You rode my storm... and won. Impressive."],
  tide_challenge: ['cgSgspJ2msm6clMCkdW9', "Welcome to my tide pool! Bounce, roll, and try not to wash out!"],
  tide_wins: ['cgSgspJ2msm6clMCkdW9', "Washed out! The tide always wins."],
  tide_loses: ['cgSgspJ2msm6clMCkdW9', "Beached... by a pinball. How embarrassing."],
  mantis_challenge: ['SOYHLrjzK2X1ezoPC6cr', 'Cross my pond to reach me. Fill all three lily pads... and do not land where I wait.'],
  mantis_wins: ['SOYHLrjzK2X1ezoPC6cr', 'The pond keeps what it catches.'],
  mantis_loses: ['SOYHLrjzK2X1ezoPC6cr', 'Swift... and patient. You have earned your way across.'],
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
  // Stage-boss intro lines (called out as they strike their pose).
  anvil_intro: ['VR6AewLTigWG4xSOukaG', "Step up to the anvil, tin can. I'll hammer you flat!"],
  mantis_intro: ['SOYHLrjzK2X1ezoPC6cr', 'Be still... like the leaves. Then, I strike.'],
  frostline_intro: ['D38z5RcWu1voky8WS1ja', "Cold feet already? Good. Stay frozen!"],
  gale_intro: ['XB0fDUnXU5powFXDhCwa', "Hold on to something, little one. The wind's picking up!"],
  volt_intro: ['TX3LPaxmHKxFdv7VOQHJ', "Feel that tingle? That's ten thousand volts saying hello!"],
  magma_intro: ['N2lVS1w4EtoT3dr4eOWO', "You're in my kitchen now. Hope you like it hot!"],
  scrap_intro: ['CYw3kZ02Hs0563khs1Fj', "Ooh, shiny parts! Hold still, I'm collecting!"],
  tide_intro: ['cgSgspJ2msm6clMCkdW9', "The tide's coming in, sweetie. Sink or swim!"],
  jared_intro: ['iP95p4xoKVk53GoZ742B', "Store's closed, pal. But hey... hot dogs are on the house!"],
  gate_intro: ['2EiwWnXFnvU5JabPnv8n', 'None pass this gate. Turn back, machine.'],
  overlord_intro: ['nPczCjzI2devNBz1zQrb', 'So. The little machine finally arrives. Kneel.'],
  baron_intro: ['ErXwobaYiN019PkySvjV', "Rivet sent you? Ha! Everything here is for sale... including your spare parts!"],
  shop_vault: ['MF3mGyEYCl7XYWbV9V6O', "You found every hidden 1-UP? Then take this key. My rival's megastore is open... go teach him a lesson!"],
  // Rivet, the shopkeeper.
  shop_welcome: ['MF3mGyEYCl7XYWbV9V6O', "Welcome to Rivet's! Bolts in, goodies out!"],
  shop_thanks: ['MF3mGyEYCl7XYWbV9V6O', 'Pleasure doing business, sugar!'],
  shop_broke: ['MF3mGyEYCl7XYWbV9V6O', "Ooh, you're a few bolts short. Go bust some bots!"],
  shop_full: ['MF3mGyEYCl7XYWbV9V6O', "Whoa there, you can't carry any more of those!"],
  shop_bye: ['MF3mGyEYCl7XYWbV9V6O', 'Come back soon! Bring bolts!'],
  pip_intro1: ['MF3mGyEYCl7XYWbV9V6O', "Hey, hero! Saw you flatten that robot master. Look what I've been tinkering on."],
  pip_intro2: ['MF3mGyEYCl7XYWbV9V6O', "Meet Pip! It has a lamp for the dark, and I can bolt on more gadgets if you bring me bolts."],
  pip_intro3: ['MF3mGyEYCl7XYWbV9V6O', "Ha! It likes you. Go on, take it along. Come see me for upgrades, sugar!"],
  overlord_challenge: ['nPczCjzI2devNBz1zQrb', 'Pathetic machine. My armada will blot you from the sky!'],
  overlord_loses: ['nPczCjzI2devNBz1zQrb', 'Impossible... my fleet... destroyed!'],
  toad_challenge: ['IKne3meq5aSn9XLyUdCD', 'Ribbit! You want past me? Hop across my thicket first, tin can. Fill all three lily pads before the time runs out!'],
  toad_wins: ['IKne3meq5aSn9XLyUdCD', 'Splash! Ha ha!'],
  toad_loses: ['IKne3meq5aSn9XLyUdCD', 'Ribbit... fine, fine. Go on through.'],
  ceej_challenge: ['pqHfZKP75CvOlQylNhV4', "Ten-hut! General Ceej Geigan, commanding! You want this armor, private? You'll have to survive... a history lesson!"],
  ceej_loses: ['pqHfZKP75CvOlQylNhV4', "Well, I'll be. You earned that armor, soldier. Class dismissed!"],
  ceej_wins: ['pqHfZKP75CvOlQylNhV4', "Dismissed! Hit the books, private."],
  juck_challenge: ['yoZ06aMxZJJ28mfd3POQ', "Well, well. Juck McBuck, best shot in the county. Them boots are mine to guard... now hold real still."],
  juck_loses: ['yoZ06aMxZJJ28mfd3POQ', "Well, shoot. Go on, take the boots. Don't tell my dad."],
  juck_wins: ['yoZ06aMxZJJ28mfd3POQ', "Yee-haw! Bagged me a robot!"],
  hydro_challenge: ['CwhRBWXzGAHq8TQ4Fs17', "Hey, buddy! You look thirsty. Have you been drinking enough water today? I'm the Hydronator... and I insist."],
  hydro_loses: ['CwhRBWXzGAHq8TQ4Fs17', "Okay, okay! You win. The helmet's yours. Grab a water on the way out!"],
  hydro_wins: ['CwhRBWXzGAHq8TQ4Fs17', "See? You just needed to hydrate."],
  beard_challenge: ['JBFqnCBsd6RMkjVDRZzb', "Halt, tinker! Beardsmith, forge-master of these halls. Ye want the UltraBlaster? Then face me toolbelt!"],
  beard_loses: ['JBFqnCBsd6RMkjVDRZzb', "Hah! Fine craftsmanship, lad. Take the blaster. Ye've earned it."],
  beard_wins: ['JBFqnCBsd6RMkjVDRZzb', "Back to the scrap heap with ye!"],
  ceej_fact1: ['pqHfZKP75CvOlQylNhV4', "D-Day, June sixth, nineteen forty-four! The largest seaborne invasion in history. Over five thousand ships, son!"],
  ceej_fact2: ['pqHfZKP75CvOlQylNhV4', "The beaches had code names: Utah, Omaha, Gold, Juno and Sword. Memorize them, private!"],
  ceej_fact3: ['pqHfZKP75CvOlQylNhV4', "Before D-Day, the Allies fooled the enemy with a fake army. Inflatable tanks! The Ghost Army!"],
  ceej_fact4: ['pqHfZKP75CvOlQylNhV4', "The invasion was pushed back a whole day for bad weather. Always check the forecast, recruit!"],
  ceej_fact5: ['pqHfZKP75CvOlQylNhV4', "D-Day paratroopers found each other in the dark with little clickers called crickets. Click-clack!"],
  ceej_fact6: ['pqHfZKP75CvOlQylNhV4', "The Allies towed their own floating harbors across the Channel. Mulberry harbors! Bring your own dock!"],
  ceej_fact7: ['pqHfZKP75CvOlQylNhV4', "At Midway, in nineteen forty-two, codebreakers knew the enemy plan before their ships even sailed!"],
  ceej_fact8: ['pqHfZKP75CvOlQylNhV4', "In the Battle of Britain, radar helped a few brave pilots defend a whole island!"],
  ceej_fact9: ['pqHfZKP75CvOlQylNhV4', "The Battle of the Bulge was fought in a frozen forest. Bring a scarf, private!"],
  ceej_fact10: ['pqHfZKP75CvOlQylNhV4', "Wojtek the bear served with Polish troops and helped carry ammo at Monte Cassino. A real bear!"],
  juck_miss1: ['yoZ06aMxZJJ28mfd3POQ', "Dang it! The wind's all wrong!"],
  juck_miss2: ['yoZ06aMxZJJ28mfd3POQ', "Hold still, would ya?!"],
  juck_miss3: ['yoZ06aMxZJJ28mfd3POQ', "That was a warning shot. Yep. Totally meant that."],
  juck_miss4: ['yoZ06aMxZJJ28mfd3POQ', "Who's been messin' with my scope?!"],
  juck_miss5: ['yoZ06aMxZJJ28mfd3POQ', "Aw, shucks. Sun was in my eyes."],
  juck_miss6: ['yoZ06aMxZJJ28mfd3POQ', "I swear this thing pulls left!"],
  juck_miss7: ['yoZ06aMxZJJ28mfd3POQ', "You got lucky, tin man!"],
  juck_miss8: ['yoZ06aMxZJJ28mfd3POQ', "My dad's never gonna let me hear the end of this..."],
  juck_hit: ['yoZ06aMxZJJ28mfd3POQ', "Got 'im! Ha!"],
  hydro_offer1: ['CwhRBWXzGAHq8TQ4Fs17', "Here, have a glass of water!"],
  hydro_offer2: ['CwhRBWXzGAHq8TQ4Fs17', "Stay hydrated, my friend!"],
  hydro_offer3: ['CwhRBWXzGAHq8TQ4Fs17', "Eight glasses a day, buddy. That's the rule."],
  hydro_offer4: ['CwhRBWXzGAHq8TQ4Fs17', "You look a little parched. Drink up!"],
  hydro_offer5: ['CwhRBWXzGAHq8TQ4Fs17', "Water! Nature's favorite beverage!"],
  hydro_offer6: ['CwhRBWXzGAHq8TQ4Fs17', "Another one? Don't mind if you do!"],
  hydro_chapstick: ['CwhRBWXzGAHq8TQ4Fs17', "Hold on... chapstick. Ahh, good as new!"],
  beard_drill: ['JBFqnCBsd6RMkjVDRZzb', "Drill's spinnin'!"],
  beard_saw: ['JBFqnCBsd6RMkjVDRZzb', "Measure twice, cut once!"],
  beard_hammer: ['JBFqnCBsd6RMkjVDRZzb', "Hammer and anvil!"],
  beard_nails: ['JBFqnCBsd6RMkjVDRZzb', "Nail gun! Hold still!"],
  beard_forge: ['JBFqnCBsd6RMkjVDRZzb', "Into the forge she goes!"],
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
  // Bomb battle, shooter, RPG.
  fuse: ['16-bit SNES game sound, bomb dropped, short fuse fizz', 0.6],
  explode: ['16-bit SNES game sound, bomb explosion, punchy boom', 0.8],
  laser: ['16-bit SNES game sound, small spaceship laser shot', 0.5],
  alienDie: ['16-bit SNES game sound, alien invader destroyed, crunchy pop', 0.5],
  rpgHit: ['16-bit SNES game sound, turn-based RPG attack hit, sharp slash', 0.5],
  rpgSpell: ['16-bit SNES game sound, RPG magic spell cast, shimmering', 0.8],
  victory: ['16-bit SNES game sound, short RPG victory fanfare jingle', 3],
  // Pip the drone.
  pip_chirp: ['tiny cute robot drone chirp, happy little electronic beep-boop, 16-bit game sound', 0.5],
  pip_trill: ['tiny cute robot drone excited happy trill, rising chirpy electronic beeps, 16-bit game sound', 1.0],
  pip_fetch: ['tiny robot drone grabbing an item, quick electronic blip with a little click, 16-bit game sound', 0.5],
  pip_zap: ['tiny robot drone firing a small laser, quick high pew, 16-bit game sound', 0.5],
  pip_guard: ['tiny robot drone electric shield zapping a bullet, crackle and sparkle, 16-bit game sound', 0.5],
  pip_startle: ['tiny robot drone startled, surprised wobbly electronic warble, 16-bit game sound', 0.6],
  pip_hum: ['tiny robot drone hovering, soft steady electric thruster hum, seamless loop', 2.0],
  // Set pieces.
  powerDown: ['16-bit SNES game sound, power failure, electricity dying, descending hum and a clunk into silence', 1.5],
  powerUp: ['16-bit SNES game sound, generators powering back up, rising electric whine and lights clicking on', 1.5],
  titanCrush: ['16-bit SNES game sound, giant hydraulic press crushing a robot, heavy metal crunch and sparks', 0.8],
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
// Short one-shot jingles (stored as music, played once).
const JINGLES = {
  jingle_victory: ['Triumphant short victory fanfare after defeating a boss, bright brass and chiptune arpeggios, ends on a held major chord', 9000],
};
for (const [name, [mood, ms]] of Object.entries(JINGLES)) {
  await job('music', name, () =>
    post('/music', { prompt: `${mood}. ${STYLE16}.`, music_length_ms: ms, force_instrumental: true, model_id: 'music_v1' }),
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
