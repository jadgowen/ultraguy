import type { StageData } from './Level';
import { SKY, bossRoom, rows } from './rooms';

// CANOPY (jungle). Forest floor under a leaf ceiling, full of camouflaged
// lurkers and seed-spitting plants; climb a vine up through the canopy and
// cross the treetops (fall between them and you're gone).
//
// Layout:  row 0:  . . . E F G | X Y
//          row 1:  A B C D

const room = bossRoom();

export const CANOPY: StageData = {
  id: 'canopy',
  name: 'CANOPY',
  theme: 'jungle',
  boss: 'mantis',
  bossName: 'MANTIS',
  bossWeapon: 'thorn',
  layout: ['...EFG|XY', 'ABCD'],
  screens: {
    A: [
      '################',
      '######...#######',
      '..##.......##...',
      ...rows(SKY, 8),
      '..........##....',
      '..P.......##..l.',
      '################',
      '################',
    ],
    B: [
      '################',
      '#####....#######',
      ...rows(SKY, 8),
      '............s...',
      '...........####.',
      '...w............',
      '#####^^#########',
      '################',
    ],
    C: [
      '################',
      '###....#########',
      ...rows(SKY, 6),
      '........###.....',
      SKY,
      SKY,
      '....##..........',
      '....##.l....h...',
      '################',
      '################',
    ],
    // Vine up through a gap in the canopy.
    D: [
      '############H###',
      '############H###',
      ...rows('............H..#', 9),
      '......l.....H..#',
      '............H..#',
      '################',
      '################',
    ],
    E: [
      ...rows('#...............', 7),
      '#........f......',
      SKY.replace(/^./, '#'),
      '#...###.........',
      '#...............',
      '#...............',
      '#..c............',
      '############H###',
      '############H###',
    ],
    // Treetops: gaps are bottomless.
    F: [
      ...rows(SKY, 7),
      '..........f.....',
      SKY,
      SKY,
      SKY,
      '.....##.........',
      '..l.............',
      '#####...####..##',
      '#####...####..##',
    ],
    G: [
      ...rows('...............#', 10),
      '...............D',
      '..........##...D',
      '...B......##s..D',
      '################',
      '################',
    ],
    X: room.left,
    Y: room.right,
  },
};
