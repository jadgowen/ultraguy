import type { StageData } from './Level';
import { bossRoom, miniHall, rows, SECRET_ROOM, SKY } from './rooms';

// CANOPY (jungle). Built around bounce flowers ('%'): land on one and it
// throws you high (higher if you hold jump).
//  1. The forest floor: a flower up a wall too tall to jump (A), breaking
//     branches over thorns (B), then a chain of flowers over thorns (C).
//  2. Up the tree: a flower through a gap in the canopy (D: hold jump), then a
//     climb from flower to flower inside the trunk (E).
//  3. The treetops: breaking branches, a drifting log and one last flower
//     over a long drop (F-H). Then the miniboss hall and MANTIS.
// The Jump Boots are behind D's fake right wall (into the secret room S).
//
// Layout:  row 0:  . . . F G H 1 2 I | X Y
//          row 1:  . . . E
//          row 2:  A B C D S

const LEAVES = '################';
const FLOOR = '################';
const room = bossRoom();
const hall = miniHall('#');

export const CANOPY: StageData = {
  id: 'canopy',
  name: 'CANOPY',
  tagline: "BOUNCE HIGH",
  theme: 'jungle',
  boss: 'mantis',
  bossName: 'MANTIS',
  bossWeapon: 'thorn',
  layout: ['...FGH12I|XY', '...E', 'ABCDS'],
  miniboss: 'toad',
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
      '#.%............#',
      '#####..........#',
      ...rows('#..............#', 3),
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
    '1': hall.a,
    '2': hall.b,
    I: [...rows('...............#', 10), '...............D', '..........##...D', '...B......##s..D', FLOOR, FLOOR],
    X: room.left,
    Y: room.right,
  },
};
