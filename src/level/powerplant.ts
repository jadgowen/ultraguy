import type { StageData } from './Level';
import { SKY, bossRoom, rows } from './rooms';

// POWER PLANT. Electric barriers ('Z') switch on and off every ~1.7 seconds:
// wait for them to go dark, then run through. Tesla-coil zappers throw arcs
// along the floor and steel rollers come barreling at you.
//
// Layout:  row 0:  A B C D E . . . K L M N | X Y
//          row 1:  . . . . F G H I J
// Run right, ladder down at E, run the lower floor, ladder up at J, finish at N.

const CEIL = '################';
const room = bossRoom();

export const POWERPLANT: StageData = {
  id: 'powerplant',
  name: 'POWER PLANT',
  theme: 'power',
  boss: 'volt',
  bossName: 'VOLT',
  bossWeapon: 'spark',
  layout: ['ABCDE...KLMN|XY', '....FGHIJ'],
  screens: {
    A: [CEIL, CEIL, ...rows(SKY, 8), '..........###...', SKY, '..P.........o...', CEIL, CEIL],
    // First barrier: wait for it to switch off.
    B: [CEIL, CEIL, ...rows(SKY, 7), '........###.....', '.........Z......', '.........Z......', '...k.....Z......', CEIL, CEIL],
    C: [CEIL, CEIL, ...rows(SKY, 6), '..........f.....', SKY, SKY, '.....###........', '..c.............', '#######...######', '#######...######'],
    // Two barriers switch together: cross one, wait between them.
    D: [CEIL, CEIL, ...rows(SKY, 7), '....###....###..', '.....Z......Z...', '.....Z......Z...', '.....Z...t..Z...', CEIL, CEIL],
    E: [CEIL, CEIL, ...rows('...............#', 10), '...o...........#', '############H###', '############H###'],
    F: ['############H###', ...rows('#...........H..#', 9), '#...........H...', '#..........cH...', '#...........H...', CEIL, CEIL],
    G: [...rows(CEIL, 6), ...rows(SKY, 5), '.........##.....', '...o.....##.....', CEIL, CEIL],
    H: [...rows(CEIL, 6), SKY, SKY, SKY, '.....###........', '......Z.........', '......Z.........', '......Z...k.....', '#############^^#', CEIL],
    I: [...rows(CEIL, 6), SKY, '..........f.....', SKY, '......t.........', '....####........', SKY, SKY, CEIL, CEIL],
    J: [...rows('##########H#####', 6), ...rows('..........H....#', 7), CEIL, CEIL],
    K: [CEIL, CEIL, ...rows('#...............', 10), '#...c...........', '##########H#####', '##########H#####'],
    // Barrier gauntlet with a roller between the posts.
    L: [CEIL, CEIL, ...rows(SKY, 7), '..###....###....', '...Z......Z.....', '...Z......Z.....', '...Z...o..Z.....', CEIL, CEIL],
    M: [CEIL, CEIL, ...rows(SKY, 7), '..........k.....', '.........###....', SKY, '....##..........', '#######^^#######', CEIL],
    N: [CEIL, CEIL, ...rows('...............#', 8), '...............D', '...............D', '...B...........D', CEIL, CEIL],
    X: room.left,
    Y: room.right,
  },
};
