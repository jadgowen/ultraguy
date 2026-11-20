// Enemy and boss sprite sheet generator.
//
//   npm run sprites
//
// Writes:
//   public/assets/sprites.png    every frame packed into one sheet
//   public/assets/sprites.json   frame name -> [x, y, w, h]
//   art/sprites-preview.png      every frame at 4x, labeled by row (for looking at)
//
// Frame names are the texture keys the game uses (walker0, anvil_idle, ...);
// BootScene cuts the sheet into one texture per frame. Sizes match each
// enemy's hitbox anchoring (drawn bottom-center), and everything faces right
// (the game mirrors sprites for facing left).

import { Bitmap, drawGrid, encodePNG, shade16, write } from './lib.mjs';
import { anvilFrames } from './anvilArt.mjs';
import { magmaFrames } from './magmaArt.mjs';
import { voltFrames } from './voltArt.mjs';
import { frostlineFrames } from './frostlineArt.mjs';
import { galeFrames } from './galeArt.mjs';
import { mantisFrames } from './mantisArt.mjs';
import { tideFrames } from './tideArt.mjs';
import { scrapFrames } from './scrapArt.mjs';
import { guardianFrames } from './guardianArt.mjs';
import { miniFrames } from './miniArt.mjs';
import { boxFrames } from './boxArt.mjs';
import { enemyFrames } from './enemyArt.mjs';

// Palette characters ('.' is transparent):
const PALETTE = {
  K: 0x1a1428, // outline
  W: 0xfff1e0, // white
  w: 0xc8ccd8, // light gray
  G: 0x8a8fa8, // gray
  g: 0x55607a, // dark gray
  d: 0x2b2540, // near black
  S: 0x2a3a6a, // navy
  s: 0x4a5a9a, // navy light
  R: 0xd83a4a, // red
  r: 0x8c2030, // dark red
  P: 0xff8aa8, // pink
  Y: 0xffe14a, // yellow
  y: 0xd8a020, // dark yellow
  O: 0xf28c28, // orange
  o: 0xb85a1a, // dark orange
  E: 0x5ab84a, // green
  e: 0x2e7a34, // dark green
  N: 0xa8e070, // light green
  B: 0x6ab8e8, // blue
  b: 0x3a78b8, // dark blue
  C: 0x9ee8ff, // cyan
  c: 0xe6f8ff, // ice white
  q: 0x4aa8d8, // ice shade
  U: 0x8c4ad8, // purple
  u: 0x5a2a8a, // dark purple
  M: 0x7a5a3a, // brown
  V: 0x5ef0c8, // teal
  T: 0xa8704a, // skin
  t: 0x7a4a30, // skin shade
  n: 0xe0b070, // bun
  F: 0xf2c8a0, // fair skin
  f: 0xc8946c, // fair skin shade
  L: 0x6a7040, // olive drab
  l: 0x444a28, // olive drab shade
  A: 0xc8b078, // khaki
  H: 0x6a4428, // beard brown
  h: 0x9a6a40, // beard brown light
};

const ANGRY = { Y: 'R', y: 'r', d: 'R' }; // boss eyes/core glow red when attacking

// --- parts ---------------------------------------------------------------------

