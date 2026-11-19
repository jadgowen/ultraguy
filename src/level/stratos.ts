import type { StageData } from './Level';
import { bossArena, bossHall, miniHall, rows, SKY } from './rooms';

/** The quiet hallway before the boss room (see bossHall). */
const lobby = bossHall();

// STRATOS (sky). Built around moving air:
//  1. Low altitude (A-F): ride moving clouds, then learn the gusts. The WIND
//     warning blinks before each gust; headwinds stop a jump short, tailwinds
//     carry you past a small cloud.
//  2. The climb (W, G-H, I-J): updrafts lift you up through the stage (you can
//     jump again while inside one), across crumbling clouds and a moving cloud.
//  3. High altitude (K-N): gusts again, now over crumbling clouds and movers.
//  4. The STORM KITE, out over open sky (1-3): a ledge each side, a gap
//     between, moving clouds and crumbling ones to fight from, and the gusts
//     still blowing. Then GALE.
//
// Layout (each letter one screen; you climb from W up to K):
//   row 0:  . . . . . . K L M N 1 2 3 O | X Y
//   row 1:  . . . . . . I J
//   row 2:  . . . . . . G H
//   row 3:  A B C D E F W

// GALE's sky deck: an updraft up the middle carries you to his height (you
// can jump again inside it), and a cloud either side.
const room = bossArena('#', {
  4: '..............yy',
  5: '..............yy',
  6: '..............yy',
  7: '..............yy',
  8: '..............yy',
  9: '..............yy',
  10: '....CCC.......yy',
  11: '..............yy',
  12: '..............yy',
}, {
  4: 'y..............#',
  5: 'y..............#',
  6: 'y..............#',
  7: 'y..............#',
  8: 'y..............#',
  9: 'y..............#',
  10: 'y.........CCC..#',
  11: 'y..............#',
  12: 'y.......X......#',
});
const hall = miniHall('#', false, true);

export const STRATOS: StageData = {
  id: 'stratos',
  name: 'STRATOS',
  tagline: "RIDE THE WIND",
  theme: 'sky',
  boss: 'gale',
  bossName: 'GALE',
  bossWeapon: 'cyclone',
  signature: [{ kind: 'gustFan', from: 'bomber', every: 2 }, { kind: 'gustFan', from: 'flyer', every: 3 }],
  layout: ['......KLMN12378O|56|XY', '......IJ', '......GH', 'ABCDEFW'],
  miniboss: 'kite',
  upgrade: 'armor',
  wind: { screens: 'DEFLMN23', dirs: [-1, 1] },
  screens: {
    // --- 1. Low altitude --------------------------------------------------------
    // A moving cloud ferries you over the first drop.
    A: [...rows(SKY, 12), '..P.............', '##########=-----', '##########......'],
    B: [SKY, SKY, SKY, '...........b....', ...rows(SKY, 8), SKY, '----############', '....############'],
    // A lift up to the high ledge: the wall is too tall to jump.
    C: [
      ...rows(SKY, 6),
      '......v..#######',
      ...rows('......:..#######', 5),
      '..w...:..#######',
      '################',
      '################',
    ],
    // First gusts, on solid ground: wait out a headwind before the gap.
    D: [SKY, SKY, SKY, '.....f..........', SKY, '..c.............', '#######...######', '#######...######', '#######...######', ...rows(SKY, 6)],
    // Small clouds in the wind: a tailwind can carry you right past one.
    E: [...rows(SKY, 5), '.........z......', '###.............', '###.............', '###...CCC.......', '............CCC.', ...rows(SKY, 5)],
    // A moving cloud while the wind blows.
    F: [...rows(SKY, 4), '.......f........', ...rows(SKY, 4), '.=------...#####', '...........#####', '...........#####', ...rows(SKY, 3)],

    // --- 2. The climb -------------------------------------------------------------
    // First updraft, over safe ground: it carries you up off the screen.
    W: [
      ...rows('..........yyy..#', 8),
      '..c.......yyy..#',
      '#########.yyy..#',
      '#########.yyy..#',
      '..........yyy..#',
      '..........yyy..#',
      '.........#######',
      '.........#######',
    ],
    // The updraft tops out beside a ledge: jump from inside it to reach the ledge.
    G: [...rows(SKY, 7), '..........yyy###', '..........yyy###', ...rows('..........yyy...', 6)],
    // Crumbling clouds to the next updraft (no floor below).
    H: [
      ...rows('.............yyy', 4),
      '......f......yyy',
      '.............yyy',
      '.............yyy',
      '##..xxx...xxxyyy',
      '##...........yyy',
      ...rows('.............yyy', 6),
    ],
    // Off the updraft to the left, onto a moving cloud.
    J: [SKY, SKY, '....b...........', SKY, SKY, '.=-----.#####yyy', '........#####yyy', ...rows('.............yyy', 8)],
    // Drop off the ledge into the last updraft (miss it and you fall back down).
    I: [
      '..yyy...........',
      '..yyy...........',
      '..yyy......z....',
      '..yyy...........',
      '..yyy...........',
      '..yyy....#######',
      '..yyy....#######',
      ...rows('..yyy...........', 4),
      '#######.........',
      '#######.........',
      SKY,
      SKY,
    ],

    // --- 3. High altitude ------------------------------------------------------------
    K: [SKY, SKY, '.........b......', ...rows(SKY, 4), '........c.......', '..yyy###########', '..yyy###########', ...rows('..yyy...........', 5)],
    // Gusts over crumbling clouds.
    L: [...rows(SKY, 5), '..........z.....', SKY, '............xxx.', '####..xxx.......', '####............', ...rows(SKY, 5)],
    // Gusts on a moving cloud.
    M: [SKY, SKY, SKY, '.....b..........', SKY, SKY, SKY, '=-----..........', '.........#######', '.........#######', ...rows(SKY, 5)],
    // The Armor sits on a cloud too high for a single jump. Then down to the hall.
    N: [
      SKY,
      SKY,
      SKY,
      '...U............',
      '..CCC...........',
      SKY,
      SKY,
      SKY,
      '#######.........',
      '#######.........',
      '.........CCC....',
      '.............###',
      '.............###',
      SKY,
      SKY,
    ],
    '1': hall.a,
    // The Kite's sky: a short ledge, then open air with clouds to stand on.
    '2': [
      ...rows(SKY, 9),
      '.......xxx......',
      SKY,
      '...=-------.....',
      SKY,
      '#####........=--',
      '#####...........',
    ],
    // ...and the far ledge (the Kite hovers over the gap).
    '3': [...rows(SKY, 10), '...xxx..........', SKY, '.........M......', '----..##########', '......##########'],
    O: [...rows('...............#', 10), '...............D', '...............D', '..c............D', '################', '################'],
    // --- Extra stretch before the boss door: more of the stage's enemies, a bolt cache ---
    '7': ['................', '................', '................', '...b............', '................', '.........z......', '................', '................', '................', '................', '................', '.....CCC........', '................', '#####....#######', '#####....#######'],
    '8': ['................', '................', '................', '....b...........', '................', '................', '............f...', '................', '................', '.......$........', '......CCC.......', '................', '................', '################', '################'],
    '5': lobby.left,
    '6': lobby.right,
    X: room.left,
    Y: room.right,
  },
};
