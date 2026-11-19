import type { StageData } from './Level';
import { bossArena, bossHall, rows, SECRET_ROOM, SKY } from './rooms';

/** The quiet hallway before the boss room (see bossHall). */
const lobby = bossHall();

// CANOPY (jungle). Built around bounce flowers ('%'): land on one and it
// throws you high (higher if you hold jump).
//  1. The forest floor: a flower up a wall too tall to jump (A), breaking
//     branches over thorns (B), then a chain of flowers over thorns (C).
//  2. Up the tree: a flower through a gap in the canopy (D: hold jump), then a
//     climb from flower to flower inside the trunk (E).
//  3. The treetops: breaking branches, a drifting log and one last flower
//     over a long drop (F-H).
//  4. THE GREAT CLIMB (instead of a miniboss): drop down a hollow (J, K) to a
//     landing with a hidden crawlspace (N), then climb the inside of the great
//     tree (L, M, T) on flowers, branches and vines while brambles grow up after
//     you. Out at the top, and on to MANTIS.
// The Jump Boots are behind D's fake right wall (into the secret room S).
//
// Layout:  row 0:  . . . F G H J T I | X Y
//          row 1:  . . . E . . K M
//          row 2:  A B C D S . N L

const LEAVES = '################';
const FLOOR = '################';
// MANTIS in the treetops: a bounce flower at each end throws you up to the
// branches (and a breaking one near the top), out of reach of his leaps.
const room = bossArena('#', {
  7: '.........CCC....',
  13: '#####%##########',
}, {
  4: '.......xxx.....#',
  7: '...CCC.........#',
  13: '##########%####' + '#',
});
const CEIL = '################';

export const CANOPY: StageData = {
  id: 'canopy',
  name: 'CANOPY',
  tagline: "BOUNCE HIGH",
  theme: 'jungle',
  boss: 'mantis',
  bossName: 'MANTIS',
  bossWeapon: 'thorn',
  signature: [{ kind: 'snapper', from: 'spitter', every: 2 }, { kind: 'snapper', from: 'lurker', every: 1 }],
  layout: ['...FGHJT78I|56|XY', '...E..KM', 'ABCDS.NL'],
  rise: { screens: 'LMT', speed: 0.3 },
  upgrade: 'boots',
  decor: [
    // A hint by the flower that needs a high bounce.
    { x: 3 * 256 + 96, y: 2 * 240 + 40, text: 'HOLD JUMP', color: '#ffe14a', size: 8, depth: 1 },
  ],
  screens: {
    // --- 1. Forest floor ----------------------------------------------------------
    // The wall is too tall to jump: bounce off the flower.
    A: [LEAVES, '######...#######', ...rows(SKY, 6), ...rows('.............###', 4), '..P.......%..###', FLOOR, FLOOR],
    // Thin branches crack under you, over thorns.
    B: [LEAVES, '#####....#######', ...rows(SKY, 5), '.c..............', '###..xxx..xxx.##', ...rows('###...........##', 4), '###^^^^^^^^^^^##', FLOOR],
    // Flower to flower over the thorns.
    C: [
      LEAVES,
      '###....#########',
      ...rows(SKY, 4),
      '..........s.....',
      SKY,
      '##..............',
      '##..%...%...%...',
      ...rows('##..#...#...#...', 3),
      '##^^#^^^#^^^#^^^',
      FLOOR,
    ],
    // Up through the canopy gap: hold jump on the flower. The bottom of the
    // right wall is fake: the Jump Boots.
    D: [
      '######...#######',
      '######...#######',
      ...rows('...............#', 3),
      '.......%.......#',
      '#########......#',
      '#########......#',
      ...rows('...............#', 3),
      '..........l....F',
      '............%..F',
      FLOOR,
      FLOOR,
    ],
    S: SECRET_ROOM,

    // --- 2. Inside the trunk ------------------------------------------------------------
    E: [
      '#...############',
      '#..............#',
      '#..............#',
      '#.%............#',
      '#######........#',
      ...rows('#..............#', 2),
      '#.......%......#',
      '#.......####...#',
      '#..............#',
      '#....f.........#',
      '#..............#',
      '#............%.#',
      '######...#######',
      '######...#######',
    ],

    // --- 3. The treetops --------------------------------------------------------------
    F: [...rows(SKY, 8), '...........s....', '..........####..', SKY, SKY, '.....c..........', '#...####xxx..###', '#...####.....###'],
    // A log drifts over the drop.
    G: [...rows(SKY, 5), '.....f..........', ...rows(SKY, 7), '##.=-------..###', '##...........###'],
    // Bounce up to a branch, then down to the hall.
    H: [...rows(SKY, 7), '........xxx.....', SKY, SKY, SKY, '.....%.......###', '.....#.......###', '###..#.......###', '###..#.......###'],

    // --- 4. The great climb ---------------------------------------------------------------
    // Down the hollow to the landing.
    J: [LEAVES, LEAVES, ...rows('...............#', 9), ...rows('####......######', 4)],
    K: rows('####......######', 15),
    // The landing: checkpoint, and the crawlspace (slide in) with the E-tank and bolts.
    N: [...rows('####......######', 9), '#...............', '#...............', '..#########.....', '......E.$...c...', FLOOR, FLOOR],
    // Inside the trunk, bottom: a flower (hold jump) up to a branch, then the vine.
    L: [
      ...rows('###.........H###', 3),
      '###..s......H###',
      '###.CCC.....H###',
      ...rows('###.........H###', 2),
      '###.....CCCCC###',
      ...rows('###..........###', 2),
      ...rows('.............###', 3),
      '#####%##########',
      FLOOR,
    ],
    // Middle: off the vine onto breaking branches, a flower, then a branch to the next vine.
    M: [
      ...rows('###.....H....###', 3),
      '###.CCCCH....###',
      ...rows('###..........###', 2),
      '###.......f..###',
      '###..........###',
      SKY.replace(/^.../, '###').replace(/...$/, '###'),
      '###%%.CCxx...###',
      '###..........###',
      ...rows('###.........H###', 4),
    ],
    // Top: up the last vine and out to the right (the brambles stop below the exit).
    T: [
      CEIL,
      CEIL,
      ...rows('###.............', 2),
      '###.........c...',
      '###.....H#######',
      '###.....H#######',
      ...rows('###.....H....###', 2),
      '###.....H....###',
      '###.CCC.H....###',
      ...rows('###.....H....###', 4),
    ],
    I: [...rows('...............#', 10), '...............D', '..........##...D', '...c......##s..D', FLOOR, FLOOR],
    // --- Extra stretch before the boss door: more of the stage's enemies, a bolt cache ---
    '7': ['................', '................', '................', '................', '................', '........f.......', '................', '................', '................', '................', '................', '.....CCCCC......', '..s.........l...', '#####^^^^^######', '################'],
    '8': ['................', '................', '................', '................', '................', '................', '..........$.....', '.........CCCC...', '................', '................', '................', '................', '...........l....', '####%###########', '################'],
    '5': lobby.left,
    '6': lobby.right,
    X: room.left,
    Y: room.right,
  },
};
