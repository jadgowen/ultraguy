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

import { Bitmap, drawGrid, encodePNG, write } from './lib.mjs';

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
    '..KKRRRRRRRKK...',
    '.KRRPPRRRRRRRK..',
    '.KRPRRRRRKKKKRK.',
    'KRRRRRRRKWWSWKRK',
    'KRRRRRRRKWWSWKRK',
    'KrRRRRRRKWWWWKRK',
    'KrrRRRRRRKKKKRrK',
    'KwGGGGGGGGGGGGgK',
    '.KKKKKKKKKKKKKK.',
  ],
  walkerLegsA: [
    '...KgK....KgK...',
    '...KgK....KgK...',
    '..KdgK....KdgK..',
    '.KGGGK...KGGGK..',
    'KGGGGK...KGGGGK.',
    'KKKKKK...KKKKKK.',
  ],
  walkerLegsB: [
    '....KgK..KgK....',
    '...KgK....KgK...',
    '..KdgK.....KdgK.',
    '.KGGGK....KGGGK.',
    'KGGGGK....KGGGGK',
    'KKKKKK....KKKKKK',
  ],

  // HOPPER: frog bot
  hopperSit: [
    '..KKKK....KKKK..',
    '.KWWWSK..KSWWWK.',
    '.KWWSSKKKKSSWWK.',
    'KEKKKKEEEEKKKKEK',
    'KEEEEEEEEEEEEEEK',
    'KENEEEEEEEEEENEK',
    'KEEEKRRRRRRKEEEK',
    'KEEEEKKKKKKEEEEK',
    'KeEEEEEEEEEEEEeK',
    'KeeEENNNNNNEEeeK',
    '.KeeeEEEEEEeeeK.',
    'KEEKKeeeeeeKKEEK',
    'KEEEK......KEEEK',
    'KKKKK......KKKKK',
  ],
  hopperJump: [
    '...KKK....KKK...',
    '..KWWSK..KSWWK..',
    '..KWSSKKKKSSWK..',
    '.KEKKKEEEEKKKEK.',
    '.KEEEEEEEEEEEEK.',
    '.KENEEKRRKEENEK.',
    '.KEEEEKKKKEEEEK.',
    '.KeEEEEEEEEEEeK.',
    '..KeeNNNNNNeeK..',
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
    'KGGGGGGGGGGGGGgK',
    'KggggggggggggggK',
    'KKKKKKKKKKKKKKKK',
  ],
  turretShut: [
    '....KKKKKKKK....',
    '...KwwGGGGGgK...',
    '..KwGGGGGGGGgK..',
    '.KwGGGGGGGGGGgK.',
    '.KGGGGGGGGGGGgK.',
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
    'KUuYYuUK',
    'KUYSYYUK',
    'KUuYYuUK',
    '.KuUUuK.',
    '..KKKK..',
  ],
  flyerWingUp: ['KK...', 'KUK..', 'KUUKK', 'KuUUK', '.KuUK', '..KK.'],
  flyerWingDown: ['..KK.', '.KuUK', 'KuUUK', 'KUUKK', 'KUK..', 'KK...'],

  // LURKER: camouflage lizard with a turret eye
  lurkerBody: [
    '...........KKKK...',
    '..........KEEEEK..',
    '...KKKKKKKEEKKKEK.',
    '..KEEEEEEEEKYYSKEK',
    '.KENNEENNEEKYYKEEK',
    'KKEEEEEEEEEEKKEEK.',
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
    '..KRKSSSSSSKRK..',
    '..KRKSSYYSSKRK..',
    '..KRKSSSSSSKRK..',
    '..KRRKKKKKKRRK..',
    '...KRRrRRrRRK...',
    '....KKKKKKKK....',
  ],

  // SLIDER: penguin bot
  sliderBody: [
    '.....KKKKK......',
    '....KSSSSSK.....',
    '...KSSSSWSSK....',
    '...KSSSWSKSK....',
    '..KSSSSSSSSOOK..',
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
    'KRrRRRRRRRRRWWKYYK',
    '.KrrRRRRRRRRRKYYK.',
    '..KrrrRRRRRRRK.K..',
    '...KKKrrrrrrK.....',
    '.....KKKKKKK......',
  ],
  bomberWingUp: ['KK.....', 'KRKK...', 'KRRRKK.', '.KrRRRK', '..KKKKK'],
  bomberWingDown: ['..KKKKK', '.KrRRRK', 'KRRRKK.', 'KK.....'],

  // SPARKER: imp on a cloud
  sparkerImp: ['..KKKK..', '.KUUUUK.', 'KUYUUYUK', 'KUSUUSUK', 'KUUUUUUK', '.KuWWuK.', 'KUUUUUUK', 'KuUUUUuK', '.KKKKKK.'],
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
  anvilHead: [
    'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
    'KwwwwwwwwwwwwwwwwwwwwwwwwwwwwwGK',
    'KGGGGGGGGGGGGGGGGGGGGGGGGGGGGGgK',
    '.KKggggggggggggggggggggggggggKK.',
    '....KKKGGGGGGGGGGGGGGGGGGKKK....',
    '......KGGGGGGGGGKKKKKKKGGK......',
    '......KGGGGGGGGGKYYYYYKGgK......',
    '......KGGGGGGGGGKyyyyyKGgK......',
    '......KgGGGGGGGGKKKKKKKGgK......',
    '......KKKKKKKKKKKKKKKKKKKK......',
  ],
  anvilTorso: [
    '.KKKKKKKKKKKKKKKKKKKKKKKK.',
    'KRRPRRRRRRRRRRRRRRRRRRRRrK',
    'KRPRRRKKKKKKKKKKKKKKRRRRrK',
    'KRRRRKwwwwwwwwwwwwwGKRRRrK',
    'KRRRRKGGGGGGGGGGGGGgKRRRrK',
    'KRRRRKGGGGKKKKKKGGGgKRRRrK',
    'KRRRRKGGGGKddddKGGGgKRRRrK',
    'KRRRRKGGGGKKKKKKGGGgKRRRrK',
    'KRRRRKggggggggggggggKRRRrK',
    'KRRRRRKKKKKKKKKKKKKKRRRRrK',
    'KrRRRRRRRRRRRRRRRRRRRRRrrK',
    'KKKKKKKKKKKKKKKKKKKKKKKKKK',
    'KSSSSSSSSSSSSSSSSSSSSSSSSK',
    'KSsSSSSSSSSSSSSSSSSSSSSsSK',
    'KKKKKKKKKKKKKKKKKKKKKKKKKK',
  ],
  anvilFist: ['KKKKKK', 'KwwGGK', 'KGGGgK', 'KGGGgK', 'KKKKKK', 'KwGGgK', 'KGGGgK', 'KGKGgK', 'KGGGgK', 'KKKKKK'],
  anvilCannon: ['KKKKKKKKK.', 'KwwGGGGGgK', 'KGGGGGGGKK', 'KGGGGGGGKR', 'KGGGGGGGKK', 'KgggggggGK', 'KKKKKKKKK.'],
  anvilLeg: ['..KSSSSK..', '..KSssSK..', '..KSSSSK..', '..KSssSK..', '.KKKKKKKK.', 'KwwwGGGGgK', 'KGGGGGGGgK', 'KKKKKKKKKK'],
  anvilLegShort: ['..KSSSSK..', '..KSssSK..', '.KKKKKKKK.', 'KwwwGGGGgK', 'KGGGGGGGgK', 'KKKKKKKKKK'],
  anvilLegCrouch: ['..KSSSSK..', '.KKKKKKKK.', 'KwwwGGGGgK', 'KKKKKKKKKK'],

  // MANTIS (boss)
  mantisHead: [
    '...KKKKK....',
    '..KEEEEEKK..',
    '.KENEEEEEEK.',
    'KEERRREEEEEK',
    'KERRYRKEEEeK',
    'KEERRRKEEeK.',
    '.KEEEEEEeK..',
    '..KKEEeeK...',
    '....KKKK....',
  ],
  mantisBody: [
    '............KKKKK.....',
    '...........KEEEEEK....',
    '..KKKKKKKKKEENEEEK....',
    '.KeEEEEEEEKEEEEEEK....',
    'KeEEEEEEEEEKEEEEEK....',
    'KeEENEEENEEEKEEEK.....',
    'KeeEEEEEEEEEKEEEK.....',
    '.KeeeEEEEEEKKEEEK.....',
    '..KKKeeeeeK.KEEEK.....',
    '.....KKKKK..KEEEK.....',
    '............KeeeK.....',
    '............KKKKK.....',
  ],
  mantisLegs: [
    '......KeK...KeK.......',
    '.....KeK.....KeK......',
    '....KeK.......KeK.....',
    '...KeK.........KeK....',
    '..KeK...........KeK...',
    '..KeK...........KeK...',
    '..KeK...........KeK...',
    '..KeK...........KeK...',
    '.KeeK...........KeeK..',
    '.KKKK...........KKKK..',
  ],
  mantisLegsJump: [
    '......KeK...KeK.......',
    '.....KeK.....KeK......',
    '....KeK.......KeK.....',
    '...KeK.........KeK....',
    '..KeeK.........KeeK...',
    '..KKKK.........KKKK...',
  ],
  mantisScythe: [
    '......KK',
    '.....KcK',
    '....KccK',
    '...KccK.',
    '..KccK..',
    '.KccK...',
    'KcKEK...',
    'KKEEK...',
    '..KEK...',
    '..KEEK..',
    '...KEK..',
    '....KK..',
  ],
  mantisThrowArm: ['.KKKKKK.....', 'KEEEEEEKKKK.', 'KeeeeeeKcccK', '.KKKKKKKKKK.'],

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
    'KBBBBBBcccccccccccBBBBBBBK..',
    'KBBBBBccccccccccccccBBBBBK..',
    'KbBBBBccccccccccccccBBBBbK..',
    'KbBBBBcccccCcccccccBBBBBbK..',
    'KbbBBBBccccccccccccBBBBbbK..',
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
  frostFlipper: ['..KKK.', '.KbBK.', 'KbBBK.', 'KbBBK.', 'KbBBK.', 'KbbK..', 'KKK...'],
  frostFlipperUp: ['..KK..', '.KcCK.', 'KcCCK.', '.KBBK.', '.KBBK.', 'KBBBK.', 'KbbK..', 'KKK...'],
  iceSkid: ['.c..c...c..c', 'c..C...c..C.'],

  // GALE (boss)
  galeProp: ['KKKKKKKKK....KKKKKKKKK', 'KwwwwwwwwKKKKwwwwwwwwK', 'KKKKKKKKKKYYKKKKKKKKKK'],
  galeHub: ['.KYYK.', '.KyyK.', 'KKKKKK'],
  galeBody: [
    '...KKKKKKKKKK...',
    '..KWWWWWWWWWWK..',
    '.KWWwwwwwwWWWWK.',
    'KWWwWWWWKKKKKWWK',
    'KWwWWWWKSSSSVKWK',
    'KWwWWWWKSSSVVKWK',
    'KWWWWWWWKKKKKWWK',
    'KBBBBBBBBBBBBBBK',
    'KbBBBBBBBBBBBBbK',
    'KWWWWWWWWWWWWWWK',
    'KwWWWWWWWWWWWWwK',
    '.KwWWWWWWWWWWwK.',
    '..KwwWWWWWWwwK..',
    '...KKwwwwwwKK...',
    '.....KKKKKK.....',
    '......KbbK......',
  ],
  galeWing: ['.......KK', '.....KKBK', '...KKBBBK', '.KKBBBBbK', 'KBBBBBbbK', 'KbBBBbbK.', '.KbbbbK..', '..KKKK...'],
  galeWingUp: ['KK.......', 'KBKK.....', 'KBBBKK...', 'KbBBBBKK.', '.KbBBBBBK', '..KbbBBBK', '...KKbbbK', '.....KKKK'],
  galeWingDown: ['.....KKKK', '...KKbbbK', '..KbbBBBK', '.KbBBBBBK', 'KbBBBBKK.', 'KBBBKK...', 'KBKK.....', 'KK.......'],
  galeTalons: ['..KbK..KbK..', '..KbK..KbK..', '.KYYYK.KYYYK', '.KKKKK.KKKKK'],

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
    '.....KOOOOK.....',
    '......KyyK......',
    '.....KOOOOK.....',
    '......KyyK......',
    '.....KOOOOK.....',
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
    '......KKKrRRRRrK..',
    '....KKrrRRYRRRRYK.',
    '..KKrrRRRRRRRRRRK.',
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
    'KgKMMMMMMMMMMKgK',
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
    'KKYYYYYYYYYYOK',
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
    'KYYYYYYYYYYYOK',
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
    '...KSSSSSSK...',
    '..KSsVVVVsSK..',
    '..KSsVWWVsSK..',
    '..KSSSSSSSSK..',
    '...KSSSSSSK...',
    '....KKKKKK....',
  ],
  voltBody: [
    '..KKKKKKKKKKKKKK..',
    '.KSSSSSSSSSSSSSSK.',
    'KSsSSSKKKKKKSSSsSK',
    'KSsSSKYYYYYYKSSsSK',
    'KSsSSKYWWYYYKSSsSK',
    'KSsSSKYYYYYYKSSsSK',
    'KSsSSSKKKKKKSSSsSK',
    'KSSSSSSSSSSSSSSSSK',
    '.KSSSSSSSSSSSSSSK.',
    '..KKKKKKKKKKKKKK..',
    '...KSSK....KSSK...',
    '...KSsK....KSsK...',
  ],
  voltLegs: [
    '...KSSK....KSSK...',
    '...KSsK....KSsK...',
    '..KKKKKK..KKKKKK..',
    '.KYYYYYK..KYYYYYK.',
    '.KyyyyyK..KyyyyyK.',
    '.KKKKKKK..KKKKKKK.',
  ],
  voltArm: ['KKKK', 'KSsK', 'KSsK', 'KSsK', 'KKKK', 'KYYK', 'KYYK', 'KYYK', 'KyyK', 'KKKK'],
  voltArmUp: ['KYYK', 'KWYK', 'KYYK', 'KKKK', 'KSsK', 'KSsK', 'KSsK', 'KSsK', 'KSsK', 'KKKK'],

  // --- MAGMA (boss) ----------------------------------------------------------------
  magmaBody: [
    '........KKKKKKKKKK........',
    '.....KKKgGGGGGGGGgKKK.....',
    '....KgGGGGGGGGGGGGGGgK....',
    '...KgGGGGGGGGGGGGKKKGGK...',
    '..KgGGGRGGGGGGGGKYYKGGgK..',
    '..KgGGRRRGGGGGGGKYRKGGgK..',
    '.KgGGGGRGGGGGGGGGKKGGGGgK.',
    '.KgGGGGGGGGRRGGGGGGGGGGgK.',
    'KgGGRGGGGGGGRGGGGGGGGGGGgK',
    'KgGRRRGGGGGGRRGGGGGGGGGGgK',
    'KgGGRGGGGGGGGRGGGGGGGRGGgK',
    'KggGGGGGGGGGGGGGGGGGRRRggK',
    '.KggGGGGGGGGGGGGGGGGGRggK.',
    '.KgggGGGGGGGGGGGGGGgggK...',
    '..KKgggggggggggggggggKK...',
    '....KKKKKKKKKKKKKKKKK.....',
  ],
  magmaLegs: [
    '....KgggK......KgggK......',
    '....KgGgK......KgGgK......',
    '...KgGGGgK....KgGGGgK.....',
    '..KRgGGGgRK..KRgGGGgRK....',
    '..KgggggggK..KgggggggK....',
    '..KKKKKKKKK..KKKKKKKKK....',
  ],
  magmaFist: ['.KKKK.', 'KgGGgK', 'KGRGGK', 'KGGGgK', 'KgGGgK', '.KKKK.', 'KgGGgK', 'KGGRGK', 'KgGGgK', '.KKKK.'],
  magmaFistFire: ['.KYYK.', 'KYWWYK', 'KOYYOK', '.KKKK.', 'KgGGgK', 'KGRGGK', 'KgGGgK', 'KGGGgK', 'KgGGgK', '.KKKK.'],

  // --- SCRAP (boss) ----------------------------------------------------------------
  scrapBody: [
    '..KKKKKKKKKKKKKKKKKKKK..',
    '.KMMMMyMMMMMMMMMyMMMMMK.',
    'KMMMKKKKKKKKKKKKKKKKMMMK',
    'KMMMKRRKddddddddKRRKMMMK',
    'KMMMKKKKKKKKKKKKKKKKMMMK',
    'KMyMMMMMMMMMMMMMMMMMMyMK',
    'KMMMMGGGGGGGGGGGGGGMMMMK',
    'KMMMMGwwwwwwwwwwwwGMMMMK',
    'KMMMMGGGGKKKKKKGGGGMMMMK',
    'KMMMMGGGGKYYYYKGGGGMMMMK',
    'KMMMMGGGGKKKKKKGGGGMMMMK',
    'KMMMMggggggggggggggMMMMK',
    'KMyMMMMMMMMMMMMMMMMMMyMK',
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
    '............KbbK..................',
    '...........KbBBK..................',
    '.......KKKKKbBBBKKKKKKK...........',
    '....KKKbbbbBBBBBBBBBBBBBKKK.......',
    '..KKbbbBBBBBBBBBBBBBBBBBBBBKK.....',
    'KKbbBBBBBBBBBBBBBBBBBBBBBKWWSBKK..',
    'KbKbBBBBBBBBBBBBBBBBBBBBBBKWWBBBK.',
    'KbbKBBBBBBBBBBBBBBBBBBBBBBBBBBBBBK',
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
  layers: [
    [pose === 'jump' ? 'mantisLegsJump' : 'mantisLegs', 2, 22],
    ['mantisBody', 2, 10],
    ['mantisHead', 14, 1],
    pose === 'throw' ? ['mantisThrowArm', 17, 13] : ['mantisScythe', 22, 6],
  ],
});

