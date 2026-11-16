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

const anvil = (pose) => {
  const dy = pose === 'crouch' ? 4 : 0;
  const map = pose === 'shoot' || pose === 'crouch' ? ANGRY : undefined;
  const layers = [];
  if (pose === 'jump') {
    layers.push(['anvilLegShort', 6, 22], ['anvilLegShort', 20, 22]);
  } else if (pose === 'crouch') {
    layers.push(['anvilLegCrouch', 6, 28], ['anvilLegCrouch', 20, 28]);
  } else {
    layers.push(['anvilLeg', 6, 24], ['anvilLeg', 20, 24]);
  }
  layers.push(['anvilTorso', 5, 9 + dy, { map }], ['anvilHead', 2, dy, { map }]);
  if (pose === 'jump') layers.push(['anvilFist', 0, 1], ['anvilFist', 30, 1]);
  else if (pose === 'shoot') layers.push(['anvilFist', 0, 11], ['anvilCannon', 26, 13]);
  else layers.push(['anvilFist', 0, 11 + dy], ['anvilFist', 30, 11 + dy]);
  return { w: 36, h: 32, layers };
};

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

/** VAULT SENTRY, the UltraBlaster's guardian, seen head-on for the RPG battle. 64 x 64. */
function sentryFront() {
  return shapes(64, 64, [
    // Thruster glow under the floating base.
    ['ellipse', 32, 60, 9, 3, 'O'], ['ellipse', 32, 59, 5, 2, 'Y'],
    ['poly', [[20, 50], [44, 50], [40, 57], [24, 57]], 'g'], ['rect', 22, 50, 20, 2, 'G'],
    // Body.
    ['poly', [[16, 24], [48, 24], [44, 50], [20, 50]], 'G'],
    ['rect', 18, 24, 28, 2, 'w'],
    ['ellipse', 32, 37, 7, 7, 'd'], ['ellipse', 32, 37, 5, 5, 'C'], ['ellipse', 32, 37, 2.5, 2.5, 'W'],
    ['line', 21, 44, 43, 44, 'g'], ['px', 22, 28, 'w'], ['px', 41, 28, 'w'], ['px', 22, 46, 'w'], ['px', 41, 46, 'w'],
    // Shoulders.
    ['ellipse', 13, 25, 8, 6, 'S'], ['ellipse', 51, 25, 8, 6, 'S'], ['line', 7, 22, 19, 22, 's'], ['line', 45, 22, 57, 22, 's'],
    // Left arm: a shield. Right arm: a cannon.
    ['rect', 7, 30, 6, 10, 'g'], ['poly', [[1, 36], [14, 34], [14, 52], [7, 56], [1, 52]], 'S'], ['line', 7, 37, 7, 53, 'V'],
    ['rect', 51, 30, 6, 10, 'g'], ['rect', 49, 40, 10, 14, 'G'], ['rect', 50, 52, 8, 4, 'd'], ['rect', 52, 53, 4, 2, 'R'],
    ['line', 49, 43, 58, 43, 'g'], ['line', 49, 47, 58, 47, 'g'],
    // Neck and dome head with one big eye.
    ['rect', 28, 20, 8, 5, 'g'],
    ['ellipse', 32, 13, 12, 10, 'G'], ['ellipse', 30, 9, 6, 3, 'w'],
    ['rect', 21, 13, 22, 6, 'd'], ['ellipse', 32, 16, 5, 2.6, 'R'], ['ellipse', 32, 16, 2.4, 1.6, 'Y'], ['px', 31, 15, 'W'],
    ['line', 32, 2, 32, 0, 'g'], ['px', 32, 0, 'R'],
  ]);
}
P.sentryFront = sentryFront();

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


const volt = (pose) => ({
  w: 30,
  h: 30,
  layers: [
    ['voltLegs', 6, 24],
    ['voltBody', 6, 12],
    ['voltHead', 8, 2],
    ...(pose === 'cast' ? [['voltArmUp', 2, 4], ['voltArmUp', 24, 4]] : [['voltArm', 2, 13], ['voltArm', 24, 13]]),
  ],
});