const P = {
  // WALKER: one-eyed dome bot
  walkerBody: [
    '....KKKKKKK.....',
    '..KKRPPRRRRKK...',
    '.KRPWPRRRRRRRK..',
    '.KRPRRRRKKKKKRK.',
    'KRRRRRRRKWCSWKRK',
    'KRRRRRRRKWWSWKRK',
    'KrRRRRRRKCWWWKRK',
    'KrrRRRRRRKKKKRrK',
    'KwGdGGGdGGGdGGgK',
    '.KKKKKKKKKKKKKK.',
  ],
  walkerLegsA: [
    '...KgK....KgK...',
    '...KwK....KwK...',
    '..KdgK....KdgK..',
    '.KGwGK...KGwGK..',
    'KGGGgK...KGGGgK.',
    'KKKKKK...KKKKKK.',
  ],
  walkerLegsB: [
    '....KgK..KgK....',
    '...KwK....KwK...',
    '..KdgK.....KdgK.',
    '.KGwGK....KGwGK.',
    'KGGGgK....KGGGgK',
    'KKKKKK....KKKKKK',
  ],

  // HOPPER: frog bot
  hopperSit: [
    '..KKKK....KKKK..',
    '.KWWWSK..KSWWWK.',
    '.KWCSSKKKKSSCWK.',
    'KEKKKKENNEKKKKEK',
    'KEEEEENEENEEEEEK',
    'KENEEEEEEEEEENEK',
    'KEEEKRRRRRRKEEEK',
    'KEEEEKKKKKKEEEEK',
    'KeEEGGGGGGGGEEeK',
    'KeeEGwGGGGwGEeeK',
    '.KeeEGGGGGGEeeK.',
    'KEEKKeeeeeeKKEEK',
    'KEEEK......KEEEK',
    'KKKKK......KKKKK',
  ],
  hopperJump: [
    '...KKK....KKK...',
    '..KWWSK..KSWWK..',
    '..KWCSKKKKSCWK..',
    '.KEKKKEEEEKKKEK.',
    '.KEEEEEEEEEEEEK.',
    '.KENEEKRRKEENEK.',
    '.KEEEEKKKKEEEEK.',
    '.KeEEEEEEEEEEeK.',
    '..KeeGGGGGGeeK..',
    '..KeeeeeeeeeeK..',
    '..KEK......KEK..',
    '.KEK........KEK.',
    'KEEK........KEEK',
    'KKKK........KKKK',
  ],

  // TURRET: armored dome that opens to fire
  turretBase: [
    'KKKKKKKKKKKKKKKK',
    'KwGGGGGGGGGGGGgK',
    'KGgKGGGgKGGGgKgK',
    'KGdGGGGGGGGGGdgK',
    'KggggggggggggggK',
    'KKKKKKKKKKKKKKKK',
  ],
  turretShut: [
    '....KKKKKKKK....',
    '...KwwGGGGGgK...',
    '..KwGGGGGGGGgK..',
    '.KwGGGGGGGGGGgK.',
    '.KGyGGyGGyGGygK.',
    '.KGgggggggggggK.',
    '.KggKKKKKKKKggK.',
    '.KKKdddddddKKKK.',
  ],
  turretLid: [
    '....KKKKKKKK....',
    '...KwwGGGGGgK...',
    '..KwGGGGGGGGgK..',
    '.KwGGGGGGGGGGgK.',
    '.KGgggggggggggK.',
    '.KKKKKKKKKKKKKK.',
  ],
  turretEye: [
    '..KdddKKKKdddK..',
    '..KddKRRYRKddK..',
    '..KddKRrrRKddK..',
    '..KdddKKKKdddK..',
  ],

  // FLYER: purple drone (wings drawn per frame, mirrored)
  flyerBody: [
    '..KKKK..',
    '.KUUUUK.',
    'KUuCCuUK',
    'KUCWCCUK',
    'KUuCCuUK',
    '.KuUUuK.',
    '..KKKK..',
  ],
  flyerWingUp: ['KK...', 'KUK..', 'KUUKK', 'KuUUK', '.KuUK', '..KK.'],
  flyerWingDown: ['..KK.', '.KuUK', 'KuUUK', 'KUUKK', 'KUK..', 'KK...'],

  // LURKER: camouflage lizard with a turret eye
  lurkerBody: [
    '...........KKKK...',
    '..........KEEEEK..',
    '...KeKeKeKEEKKKEK.',
    '..KEEEEEEEEKYYSKEK',
    '.KENNEENNEEKYYKEEK',
    'KKENEENEENEEKKEEK.',
    'KeKeEEEEEEEEEEEK..',
    'KeKKeeeeeeeeeeK...',
  ],
  lurkerLegsA: ['.KK.KeK...KeK.....', '...KeeK...KeeK....', '...KKKK...KKKK....'],
  lurkerLegsB: ['.KK..KeK.KeK......', '....KeeKKeeK......', '....KKKKKKKK......'],

  // SPITTER: carnivorous plant
  spitterStem: [
    '.......KEK......',
    '..KKK..KEK..KKK.',
    '.KNEEKKKEKKKEENK',
    '..KEEEEKEKEEEEK.',
    '...KKKKKEKKKKK..',
    '......KMMMK.....',
  ],
  spitterBud: [
    '......KKKK......',
    '.....KRRPRK.....',
    '....KRRRRPRK....',
    '...KRRrRRRPRK...',
    '...KRrRRRRRRK...',
    '...KRRRRRrRRK...',
    '....KRRRRRRK....',
    '.....KrRRrK.....',
    '......KKKK......',
  ],
  spitterOpen: [
    '..KK........KK..',
    '.KRPK......KPRK.',
    '.KRRPK....KPRRK.',
    '..KRRKKKKKKRRK..',
    '..KRKWSWSWSKRK..',
    '..KRKSSYYSSKRK..',
    '..KRKSSSSSSKRK..',
    '..KRRKWSWSWKRK..',
    '...KRRrRRrRRK...',
    '....KKKKKKKK....',
  ],

  // SLIDER: penguin bot
  sliderBody: [
    '.....KKKKK......',
    '....KSSSSSK.....',
    '...KSSSSWSSK....',
    '...KSSSWSKSK....',
    '..KSRRRRRRSOOK..',
    '..KSSWWWWSSOK...',
    '.KSSWWWWWWSK....',
    '.KSWWWWWWWWSK...',
    'KsSWWWWWWWWSsK..',
    'KsSWWWWWWWWSsK..',
    '.KSSWWWWWWSSK...',
    '..KSSSSSSSSK....',
  ],
  sliderFeetA: ['..KOOK..KOOK....', '.KOOOK.KOOOK....'],
  sliderFeetB: ['...KOOK.KOOK....', '..KOOOKKOOOK....'],

  icicle: [
    'KKKKKKKKKK',
    'KcCCCCCCqK',
    '.KcCCCCqK.',
    '.KcCCCCqK.',
    '..KcCCqK..',
    '..KcCCqK..',
    '..KcCCqK..',
    '...KcqK...',
    '...KcqK...',
    '...KcqK...',
    '....KK....',
  ],

  // BOMBER: red bird
  bomberBody: [
    '.........KKKKK....',
    '..KKKKKKKRRRRRK...',
    '.KRRRRRRRRRRRWSKK.',
    'KRrRrRRrRRRRWWKYYK',
    '.KrrRrRRrRRRRKYYK.',
    '..KrrrRRRRRRRK.K..',
    '...KKKrrrrrrK.....',
    '.....KKKKKKK......',
  ],
  bomberWingUp: ['KK.....', 'KRKK...', 'KRRRKK.', '.KrRRRK', '..KKKKK'],
  bomberWingDown: ['..KKKKK', '.KrRRRK', 'KRRRKK.', 'KK.....'],

  // SPARKER: imp on a cloud
  sparkerImp: [
    'K.KKKK.K',
    'KKUUUUKK',
    'KUYUUYUK',
    'KUSUUSUK',
    'KUUUUUUK',
    '.KuWWuK.',
    'KUUUUUUK',
    'KuUUUUuK',
    '.KKKKKK.',
  ],
  sparkerArm: ['KYK', 'KYK', 'KUK', 'KUK', 'KUK', '.K.'],
  cloud: [
    '.....KKK...KKK......',
    '...KKwwwKKKwwwKK....',
    '..KWWWWWWWWWWWWWKK..',
    '.KWWWWWWWWWWWWWWWWK.',
    'KWWWWWWWWWWWWWWWWWWK',
    'KWWWWWWWWWWWWWWWWWWK',
    'KwWWWWWWWWWWWWWWWWwK',
    '.KwwwWWWWWWWWWWwwwK.',
    '..KKKwwwwwwwwwwKKK..',
    '.....KKKKKKKKKK.....',
  ],

  // ANVIL (boss)
  // An anvil for a head (horn to the right), glowing visor; furnace-grate chest.
  anvilHead: [
    '..KKKKKKKKKKKKKKKKKKKKKKKKKK....',
    '.KW' + 'w'.repeat(25) + 'KKK.',
    'Kw' + 'G'.repeat(28) + 'wK',
    '.K' + 'g'.repeat(25) + 'GGKK.',
    '...KKKKGGGGGGGGGGGGGGGGGGKKK....',
    '......KGGwGGGGGKKKKKKKKGGK......',
    '......KGGGGGGGGKRYYYYRKGgK......',
    '......KGGGGGGGGKrRRRRrKGgK......',
    '......KgGGGgGGGKKKKKKKKGgK......',
    '......KKKKKKKKKKKKKKKKKKKK......',
  ],
  anvilTorso: [
    '.KKKKKKKKKKKKKKKKKKKKKKKK.',
    'KP' + 'R'.repeat(22) + 'rK',
    'KRRgR' + 'K'.repeat(16) + 'RgRrK',
    'KRRRK' + 'w'.repeat(16) + 'KRRrK',
    'KRRRKGKOOOOOOOOOOOOKGKRRrK',
    'KRRRKGKOYYOYYOYYOYOKGKRRrK',
    'KRRRKGKOyyOyyOyyOyOKGKRRrK',
    'KRRRKG' + 'K'.repeat(14) + 'GKRRrK',
    'KRRRK' + 'g'.repeat(16) + 'KRRrK',
    'KrRRR' + 'K'.repeat(16) + 'RRRrK',
    'Krr' + 'R'.repeat(20) + 'rrK',
    'K'.repeat(26),
    'KSSSSSGGSSSSSSSSSSSGGSSSSK',
    'KSsSSSggSSSSSSSSSSSggSSsSK',
    'K'.repeat(26),
  ],
  anvilFist: ['KKKKKK', 'KwWwGK', 'KGGGgK', 'KgGGgK', 'KKKKKK', 'KwGGgK', 'KGKGKK', 'KGGGgK', 'KgggKK', '.KKKK.'],
  anvilCannon: ['KKKKKKKKK.', 'KwWwwGGGgK', 'KGGGGGGKKK', 'KGKGKGGKYK', 'KGGGGGGKKK', 'KgggggggGK', 'KKKKKKKKK.'],
  anvilLeg: ['..KSSSSK..', '..KSssSK..', '..KGwGGK..', '..KSSSSK..', '.KKKKKKKK.', 'KwWwGGGGgK', 'KGGGGGGGgK', 'KKKKKKKKKK'],
  anvilLegShort: ['..KSSSSK..', '..KGwGGK..', '.KKKKKKKK.', 'KwWwGGGGgK', 'KGGGGGGGgK', 'KKKKKKKKKK'],
  anvilLegCrouch: ['..KGwGGK..', '.KKKKKKKK.', 'KwWwGGGGgK', 'KKKKKKKKKK'],

  // FROSTLINE (boss)
  frostBody: [
    '.........KKKKKKKKKK.........',
    '.......KKBBBBBBBBBBKK.......',
    '.....KKBBcBBBBBBBBBBBKK.....',
    '....KBBccBBBBBBBBBBBBBBK....',
    '...KBBcBBBBBBBBKKKBBBBBBK...',
    '..KBBBBBBBBBBBKWWSKBBBBBBK..',
    '..KBBBBBBBBBBBKWWWKBBBBOOOK.',
    '.KBBBBBBBBBBBBBKKKBBBBBOOOOK',
    '.KBBBBBBccccccccBBBBBBBKKKK.',
    'KBBBBBBcccWccccWccBBBBBBBK..',
    'KBBBBBccccccccccccccBBBBBK..',
    'KbBBBBcccWcccccccWccBBBBbK..',
    'KbBBBBcccccCcccccccBBBBBbK..',
    'KbbBBBBcccccWccccccBBBBbbK..',
    '.KbbBBBBccccccccccBBBBbbK...',
    '.KbbbBBBBBBBBBBBBBBBBbbbK...',
    '..KbbbbBBBBBBBBBBBBbbbbK....',
    '...KKbbbbbbbbbbbbbbbbKK.....',
    '.....KKKKKKKKKKKKKKKK.......',
  ],
  frostFeet: [
    '......KbbbK......KbbbK......',
    '.....KbbbbbK....KbbbbbK.....',
    '....KbbbbbbbK..KbbbbbbbK....',
    '....KKKKKKKKK..KKKKKKKKK....',
  ],
  frostFlipper: ['..KKK.', '.KbBK.', 'KbBBK.', 'KbBBK.', 'KbBBK.', 'KcbK..', 'KKK...'],
  frostFlipperUp: ['..KK..', '.KcCK.', 'KcCCK.', '.KBBK.', '.KBBK.', 'KBBBK.', 'KbbK..', 'KKK...'],
  iceSkid: ['.c..c...c..c', 'c..C...c..C.'],
  // An ice-crystal crest on his head.
  frostCrest: ['..K....K....', '.KcK..KCK...', '.KCK.KcCK.K.', 'KcCcKKCcCKcK'],

  // GALE (boss)
  galeProp: ['KKKKKKKKK....KKKKKKKKK', 'KWwwwwwwwKKKKwwwwwwwWK', 'KKKKKKKKKKYYKKKKKKKKKK'],
  galeHub: ['.KYYK.', '.KyyK.', 'KKKKKK'],
  galeBody: [
    '...KKKKKKKKKK...',
    '..KWWWWWWWWWWK..',
    '.KWWwwwwwwWWWWK.',
    'KWWwWWWWKKKKKWWK',
    'KWwWWWWKSSSWVKWK',
    'KWwWWWWKSSSVVKWK',
    'KWWWWWWWKKKKKWWK',
    'KBBYBBBBBBBBYBBK',
    'KbBBbBBbBBbBBBbK',
    'KWWdWWWWWWWWdWWK',
    'KwWWWWWWWWWWWWwK',
    '.KwWWWWWWWWWWwK.',
    '..KwwWWWWWWwwK..',
    '...KKwwwwwwKK...',
    '.....KKKKKK.....',
    '......KbbK......',
  ],
  galeWing: ['.......KK', '.....KKBK', '...KKBcBK', '.KKBcBBbK', 'KBcBBBbbK', 'KbBcBbbK.', '.KbbbbK..', '..KKKK...'],
  galeWingUp: ['KK.......', 'KBKK.....', 'KBcBKK...', 'KbBcBBKK.', '.KbBcBBBK', '..KbbBcBK', '...KKbbbK', '.....KKKK'],
  galeWingDown: ['.....KKKK', '...KKbbbK', '..KbbBcBK', '.KbBcBBBK', 'KbBcBBKK.', 'KBcBKK...', 'KBKK.....', 'KK.......'],
  galeTalons: ['..KbK..KbK..', '..KbK..KbK..', '.KYWYK.KYWYK', '.KKKKK.KKKKK'],

  // --- player shots -------------------------------------------------------------
  bullet: ['.YYYY.', 'YYWWWY', 'yYWWWY', '.yYYY.'],
  charge1: [
    '...CCCC...',
    '.qCCcccC..',
    'qCcWWWWcC.',
    'qCcWWWWWcC',
    'qCcWWWWWcC',
    'qCcWWWWcC.',
    '.qCCcccC..',
    '...CCCC...',
  ],
  charge2: [
    '...........OOOOOO.....',
    '........OOOYYYYYYOO...',
    '......OOYYYYWWWWYYYO..',
    '...yyOYYYWWWWWWWWWYYO.',
    '.yyOOYYWWWWWWWWWWWWYYO',
    'yOOYYYWWWWWWWWWWWWWWYO',
    'yOYYYWWWWWWWWWWWWWWWYO',
    'yOYYYWWWWWWWWWWWWWWWYO',
    'yOOYYYWWWWWWWWWWWWWWYO',
    '.yyOOYYWWWWWWWWWWWWYYO',
    '...yyOYYYWWWWWWWWWYYO.',
    '......OOYYYYWWWWYYYO..',
    '........OOOYYYYYYOO...',
    '...........OOOOOO.....',
  ],
  // Ground shockwave (player's Quake Wave; Anvil's is recolored).
  quakeWave: [
    '...WW...',
    '..wWWw..',
    '..wWWw..',
    '.wwWWww.',
    '.rwWWwr.',
    '.rRwwRr.',
    'rRRwwRRr',
    'rRRRRRRr',
    'rRRRRRRr',
    'rrRRRRrr',
    'rrrRRrrr',
    'gGgGGgGg',
  ],
  shuriken: [
    '....KK....',
    '...KNNK...',
    '...KNEK...',
    '.KKKEEKKK.',
    'KNNEEYEeeK',
    'KNEEYEEeeK',
    '.KKKEeKKK.',
    '...KEeK...',
    '...KeeK...',
    '....KK....',
  ],
  frostSpike: [
    'KKKK........',
    'KccCCKKKK...',
    'KcWcCCCCqKK.',
    'KqccCCCCqqqK',
    'KqqqKKKKK...',
    'KKKK........',
  ],

  // --- enemy shots -----------------------------------------------------------------
  pellet: ['.PP.', 'PWWP', 'PWWP', '.PP.'],
  orb: ['..RR..', '.RYYR.', 'RYWWYR', 'RYWWYR', '.RYYR.', '..RR..'],
  iceShard: ['..KK..', '.KcCK.', 'KcCCqK', 'KcCqqK', '.KCqK.', '..KK..'],
  iceBlock: [
    'KKKKKKKKKKKKKK',
    'KccccccccccCqK',
    'KcWWcCCCCCCCqK',
    'KcWCCCCCCCCCqK',
    'KcCCCCCCCCCCqK',
    'KcCCCCCcCCCCqK',
    'KcCCCCcCCCCCqK',
    'KcCCCcCCCCCCqK',
    'KcCCCCCCCCCCqK',
    'KcCCCCCCCCCCqK',
    'KcCCCCCCCCCqqK',
    'KCCCCCCCCCqqqK',
    'KqqqqqqqqqqqqK',
    'KKKKKKKKKKKKKK',
  ],
  seed: ['.KKKK.', 'KMyyMK', 'KMyMMK', 'KMMMMK', 'KMMMdK', '.KKKK.'],
  egg: ['..KK..', '.KWWK.', 'KWWWwK', 'KWWWwK', 'KWPWwK', 'KWWwwK', '.KwwK.', '..KK..'],
  bolt: ['...KK.', '..KYK.', '.KYYK.', '.KYK..', 'KYYKKK', 'KYWWYK', 'KKKYYK', '..KYK.', '.KYK..', '.KYK..', 'KYK...', 'KK....'],

  // --- pickups -----------------------------------------------------------------------
  hpSmall: ['.KKKKKK.', 'KRRWWRRK', 'KWWWWWWK', 'KRRWWRRK', 'KrrrrrrK', '.KKKKKK.'],
  hpBig: [
    '.KKKKKKKKKK.',
    'KPRRRRRRRRrK',
    'KRRRRWWRRRrK',
    'KRRRRWWRRRrK',
    'KRWWWWWWWWrK',
    'KRWWWWWWWWrK',
    'KRRRRWWRRRrK',
    'KRRRRWWRRRrK',
    'KrrrrrrrrrrK',
    '.KKKKKKKKKK.',
  ],
  ammoSmall: ['.KKKKKK.', 'KVcVVVVK', 'KVVKKVVK', 'KVVKKVVK', 'KbVVVVbK', '.KKKKKK.'],
  goal: [
    '....KKKKKKKK....',
    '...KVVVVVVVVK...',
    '..KVcWWWWWWcVK..',
    '..KVWWWWWWWWVK..',
    '..KVWWWWWWWWVK..',
    '..KVWWVVVVWWVK..',
    '..KVWWWWWWWWVK..',
    '..KVWWWWWWWWVK..',
    '..KVWWVVVVWWVK..',
    '..KVWWWWWWWWVK..',
    '..KVWWWWWWWWVK..',
    '..KVWWVVVVWWVK..',
    '..KVWWWWWWWWVK..',
    '..KVcWWWWWWcVK..',
    '...KVVVVVVVVK...',
    '....KKKKKKKK....',
  ],

  // --- power plant enemies --------------------------------------------------------
  zapper: [
    '.....KKKKKK.....',
    '....KYYYYYYK....',
    '....KYWWYYYK....',
    '.....KKKKKK.....',
    '......KyyK......',
    '.....KOYOOK.....',
    '......KyyK......',
    '.....KOYOOK.....',
    '......KyyK......',
    '.....KOYOOK.....',
    '....KKKKKKKK....',
    '...KGGGGGGGGK...',
    '..KwGGGGGGGGgK..',
    '..KGgKGGGGKggK..',
    '..KggggggggggK..',
    '..KKKKKKKKKKKK..',
  ],
  roller: [
    '....KKKKKK....',
    '..KKwwGGGGKK..',
    '.KwwWwGGGGGgK.',
    '.KwWwGGGGGGgK.',
    'KwwGGGGGGGGGgK',
    'KwGGGGKKGGGGgK',
    'KGGGGKddKGGGgK',
    'KGGGGKddKGGggK',
    'KGGGGGKKGGGggK',
    'KgGGGGGGGGgggK',
    '.KgGGGGGGgggK.',
    '.KggGGGgggggK.',
    '..KKgggggggK..',
    '....KKKKKK....',
  ],
  // --- caldera enemies -------------------------------------------------------------
  ember: [
    '....KKKK....',
    '...KYYYYK...',
    '..KYWWYYOK..',
    '.KYWYYYYOOK.',
    'KYYYKYYKYOOK',
    'KYYYKYYKOOOK',
    'KOYYYYYYOOrK',
    'KOOYYYYOOOrK',
    '.KOOOOOOOrK.',
    '..KrOOOOrK..',
    '...KrrrrK...',
    '....KKKK....',
  ],
  slugBody: [
    '.........KKKKKK...',
    '......KKKrRPRRrK..',
    '....KKrrRRYRRRRYK.',
    '..KKrrRRPRRRRRRRK.',
    '.KrrRRYRRRRYRRRRRK',
    'KrrRRRRRRRRRRRRRRK',
    'KrrrRRRRRRRRRRRRrK',
    'KdrrrrrrrrrrrrrrrK',
  ],
  slugFootA: ['KOdOdOdOdOdOdOdOdK', '.KKKKKKKKKKKKKKKK.'],
  slugFootB: ['KdOdOdOdOdOdOdOdOK', '.KKKKKKKKKKKKKKKK.'],
  // --- scrapyard enemies ---------------------------------------------------------
  saw: [
    '...K.KKKK.K...',
    '..KwKwwwwKwK..',
    '.KwwwGGGGwwwK.',
    'KKwGGGGGGGGwKK',
    '.KwGGGgggGGGK.',
    'KwGGGgKKgGGGwK',
    'KwGGgKddKgGGwK',
    'KwGGgKddKgGGwK',
    'KwGGGgKKgGGGwK',
    '.KwGGGgggGGGK.',
    'KKwGGGGGGGGwKK',
    '.KwwwGGGGwwwK.',
    '..KwKwwwwKwK..',
    '...K.KKKK.K...',
  ],
  junkbot: [
    '.....KKKKKK.....',
    '....KGGGGGGK....',
    '....KGKVVKGK....',
    '....KGGGGGGK....',
    '..KKKKKKKKKKKK..',
    '.KMMMMMMMMMMMMK.',
    'KGKMyMMMMMMyMKGK',
    'KGKMMMMMMMMMMKGK',
    'KGKMMKKKKKKMMKGK',
    'KgKMMoooMMMMMKgK',
    '.KKMMMMMMMMMMKK.',
    '..KMyMMMMMMyMK..',
    '..KMMMMMMMMMMK..',
    '..KKKKKKKKKKKK..',
    '...KgK....KgK...',
    '...KgK....KgK...',
    '..KGGGK..KGGGK..',
    '..KKKKK..KKKKK..',
  ],
  junkArm: ['.KK', 'KMK', 'KGK', 'KGK', 'KGK'],
  // --- reef enemies ----------------------------------------------------------------
  puffer: [
    '.....KKKKK....',
    '...KKYYYYYKK..',
    '..KYYYYYYWSYK.',
    'K.KYYYYYYWWYYK',
    'KKYYyYYyYYYYOK',
    'KYKYYYYYYYYYYK',
    'KYKcccccccYYYK',
    'KKKccccccccYK.',
    '...KcccccccK..',
    '....KKKKKKK...',
    '..............',
    '..............',
  ],
  pufferPuffed: [
    '...K..K..K....',
    '..KYKKYKKYK...',
    '.KYYYYYYYYYK..',
    'KYYYYYYYYWSYK.',
    '.KYYYYYYYWWYYK',
    'KYYyYYyYYyYYOK',
    '.KYYYYYYYYYYYK',
    'KYcccccccccYK.',
    '.KcccccccccK..',
    '..KKcKKcKKK...',
    '...K..K..K....',
    '..............',
  ],
  clamShut: [
    '................',
    '................',
    '................',
    '....KKKKKKKK....',
    '..KKPPPPPPPPKK..',
    '.KPPWPPPPPPPPPK.',
    'KPPPPKPPPPKPPPPK',
    'KPPPPPKPPKPPPPPK',
    'KKKKKKKKKKKKKKKK',
    'KrPPPPPPPPPPPPrK',
    '.KrrPPPPPPPPrrK.',
    '..KKKKKKKKKKKK..',
  ],
  clamOpen: [
    '..KKKKKKKKKKKK..',
    '.KPPWPPPPPPPPPK.',
    'KPPPPKPPPPKPPPPK',
    'KKKKKKKKKKKKKKKK',
    '..KddddddddddK..',
    '..KdddKWWKdddK..',
    '..KdddKWcKdddK..',
    '..KddddKKddddK..',
    'KKKKKKKKKKKKKKKK',
    'KrPPPPPPPPPPPPrK',
    '.KrrPPPPPPPPrrK.',
    '..KKKKKKKKKKKK..',
  ],

  // --- VOLT (boss) ----------------------------------------------------------------
  voltHead: [
    'K............K',
    'KYK........KYK',
    '.KYK......KYK.',
    '..KYKKKKKKYK..',
    '...KsSSSSSK...',
    '..KSKVVVVKSK..',
    '..KSKVWVVKSK..',
    '..KSKKKKKKSK..',
    '...KSSYYSSK...',
    '....KKKKKK....',
  ],
  // A battery in the chest with its charge glowing; coil rings on the limbs.
  voltBody: [
    '..KKKKKKKKKKKKKK..',
    '.KSsSSSSSSSSSSsSK.',
    'KSsSS' + 'K'.repeat(8) + 'SSsSK',
    'KSsSKYYYYYYYYKSsSK',
    'KSsSKYWWYYYyyKSsSK',
    'KSsSKyyyyyyyyKSsSK',
    'KSsSS' + 'K'.repeat(8) + 'SSsSK',
    'KSSSSSSGGGGSSSSSSK',
    '.KSSSSSGwwGSSSSSK.',
    '..KKKKKKKKKKKKKK..',
    '...KSSK....KSSK...',
    '...KSsK....KSsK...',
  ],
  voltLegs: [
    '...KSSK....KSSK...',
    '...KYYK....KYYK...',
    '..KKKKKK..KKKKKK..',
    '.KSsSSSK..KSsSSSK.',
    '.KYYYYYK..KYYYYYK.',
    '.KKKKKKK..KKKKKKK.',
  ],
  voltArm: ['KKKK', 'KSsK', 'KYYK', 'KSsK', 'KYYK', 'KKKK', 'KCWK', 'KCCK', 'KccK', 'KKKK'],
  voltArmUp: ['KWYK', 'KYYK', 'KCCK', 'KKKK', 'KSsK', 'KYYK', 'KSsK', 'KYYK', 'KSsK', 'KKKK'],

  // --- MAGMA (boss) ----------------------------------------------------------------
  // Basalt with glowing lava seams; ember eyes.
  magmaBody: [
    '........KKKKKKKKKK........',
    '.....KKKgGGgGGGGgGKKK.....',
    '....KgGGgYOgGGGGGGGGgK....',
    '...KgGGgOOgGGGGGKKKKGGK...',
    '..KgGGGgOgGGGGGKYYYKGGgK..',
    '..KgGGgOgGGGGGGKYRYKGGgK..',
    '.KgGGgOOgGGGGGGGKKKKGGGgK.',
    '.KgGGgOYOg' + 'G'.repeat(13) + 'gK.',
    'KgGGGgOOgGGGGGgOOgGGGGGGgK',
    'KgGGgOYOgGGGGgOYYOgGGGGggK',
    'KgGGgOOgGGGGGGgOOgGGGGgggK',
    'KggGGgggGGGGGGGgOgGGGGgggK',
    '.KggGGGGGGGGGGGGGgOgGGggK.',
    '.KgggGGGGGGGGGGGGGGgggK...',
    '..KKgggggggggggggggggKK...',
    '....KKKKKKKKKKKKKKKKK.....',
  ],
  magmaLegs: [
    '....KgggK......KgggK......',
    '....KgOgK......KgOgK......',
    '...KgGOGgK....KgGOGgK.....',
    '..KRgGGGgRK..KRgGGGgRK....',
    '..KgggggggK..KgggggggK....',
    '..KKKKKKKKK..KKKKKKKKK....',
  ],
  magmaFist: ['.KKKK.', 'KgGGgK', 'KGOGgK', 'KgOYgK', 'KgGGgK', '.KKKK.', 'KgGOgK', 'KGOGgK', 'KgGGgK', '.KKKK.'],
  magmaFistFire: ['.KYYK.', 'KYWWYK', 'KOYYOK', '.KKKK.', 'KgGGgK', 'KGRGGK', 'KgGGgK', 'KGGGgK', 'KgGGgK', '.KKKK.'],

  // --- SCRAP (boss) ----------------------------------------------------------------
  scrapBody: [
    '..KKKKKKKKKKKKKKKKKKKK..',
    '.KMMMMyMMMKGGGGGKMMyMMK.',
    'KMMMKKKKKKKKKKKKKKKKMMMK',
    'KMMMKRRKddddddddKRRKMMMK',
    'KMMMKKKKKKKKKKKKKKKKMMMK',
    'KMyMMMMMMoooMMMMMMMMMyMK',
    'KMMMMGGGGGGGGGGGGGGMMMMK',
    'KMMMMGwwwwwwwwwwwwGMMMMK',
    'KMMMMGGGGKKKKKKGGGGMMMMK',
    'KMMMMGGGGKYYYYKGGGGMMMMK',
    'KMMMMGGGGKKKKKKGGGGMMMMK',
    'KMMMMggggggggggggggMMMMK',
    'KMyMdMMMMMMMMMMMMMMdMyMK',
    'KMMMMMMMMMMMMMMMMMMMMMMK',
    '.KKKKKKKKKKKKKKKKKKKKKK.',
    '...KgGGgK......KgGGgK...',
    '..KgGGGGgK....KgGGGGgK..',
    '.KKKKKKKKKK..KKKKKKKKKK.',
  ],
  scrapAntenna: ['..KK..', '.KRRK.', '..KK..', '..KK..'],
  scrapArm: ['.KKKK.', 'KMMMMK', 'KMyMMK', 'KMMMMK', 'KMMMMK', '.KKKK.', 'KGGGGK', 'KGKKGK', 'KG..GK', 'KK..KK'],
  scrapArmUp: ['.KwwK.', 'KwGGwK', 'KGddGK', 'KwGGwK', '.KwwK.', '..KK..', '.KMMK.', '.KMMK.', '.KMMK.', '.KMMK.', '.KMMK.', '.KKKK.'],
  scrapMagnet: [
    '..KKKKKKKK',
    '.KRRRRRRWK',
    'KRRKKKKKKK',
    'KRK.......',
    'KRK.......',
    'KRRKKKKKKK',
    '.KRRRRRRWK',
    '..KKKKKKKK',
  ],

  // --- TIDE (boss) -------------------------------------------------------------------
  tideBody: [
    '.............KK...................',
    '............KbcK..................',
    '...........KbBcK..................',
    '.......KKKKKbBBBKKKKKKK...........',
    '....KKKbbbbBBBBBBBBBBBBBKKK.......',
    '..KKbbbBBBBcBBBBBBBBBBBBBBBKK.....',
    'KKbbBBBBBBBBccBBBBBBBBBBBKWWSBKK..',
    'KbKbBBBBBBBBBBBBBBBbBbBbBBKWWBBBK.',
    'KbbKBBBBBBBBBBBBBBBbBbBbBBBBBBBBBK',
    'KbbbKBBBBBBBBBBBBBBBBBBBBBBKWKWKWK',
    'KbbKcccccccccccccccccccccccKKKKKK.',
    'KbK.KccccccccccccccccccccccWKWKWK.',
    'KK...KKccccccccccccccccccKKKKKK...',
    '......KKKKccccccccccccKKKK........',
    '..........KKKKKKKKKKKK............',
  ],
  tideMouth: ['KKKKKKK', 'KrrrrrK', 'KRWRWRK', 'KKKKKKK'],
  speedLines: ['ww......', '..wwww..', 'w.......', '...www..'],

  arc: ['.C....C...', 'CYC..CYC..', 'Y.YCCY.YC.', '...YY...YC', '.........Y', '..........'],
  scrapChunk: ['.KKKK...', 'KGGgKK..', 'KGwGGgK.', 'KgGGKGgK', '.KGgGGK.', '..KMMgK.', '...KKK..', '........'],
  flameLick: ['...Y....', '..YWY...', '..YWYO..', '.OYYYO..', '.OYYYOO.', 'OOYYYYO.', 'ORYYYRO.', 'ORROORRO', '.RRRRRR.', '........'],
  hotdog: ['..nnnnnnnnnn..', '.nRRRRRRRRRRn.', 'nRYRRYRRYRRYRn', 'nnRRRRRRRRRRnn', '.nnnnnnnnnnnn.', '..............'],
};

