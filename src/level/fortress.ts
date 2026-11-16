import type { StageData } from './Level';
import { SKY, bossRoom, rows, water } from './rooms';

// The FORTRESS: three stages played in order once all eight bosses are
// beaten, each mixing hazards from the boss stages and ending with a guardian
// boss (no weapon reward), then the boss hall and the final boss stage.

const CEIL = '################';

/** Room shared by the three fortress guardians (plain string rows, safe to reuse). */
const guardRoom = bossRoom();
const FLOOR = '################';

/**
 * Fortress 1: GATE. An industrial remix: crushers over switch blocks, barrels
 * rolling under presses on a belt, a lift over lava and switch blocks up from
 * it, then a drop to the lower works: springs under crushers over spikes,
 * barrels across a switch-block bridge, and a press line on a belt that rushes
 * you along. Then the GATEKEEPER.
 *
 * Layout:  row 0:  A B C D E
 *          row 1:  . . . . F G H J | X Y
 */
export const FORTRESS_1: StageData = {
  id: 'fortress1',
  name: 'FORTRESS GATE',
  tagline: 'NO TURNING BACK',
  theme: 'fortress',
  boss: 'gatekeeper',
  bossName: 'GATEKEEPER',
  layout: ['ABCDE', '....FGHJ|XY'],
  screens: {
    A: [CEIL, CEIL, ...rows(SKY, 10), '..P.......w.....', FLOOR, FLOOR],
    // Presses slam onto switch blocks over spikes.
    B: [CEIL, CEIL, '....!.....!.....', ...rows(SKY, 9), SKY, '####[[[[]]]]####', '####^^^^^^^^####'],
    // Barrels roll at you under the presses, on a belt dragging you back.
    C: [CEIL, CEIL, '..!.....!.......', ...rows(SKY, 9), '.c............@.', '<<<<<<<<<<<<<<<<', FLOOR],
    // A lift over lava, then switch blocks up to the ledge.
    D: [
      CEIL,
      CEIL,
      ...rows(SKY, 6),
      '..............##',
      '...........]]]##',
      '..............##',
      '........[[[...##',
      '..............##',
      '##=-----......##',
      '##LLLLLLLLLLLL##',
    ],
    // Drop down the hole.
    E: [CEIL, CEIL, ...rows('...............#', 5), '..........t....#', '##...###########', ...rows('##...###########', 6)],
    // Springs between spikes, presses slamming onto them.
    F: ['##...###########', '##...###########', '#......!...!....', ...rows('#...............', 9), '#.c....%...%...%', '#####^^#^^^#^^^#', FLOOR],
    // Barrels roll across a switch-block bridge.
    G: [CEIL, CEIL, ...rows(SKY, 9), '..............@.', '............####', '###[[[]]][[[####', '###^^^^^^^^^####'],
    // A press line on a belt that rushes you along.
    H: [CEIL, CEIL, '..!...!...!.....', ...rows(SKY, 9), SKY, '>>>>>>>>>>>>>>>>', FLOOR],
    J: [CEIL, CEIL, ...rows('...............#', 8), '...............D', '...............D', '...B...........D', FLOOR, FLOOR],
    X: guardRoom.left,
    Y: guardRoom.right,
  },
};

/**
 * Fortress 2: DEPTHS. An elemental remix: snowballs across ice, cracking ice
 * that drops you into a flooded vault, currents in the dark (one with you,
 * one against), a bubble column under a backward current, cracking ice over
 * lava, then a climb with lava rising after you: a spring, cracking ice,
 * switch blocks, a ladder, a lift. Then the ABYSS EYE.
 *
 * Layout:  row 0:  A B . . . H I J | X Y
 *          row 1:  . C D E F G
 */
