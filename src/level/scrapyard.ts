import type { StageData } from './Level';
import { SKY, bossRoom, rows } from './rooms';

// SCRAPYARD. Conveyor belts ('<' '>') carry you while you stand on them:
// some fight you, some push you toward spikes. Grinders roll along the
// floor and down staircases; junkbots lob scrap.
//
// Layout:  row 0:  . . . . . . H I J K L M N | X Y
//          row 1:  A B C D E F G
// Run the lower yard, ladder up at G, cross the high yard.

const FLOOR = '################';
const room = bossRoom();

export const SCRAPYARD: StageData = {
  id: 'scrapyard',
  name: 'SCRAPYARD',
  theme: 'scrap',
  boss: 'scrap',
  bossName: 'SCRAP',
  bossWeapon: 'saw',
  layout: ['......HIJKLMN|XY', 'ABCDEFG'],
  screens: {
    A: [...rows(SKY, 10), '..........###...', SKY, '..P.........j...', FLOOR, FLOOR],
    // Belt pushing against you.
    B: [...rows(SKY, 12), '..........g.....', '####<<<<<<<<####', FLOOR],
    // Conveyor island over two pits.
    C: [...rows(SKY, 12), '..c.............', '#####..>>>..####', '#####......#####'],
    // Junk staircase; a grinder rolls down it.
    D: [...rows(SKY, 9), '............g...', '..........####..', '.......#######..', '....##########..', FLOOR, FLOOR],
    E: [...rows(SKY, 9), '..........j.....', '.........####...', SKY, SKY, '<<<<<<<<<<<<<<<<', FLOOR],
    // This belt carries you into spikes: jump them.
    F: [...rows(SKY, 12), '..........g.....', '##>>>>>^^#######', FLOOR],
    G: [...rows('##########H#####', 6), ...rows('..........H....#', 7), FLOOR, FLOOR],
    H: [...rows('#...............', 12), '#...c...........', '##########H#####', '##########H#####'],
    I: [...rows(SKY, 12), '....j...........', '#######..<<<..##', '#######.......##'],
    J: [...rows(SKY, 9), '.........g......', '........#####...', SKY, '..g.............', FLOOR, FLOOR],
    K: [...rows(SKY, 7), '..........f.....', ...rows(SKY, 4), '...c............', '>>>>>>>>>>>>>>>>', FLOOR],
    L: [...rows(SKY, 9), '.........g......', '.......####.....', '....#######.....', '.##########.....', FLOOR, FLOOR],
    M: [...rows(SKY, 12), '.......j........', '###<<<<^^<<<####', FLOOR],
    N: [...rows('...............#', 10), '...............D', '...............D', '...B...........D', FLOOR, FLOOR],
    X: room.left,
    Y: room.right,
  },
};