// --- frames --------------------------------------------------------------------
// [part, x, y, { map, flip }?] drawn in order (back to front).

const mantis = (pose) => ({
  w: 30,
  h: 32,
  layers: [[pose === 'jump' ? 'mantisJump' : pose === 'throw' ? 'mantisThrow' : 'mantisIdle', 0, 0]],
});

const frost = (pose) => {
  if (pose === 'slide') {
    return { w: 32, h: 28, layers: [['iceSkid', 0, 25], ['frostCrest', 11, 6], ['frostBody', 2, 9], ['frostFlipper', 22, 18]] };
  }
  return {
    w: 32,
    h: 28,
    layers: [
      ['frostFeet', 2, 24],
      ['frostCrest', 11, 2],
      ['frostBody', 2, 5],
      pose === 'shoot' ? ['frostFlipperUp', 26, 9] : ['frostFlipper', 0, 14],
    ],
  };
};

const gale = (pose) => {
  const wing = pose === 'blow' ? ['galeWingUp', 4] : pose === 'dive' ? ['galeWingDown', 16] : ['galeWing', 10];
  return {
    w: 34,
    h: 28,
    layers: [
      [wing[0], 0, wing[1]],
      [wing[0], 25, wing[1], { flip: true }],
      ['galeProp', 6, 2],
      ['galeHub', 14, 5],
      ['galeTalons', 11, 24],
      ['galeBody', 9, 8],
    ],
  };
};