export const FORTRESS_2: StageData = {
  id: 'fortress2',
  name: 'FORTRESS DEPTHS',
  tagline: 'THE DEPTHS RISE',
  theme: 'fortress',
  boss: 'abyss',
  bossName: 'ABYSS EYE',
  layout: ['AB...HIJ|XY', '.CDEFG'],
  dark: 'DE',
  rise: { screens: 'GH', speed: 0.35 },
  screens: {
    A: [CEIL, CEIL, ...rows(SKY, 10), '..P...........@.', 'IIIIIIIIIIIIIIII', FLOOR],
    // Cracking ice: it drops you into the flooded vault below.
    B: [CEIL, CEIL, ...rows(SKY, 10), '.c..............', 'IIIxxxxxxxxxIIII', '###.........####'],
    C: water([
      '###.........####',
      ...rows('#...............', 5),
      '#...}}}}}}}}}}}}',
      '#...}}}}}}}}}}}}',
      ...rows('#...............', 3),
      '#........u......',
      '#...............',
      '####^^^^^^^^####',
      FLOOR,
    ]),
    // In the dark: a current pushing back. Swim under it.
    D: water([CEIL, CEIL, SKY, SKY, '{{{{{{{{{{{{{{{{', '{{{{{{{{{{{{{{{{', '{{{{{{{{{{{{{{{{', SKY, '......u.........', SKY, '...###....###...', SKY, SKY, '###^^^###^^^####', FLOOR]),
    // Still dark: a bubble column up into a current pushing you off the wall.
    E: water([CEIL, CEIL, SKY, '{{{{{{{{{{......', '..........###...', ...rows('.......yyy###...', 8), FLOOR, FLOOR]),
    // Out of the water: cracking ice over lava.
    F: [CEIL, CEIL, ...rows(SKY, 9), '.c..........m...', SKY, '####xxx..xxx####', '####LLLLLLLL####'],
    // The lava starts rising: spring, cracking ice, switch blocks, ladder.
    G: [
      '###########H####',
      '#..........H...#',
      '#..........H...#',
      '#.........]]]..#',
      '#..............#',
      '#....[[[.......#',
      '#..............#',
      '####...........#',
      '#..............#',
      '#...xxxx.......#',
      '...............#',
      '.........%.....#',
      '.........#.....#',
      FLOOR,
      FLOOR,
    ],
    // Keep climbing: spring, cracking ice, a lift, and out the top right.
    H: [
      CEIL,
      '#...............',
      '#...............',
      '#............c..',
      '#..........#####',
      '#..............#',
      '#......=----...#',
      '#..............#',
      '#..xxx.........#',
      ...rows('#..............#', 3),
      '#......%.......#',
      '###########H####',
      '###########H####',
    ],
    // Snowballs across cracking bridges over lava, then down to the door.
    I: [CEIL, CEIL, SKY, '..............@.', '###xxx.xxx.xxx##', ...rows(SKY, 9), 'LLLLLLLLLLLLLLLL'],
    J: [CEIL, CEIL, ...rows('...............#', 8), '...............D', '...............D', '...B...........D', FLOOR, FLOOR],
    X: guardRoom.left,
    Y: guardRoom.right,
  },
};

/**
 * Fortress 3: SPIRE. A sky remix up the tower: a lift under a press over
 * spikes, switch blocks in the wind, then the climb: an updraft, a moving
 * platform, a spring up through a gap, a lift over spikes in the wind, an
 * updraft to the roof. On the roof: cracking tiles and a lift in the wind,
 * then springs under presses. Then the SPIRE WARDEN.
 *
 * Layout:  row 0:  . . . J K L M | X Y
 *          row 1:  . . G H
 *          row 2:  . . E F
 *          row 3:  A B C D
 */
