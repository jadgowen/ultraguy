import type { StageData } from './Level';
import { bossRoom, miniHall, rows, SKY } from './rooms';

// SCRAPYARD. Built around the machinery: barrel chutes ('@') that keep sending
// barrels rolling at you, compactor presses ('!'), crane platforms ('=' and
// 'v') and conveyor belts.
//  1. The lower yard: barrels across open ground (A), a crane over a junk pit
//     (B), presses over a belt dragging you back (C), then a belt staircase
//     with barrels bouncing down it (D).
//  2. A long crane ride over the pit (E), presses with barrels under them (F),
//     then a crane lift up to the ladder (G).
//  3. The high yard: a press line over a belt that hurries you along, with
//     barrels coming the other way (I), and one last crane (J). Then the hall
//     and SCRAP.
//
// Layout:  row 0:  . . . . . . H I J 1 2 K | X Y
//          row 1:  A B C D E F G

const FLOOR = '################';
const GIRDER = '################';
const room = bossRoom();
const hall = miniHall('#', false, true);

export const SCRAPYARD: StageData = {
  id: 'scrapyard',
  name: 'SCRAPYARD',
  tagline: "EVERYTHING MOVES",
  theme: 'scrap',
  boss: 'scrap',
  bossName: 'SCRAP',
  bossWeapon: 'saw',
  signature: [{ kind: 'magnetDrone', from: 'flyer', every: 1 }, { kind: 'magnetDrone', from: 'junkbot', every: 2 }],
  layout: ['......HIJ12K|XY', 'ABCDEFG'],
  miniboss: 'crusher',
  screens: {
    // --- 1. The lower yard ------------------------------------------------------------
    A: [...rows(SKY, 12), '..P...........@.', FLOOR, FLOOR],
    B: [...rows(SKY, 8), '...........j....', '..........###...', SKY, SKY, SKY, '###=-------...##', '###^^^^^^^^^^^##'],
    C: [SKY, GIRDER, '..!....!....!...', ...rows(SKY, 9), '..c.............', '<<<<<<<<<<<<<<<<', FLOOR],
    // Belt stairs pull you down while barrels bounce down them.
    D: [...rows(SKY, 8), '..............@.', '............<<<<', '.........<<<####', '......<<<#######', '...<<<##########', '<<<#############', FLOOR],

    // --- 2. Cranes and presses ------------------------------------------------------------
    E: [...rows(SKY, 6), '......f.........', SKY, SKY, '##=--------...##', ...rows('.............###', 5)],
    F: [SKY, GIRDER, '..!....!........', ...rows(SKY, 5), '.c...........@..', FLOOR, FLOOR, FLOOR, FLOOR, FLOOR, FLOOR],
    // Ride the crane lift up to the ladder.
    G: [
      '############H###',
      '#...........H..#',
      '#...........H..#',
      '#......v...###.#',
      ...rows('#......:.......#', 3),
      '.......:.......#',
      '.......:.......#',
      FLOOR,
      FLOOR,
      FLOOR,
      FLOOR,
      FLOOR,
      FLOOR,
    ],

    // --- 3. The high yard ---------------------------------------------------------------
    H: [GIRDER, GIRDER, ...rows(SKY, 10), '..........c.....', '############H###', '############H###'],
    // Presses over a belt that hurries you on, barrels rolling the other way.
    I: [GIRDER, GIRDER, '.!...!...!...!..', ...rows(SKY, 9), '..............@.', '>>>>>>>>>>>>>>>>', FLOOR],
    J: [GIRDER, GIRDER, ...rows(SKY, 8), '.....j..........', '............####', '............####', '####=-----..####', '####^^^^^^^^####'],
    '1': hall.a,
    '2': hall.b,
    K: [...rows('...............#', 10), '...............D', '...............D', '..B............D', FLOOR, FLOOR],
    X: room.left,
    Y: room.right,
  },
};