/**
 * Tornado funnel, generated rather than hand-drawn: wide at the top, narrowing
 * to a point at the bottom, with diagonal bands that shift by `frame` so two
 * frames read as spinning. `cols` = [band, band, highlight].
 */
function tornado(w, h, frame, cols) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    const half = Math.max(1, Math.round((w / 2) * (1 - (y / h) * 0.85)));
    const x0 = Math.floor(w / 2) - half;
    let row = '';
    for (let x = 0; x < w; x++) {
      if (x < x0 || x >= x0 + half * 2) row += '.';
      else if (x === x0 || x === x0 + half * 2 - 1) row += 'K';
      else row += cols[Math.floor((x + y * 2 + frame * 3) / 3) % 3];
    }
    rows.push(row);
  }
  return rows;
}
/** Filled circle with an outline and a highlight, as a text grid. */
function disc(size, fill, outline, light) {
  const r = size / 2;
  const rows = [];
  for (let y = 0; y < size; y++) {
    let row = '';
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - r, y + 0.5 - r);
      if (d > r) row += '.';
      else if (d > r - 1.2) row += outline;
      else if (Math.hypot(x + 0.5 - r * 0.65, y + 0.5 - r * 0.65) < r * 0.28) row += light;
      else row += fill;
    }
    rows.push(row);
  }
  return rows;
}

/** Ring of spark clusters (Spark Ring). */
function sparkRing(size) {
  const r = size / 2 - 2;
  const rows = Array.from({ length: size }, () => Array(size).fill('.'));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const cx = Math.round(size / 2 + Math.cos(a) * r - 0.5);
    const cy = Math.round(size / 2 + Math.sin(a) * r - 0.5);
    for (const [dx, dy, ch] of [[0, 0, 'W'], [1, 0, 'Y'], [-1, 0, 'Y'], [0, 1, 'Y'], [0, -1, 'Y'], [1, 1, 'C'], [-1, -1, 'C']]) {
      const x = cx + dx;
      const y = cy + dy;
      if (x >= 0 && y >= 0 && x < size && y < size) rows[y][x] = ch;
    }
  }
  return rows.map((r) => r.join(''));
}

/** Vertical column of fire or water: wobbly edges, bright core. */
function column(w, h, edge, mid, core, seed = 0) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    const wobble = Math.round(Math.sin((y + seed) * 0.7) * 1.2);
    const half = Math.max(2, Math.round(w / 2 - 1 + wobble - (y < 4 ? 4 - y : 0)));
    let row = '';
    for (let x = 0; x < w; x++) {
      const d = Math.abs(x + 0.5 - w / 2);
      row += d > half ? '.' : d > half - 1.5 ? edge : d > half / 3 ? mid : core;
    }
    rows.push(row);
  }
  return rows;
}

/** Horizontal flame cone, narrow at the hand (left), wide at the tip. */
function flameCone(w, h) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) {
      const half = 1.5 + (x / w) * (h / 2 - 1.5) + Math.sin(x * 0.9 + y) * 0.8;
      const d = Math.abs(y + 0.5 - h / 2);
      row += d > half ? '.' : d > half - 1.2 ? 'R' : d > half / 2 ? 'O' : x > w * 0.25 ? 'Y' : 'W';
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Build a big sprite from rectangles ([x, y, w, h, char], later ones on top),
 * then outline it: any empty cell touching a filled one becomes 'K'.
 */
function boxes(w, h, rects) {
  const g = Array.from({ length: h }, () => Array(w).fill('.'));
  for (const [x, y, rw, rh, ch] of rects) {
    for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) if (yy >= 0 && yy < h && xx >= 0 && xx < w) g[yy][xx] = ch;
  }
  const out = g.map((row) => row.slice());
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (g[y][x] !== '.') continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy]?.[x + dx] && g[y + dy][x + dx] !== '.' && g[y + dy][x + dx] !== 'K');
      if (near) out[y][x] = 'K';
    }
  }
  return out.map((r) => r.join(''));
}

/**
 * Build a sprite from shapes, later ones on top, then outline it like boxes():
 *   ['rect', x, y, w, h, ch]          ['px', x, y, ch]
 *   ['ellipse', cx, cy, rx, ry, ch]   ['poly', [[x, y], ...], ch]
 *   ['line', x0, y0, x1, y1, ch, thickness = 1]
 */
function shapes(w, h, ops) {
  const g = Array.from({ length: h }, () => Array(w).fill('.'));
  const put = (x, y, ch) => {
    x = Math.round(x);
    y = Math.round(y);
    if (y >= 0 && y < h && x >= 0 && x < w) g[y][x] = ch;
  };
  for (const op of ops) {
    const [kind, ...a] = op;
    if (kind === 'rect') {
      const [x, y, rw, rh, ch] = a;
      for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) put(xx, yy, ch);
    } else if (kind === 'px') put(a[0], a[1], a[2]);
    else if (kind === 'ellipse') {
      const [cx, cy, rx, ry, ch] = a;
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
          if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) put(x, y, ch);
    } else if (kind === 'poly') {
      const [pts, ch] = a;
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
        for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
          const px = x + 0.5;
          const py = y + 0.5;
          let inside = false;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const [xi, yi] = pts[i];
            const [xj, yj] = pts[j];
            if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
          }
          if (inside) put(x, y, ch);
        }
      }
    } else if (kind === 'line') {
      const [x0, y0, x1, y1, ch, t = 1] = a;
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        const y = y0 + ((y1 - y0) * i) / n;
        for (let dy = 0; dy < t; dy++) for (let dx = 0; dx < t; dx++) put(x + dx - (t - 1) / 2, y + dy - (t - 1) / 2, ch);
      }
    }
  }
  const out = g.map((row) => row.slice());
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (g[y][x] !== '.') continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy]?.[x + dx] && g[y + dy][x + dx] !== '.' && g[y + dy][x + dx] !== 'K');
      if (near) out[y][x] = 'K';
    }
  }
  return out.map((r) => r.join(''));
}

/**
 * MANTIS (Canopy boss), redesigned: an upright praying-mantis warrior with a
 * triangular head and big compound eyes, a raised serrated scythe forelimb,
 * folded veined wings over a segmented abdomen, and four thin jointed legs.
 * 30 x 32, facing right.
 */
function mantisShape(pose) {
  const jump = pose === 'jump';
  const throwing = pose === 'throw';
  // Legs splay wide so they read as separate limbs.
  const legs = jump
    ? [
        ['line', 12, 22, 6, 24, 'E'], ['line', 6, 24, 9, 28, 'E'],
        ['line', 16, 21, 21, 23, 'E'], ['line', 21, 23, 19, 27, 'E'],
      ]
    : [
        ['line', 12, 23, 6, 26, 'E'], ['line', 6, 26, 2, 31, 'E'],
        ['line', 14, 23, 12, 28, 'E'], ['line', 12, 28, 11, 31, 'E'],
        ['line', 16, 21, 21, 25, 'E'], ['line', 21, 25, 23, 31, 'E'],
        ['line', 16, 22, 17, 27, 'E'], ['line', 17, 27, 16, 31, 'E'],
      ];
  const wings = jump
    ? [
        ['poly', [[16, 11], [3, 4], [1, 8], [6, 13], [15, 15]], 'N'],
        ['line', 15, 12, 3, 6, 'E'], ['line', 11, 12, 4, 9, 'E'],
      ]
    : [
        ['poly', [[17, 11], [7, 21], [5, 25], [9, 24], [17, 16]], 'N'],
        ['line', 16, 13, 7, 23, 'E'], ['line', 13, 17, 8, 22, 'e'],
        // A dark edge along the top of the wing keeps it apart from the body.
        ['line', 17, 11, 7, 21, 'e'],
      ];
  const arm = jump
    ? [
        ['line', 18, 11, 23, 4, 'E', 2],
        ['poly', [[22, 3], [28, 0], [29, 3], [24, 6]], 'c'], ['px', 25, 3, 'w'], ['px', 27, 2, 'w'],
      ]
    : throwing
      ? [
          ['line', 18, 12, 25, 11, 'E', 2],
          ['poly', [[24, 9], [29, 11], [29, 13], [24, 13]], 'c'], ['px', 26, 13, 'w'], ['px', 28, 13, 'w'],
        ]
      : [
          // Praying forelimb: femur up and forward, the blade folded back down with spikes.
          ['line', 18, 12, 25, 6, 'E', 2],
          ['poly', [[24, 5], [27, 7], [24, 16], [21, 16]], 'c'],
          ['px', 23, 9, 'w'], ['px', 22, 11, 'w'], ['px', 22, 13, 'w'], ['px', 21, 15, 'w'],
        ];
  return shapes(30, 32, [
    ...legs,
    // Abdomen with segments, curving down behind.
    ['ellipse', 11, 21, 5, 3.5, 'e'],
    ['line', 8, 19, 8, 24, 'E'], ['line', 11, 18, 11, 24, 'E'], ['line', 14, 19, 14, 23, 'E'],
    ...wings,
    // Thorax: long and slender.
    ['poly', [[15, 10], [19, 10], [18, 22], [15, 23]], 'E'],
    ['line', 16, 11, 16, 21, 'N'],
    ['rect', 17, 7, 3, 4, 'E'],
    // Red collar between head and thorax.
    ['rect', 16, 10, 4, 1, 'R'],
    // Head: a triangle with bulging eyes at the top corners, antennae.
    ['line', 16, 2, 11, 0, 'e'], ['line', 24, 2, 29, 0, 'e'],
    ['poly', [[15, 2], [25, 2], [21, 9], [19, 9]], 'E'],
    ['line', 18, 3, 22, 3, 'N'],
    ['ellipse', 15.5, 3.5, 2.2, 2.4, 'Y'], ['ellipse', 24.5, 3.5, 2.2, 2.4, 'Y'],
    ['ellipse', 15.5, 4.6, 1.8, 1.2, 'O'], ['ellipse', 24.5, 4.6, 1.8, 1.2, 'O'],
    ['px', 16, 4, 'd'], ['px', 24, 4, 'd'], ['px', 15, 2, 'W'], ['px', 24, 2, 'W'],
    ['px', 20, 9, 'r'], ['px', 20, 6, 'e'], ['px', 19, 7, 'e'], ['px', 21, 7, 'e'],
    // Yellow spots on the abdomen.
    ['px', 9, 22, 'Y'], ['px', 12, 23, 'Y'],
    ...arm,
  ]);
}
P.mantisIdle = mantisShape('idle');
P.mantisJump = mantisShape('jump');
P.mantisThrow = mantisShape('throw');