export const FORTRESS_3: StageData = {
  id: 'fortress3',
  name: 'FORTRESS SPIRE',
  tagline: 'TO THE TOP',
  theme: 'fortress',
  boss: 'warden',
  bossName: 'SPIRE WARDEN',
  layout: ['...JKLM|XY', '..GH', '..EF', 'ABCD'],
  wind: { screens: 'CGHJKL', dirs: [1, -1] },
  screens: {
    A: [CEIL, CEIL, ...rows(SKY, 10), '..P.............', FLOOR, FLOOR],
    // Ride the lift under a press, over spikes.
    B: [CEIL, CEIL, '.......!........', ...rows(SKY, 9), SKY, '##=------..xxx##', '##^^^^^^^^^^^^##'],
    // Switch blocks over spikes, in the wind.
    C: [CEIL, CEIL, ...rows(SKY, 10), '.c..............', '###[[[]]][[[####', '###^^^^^^^^^####'],
    // An updraft up through the ceiling.
    D: ['##########yyy###', '##########yyy###', ...rows('..........yyy..#', 11), FLOOR, FLOOR],
    // Off the moving platform onto the ledge, then the spring up through the gap
    // (fall off the ledge and the floor spring bounces you back up).
    E: [
      '###...##########',
      ...rows('#...............', 4),
      '#...%.....=-----',
      '#########.......',
      ...rows('#...............', 5),
      '#.........%.....',
      FLOOR,
      FLOOR,
    ],
    F: [CEIL, '...............#', '...............#', '...............#', '...........z...#', '------####yyy..#', ...rows('..........yyy..#', 7), '##########yyy###', '##########yyy###'],
    // Windy: across to a lift over spikes, then the updraft to the roof.
    G: [CEIL, ...rows(SKY, 9), '.........b......', SKY, SKY, '###...####..xxx.', '###...####^^^^^^'],
    H: ['############yyy#', ...rows('............yyy#', 12), '=-------.#######', '^^^^^^^^^#######'],
    // The roof, in the wind.
    J: [SKY, SKY, '.....b..........', ...rows(SKY, 6), '............yyy#', ...rows('............yyy#', 4), '############yyy#'],
    K: [SKY, SKY, SKY, '......z.........', ...rows(SKY, 5), '##..xxx...=----.', ...rows(SKY, 5)],
    // Springs under presses.
    L: [CEIL, '..!.......!.....', ...rows(SKY, 7), '..%...%...%...##', ...rows('..#...#...#...##', 5)],
    M: [...rows('...............#', 10), '...............D', '...............D', '...B...........D', FLOOR, FLOOR],
    X: guardRoom.left,
    Y: guardRoom.right,
  },
};

const finalRoom = bossRoom();

/** The final stage: a short walk to the last door. */
export const FINALE: StageData = {
  id: 'finale',
  name: 'THRONE',
  tagline: 'THE LAST DOOR',
  theme: 'fortress',
  boss: 'overlord',
  bossName: 'OVERLORD',
  layout: ['AB|XY'],
  screens: {
    A: [...rows(CEIL, 6), ...rows(SKY, 6), '..P.............', FLOOR, FLOOR],
    B: [...rows(CEIL, 6), ...rows('...............#', 4), '...............D', '...............D', '...B...........D', FLOOR, FLOOR],
    X: finalRoom.left,
    Y: finalRoom.right,
  },
};

const rematchRoom = bossRoom();

/**
 * BOSS HALL: before the throne, eight teleporter capsules ('T'), one per
 * stage boss. Press UP in a capsule to refight that boss; the exit capsule
 * opens once all eight are beaten. Bosses are fought in the room below.
 */
export const GAUNTLET: StageData = {
  id: 'gauntlet',
  name: 'BOSS HALL',
  tagline: 'ALL EIGHT, ONE MORE TIME',
  theme: 'fortress',
  layout: ['AB', 'XY'],
  screens: {
    A: [CEIL, CEIL, ...rows(SKY, 10), '.P...T..T..T..T.', FLOOR, FLOOR],
    B: [CEIL, CEIL, ...rows(SKY, 10), '.T..T..T..T...*.', FLOOR, FLOOR],
    X: rematchRoom.left,
    Y: rematchRoom.right,
  },
};
