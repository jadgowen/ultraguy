import type { StageData } from './Level';
import { SKY, bossRoom, rows } from './rooms';

// GLACIER (ice). Slippery ice floors ('I') keep you sliding after you let go,
// icicles drop when you pass under them, and sliders skate straight at you.
// Climb down into an ice cave lined with spikes.
//
// Layout:  row 0:  A B C
//          row 1:  . . D E F | X Y

const room = bossRoom('I');

export const GLACIER: StageData = {
  id: 'glacier',
  name: 'GLACIER',
  theme: 'ice',
  boss: 'frostline',
  bossName: 'FROSTLINE',
  bossWeapon: 'frost',
  layout: ['ABC', '..DEF|XY'],
  screens: {
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
    C: [
      ...rows('...............#', 9),
      '....#########..#',
      '....i...i......#',
      '...............#',
      '......p........#',
      'IIIIIIIIIIIIH###',
      '############H###',
    ],
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