// --- Part guardians, seen head-on for the RPG battles. 64 x 64 each. ----------------------

/** CEEJ GEIGAN: an old-school general. Peaked cap, handlebar mustache, ribbons, binoculars. */
function ceejFront() {
  return shapes(64, 64, [
    // Jacket, lapels, collar and tie.
    ['poly', [[10, 40], [22, 35], [30, 35], [32, 41], [34, 35], [42, 35], [54, 40], [58, 64], [6, 64]], 'L'],
    ['line', 10, 41, 7, 63, 'l'], ['line', 54, 41, 57, 63, 'l'],
    ['poly', [[26, 35], [32, 41], [38, 35]], 'A'],
    ['poly', [[31, 38], [33, 38], [34, 45], [32, 47], [30, 45]], 'l'],
    ['line', 25, 35, 30, 47, 'l'], ['line', 39, 35, 34, 47, 'l'],
    // Shoulder boards with stars.
    ['rect', 12, 37, 10, 3, 'l'], ['rect', 42, 37, 10, 3, 'l'],
    ['px', 14, 38, 'Y'], ['px', 17, 38, 'Y'], ['px', 20, 38, 'Y'], ['px', 44, 38, 'Y'], ['px', 47, 38, 'Y'], ['px', 50, 38, 'Y'],
    // Ribbon rack and a medal.
    ['rect', 38, 44, 3, 2, 'R'], ['rect', 41, 44, 3, 2, 'B'], ['rect', 44, 44, 3, 2, 'Y'],
    ['rect', 38, 46, 3, 2, 'E'], ['rect', 41, 46, 3, 2, 'W'], ['rect', 44, 46, 3, 2, 'R'],
    ['line', 42, 48, 42, 49, 'R'], ['ellipse', 42, 51, 1.6, 1.6, 'Y'],
    // Binoculars on a strap.
    ['line', 28, 36, 23, 46, 'M'], ['rect', 19, 46, 4, 7, 'd'], ['rect', 24, 46, 4, 7, 'd'], ['rect', 23, 48, 1, 3, 'g'],
    ['px', 20, 52, 'B'], ['px', 25, 52, 'B'],
    // Buttons, belt and buckle.
    ['px', 32, 50, 'Y'], ['px', 32, 54, 'Y'],
    ['rect', 8, 57, 49, 3, 'M'], ['rect', 30, 56, 5, 5, 'Y'], ['rect', 31, 57, 3, 3, 'y'],
    // A swagger stick in his hand.
    ['line', 3, 38, 11, 56, 'M', 2], ['px', 3, 38, 'Y'], ['ellipse', 10, 54, 3, 3, 'F'],
    // Neck, ears and face.
    ['rect', 28, 32, 8, 4, 'f'],
    ['ellipse', 21.5, 22, 2, 3, 'F'], ['ellipse', 42.5, 22, 2, 3, 'F'],
    ['ellipse', 32, 22, 10, 11, 'F'],
    ['line', 24, 30, 28, 33, 'f'], ['line', 40, 30, 36, 33, 'f'],
    // Bushy gray brows, squinting eyes, a big nose.
    ['rect', 25, 17, 6, 2, 'w'], ['rect', 34, 17, 6, 2, 'w'],
    ['line', 26, 20, 29, 20, 'd'], ['line', 35, 20, 38, 20, 'd'], ['px', 27, 21, 'f'], ['px', 36, 21, 'f'],
    ['rect', 31, 21, 3, 4, 'f'], ['px', 31, 21, 'F'],
    // Handlebar mustache and a confident grin.
    ['poly', [[24, 26], [32, 25], [40, 26], [43, 24], [42, 28], [37, 28], [32, 27], [27, 28], [22, 28], [21, 24]], 'w'],
    ['line', 26, 28, 38, 28, 'G'],
    ['line', 29, 30, 35, 30, 'd'], ['px', 28, 29, 'd'], ['px', 36, 29, 'd'], ['line', 30, 31, 34, 31, 'f'],
    // Peaked cap: crown, band, gold cord, black visor, star badge.
    ['poly', [[19, 11], [45, 11], [49, 5], [43, 1], [21, 1], [15, 5]], 'L'],
    ['line', 22, 2, 42, 2, 'A'], ['line', 17, 6, 47, 6, 'l'],
    ['rect', 19, 10, 26, 3, 'l'], ['line', 20, 11, 44, 11, 'y'],
    ['poly', [[18, 13], [46, 13], [43, 16], [21, 16]], 'd'], ['line', 22, 14, 42, 14, 'g'],
    ['px', 32, 3, 'Y'], ['line', 31, 4, 33, 4, 'Y'], ['line', 29, 5, 35, 5, 'Y'], ['px', 31, 6, 'Y'], ['px', 33, 6, 'Y'], ['px', 30, 7, 'Y'], ['px', 34, 7, 'Y'],
  ]);
}
P.ceejFront = ceejFront();

/** JUCK MCBUCK: a hunter in blaze orange over camo, squinting down his scoped rifle. */
function juckFront() {
  return shapes(64, 64, [
    // Camo jacket.
    ['poly', [[8, 40], [22, 34], [42, 34], [56, 40], [60, 64], [4, 64]], 'e'],
    ['ellipse', 12, 50, 4, 3, 'M'], ['ellipse', 30, 58, 5, 3, 'l'], ['ellipse', 52, 48, 4, 3, 'l'], ['ellipse', 24, 44, 3, 2, 'E'],
    ['ellipse', 48, 60, 4, 2, 'M'], ['ellipse', 32, 40, 3, 2, 'M'], ['ellipse', 8, 60, 3, 2, 'E'],
    // Blaze-orange vest.
    ['poly', [[18, 36], [28, 35], [29, 64], [13, 64]], 'O'], ['poly', [[36, 35], [46, 36], [51, 64], [35, 64]], 'O'],
    ['line', 28, 36, 29, 63, 'o'], ['line', 36, 36, 35, 63, 'o'], ['rect', 39, 44, 5, 4, 'o'],
    // The rifle, held across his body: wood stock, scope, long barrel.
    ['poly', [[2, 56], [13, 51], [17, 56], [6, 63]], 'M'], ['line', 4, 58, 13, 54, 'H'],
    ['line', 14, 54, 48, 36, 'M', 3], ['line', 15, 56, 47, 39, 'H'],
    ['line', 46, 37, 63, 28, 'g', 2], ['px', 63, 27, 'd'],
    ['line', 26, 44, 40, 37, 'd', 3], ['px', 25, 46, 'B'], ['px', 41, 36, 'B'], ['line', 28, 42, 38, 37, 'g'],
    ['line', 22, 50, 24, 53, 'd'],
    // Hands on the grip and the fore-end.
    ['ellipse', 21, 51, 3, 3, 'F'], ['ellipse', 44, 39, 3, 3, 'F'], ['px', 20, 53, 'f'], ['px', 43, 41, 'f'],
    // Neck, ears, face.
    ['rect', 28, 30, 8, 5, 'f'],
    ['ellipse', 22.5, 21, 2, 3, 'F'], ['ellipse', 41.5, 21, 2, 3, 'F'],
    ['ellipse', 32, 21, 9, 10, 'F'],
    // Scruffy beard and a grimace.
    ['poly', [[23, 23], [25, 30], [32, 33], [39, 30], [41, 23], [39, 27], [36, 28], [28, 28], [25, 27]], 'H'],
    ['px', 26, 25, 'h'], ['px', 38, 25, 'h'], ['px', 30, 31, 'h'], ['px', 35, 30, 'h'], ['px', 28, 29, 'h'],
    ['line', 29, 28, 35, 28, 'd'], ['px', 30, 27, 'H'], ['px', 34, 27, 'H'],
    // One eye squinting down the sights, the other wide open. Brows knitted.
    ['line', 26, 17, 30, 18, 'H'], ['line', 34, 18, 38, 16, 'H'],
    ['line', 26, 20, 29, 20, 'd'], ['rect', 35, 19, 2, 2, 'd'], ['px', 35, 19, 'W'],
    ['rect', 31, 21, 2, 4, 'f'],
    // Blaze-orange cap.
    ['ellipse', 32, 9, 12, 7, 'O'], ['line', 25, 4, 37, 4, 'Y'], ['line', 21, 10, 43, 10, 'o'],
    ['poly', [[19, 12], [45, 12], [48, 15], [16, 15]], 'o'], ['line', 18, 14, 46, 14, 'r'],
    ['rect', 30, 6, 4, 2, 'W'],
  ]);
}
P.juckFront = juckFront();

/** THE HYDRONATOR: a friendly bearded guy in a trucker cap, holding out a glass of water. */
function hydroFront() {
  return shapes(64, 64, [
    // A plain tee.
    ['poly', [[8, 42], [22, 35], [42, 35], [56, 42], [58, 64], [6, 64]], 's'],
    ['line', 9, 43, 7, 63, 'S'], ['line', 55, 43, 57, 63, 'S'], ['poly', [[26, 35], [32, 39], [38, 35]], 'f'],
    // Left arm at his side.
    ['poly', [[8, 42], [14, 44], [13, 60], [7, 60]], 's'], ['ellipse', 10, 61, 3, 3, 'F'],
    // Right arm reaching out to you with the glass.
    ['poly', [[44, 40], [54, 44], [50, 54], [40, 50]], 'F'], ['line', 41, 50, 50, 54, 'f'],
    // The glass: rim, water, highlight, a couple of bubbles.
    ['poly', [[33, 34], [51, 34], [49, 58], [35, 58]], 'c'],
    ['poly', [[34, 41], [50, 41], [49, 57], [35, 57]], 'B'],
    ['line', 34, 41, 50, 41, 'C'], ['line', 37, 36, 37, 56, 'W'], ['line', 38, 43, 38, 55, 'C'],
    ['px', 45, 47, 'c'], ['px', 43, 52, 'c'], ['px', 46, 44, 'C'], ['line', 33, 34, 51, 34, 'W'],
    ['line', 35, 57, 49, 57, 'b'],
    // Fingers wrapped around the front of the glass.
    ['rect', 46, 45, 5, 2, 'F'], ['rect', 46, 48, 5, 2, 'F'], ['rect', 46, 51, 4, 2, 'F'],
    ['line', 46, 47, 50, 47, 'f'], ['line', 46, 50, 50, 50, 'f'],
    // Neck, ears, face.
    ['rect', 28, 30, 8, 5, 'f'],
    ['ellipse', 22.5, 21, 2, 3, 'F'], ['ellipse', 41.5, 21, 2, 3, 'F'],
    ['ellipse', 32, 21, 9, 10, 'F'],
    // Full beard, mustache and a big friendly smile.
    ['poly', [[22, 19], [24, 29], [28, 34], [32, 35], [36, 34], [40, 29], [42, 19], [40, 25], [36, 27], [28, 27], [24, 25]], 'H'],
    ['px', 25, 27, 'h'], ['px', 39, 27, 'h'], ['px', 29, 32, 'h'], ['px', 34, 33, 'h'], ['px', 32, 34, 'h'],
    ['line', 28, 26, 36, 26, 'H'], ['rect', 29, 28, 7, 2, 'd'], ['line', 30, 28, 34, 28, 'W'],
    // Kind eyes, raised brows, rosy cheeks.
    ['line', 26, 16, 29, 16, 'H'], ['line', 35, 16, 38, 16, 'H'],
    ['rect', 27, 18, 2, 2, 'd'], ['rect', 35, 18, 2, 2, 'd'], ['px', 27, 18, 'W'], ['px', 35, 18, 'W'],
    ['px', 25, 22, 'P'], ['px', 39, 22, 'P'], ['rect', 31, 20, 2, 4, 'f'],
    // Trucker cap with a water-drop patch.
    ['ellipse', 32, 8, 12, 7, 'b'], ['rect', 21, 4, 4, 6, 'w'], ['rect', 39, 4, 4, 6, 'w'],
    ['rect', 27, 3, 10, 7, 'W'], ['px', 32, 4, 'B'], ['line', 31, 5, 33, 5, 'B'], ['rect', 30, 6, 5, 2, 'B'], ['line', 31, 8, 33, 8, 'b'],
    ['poly', [[19, 11], [45, 11], [47, 14], [17, 14]], 'S'], ['line', 18, 13, 46, 13, 'd'],
    // Sparkles off the glass.
    ['px', 54, 33, 'C'], ['px', 53, 31, 'c'], ['px', 30, 40, 'C'],
  ]);
}
P.hydroFront = hydroFront();