const magma = (pose) => {
  const legsY = pose === 'jump' ? 22 : 24;
  const arms =
    pose === 'jump' ? [['magmaFist', 0, 4], ['magmaFist', 26, 4]]
    : pose === 'throw' ? [['magmaFist', 0, 12], ['magmaFistFire', 26, 2]]
    : [['magmaFist', 0, 12], ['magmaFist', 26, 12]];
  return { w: 32, h: 30, layers: [['magmaLegs', 3, legsY], ['magmaBody', 3, 8], ...arms] };
};

const scrap = (pose) => {
  const arms =
    pose === 'toss' ? [['scrapArmUp', 0, 0], ['scrapArm', 26, 9]]
    : pose === 'magnet' ? [['scrapArm', 0, 9], ['scrapMagnet', 22, 10]]
    : [['scrapArm', 0, 9], ['scrapArm', 26, 9]];
  return { w: 32, h: 22, layers: [['scrapAntenna', 13, 0], ['scrapBody', 4, 4], ...arms] };
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
  anvil_idle: anvil('idle'),
  anvil_jump: anvil('jump'),
  anvil_shoot: anvil('shoot'),
  anvil_crouch: anvil('crouch'),
  mantis_idle: mantis('idle'),
  mantis_jump: mantis('jump'),
  mantis_throw: mantis('throw'),
  frostline_idle: frost('idle'),
  frostline_slide: frost('slide'),
  frostline_shoot: frost('shoot'),
  gale_idle: gale('idle'),
  gale_blow: gale('blow'),
  gale_dive: gale('dive'),
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
  volt_idle: volt('idle'),
  volt_cast: volt('cast'),
  magma_idle: magma('idle'),
  magma_jump: magma('jump'),
  magma_throw: magma('throw'),
  scrap_idle: scrap('idle'),
  scrap_toss: scrap('toss'),
  scrap_magnet: scrap('magnet'),
  tide_idle: tide('swim'),
  tide_swim: tide('swim'),
  tide_dash: tide('dash'),
  tide_open: tide('open'),
  overlord_idle: single('overlordIdle', 64, 84),
  jared_idle: single('jaredIdle', 40, 56),
  jared_throw: single('jaredThrow', 40, 56),
  overlord_fire: single('overlordFire', 64, 84),
};


// --- minibosses (one per boss stage, mid-stage) ---------------------------------

/** PRESS TITAN (Foundry): a hydraulic walker with a press plate on its back. */
function pressTitan(attack) {
  const plate = attack ? 0 : 3;
  return boxes(44, 40, [
    [8, 30, 8, 7, 'g'], [28, 30, 8, 7, 'g'], [5, 36, 14, 4, 'G'], [25, 36, 14, 4, 'G'],
    [10, 26, 4, 6, 'w'], [30, 26, 4, 6, 'w'],
    [4, 10, 36, 18, 'O'], [4, 24, 36, 4, 'o'], [4, 10, 36, 2, 'Y'],
    [6, 22, 4, 2, 'd'], [14, 22, 4, 2, 'd'], [22, 22, 4, 2, 'd'], [30, 22, 4, 2, 'd'],
    [12, 13, 20, 7, 'd'], [17, 15, 10, 3, attack ? 'R' : 'Y'],
    [19, plate + 4, 6, 10 - plate, 'g'], [0, plate, 44, 6, 'G'], [0, plate, 44, 1, 'w'],
    // detail: rivets, hydraulic lines, a pressure gauge, hazard stripes on the plate
    ...[6, 12, 18, 24, 30, 36].map((x) => [x, 12, 2, 1, 'y']),
    [2, 13, 2, 12, 'G'], [40, 13, 2, 12, 'G'], [2, 13, 2, 1, 'w'], [40, 13, 2, 1, 'w'],
    [33, 15, 5, 5, 'W'], [33, 15, 5, 1, 'w'], [35, 16, 1, 2, attack ? 'R' : 'd'],
    ...[2, 10, 18, 26, 34].map((x) => [x, plate + 2, 4, 2, 'Y']),
    ...[6, 14, 22, 30, 38].map((x) => [x, plate + 2, 4, 2, 'd']),
  ]);
}

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

