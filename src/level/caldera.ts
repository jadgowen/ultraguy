import type { StageData } from './Level';
import { SKY, bossArena, bossHall, challengeRoom, rows } from './rooms';

/** The quiet hallway before the boss room (see bossHall). */
const lobby = bossHall();
/** Where the stage's boss challenges you to their own game (see challengeRoom). */
const duel = challengeRoom();

// CALDERA. Built around lava: lifts over it, rock that crumbles into it, and
// a climb with the lava rising behind you.
//  1. Across the lava: a lift (A), crumbling rocks with embers leaping
//     between them (B), then a breather with a magma slug (C).
//  2. The rising lava: as soon as you enter the shaft (D), lava starts to
//     climb after you. Up the ledges and crumbling rocks, a ladder, more
//     ledges, a lift, and out the top (E). Don't stop.
//  3. The rim: a lift and crumbling rocks over lava pits (F, G).
//  4. The magma elevator (no miniboss here): drop down a chute (J, K) to a
//     landing (N: checkpoint, and a crawlspace with the E-tank, a 1-UP and
//     bolts), then ride the lift up the shaft (L, M, T) while magma rises
//     below and the walls spit fire. Off at the top, on to MAGMA.
//
// Layout:  row 0:  . . . F G H J T I | X Y
//          row 1:  . . . E . . K M
//          row 2:  A B C D . . N L

const CEIL = '################';
const FLOOR = '################';
// MAGMA's crucible: every so often the lava surges up over the floor (see
// arenaFx.ts); get up on a basalt ledge until it drains.
const room = bossArena('#', {
  11: '.....CCC........',
}, {
  11: '..CCC....CCC...#',
});

export const CALDERA: StageData = {
  id: 'caldera',
  name: 'CALDERA',
  tagline: "DON'T STOP CLIMBING",
  theme: 'volcano',
  boss: 'magma',
  bossName: 'MAGMA',
  bossWeapon: 'flame',
  signature: [{ kind: 'lavaLeaper', from: 'slug', every: 1 }, { kind: 'lavaLeaper', from: 'ember', every: 3 }],
  layout: ['...FGHJT9078I|56|XY', '...E..KM', 'ABCD..NL'],
  rise: { screens: 'DE', speed: 0.35 },
  screens: {
    // --- 1. Across the lava -------------------------------------------------------------
    A: [CEIL, CEIL, ...rows(SKY, 10), '..P.............', '#######=-----###', '#######LLLLLL###'],
    B: [CEIL, CEIL, ...rows(SKY, 10), '.......e....e...', '###xxx..xxx..###', '###LLLLLLLLLL###'],
    C: [CEIL, CEIL, ...rows(SKY, 8), '.......###......', SKY, '..c........m....', FLOOR, FLOOR],

    // --- 2. The rising lava -------------------------------------------------------------
    D: [
      '###########H####',
      '#..........H...#',
      '#..........H...#',
      '#.........###..#',
      '#..............#',
      '#....xxxx......#',
      '#..............#',
      '####...........#',
      '#..............#',
      '#...xxxx.......#',
      '...............#',
      '.........####..#',
      '...............#',
      FLOOR,
      FLOOR,
    ],
    E: [
      '###H############',
      '#..H...........#',
      '#..H...........#',
      '#.###..........#',
      '#..............#',
      '#.....=-----...#',
      '#..............#',
      '#..........xxx.#',
      '#..............#',
      '#......###.....#',
      '#..............#',
      '#..xxx.........#',
      '#..............#',
      '###########H####',
      '###########H####',
    ],

    // --- 3. The rim -----------------------------------------------------------------------
    F: [CEIL, CEIL, ...rows(SKY, 10), '.c..............', '###H####=-----##', '###H####LLLLLL##'],
    G: [CEIL, CEIL, ...rows(SKY, 9), '.......e........', '......e.....e...', '##xxx..xxx..xxx#', '##LLLLLLLLLLLL##'],
    H: [CEIL, CEIL, ...rows(SKY, 9), '..........######', '....m.....######', FLOOR, FLOOR],
    // --- 4. The magma elevator ---------------------------------------------------------------
    // A hole in the floor down to the landing.
    J: [CEIL, CEIL, ...rows('...............#', 9), ...rows('####......######', 4)],
    K: rows('####......######', 15),
    // The landing: checkpoint, and the crawlspace (slide in) with the E-tank, a 1-UP and bolts.
    N: [...rows('####......######', 9), '#...............', '#...............', '..#########.....', '....+.E.$...c...', FLOOR, FLOOR],
    // The shaft: the lift waits at the bottom (';') and stops at the top (',').
    L: [...rows('###..........###', 10), '.............###', '.............###', '.......;.....###', FLOOR, FLOOR],
    M: rows('###..........###', 15),
    T: [CEIL, CEIL, ...rows('###..........###', 8), '###.............', '###.............', '###....,........', '###.......######', '###.......######'],
    I: [CEIL, CEIL, ...rows('...............#', 8), '...............D', '...............D', '...c...........D', FLOOR, FLOOR],
    // --- Extra stretch before the boss door: more of the stage's enemies, a bolt cache ---
    // --- The boss's challenge: their own game, before the last stretch ---
    '9': duel.a,
    '0': duel.b,
    '7': ['################', '################', '................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '.......e....m...', '######LLL#######', '######LLL#######'],
    '8': ['################', '################', '................', '................', '................', '................', '..........f.....', '................', '................', '................', '....$...........', '...###..........', '.............m..', '################', '################'],
    '5': lobby.left,
    '6': lobby.right,
    X: room.left,
    Y: room.right,
  },
};
