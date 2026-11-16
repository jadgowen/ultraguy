import type { StageData } from './Level';
import { bossRoom, miniHall, rows, SKY } from './rooms';

// CALDERA. Built around lava: lifts over it, rock that crumbles into it, and
// a climb with the lava rising behind you.
//  1. Across the lava: a lift (A), crumbling rocks with embers leaping
//     between them (B), then a breather with a magma slug (C).
//  2. The rising lava: as soon as you enter the shaft (D), lava starts to
//     climb after you. Up the ledges and crumbling rocks, a ladder, more
//     ledges, a lift, and out the top (E). Don't stop.
//  3. The rim: a lift and crumbling rocks over lava pits (F, G), then the
//     hall and MAGMA.
//
// Layout:  row 0:  . . . F G H 1 2 I | X Y
//          row 1:  . . . E
//          row 2:  A B C D

const CEIL = '################';
const FLOOR = '################';
const room = bossRoom();
const hall = miniHall('#');

export const CALDERA: StageData = {
  id: 'caldera',
  name: 'CALDERA',
  tagline: "DON'T STOP CLIMBING",
  theme: 'volcano',
  boss: 'magma',
  bossName: 'MAGMA',
  bossWeapon: 'flame',
  layout: ['...FGH12I|XY', '...E', 'ABCD'],
  miniboss: 'crab',
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
    '1': hall.a,
    '2': hall.b,
    I: [CEIL, CEIL, ...rows('...............#', 8), '...............D', '...............D', '...B...........D', FLOOR, FLOOR],
    X: room.left,
    Y: room.right,
  },
};