/** TUSK MAMMOTH (Glacier): an armored mammoth that charges across the ice. */
function tuskMammoth(attack) {
  const trunk = attack ? [[43, 0, 4, 14, 'b']] : [[43, 12, 4, 16, 'b']];
  return boxes(48, 36, [
    [8, 26, 8, 10, 'b'], [28, 26, 8, 10, 'b'],
    [6, 6, 32, 22, 'B'], [6, 22, 32, 6, 'b'], [6, 6, 32, 2, 'c'],
    [10, 2, 4, 6, 'C'], [18, 0, 4, 8, 'C'], [26, 2, 4, 6, 'C'],
    [30, 4, 16, 20, 'B'], [30, 4, 16, 2, 'c'], [36, 9, 4, 4, attack ? 'R' : 'Y'],
    ...trunk,
    [36, 20, 12, 3, 'W'],
    // detail: shaggy fur strokes, a riveted armor plate, tusk shading, eye glint
    ...[9, 14, 19, 24, 29].map((x) => [x, 11, 1, 9, 'b']),
    [10, 7, 20, 3, 'G'], [10, 7, 20, 1, 'w'], ...[12, 18, 24].map((x) => [x, 8, 1, 1, 'd']),
    [36, 22, 12, 1, 'w'], [37, 9, 1, 1, 'W'],
  ]);
}