/**
 * BEARDSMITH: a stout dwarven robot. Riveted helmet, glowing eyes, a huge black
 * beard with gold-ringed braids (and a bare patch in one eyebrow), a hammer
 * raised high, a drill in the other hand and a belt full of tools.
 */
function beardFront() {
  return shapes(64, 64, [
    // Squat riveted body and shoulder pads.
    ['poly', [[6, 36], [18, 30], [46, 30], [58, 36], [60, 64], [4, 64]], 'G'],
    ['line', 7, 37, 5, 63, 'g'], ['line', 57, 37, 59, 63, 'g'],
    ['px', 10, 42, 'w'], ['px', 10, 50, 'w'], ['px', 54, 42, 'w'], ['px', 54, 50, 'w'],
    ['ellipse', 9, 36, 7, 6, 'g'], ['ellipse', 55, 36, 7, 6, 'g'], ['line', 4, 34, 13, 32, 'w'], ['line', 51, 32, 60, 34, 'w'],
    // Tool belt: nail gun, saw blade, wrench.
    ['rect', 5, 57, 54, 5, 'M'], ['line', 5, 57, 58, 57, 'h'], ['rect', 29, 57, 6, 5, 'Y'], ['rect', 31, 58, 2, 3, 'y'],
    ['rect', 10, 53, 7, 5, 'O'], ['rect', 15, 55, 3, 2, 'g'], ['px', 11, 54, 'Y'],
    ['ellipse', 47, 56, 4.5, 4.5, 'w'], ['ellipse', 47, 56, 1.5, 1.5, 'g'], ['px', 47, 51, 'G'], ['px', 52, 56, 'G'], ['px', 47, 61, 'G'], ['px', 42, 56, 'G'],
    ['line', 22, 56, 24, 62, 'w'], ['rect', 21, 55, 3, 2, 'w'],
    // The drill (viewer's left).
    ['rect', 2, 32, 11, 10, 'Y'], ['line', 2, 41, 12, 41, 'y'], ['rect', 4, 34, 3, 3, 'd'], ['rect', 5, 42, 5, 6, 'd'], ['ellipse', 9, 47, 4, 4, 'G'],
    ['rect', 6, 29, 3, 3, 'g'], ['line', 7, 28, 7, 19, 'w', 2], ['px', 6, 26, 'G'], ['px', 8, 23, 'G'], ['px', 6, 20, 'G'], ['px', 7, 18, 'w'],
    // The hammer, raised (viewer's right).
    ['line', 55, 46, 58, 15, 'M', 2], ['line', 54, 46, 57, 15, 'h'],
    ['rect', 49, 6, 15, 9, 'g'], ['rect', 50, 7, 13, 3, 'G'], ['line', 50, 7, 62, 7, 'w'], ['rect', 49, 6, 2, 9, 'd'], ['rect', 62, 6, 2, 9, 'd'],
    ['ellipse', 55, 42, 4, 4, 'G'], ['px', 54, 41, 'w'],
    // Helmet: dome, crest, riveted rim.
    ['ellipse', 32, 11, 13, 9, 'G'], ['line', 32, 2, 32, 14, 'w'], ['line', 25, 5, 29, 4, 'w'],
    ['rect', 18, 14, 28, 3, 'g'], ['px', 21, 15, 'w'], ['px', 27, 15, 'w'], ['px', 37, 15, 'w'], ['px', 43, 15, 'w'],
    // Metal face plate, glowing eyes, round nose.
    ['rect', 21, 17, 22, 9, 'w'],
    ['rect', 25, 20, 4, 3, 'd'], ['px', 26, 21, 'O'], ['px', 27, 21, 'Y'],
    ['rect', 35, 20, 4, 3, 'd'], ['px', 36, 21, 'O'], ['px', 37, 21, 'Y'],
    // Thick black brows; a bare patch in the right one.
    ['rect', 23, 17, 8, 2, 'd'], ['rect', 33, 17, 3, 2, 'd'], ['rect', 39, 17, 3, 2, 'd'], ['px', 37, 18, 'G'], ['px', 38, 17, 'P'],
    // The beard: huge, black, with strands, a mustache, and two braids with gold rings.
    ['poly', [[18, 24], [46, 24], [50, 34], [46, 46], [38, 51], [32, 53], [26, 51], [18, 46], [14, 34]], 'd'],
    ['line', 23, 32, 24, 43, 'S'], ['line', 29, 34, 29, 48, 'S'], ['line', 35, 34, 35, 48, 'S'], ['line', 41, 32, 40, 43, 'S'],
    ['poly', [[22, 26], [32, 24], [42, 26], [44, 30], [32, 28], [20, 30]], 'd'], ['line', 24, 29, 31, 27, 'S'], ['line', 33, 27, 40, 29, 'S'],
    ['ellipse', 32, 24, 3, 2.5, 'G'], ['px', 31, 23, 'W'],
    ['rect', 26, 51, 3, 7, 'd'], ['rect', 26, 54, 3, 1, 'Y'], ['rect', 35, 51, 3, 7, 'd'], ['rect', 35, 54, 3, 1, 'Y'],
  ]);
}
P.beardFront = beardFront();

/** OVERLORD (final boss, phase 1): skull-faced war machine, cannon on the right. */
function overlord(firing) {
  const eye = firing ? 'Y' : 'R';
  return boxes(64, 84, [
    // treads and wheels
    [1, 70, 62, 13, 'g'], [1, 70, 62, 1, 'G'],
    ...Array.from({ length: 10 }, (_, i) => [3 + i * 6, 81, 2, 2, 'd']),
    [4, 73, 10, 8, 'G'], [18, 73, 10, 8, 'G'], [34, 73, 10, 8, 'G'], [49, 73, 10, 8, 'G'],
    [7, 76, 4, 2, 'd'], [21, 76, 4, 2, 'd'], [37, 76, 4, 2, 'd'], [52, 76, 4, 2, 'd'],
    // body
    [7, 30, 50, 40, 'U'], [7, 62, 50, 8, 'u'], [7, 34, 6, 28, 'G'], [51, 34, 6, 28, 'G'],
    // panel seams, rivets, vents, and glowing pipes from the core
    [13, 46, 38, 1, 'u'], [13, 57, 38, 1, 'u'],
    [15, 36, 2, 2, 'w'], [47, 36, 2, 2, 'w'], [15, 59, 2, 2, 'w'], [47, 59, 2, 2, 'w'],
    [16, 49, 6, 1, 'd'], [16, 52, 6, 1, 'd'], [42, 49, 6, 1, 'd'], [42, 52, 6, 1, 'd'],
    [13, 43, 11, 2, 'r'], [40, 43, 11, 2, 'r'], [13, 43, 11, 1, firing ? 'Y' : 'R'], [40, 43, 11, 1, firing ? 'Y' : 'R'],
    [22, 38, 20, 18, 'G'], [22, 38, 20, 1, 'w'],
    [24, 40, 16, 14, 'd'], [27, 43, 10, 8, 'R'], [30, 45, 4, 4, firing ? 'W' : 'Y'],
    // shoulders
    [1, 28, 14, 10, 'G'], [49, 28, 14, 10, 'G'], [1, 28, 14, 2, 'w'], [49, 28, 14, 2, 'w'],
    [3, 23, 3, 5, 'w'], [9, 23, 3, 5, 'w'], [52, 23, 3, 5, 'w'], [58, 23, 3, 5, 'w'],
    [4, 33, 2, 2, 'g'], [10, 33, 2, 2, 'g'], [52, 33, 2, 2, 'g'], [58, 33, 2, 2, 'g'],
    // horns and skull
    [13, 1, 5, 10, 'r'], [46, 1, 5, 10, 'r'],
    [17, 4, 30, 26, 'w'], [17, 4, 30, 2, 'W'], [21, 24, 22, 8, 'G'],
    [23, 26, 2, 3, 'W'], [27, 26, 2, 3, 'W'], [31, 26, 2, 3, 'W'], [35, 26, 2, 3, 'W'], [39, 26, 2, 3, 'W'],
    [25, 5, 1, 4, 'G'], [26, 8, 2, 1, 'G'], [41, 6, 1, 3, 'G'],
    [21, 11, 9, 8, 'd'], [35, 11, 9, 8, 'd'], [23, 13, 4, 4, eye], [38, 13, 4, 4, eye], [31, 19, 2, 4, 'd'],
    // cannon
    [51, 40, 12, 11, 'G'], [55, 42, 9, 7, 'g'], ...(firing ? [[59, 43, 5, 5, 'Y']] : []),
  ]);
}

/** BLACK JARED (intro boss): the clerk behind the QUIK MART counter. */
function jared(throwing) {
  const arm = throwing
    ? [[29, 8, 5, 14, 'E'], [29, 5, 5, 4, 'T'], [25, 1, 13, 4, 'n'], [26, 2, 11, 2, 'r'], [27, 2, 2, 1, 'Y'], [32, 2, 2, 1, 'Y']]
    : [[29, 21, 5, 16, 'E'], [29, 37, 5, 4, 'T']];
  return boxes(40, 56, [
    [12, 42, 7, 10, 'S'], [21, 42, 7, 10, 'S'], [11, 52, 9, 4, 'd'], [20, 52, 9, 4, 'd'],
    [10, 20, 20, 22, 'E'], [10, 24, 20, 3, 'O'], [10, 27, 20, 1, 'W'], [10, 38, 20, 4, 'e'],
    [22, 30, 6, 3, 'W'], [23, 31, 4, 1, 'R'],
    [6, 21, 5, 16, 'E'], [6, 37, 5, 4, 'T'],
    [13, 7, 14, 13, 'T'], [13, 7, 3, 13, 't'], [14, 17, 12, 3, 'd'],
    [18, 11, 2, 2, 'd'], [23, 11, 2, 2, 'd'], [20, 15, 4, 1, 't'],
    [13, 7, 2, 4, 'd'], [25, 7, 2, 3, 'd'], [17, 9, 3, 1, 'd'], [23, 9, 3, 1, 'd'],
    [12, 32, 6, 5, 'e'], [12, 32, 6, 1, 'N'], [19, 29, 1, 1, 'W'], [19, 33, 1, 1, 'W'], [19, 37, 1, 1, 'W'],
    [11, 52, 9, 1, 'G'], [20, 52, 9, 1, 'G'],
    [12, 1, 16, 6, 'E'], [12, 1, 16, 1, 'N'], [14, 5, 18, 2, 'O'],
    ...arm,
  ]);
}

