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

const FRAMES = {
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
};

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

// Preview: enemies on one row, each boss on its own row, 4x on a mid-tone.
const SCALE = 4;
const GAP = 8;
const groups = [
  rendered.filter((r) => !r.name.includes('_')),
  ...['anvil', 'mantis', 'frostline', 'gale'].map((b) => rendered.filter((r) => r.name.startsWith(`${b}_`))),
];
const enemiesRow1 = groups[0].slice(0, 10);
const enemiesRow2 = groups[0].slice(10);
const rows = [enemiesRow1, enemiesRow2, ...groups.slice(1)];
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