const frost = (pose) => {
  if (pose === 'slide') {
    return { w: 32, h: 28, layers: [['iceSkid', 0, 25], ['frostBody', 2, 9], ['frostFlipper', 22, 18]] };
  }
  return {
    w: 32,
    h: 28,
    layers: [
      ['frostFeet', 2, 24],
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

/** OVERLORD (final boss, phase 1): skull-faced war machine, cannon on the right. */
function overlord(firing) {
  const eye = firing ? 'Y' : 'R';
  return boxes(64, 84, [
    // treads and wheels
    [1, 70, 62, 13, 'g'],
    [4, 73, 10, 8, 'G'], [18, 73, 10, 8, 'G'], [34, 73, 10, 8, 'G'], [49, 73, 10, 8, 'G'],
    [7, 76, 4, 2, 'd'], [21, 76, 4, 2, 'd'], [37, 76, 4, 2, 'd'], [52, 76, 4, 2, 'd'],
    // body
    [7, 30, 50, 40, 'U'], [7, 62, 50, 8, 'u'], [7, 34, 6, 28, 'G'], [51, 34, 6, 28, 'G'],
    [24, 40, 16, 14, 'd'], [27, 43, 10, 8, 'R'], [30, 45, 4, 4, firing ? 'W' : 'Y'],
    // shoulders
    [1, 28, 14, 10, 'G'], [49, 28, 14, 10, 'G'], [1, 28, 14, 2, 'w'], [49, 28, 14, 2, 'w'],
    // horns and skull
    [13, 1, 5, 10, 'r'], [46, 1, 5, 10, 'r'],
    [17, 4, 30, 26, 'w'], [17, 4, 30, 2, 'W'], [21, 24, 22, 8, 'G'],
    [23, 26, 2, 3, 'W'], [27, 26, 2, 3, 'W'], [31, 26, 2, 3, 'W'], [35, 26, 2, 3, 'W'], [39, 26, 2, 3, 'W'],
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

const MINI_ART = { press: pressTitan, toad: briarToad, mammoth: tuskMammoth, kite: stormKite, dynamo, crab: cinderCrab, crusher, angler };
const MINI_SIZE = { press: [44, 40], toad: [44, 32], mammoth: [48, 36], kite: [44, 28], dynamo: [40, 40], crab: [46, 30], crusher: [48, 34], angler: [44, 32] };
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

const FRAMES = { ...CHARACTER_FRAMES, ...MINI_FRAMES, ...SHOT_FRAMES, ...ITEM_FRAMES };

// --- render ----------------------------------------------------------------------

function renderFrame(name, f) {
  const bmp = new Bitmap(f.w, f.h);
  for (const [part, x, y, opts] of f.layers) {
    const rows = P[part];
    if (!rows) throw new Error(`${name}: unknown part "${part}"`);
    drawGrid(bmp, `${name}/${part}`, rows, x, y, (c) => PALETTE[c], opts);
  }
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