/** STORM KITE (Stratos): a flying wing that drops lightning. */
function stormKite(attack) {
  const rod = attack ? 'W' : 'Y';
  return boxes(44, 28, [
    [0, 9, 44, 6, 'U'], [0, 13, 7, 4, 'u'], [37, 13, 7, 4, 'u'], [0, 9, 44, 1, 'C'],
    [6, 15, 2, 7, rod], [36, 15, 2, 7, rod],
    [14, 3, 16, 18, 'S'], [14, 3, 16, 2, 's'], [20, 21, 4, 7, 's'],
    [18, 8, 8, 7, 'W'], [20, 10, 4, 4, attack ? 'R' : 'd'],
    // detail: lightning stripes on the wings, tail streamers, rivets
    [3, 11, 3, 1, 'Y'], [6, 12, 3, 1, 'Y'], [9, 11, 3, 1, 'Y'], [32, 11, 3, 1, 'Y'], [35, 12, 3, 1, 'Y'], [38, 11, 3, 1, 'Y'],
    [16, 22, 2, 6, 'u'], [26, 22, 2, 6, 'u'], [16, 5, 1, 1, 'w'], [27, 5, 1, 1, 'w'],
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

/** ANGLER (Reef): a deep-sea fish with a glowing lure. */
function angler(attack) {
  const mouth = attack ? [[30, 14, 14, 12, 'd'], [31, 14, 2, 3, 'W'], [36, 14, 2, 3, 'W'], [31, 23, 2, 3, 'W'], [36, 23, 2, 3, 'W']] : [[32, 18, 12, 5, 'd'], [33, 18, 2, 2, 'W'], [38, 18, 2, 2, 'W']];
  return boxes(44, 32, [
    [0, 10, 7, 14, 'b'], [0, 10, 3, 14, 'C'],
    [4, 8, 34, 20, 'S'], [10, 20, 24, 8, 's'], [14, 4, 10, 5, 'b'],
    [26, 1, 2, 9, 'b'], [26, 1, 8, 2, 'b'], [32, 0, 6, 6, attack ? 'W' : 'Y'],
    [28, 11, 5, 5, 'W'], [30, 12, 2, 3, 'd'],
    ...mouth,
    // detail: glowing spots, fin rays, lure halo
    [10, 14, 2, 2, 'C'], [16, 12, 2, 2, 'C'], [22, 15, 2, 2, 'C'], [12, 22, 2, 2, 'C'],
    [1, 13, 4, 1, 'b'], [1, 17, 4, 1, 'b'], [1, 21, 4, 1, 'b'],
    [31, 0, 1, 1, 'C'], [38, 0, 1, 1, 'C'], [31, 5, 1, 1, 'C'], [38, 5, 1, 1, 'C'],
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

// --- fortress guardians (stage bosses of the three fortress stages) ---------------

/** GATEKEEPER (Fortress Gate): an armored golem with a portcullis for a chest. */
function gatekeeper(attack) {
  const fy = attack ? 2 : 24;
  return boxes(52, 48, [
    [12, 38, 10, 7, 'g'], [30, 38, 10, 7, 'g'], [9, 44, 15, 4, 'G'], [28, 44, 15, 4, 'G'],
    [8, 14, 36, 26, 'g'], [8, 14, 36, 2, 'w'],
    [14, 18, 24, 18, 'u'], [21, 23, 10, 8, attack ? 'R' : 'U'], [24, 25, 4, 3, attack ? 'Y' : 'P'],
    [13, 17, 3, 20, 'G'], [20, 17, 3, 20, 'G'], [27, 17, 3, 20, 'G'], [34, 17, 3, 20, 'G'],
    [10, 23, 32, 2, 'G'], [10, 31, 32, 2, 'G'],
    [0, 12, 12, 12, 'U'], [40, 12, 12, 12, 'U'], [0, 12, 12, 2, 'P'], [40, 12, 12, 2, 'P'],
    [2, 20, 8, 6, 'g'], [42, 20, 8, 6, 'g'],
    [1, fy, 10, 12, 'G'], [41, fy, 10, 12, 'G'], [1, fy, 10, 2, 'w'], [41, fy, 10, 2, 'w'],
    [18, 4, 16, 11, 'G'], [18, 4, 16, 1, 'w'], [18, 1, 3, 5, 'U'], [31, 1, 3, 5, 'U'],
    [20, 8, 12, 3, 'd'], [26, 8, 4, 3, attack ? 'R' : 'V'],
    // detail: shoulder spikes, knuckle studs, glowing seams, chest rivets
    [2, 8, 3, 4, 'w'], [7, 9, 3, 3, 'w'], [42, 9, 3, 3, 'w'], [47, 8, 3, 4, 'w'],
    ...[2, 5, 8].map((x) => [x, fy + 3, 1, 1, 'W']), ...[42, 45, 48].map((x) => [x, fy + 3, 1, 1, 'W']),
    [8, 30, 36, 1, attack ? 'R' : 'U'], [8, 36, 36, 1, attack ? 'R' : 'U'],
    [10, 16, 1, 1, 'W'], [41, 16, 1, 1, 'W'], [10, 38, 1, 1, 'W'], [41, 38, 1, 1, 'W'],
  ]);
}

/** ABYSS EYE (Fortress Depths): an armored eye that floats in the dark. */
function abyssEye(attack) {
  const iris = attack ? 'R' : 'U';
  return boxes(46, 46, [
    [21, 0, 4, 5, 'u'], [21, 41, 4, 5, 'u'], [0, 21, 5, 4, 'u'], [41, 21, 5, 4, 'u'],
    [5, 5, 4, 4, 'u'], [37, 5, 4, 4, 'u'], [5, 37, 4, 4, 'u'], [37, 37, 4, 4, 'u'],
    [10, 3, 26, 40, 'S'], [3, 10, 40, 26, 'S'], [7, 7, 32, 32, 'S'], [10, 3, 26, 2, 's'], [3, 10, 2, 26, 's'],
    [14, 9, 18, 28, 'W'], [9, 14, 28, 18, 'W'], [12, 12, 22, 22, 'W'],
    [16, 16, 14, 14, iris], [18, 15, 10, 16, iris], [15, 18, 16, 10, iris],
    [20, 20, 6, 6, 'd'], [18, 17, 3, 2, 'W'],
    ...(attack ? [[8, 7, 30, 8, 'S'], [8, 31, 30, 8, 'S'], [12, 14, 22, 1, 's'], [12, 31, 22, 1, 's']] : []),
    // detail: veins on the eye, rivets round the shell, an iris ring
    [13, 20, 3, 1, 'R'], [14, 21, 1, 2, 'R'], [30, 27, 4, 1, 'R'], [31, 28, 1, 2, 'R'], [15, 30, 3, 1, 'R'], [29, 15, 3, 1, 'R'],
    ...[[11, 5], [34, 5], [5, 11], [40, 11], [5, 34], [40, 34], [11, 40], [34, 40]].map(([x, y]) => [x, y, 1, 1, 'w']),
    [17, 16, 12, 1, attack ? 'r' : 'u'], [17, 29, 12, 1, attack ? 'r' : 'u'],
  ]);
}

/** SPIRE WARDEN (Fortress Spire): a winged knight with a blade arm. */
function spireWarden(attack) {
  const wing = attack
    ? [[0, 2, 10, 24, 'w'], [0, 18, 6, 8, 'G'], [2, 0, 4, 4, 'w'], [0, 9, 8, 1, 'G'], [0, 14, 8, 1, 'G']]
    : [[0, 12, 10, 26, 'w'], [0, 30, 6, 8, 'G'], [0, 19, 8, 1, 'G'], [0, 25, 8, 1, 'G']];
  const arm = attack ? [[30, 6, 5, 14, 'G'], [31, 0, 3, 8, 'C'], [31, 0, 3, 1, 'W']] : [[30, 24, 5, 14, 'G'], [33, 32, 7, 3, 'C'], [33, 32, 7, 1, 'W']];
  return boxes(40, 56, [
    ...wing,
    [12, 42, 6, 10, 'g'], [22, 42, 6, 10, 'g'], [10, 51, 9, 5, 'G'], [21, 51, 9, 5, 'G'],
    [9, 18, 22, 26, 'U'], [12, 20, 16, 10, 's'], [9, 38, 22, 3, 'y'], [17, 24, 6, 5, attack ? 'R' : 'Y'],
    [6, 16, 8, 6, 'G'], [26, 16, 8, 6, 'G'], [6, 16, 8, 1, 'w'], [26, 16, 8, 1, 'w'],
    [12, 4, 16, 15, 'G'], [12, 4, 16, 1, 'w'], [17, 0, 6, 6, 'R'],
    [16, 10, 11, 3, 'd'], [22, 10, 4, 3, attack ? 'R' : 'V'],
    ...arm,
    // detail: mail texture, buckle, blade edge, feather tips, helmet shading
    ...[[12, 32], [16, 33], [20, 32], [24, 33], [14, 35], [22, 35], [18, 36]].map(([x, y]) => [x, y, 1, 1, 's']),
    [18, 38, 4, 3, 'Y'], [19, 39, 2, 1, 'y'],
    [12, 14, 16, 1, 'g'], [19, 0, 2, 2, 'P'],
    ...(attack ? [[1, 4, 2, 1, 'W'], [1, 10, 2, 1, 'W']] : [[1, 14, 2, 1, 'W'], [1, 20, 2, 1, 'W']]),
  ]);
}

const MINI_ART = { press: pressTitan, toad: briarToad, mammoth: tuskMammoth, kite: stormKite, dynamo, crab: cinderCrab, crusher, angler, gatekeeper, abyss: abyssEye, warden: spireWarden };
const MINI_SIZE = { press: [44, 40], toad: [44, 32], mammoth: [48, 36], kite: [44, 28], dynamo: [40, 40], crab: [46, 30], crusher: [48, 34], angler: [44, 32], gatekeeper: [52, 48], abyss: [46, 46], warden: [40, 56] };
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


// --- boxing mode: the Gatekeeper from the front, UltraGuy from behind ------------------

/** A boxing glove (w x h) at (x, y): red leather, pink shine, white cuff. */
function glove(x, y, w = 10, h = 9, col = 'R', shine = 'P') {
  return [[x, y, w, h, col], [x + 1, y + 1, w - 4, 2, shine], [x, y + h - 2, w, 2, 'W'], [x + w - 2, y + 2, 1, h - 5, 'r']];
}

/** GATEKEEPER, front view in the ring. 48 x 60. */
function gateBoxer(pose) {
  const dy = pose === 'upWind' ? 4 : pose === 'hitBody' ? 2 : 0;
  const hx = pose === 'hitFace' ? 3 : pose === 'dizzy' ? -2 : 0;
  const eye = pose === 'hitFace' ? 'd' : pose === 'dizzy' ? 'Y' : 'R';
  if (pose === 'down') {
    return boxes(48, 60, [
      [4, 50, 40, 8, 'G'], [4, 50, 40, 2, 'w'], [14, 48, 18, 8, 'u'], [16, 48, 2, 8, 'G'], [22, 48, 2, 8, 'G'], [28, 48, 2, 8, 'G'],
      [0, 46, 12, 12, 'G'], [2, 50, 8, 2, 'd'], [4, 50, 2, 2, 'd'],
      [36, 52, 12, 6, 'U'], ...glove(10, 40), ...glove(26, 41),
    ]);
  }
  const body = [
    [14, 48, 8, 10, 'g'], [26, 48, 8, 10, 'g'], [12, 56, 12, 4, 'G'], [24, 56, 12, 4, 'G'],
    [12, 40 + dy, 24, 10, 'U'], [12, 40 + dy, 24, 2, 'Y'], [22, 43 + dy, 4, 6, 'u'],
    [10, 20 + dy, 28, 22, 'G'], [10, 20 + dy, 28, 1, 'w'],
    [15, 24 + dy, 18, 13, 'u'], [17, 24 + dy, 2, 13, 'G'], [22, 24 + dy, 2, 13, 'G'], [27, 24 + dy, 2, 13, 'G'], [15, 30 + dy, 18, 2, 'G'],
    [21, 27 + dy, 6, 5, pose === 'upper' ? 'Y' : 'R'],
    [4, 18 + dy, 10, 8, 'U'], [34, 18 + dy, 10, 8, 'U'], [4, 18 + dy, 10, 1, 'P'], [34, 18 + dy, 10, 1, 'P'],
    [17 + hx, 6 + dy, 14, 14, 'G'], [17 + hx, 6 + dy, 14, 1, 'w'], [17 + hx, 3 + dy, 3, 4, 'U'], [28 + hx, 3 + dy, 3, 4, 'U'],
    [19 + hx, 11 + dy, 10, 3, 'd'], [23 + hx, 11 + dy, 3, 3, eye], [20 + hx, 16 + dy, 8, 1, 'd'],
  ];
  const gloves = {
    idle: [...glove(4, 24), ...glove(34, 24)],
    guardHigh: [[10, 14, 4, 8, 'g'], [34, 14, 4, 8, 'g'], ...glove(12, 6), ...glove(26, 6)],
    guardLow: [...glove(10, 30), ...glove(28, 30)],
    windL: [[2, 14, 6, 8, 'g'], ...glove(0, 8), ...glove(26, 8)],
    windR: [[40, 14, 6, 8, 'g'], ...glove(38, 8), ...glove(12, 8)],
    punchL: [...glove(26, 8), ...glove(6, 32, 16, 14)],
    punchR: [...glove(12, 8), ...glove(26, 32, 16, 14)],
    upWind: [...glove(12, 10), ...glove(36, 42)],
    upper: [...glove(4, 24), ...glove(28, 0, 14, 12)],
    hitFace: [...glove(2, 30), ...glove(36, 30)],
    hitBody: [...glove(8, 36), ...glove(30, 36)],
    dizzy: [...glove(4, 38), ...glove(34, 36)],
  }[pose];
  return boxes(48, 60, [...body, ...gloves]);
}

/** ULTRAGUY from behind, gloved up. 28 x 40. */
function heroBoxer(pose) {
  if (pose === 'down') {
    return boxes(28, 40, [[2, 30, 24, 8, 'O'], [2, 30, 24, 2, 'Y'], [0, 28, 10, 10, 'O'], [14, 34, 10, 4, 'S'], ...glove(18, 26, 7, 6, 'B', 'C')]);
  }
  const torso = [
    [7, 30, 6, 8, 'S'], [15, 30, 6, 8, 'S'], [6, 36, 8, 4, 'O'], [14, 36, 8, 4, 'O'], [6, 36, 8, 1, 'Y'], [14, 36, 8, 1, 'Y'],
    [6, 26, 16, 5, 'S'], [6, 26, 16, 1, 's'],
    [5, 13, 18, 14, 'O'], [5, 13, 18, 2, 'Y'], [5, 24, 18, 3, 'o'], [13, 15, 2, 9, 'o'],
    [7, 1, 14, 13, 'O'], [9, 1, 8, 2, 'Y'], [7, 11, 14, 3, 'o'], [8, 5, 2, 3, 'G'],
  ];
  const arms = {
    idle: [[2, 16, 4, 6, 'O'], [22, 16, 4, 6, 'O'], ...glove(0, 12, 7, 8, 'B', 'C'), ...glove(21, 12, 7, 8, 'B', 'C')],
    block: [...glove(4, 2, 8, 9, 'B', 'C'), ...glove(16, 2, 8, 9, 'B', 'C')],
    punchL: [[5, 8, 4, 8, 'O'], ...glove(4, 4, 8, 8, 'B', 'C'), ...glove(21, 12, 7, 8, 'B', 'C')],
    punchR: [[19, 8, 4, 8, 'O'], ...glove(16, 4, 8, 8, 'B', 'C'), ...glove(0, 12, 7, 8, 'B', 'C')],
    punchHL: [[6, 4, 4, 10, 'O'], ...glove(5, 0, 8, 7, 'B', 'C'), ...glove(21, 12, 7, 8, 'B', 'C')],
    punchHR: [[18, 4, 4, 10, 'O'], ...glove(15, 0, 8, 7, 'B', 'C'), ...glove(0, 12, 7, 8, 'B', 'C')],
    star: [[12, 2, 4, 12, 'O'], ...glove(9, 0, 10, 8, 'Y', 'W'), ...glove(0, 14, 7, 8, 'B', 'C')],
  }[pose];
  return boxes(28, 40, [...torso, ...arms]);
}

for (const pose of ['idle', 'guardHigh', 'guardLow', 'windL', 'windR', 'punchL', 'punchR', 'upWind', 'upper', 'hitFace', 'hitBody', 'dizzy', 'down']) P[`gbox_${pose}`] = gateBoxer(pose);
for (const pose of ['idle', 'block', 'punchL', 'punchR', 'punchHL', 'punchHR', 'star', 'down']) P[`ubox_${pose}`] = heroBoxer(pose);
const BOX_FRAMES = {};
for (const pose of ['idle', 'guardHigh', 'guardLow', 'windL', 'windR', 'punchL', 'punchR', 'upWind', 'upper', 'hitFace', 'hitBody', 'dizzy', 'down']) BOX_FRAMES[`gbox_${pose}`] = single(`gbox_${pose}`, 48, 60);
for (const pose of ['idle', 'block', 'punchL', 'punchR', 'punchHL', 'punchHR', 'star', 'down']) BOX_FRAMES[`ubox_${pose}`] = single(`ubox_${pose}`, 28, 40);

BOX_FRAMES.sentry_front = single('sentryFront', 64, 64);
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

const rendered = Object.entries(FRAMES).map(([name, f]) => ({ name, bmp: renderFrame(name, f) }));

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
  ...bossNames.map((b) => pick(Object.keys(CHARACTER_FRAMES).filter((n) => n.startsWith(`${b}_`)))),
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
