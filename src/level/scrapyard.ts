import type { StageData } from './Level';
import { SKY, bossArena, bossHall, challengeRoom, miniHall, rows } from './rooms';

/** The quiet hallway before the boss room (see bossHall). */
const lobby = bossHall();
/** Where the stage's boss challenges you to their own game (see challengeRoom). */
const duel = challengeRoom();

// SCRAPYARD. Built around the machinery: barrel chutes ('@') that keep sending
// barrels rolling at you, compactor presses ('!'), crane platforms ('=' and
// 'v') and conveyor belts.
//  1. The lower yard: barrels across open ground (A), a crane over a junk pit
//     (B), presses over a belt dragging you back (C), then a belt staircase
//     with barrels bouncing down it (D).
//  2. A long crane ride over the pit (E), presses with barrels under them (F),
//     then a crane lift up to the ladder (G).
//  3. The high yard: a press line over a belt that hurries you along, with
//     barrels coming the other way (I), and one last crane (J).
//  4. THE COMPACTOR (instead of a miniboss): past the crawlspace (1), a wall
//     of grinding steel comes in from the left and keeps coming (2-4). Run:
//     slide under the low pipes, jump the junk, the barrels and the pit. It
//     stops when it hits the end of the yard. Then SCRAP.
//
// Layout:  row 0:  . . . . . . H I J 1 2 3 4 K | X Y
//          row 1:  A B C D E F G

const FLOOR = '################';
const GIRDER = '################';
// SCRAP's junk heap: two humps of junk stop his rolling saws (hide behind
// one), and a crane platform rides back and forth overhead.
const room = bossArena('#', {
  10: '......=---------',
  12: '.........#......',
}, {
  10: '-------........#',
  12: '....#...X......#',
});
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
  layout: ['......HIJ12349078K|56|XY', 'ABCDEFG'],
  compactor: { screens: '234', speed: 0.7 },
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
    // Junk to jump, then a low pipe: slide under it.
    '2': [GIRDER, GIRDER, ...rows('.........#####..', 9), '....##...#####..', '....##..........', FLOOR, FLOOR],
    // A belt dragging you back, barrels rolling at you, and a pit.
    '3': [GIRDER, GIRDER, ...rows(SKY, 10), '..............@.', '<<<<<<<<...#####', '########...#####'],
    // One more pipe, and a junkbot. The wall stops at the end of the yard.
    '4': [GIRDER, GIRDER, ...rows('....######......', 10), '..............j.', FLOOR, FLOOR],
    K: [...rows('...............#', 10), '...............D', '...............D', '..c............D', FLOOR, FLOOR],
    // --- Extra stretch before the boss door: more of the stage's enemies, a bolt cache ---
    // --- The boss's challenge: their own game, before the last stretch ---
    '9': duel.a,
    '0': duel.b,
    '7': ['################', '################', '..!.....!.......', '................', '................', '................', '................', '................', '................', '................', '................', '................', '....g.......j...', '>>>>>>>>>>>>>>>>', '################'],
    '8': ['################', '################', '................', '................', '................', '........f.......', '................', '................', '................', '................', '......$.........', '.....###........', '..............@.', '################', '################'],
    '5': lobby.left,
    '6': lobby.right,
    X: room.left,
    Y: room.right,
  },
};