P.jaredIdle = jared(false);
P.jaredThrow = jared(true);
P.overlordIdle = overlord(false);
P.overlordFire = overlord(true);
P.cyclone0 = tornado(18, 22, 0, ['Y', 'y', 'W']);
P.sparkRing = sparkRing(28);
P.pbubble = disc(12, '.', 'C', 'W');
P.bbubble = disc(10, '.', 'w', 'W');
P.sawSmall = disc(10, 'G', 'K', 'w');
P.pearl = disc(6, 'c', 'K', 'W');
P.vorb = disc(8, 'Y', 'C', 'W');
P.fireball = disc(8, 'O', 'R', 'Y');
P.pillar = column(12, 30, 'R', 'O', 'Y', 0);
P.geyser = column(12, 30, 'b', 'C', 'c', 2);
P.flameJet = flameCone(28, 16);
P.cyclone1 = tornado(18, 22, 1, ['Y', 'y', 'W']);
P.btornado = tornado(10, 14, 0, ['w', 'c', 'W']);

const single = (part, w, h, opts) => ({ w, h, layers: [[part, 0, 0, opts]] });
const FIRE = { W: 'W', w: 'Y', R: 'O', r: 'o', G: 'y', g: 'o' };
const BLADE = { N: 'c', E: 'w', e: 'G', Y: 'R' };

const SHOT_FRAMES = {
  bullet: single('bullet', 6, 4),
  charge1: single('charge1', 10, 8),
  charge2: single('charge2', 22, 14),
  pwave: single('quakeWave', 8, 12),
  thorn: single('shuriken', 10, 10),
  frost: single('frostSpike', 12, 6),
  cyclone0: single('cyclone0', 18, 22),
  cyclone1: single('cyclone1', 18, 22),
  eshot: single('pellet', 4, 4),
  bshot: single('orb', 6, 6),
  wave: single('quakeWave', 8, 12, { map: FIRE }),
  bthorn: single('shuriken', 10, 10, { map: BLADE }),
  iceshard: single('iceShard', 6, 6),
  iceblock: single('iceBlock', 14, 14),
  btornado: single('btornado', 10, 14),
  seed: single('seed', 6, 6),
  egg: single('egg', 6, 8),
  bolt: single('bolt', 6, 12),
};

Object.assign(SHOT_FRAMES, {
  arc: single('arc', 10, 6),
  scrap: single('scrapChunk', 8, 8),
  pearl: single('pearl', 6, 6),
  vorb: single('vorb', 8, 8),
  fireball: single('fireball', 8, 8),
  pillar: single('pillar', 12, 30),
  flamelick: single('flameLick', 8, 10),
  sawshot: single('saw', 14, 14),
  bbubble: single('bbubble', 10, 10),
  geyser: single('geyser', 12, 30),
  sparkring: single('sparkRing', 28, 28),
  flamejet: single('flameJet', 28, 16),
  sawblade: single('sawSmall', 10, 10),
  hotdog: single('hotdog', 14, 6),
  pbubble: single('pbubble', 12, 12),
});

const ITEM_FRAMES = {
  hp_small: single('hpSmall', 8, 6),
  hp_big: single('hpBig', 12, 10),
  ammo_small: single('ammoSmall', 8, 6),
  ammo_big: single('ammoBig', 12, 10),
  etank: single('etank', 12, 10),
  goal: single('goal', 16, 16),
  capsule_on: single('capsuleOn', 20, 30),
  capsule_off: single('capsuleOff', 20, 30),
};

const tide = (pose) => ({
  w: 34,
  h: 24,
  layers: [
    ['tideBody', 0, 6],
    ...(pose === 'open' ? [['tideMouth', 26, 14]] : []),
    ...(pose === 'dash' ? [['speedLines', 0, 0]] : []),
  ],
});

const CHARACTER_FRAMES = {
  walker0: { w: 16, h: 16, layers: [['walkerLegsA', 0, 10], ['walkerBody', 0, 0]] },
  walker1: { w: 16, h: 16, layers: [['walkerLegsB', 0, 10], ['walkerBody', 0, 0]] },
  hopper0: { w: 16, h: 14, layers: [['hopperSit', 0, 0]] },
  hopper1: { w: 16, h: 14, layers: [['hopperJump', 0, 0]] },
  turret0: { w: 16, h: 16, layers: [['turretShut', 0, 2], ['turretBase', 0, 10]] },
  turret1: { w: 16, h: 16, layers: [['turretEye', 0, 6], ['turretLid', 0, 0], ['turretBase', 0, 10]] },
  flyer0: { w: 16, h: 12, layers: [['flyerWingDown', 0, 5], ['flyerWingDown', 11, 5, { flip: true }], ['flyerBody', 4, 3]] },
  flyer1: { w: 16, h: 12, layers: [['flyerWingUp', 0, 0], ['flyerWingUp', 11, 0, { flip: true }], ['flyerBody', 4, 3]] },
  lurker0: { w: 18, h: 12, layers: [['lurkerLegsA', 0, 8], ['lurkerBody', 0, 0]] },
  lurker1: { w: 18, h: 12, layers: [['lurkerLegsB', 0, 8], ['lurkerBody', 0, 0]] },
  spitter0: { w: 16, h: 16, layers: [['spitterStem', 0, 10], ['spitterBud', 0, 1]] },
  spitter1: { w: 16, h: 16, layers: [['spitterStem', 0, 10], ['spitterOpen', 0, 0]] },
  slider0: { w: 16, h: 14, layers: [['sliderFeetA', 0, 12], ['sliderBody', 0, 0]] },
  slider1: { w: 16, h: 14, layers: [['sliderFeetB', 0, 12], ['sliderBody', 0, 0]] },
  icicle: { w: 10, h: 14, layers: [['icicle', 0, 0]] },
  bomber0: { w: 18, h: 12, layers: [['bomberBody', 0, 3], ['bomberWingDown', 4, 7]] },
  bomber1: { w: 18, h: 12, layers: [['bomberBody', 0, 3], ['bomberWingUp', 4, 0]] },
  sparker0: { w: 20, h: 18, layers: [['sparkerImp', 6, 0], ['cloud', 0, 8]] },
  sparker1: { w: 20, h: 18, layers: [['sparkerArm', 14, 0], ['sparkerImp', 6, 0], ['cloud', 0, 8]] },
  zapper0: single('zapper', 16, 16),
  zapper1: single('zapper', 16, 16, { map: { Y: 'C', O: 'Y', y: 'W' } }),
  roller0: single('roller', 14, 14),
  ember0: single('ember', 12, 12),
  ember1: single('ember', 12, 12, { map: { Y: 'O', O: 'R', W: 'Y' } }),
  slug0: { w: 18, h: 10, layers: [['slugFootA', 0, 8], ['slugBody', 0, 0]] },
  slug1: { w: 18, h: 10, layers: [['slugFootB', 0, 8], ['slugBody', 0, 0]] },
  grinder: single('saw', 14, 14),
  junkbot0: single('junkbot', 16, 18),
  junkbot1: { w: 16, h: 18, layers: [['junkbot', 0, 0], ['junkArm', 13, 1]] },
  puffer0: single('puffer', 14, 12),
  puffer1: single('pufferPuffed', 14, 12),
  clam0: single('clamShut', 16, 12),
  clam1: single('clamOpen', 16, 12),
  overlord_idle: single('overlordIdle', 64, 84),
  jared_idle: single('jaredIdle', 40, 56),
  jared_throw: single('jaredThrow', 40, 56),
  overlord_fire: single('overlordFire', 64, 84),
};


// --- minibosses (one per boss stage, mid-stage) ---------------------------------

/** BRIAR TOAD (Canopy): a thorny frog that hops and spits seeds. */
function briarToad(attack) {
  const mouth = attack ? [[30, 14, 14, 8, 'r'], [32, 16, 11, 4, 'R'], [33, 19, 8, 2, 'P']] : [[32, 17, 10, 2, 'e']];
  return boxes(44, 32, [
    [2, 21, 12, 9, 'e'], [30, 23, 10, 7, 'e'], [0, 29, 16, 3, 'E'], [28, 29, 14, 3, 'E'],
    [8, 4, 3, 6, 'M'], [15, 1, 3, 8, 'M'], [22, 3, 3, 6, 'M'],
    [6, 8, 32, 20, 'E'], [12, 20, 22, 8, 'N'], [26, 6, 16, 16, 'E'],
    [30, 2, 7, 6, 'Y'], [33, 3, 3, 4, 'd'],
    ...mouth,
    // detail: back spots, eye glint, belly stripes, toes
    [12, 10, 4, 2, 'N'], [20, 12, 4, 2, 'N'], [15, 16, 3, 2, 'N'], [24, 9, 3, 2, 'N'],
    [34, 3, 1, 1, 'W'], [14, 22, 18, 1, 'E'], [14, 25, 18, 1, 'E'],
    [0, 31, 3, 1, 'e'], [5, 31, 3, 1, 'e'], [29, 31, 3, 1, 'e'], [34, 31, 3, 1, 'e'],
  ]);
}

/** DYNAMO (Power Plant): a tesla tower on treads. */
function dynamo(attack) {
  return boxes(40, 40, [
    [0, 32, 40, 8, 'g'], [3, 34, 6, 4, 'G'], [13, 34, 6, 4, 'G'], [23, 34, 6, 4, 'G'], [32, 34, 6, 4, 'G'],
    [4, 20, 32, 12, 'y'], [4, 20, 32, 2, 'Y'],
    [10, 22, 20, 8, 'd'], [13, 24, 4, 3, attack ? 'W' : 'C'], [23, 24, 4, 3, attack ? 'W' : 'C'],
    [13, 5, 14, 16, 'G'], [10, 7, 20, 2, 'O'], [10, 12, 20, 2, 'O'], [10, 17, 20, 2, 'O'],
    [14, 0, 12, 6, attack ? 'W' : 'C'], [16, 1, 4, 2, 'W'],
    // detail: copper coil windings, tread bolts, a charge light
    ...[8, 10, 14, 16].map((y) => [13, y, 14, 1, 'o']),
    ...[5, 15, 25, 34].map((x) => [x, 35, 2, 2, 'w']),
    [8, 24, 2, 2, attack ? 'W' : 'R'],
  ]);
}

/** CINDER CRAB (Caldera): a lava crab that lobs fireballs. */
function cinderCrab(attack) {
  const cy = attack ? 0 : 6;
  return boxes(46, 30, [
    [10, 22, 3, 8, 'r'], [17, 22, 3, 8, 'r'], [26, 22, 3, 8, 'r'], [33, 22, 3, 8, 'r'],
    [8, 8, 30, 14, 'R'], [8, 8, 30, 3, 'O'], [14, 12, 4, 3, 'Y'], [26, 12, 4, 3, 'Y'], [20, 16, 6, 2, attack ? 'Y' : 'r'],
    [16, 3, 2, 6, 'r'], [28, 3, 2, 6, 'r'], [15, 0, 4, 4, 'W'], [27, 0, 4, 4, 'W'],
    [0, cy, 9, 10, 'R'], [37, cy, 9, 10, 'R'], [0, cy, 9, 2, 'O'], [37, cy, 9, 2, 'O'],
    [3, cy + 4, 3, 4, 'd'], [40, cy + 4, 3, 4, 'd'],
    // detail: glowing lava cracks in the shell, serrated claws
    [12, 11, 4, 1, 'O'], [15, 12, 1, 2, 'O'], [22, 14, 5, 1, 'O'], [30, 10, 3, 1, 'Y'], [31, 11, 1, 2, 'O'],
    ...[1, 4, 7].map((x) => [x, cy + 9, 1, 2, 'W']), ...[38, 41, 44].map((x) => [x, cy + 9, 1, 2, 'W']),
  ]);
}

