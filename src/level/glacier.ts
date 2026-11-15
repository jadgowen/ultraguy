import type { StageData } from './Level';
import { bossRoom, miniHall, rows, SECRET_ROOM, SKY } from './rooms';

// GLACIER (ice). Slippery ice floors ('I') keep you sliding after you let go,
// icicles drop when you pass under them, and sliders skate straight at you.
// Climb down into an ice cave lined with spikes.
//
// Layout:  row 0:  A B C
//          row 1:  . . D E F | X Y

const room = bossRoom('I');

const hall = miniHall('I');

export const GLACIER: StageData = {
  id: 'glacier',
  name: 'GLACIER',
  theme: 'ice',
  boss: 'frostline',
  bossName: 'FROSTLINE',
  bossWeapon: 'frost',
  layout: ['AaBbhCS', '.....DcE12degF|XY'],
  miniboss: 'mammoth',
  upgrade: 'helmet',
  screens: {
    '1': hall.a,
    '2': hall.b,
    A: [
      ...rows(SKY, 9),
      '........#######.',
      '........i...i...',
      SKY,
      '..P.............',
      '####IIIIIIII####',
      '################',
    ],
    B: [
      ...rows(SKY, 12),
      '....p......p....',
      'IIIIIII...IIIIII',
      '#######...######',
    ],
    // Ladder down into the cave.
    // --- added screens (longer stage) ---
    a: [...rows(SKY, 8), '......#######...', '.......i...i....', SKY, SKY, '..p.............', 'IIIIIIIIIIIIIIII', '################'],
    b: [...rows(SKY, 10), '.........III....', SKY, '...p............', 'IIIIII...IIIIIII', '######...#######'],
    h: [...rows(SKY, 7), '..........f.....', SKY, SKY, '.......III......', SKY, '..c.........w...', 'IIIIIIIIIIIIIIII', '################'],
    c: [...rows('################', 6), '....i.....i.....', ...rows(SKY, 5), '...........p....', 'IIIIIIIIIIIIIIII', '################'],
    d: [...rows('################', 6), '......i.....i...', ...rows(SKY, 5), '..p.............', 'IIIIIII^^IIIIIII', '################'],
    e: [...rows('################', 8), '....i......i....', ...rows(SKY, 3), '..c....p......p.', 'IIIIIIIIIIIIIIII', '################'],
    g: [...rows('################', 6), '...i....i....i..', ...rows(SKY, 6), 'IIIIII..IIIIIIII', '######..########'],
    C: [
      ...rows('...............#', 9),
      '....#########..#',
      '....i...i......#',
      '...............&',
      '......p........&',
      'IIIIIIIIIIIIH###',
      '############H###',
    ],
    // Hidden room behind C's frozen blocks: the Helmet.
    S: SECRET_ROOM,
    D: [
      '############H###',
      ...rows('#...........H..#', 9),
      '#...........H...',
      '#..........cH...',
      '#...........H...',
      'IIIIIIIIIIIIIIII',
      '################',
    ],
    // Spikes right after a long ice run: don't hold the d-pad into them.
    E: [
      ...rows('################', 6),
      '....i.....i.....',
      ...rows(SKY, 5),
      '..........p.....',
      'IIIII^^IIIIIIIII',
      '################',
    ],
    F: [
      ...rows('################', 6),
      ...rows('...............#', 4),
      '...............D',
      '...............D',
      '...B.....p.....D',
      'IIIIIIIIIIIIII##',
      '################',
    ],
    X: room.left,
    Y: room.right,
  },
};
