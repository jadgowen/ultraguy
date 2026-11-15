import type { StageData } from './Level';
import { SKY, bossRoom, rows } from './rooms';

// CALDERA. Down into a volcano. Lava ('L') is instant death; embers leap out
// of it on a rhythm, and tough magma slugs crawl the ledges. Two ladders take
// you deeper each time.
//
// Layout:  row 0:  A B C D E
//          row 1:  . . . . F G H I J
//          row 2:  . . . . . . . . K L M N | X Y

const CEIL = '################';
const room = bossRoom();

export const CALDERA: StageData = {
  id: 'caldera',
  name: 'CALDERA',
  theme: 'volcano',
  boss: 'magma',
  bossName: 'MAGMA',
  bossWeapon: 'flame',
  layout: ['ABCDE', '....FGHIJ', '........KLMN|XY'],
  screens: {
    A: [...rows(SKY, 9), '..........##....', SKY, '......##........', '..P..........m..', CEIL, CEIL],
    B: [...rows(SKY, 12), '.......e........', '#####LLL########', CEIL],
    C: [...rows(SKY, 9), '...........f....', '.......##.......', SKY, '..c.............', '#####LL##LL#####', CEIL],
    // Wide pool: use the step and the floating rock.
    D: [...rows(SKY, 8), '............##..', SKY, '........##......', SKY, '....##.e........', '######LLLL######', CEIL],
    E: [...rows('...............#', 12), '......m........#', '############H###', '############H###'],
    F: ['############H###', ...rows('#...........H..#', 9), '#...........H...', '#..........cH...', '#...........H...', CEIL, CEIL],
    G: [...rows(CEIL, 6), ...rows(SKY, 6), '.....e......m...', '####LLL#########', CEIL],
    H: [...rows(CEIL, 6), ...rows(SKY, 4), '..........##....', SKY, '...e.....e......', '##LLL##LLL###LL#', CEIL],
    I: [...rows(CEIL, 6), SKY, '.....f..........', SKY, SKY, '..........###...', SKY, '...m.......m....', CEIL, CEIL],
    J: [...rows(CEIL, 6), ...rows('...............#', 7), '############H###', '############H###'],
    K: ['############H###', ...rows('#...........H..#', 9), '#...........H...', '#..........cH...', '#...........H...', CEIL, CEIL],
    // Lava lake: hop the stone islands while embers jump.
    L: [...rows(CEIL, 6), ...rows(SKY, 6), '...e...e...e....', '##LL##LL##LL####', CEIL],
    M: [...rows(CEIL, 6), SKY, '..........f.....', SKY, '............##..', SKY, '........##......', '...m............', CEIL, CEIL],
    N: [...rows(CEIL, 6), ...rows('...............#', 4), '...............D', '...............D', '...B...........D', CEIL, CEIL],
    X: room.left,
    Y: room.right,
  },
};