/** CRUSHER (Scrapyard): a junk tank with jaws. */
function crusher(attack) {
  const top = attack ? 4 : 9;
  return boxes(48, 34, [
    [0, 26, 48, 8, 'g'], [3, 28, 6, 4, 'G'], [13, 28, 6, 4, 'G'], [23, 28, 6, 4, 'G'], [33, 28, 6, 4, 'G'],
    [10, 2, 5, 10, 'd'],
    [4, 12, 34, 14, 'M'], [4, 12, 34, 2, 'T'], [8, 15, 10, 6, 'C'], [9, 16, 3, 2, 'W'], [22, 18, 12, 2, 'o'],
    [38, top, 10, 8, 'G'], [38, top + 7, 10, 1, 'W'], [38, 18, 10, 8, 'G'], [38, 18, 10, 1, 'W'],
    // detail: rust patches, bolts, jaw teeth, exhaust glow
    [6, 16, 5, 3, 'o'], [28, 21, 4, 2, 'o'], ...[6, 14, 22, 30].map((x) => [x, 13, 2, 1, 'w']),
    ...[39, 42, 45].map((x) => [x, top + 6, 1, 2, 'W']), ...[39, 42, 45].map((x) => [x, 18, 1, 2, 'W']),
    [10, 1, 5, 2, attack ? 'O' : 'g'],
  ]);
}

/** Teleporter capsule for the boss rematch room. */
function capsule(on) {
  const glass = on ? 'C' : 'g';
  return boxes(20, 30, [
    [0, 24, 20, 6, 'G'], [0, 24, 20, 1, 'w'], [3, 4, 14, 20, glass], [5, 6, 2, 14, on ? 'W' : 'G'],
    [0, 0, 20, 5, 'G'], [0, 0, 20, 1, 'w'], [8, 26, 4, 2, on ? 'V' : 'd'],
  ]);
}

// (The Press Titan, Tusk Mammoth, Storm Kite and Angler are drawn in art/miniArt.mjs.)
const MINI_ART = { toad: briarToad, dynamo, crab: cinderCrab, crusher };
const MINI_SIZE = { toad: [44, 32], dynamo: [40, 40], crab: [46, 30], crusher: [48, 34] };
for (const [k, fn] of Object.entries(MINI_ART)) {
  P[`${k}Idle`] = fn(false);
  P[`${k}Attack`] = fn(true);
}
P.capsuleOn = capsule(true);
P.capsuleOff = capsule(false);
P.etank = [
  '.KKKKKKKKKK.',
  'KCCCCCCCCCbK',
  'KBBWWWWWBBbK',
  'KBBWBBBBBBbK',
  'KBBWWWWBBBbK',
  'KBBWBBBBBBbK',
  'KBBWWWWWBBbK',
  'KBBBBBBBBBbK',
  'KbbbbbbbbbbK',
  '.KKKKKKKKKK.',
];
P.ammoBig = [
  '.KKKKKKKKKK.',
  'KVccVVVVVVbK',
  'KVcVVVVVVVbK',
  'KVVVKKKKVVbK',
  'KVVVKKKKVVbK',
  'KVVVKKKKVVbK',
  'KVVVKKKKVVbK',
  'KVVVVVVVVVbK',
  'KbbbbbbbbbbK',
  '.KKKKKKKKKK.',
];
// Armor part icons (upgrade capsules and the pause menu), 14x14.
P.partBlaster = boxes(14, 14, [[1, 4, 9, 6, 'O'], [1, 4, 9, 1, 'Y'], [1, 9, 9, 1, 'o'], [9, 3, 4, 8, 'G'], [10, 5, 3, 4, 'C'], [11, 6, 1, 2, 'W'], [3, 6, 4, 2, 'd']]);
P.partBoots = boxes(14, 14, [[3, 1, 6, 8, 'O'], [3, 1, 6, 1, 'Y'], [3, 6, 6, 1, 'o'], [3, 8, 10, 4, 'O'], [3, 11, 10, 2, 'o'], [8, 9, 4, 1, 'Y'], [2, 3, 1, 5, 'V']]);
P.partArmor = boxes(14, 14, [[2, 2, 10, 10, 'O'], [2, 2, 10, 1, 'Y'], [1, 2, 3, 4, 'o'], [10, 2, 3, 4, 'o'], [5, 5, 4, 4, 'V'], [6, 6, 2, 2, 'W'], [4, 11, 6, 2, 'o']]);
P.partHelmet = boxes(14, 14, [[3, 1, 8, 2, 'O'], [2, 3, 10, 8, 'O'], [2, 3, 10, 1, 'Y'], [4, 6, 6, 3, 'C'], [5, 6, 2, 1, 'W'], [2, 10, 10, 2, 'o'], [6, 0, 2, 2, 'V']]);
Object.assign(ITEM_FRAMES, {
  part_blaster: single('partBlaster', 14, 14),
  part_boots: single('partBoots', 14, 14),
  part_armor: single('partArmor', 14, 14),
  part_helmet: single('partHelmet', 14, 14),
});

const MINI_FRAMES = {};
for (const [k, [w, h]] of Object.entries(MINI_SIZE)) {
  MINI_FRAMES[`${k}_idle`] = single(`${k}Idle`, w, h);
  MINI_FRAMES[`${k}_attack`] = single(`${k}Attack`, w, h);
}


// (Boxing mode's Gatekeeper and UltraGuy are drawn in art/boxArt.mjs.)
const BOX_FRAMES = {};

for (const g of ['ceej', 'juck', 'hydro', 'beard']) BOX_FRAMES[`${g}_front`] = single(`${g}Front`, 64, 64);
const FRAMES = { ...CHARACTER_FRAMES, ...MINI_FRAMES, ...SHOT_FRAMES, ...ITEM_FRAMES, ...BOX_FRAMES };

// --- render ----------------------------------------------------------------------

function renderFrame(name, f) {
  const bmp = new Bitmap(f.w, f.h);
  for (const [part, x, y, opts] of f.layers) {
    const rows = P[part];
    if (!rows) throw new Error(`${name}: unknown part "${part}"`);
    drawGrid(bmp, `${name}/${part}`, rows, x, y, (c) => PALETTE[c], opts);
  }
  // 16-bit finish: lit tops, shaded bottoms, softer outlines. White glints stay crisp.
  shade16(bmp, { keep: [PALETTE.W] });
  return bmp;
}

// The regular stage enemies are redrawn in art/enemyArt.mjs (same names and sizes): use those.
const ENEMY_ART = enemyFrames();
const rendered = Object.entries(FRAMES).map(([name, f]) => ({ name, bmp: ENEMY_ART[name] ?? renderFrame(name, f) }));

// Bosses drawn on the shaded-parts rig come in finished (they're shaded already).
const molten = anvilFrames();
for (const [name, bmp] of Object.entries(molten.frames)) rendered.push({ name, bmp });
// Mantis, Frostline, Gale and Tide share one generated anchors file.
const shared = {};
for (const art of [mantisFrames(), frostlineFrames(), galeFrames(), tideFrames(), scrapFrames(), guardianFrames(), miniFrames()]) {
  for (const [name, bmp] of Object.entries(art.frames)) rendered.push({ name, bmp });
  Object.assign(shared, art.anchors);
}
write(
  'src/entities/bosses/bossAnchors.ts',
  Buffer.from(
    '// Generated by art/sprites.mjs (art/mantisArt.mjs, frostlineArt, galeArt, tideArt, scrapArt, guardianArt, miniArt): glow points on each\n' +
      '// frame, as offsets from the sprite\'s bottom-center, facing right.\n' +
      'export type Spot = [number, number];\n' +
      'export interface BossAnchor { eye?: Spot; core?: Spot; tip?: Spot; hand?: Spot; mouth?: Spot; lights?: Spot[]; up?: Spot }\n' +
      `export const BOSS_ANCHORS: Record<string, BossAnchor> = ${JSON.stringify(shared)};\n`,
  ),
);
for (const [name, bmp] of Object.entries(boxFrames())) rendered.push({ name, bmp });
const tesla = voltFrames();
for (const [name, bmp] of Object.entries(tesla.frames)) rendered.push({ name, bmp });
write(
  'src/entities/bosses/voltAnchors.ts',
  Buffer.from(
    '// Generated by art/sprites.mjs (art/voltArt.mjs): where the glow and the arcs go on each Volt frame,\n' +
      '// as offsets from the sprite\'s bottom-center, facing right. `charge` is how full his battery shows.\n' +
      'export interface VoltAnchor { core: [number, number]; eye: [number, number]; antennae: [number, number][]; hands: [number, number][]; charge: number; casting: boolean }\n' +
      `export const VOLT_ANCHORS: Record<string, VoltAnchor> = ${JSON.stringify(tesla.anchors)};\n`,
  ),
);
const magmaCore = magmaFrames();
for (const [name, bmp] of Object.entries(magmaCore.frames)) rendered.push({ name, bmp });
write(
  'src/entities/bosses/magmaAnchors.ts',
  Buffer.from(
    '// Generated by art/sprites.mjs (art/magmaArt.mjs): where the glow goes on each Magma frame,\n' +
      '// as offsets from the sprite\'s bottom-center, facing right. `open` is how far the plates are apart.\n' +
      'export interface MagmaAnchor { core: [number, number]; eye: [number, number]; fist: [number, number]; hand: [number, number]; open: number }\n' +
      `export const MAGMA_ANCHORS: Record<string, MagmaAnchor> = ${JSON.stringify(magmaCore.anchors)};\n`,
  ),
);
write(
  'src/entities/bosses/anvilAnchors.ts',
  Buffer.from(
    '// Generated by art/sprites.mjs (art/anvilArt.mjs): where the glow goes on each Anvil frame,\n' +
      '// as offsets from the sprite\'s bottom-center, facing right.\n' +
      'export interface AnvilAnchor { furnace: [number, number]; visor: [number, number]; fists: [number, number][]; muzzle: [number, number] | null }\n' +
      `export const ANVIL_ANCHORS: Record<string, AnvilAnchor> = ${JSON.stringify(molten.anchors)};\n`,
  ),
);

// Shelf-pack into a sheet 256px wide, 1px apart.
const SHEET_W = 256;
const index = {};
let x = 0;
let y = 0;
let rowH = 0;
for (const { name, bmp } of rendered) {
  if (x + bmp.w > SHEET_W) {
    x = 0;
    y += rowH + 1;
    rowH = 0;
  }
  index[name] = [x, y, bmp.w, bmp.h];
  x += bmp.w + 1;
  rowH = Math.max(rowH, bmp.h);
}
const sheet = new Bitmap(SHEET_W, y + rowH);
for (const { name, bmp } of rendered) sheet.blit(bmp, index[name][0], index[name][1]);
write('public/assets/sprites.png', encodePNG(sheet));
write('public/assets/sprites.json', Buffer.from(JSON.stringify(index, null, 1) + '\n'));

// Preview, 4x on a mid-tone: enemies (two rows), one row per boss, shots, pickups.
const SCALE = 4;
const GAP = 8;
const byName = Object.fromEntries(rendered.map((r) => [r.name, r]));
const pick = (names) => names.map((n) => byName[n]);
const bossNames = ['anvil', 'mantis', 'frostline', 'gale', 'volt', 'magma', 'scrap', 'tide', 'overlord', 'jared'];
const enemyNames = Object.keys(CHARACTER_FRAMES).filter((n) => !bossNames.some((b) => n.startsWith(`${b}_`)));
const rows = [
  pick(enemyNames.slice(0, 10)),
  pick(enemyNames.slice(10, 20)),
  pick(enemyNames.slice(20)),
  ...bossNames.map((b) => pick(Object.keys(byName).filter((n) => n.startsWith(`${b}_`) && !n.endsWith('_h')))),
  pick(Object.keys(MINI_FRAMES)),
  pick(Object.keys(SHOT_FRAMES)),
  pick(Object.keys(ITEM_FRAMES)),
];
const rowWidth = (row) => row.reduce((s, r) => s + r.bmp.w * SCALE + GAP, GAP);
const rowHeight = (row) => Math.max(...row.map((r) => r.bmp.h)) * SCALE + GAP;
const preview = new Bitmap(Math.max(...rows.map(rowWidth)), rows.reduce((s, r) => s + rowHeight(r), GAP));
preview.fill(0x4a5578);
let py = GAP;
for (const row of rows) {
  let px = GAP;
  const h = rowHeight(row) - GAP;
  for (const r of row) {
    preview.blit(r.bmp, px, py + h - r.bmp.h * SCALE, SCALE); // bottom-aligned, like in game
    px += r.bmp.w * SCALE + GAP;
  }
  py += h + GAP;
}
write('art/sprites-preview.png', encodePNG(preview));
