import type { StageData } from './Level';
import { SKY, bossRoom, rows } from './rooms';

// STRATOS (sky). Hop between cloud platforms ('C', one-way: jump up through
// them) high above a bottomless drop, while bombers and lightning-throwing
// sparkers harass you from above.
//
// Layout:  row 0:  A B C D E F | X Y

const room = bossRoom();

export const STRATOS: StageData = {
  id: 'stratos',
  name: 'STRATOS',
  theme: 'sky',
  boss: 'gale',
  bossName: 'GALE',
  bossWeapon: 'cyclone',
  layout: ['ABCDEF|XY'],
  screens: {
    A: [
      ...rows(SKY, 12),
      '..P.............',
      '#######...CCC...',
      '#######.........',
    ],
    B: [
      SKY,
      SKY,
      SKY,
      '..............b.',
      ...rows(SKY, 5),
      '.........CCC....',
      SKY,
      '....CCC.........',
      SKY,
      'CC...........CCC',
      SKY,
    ],
    C: [
      ...rows(SKY, 5),
      '.......z........',
      ...rows(SKY, 4),
      '..........####..',
      '.....CCC..####..',
      '..........####..',
      'CCC.......####..',
      '..........####..',
    ],
    D: [
      SKY,
      SKY,
      '..b.............',
      ...rows(SKY, 7),
      'CC..............',
      '..........CCC...',
      '.....CCC........',
      SKY,
      SKY,
    ],
    E: [
      ...rows(SKY, 5),
      '..........z.....',
      SKY,
      SKY,
      SKY,
      '.....CCC........',
      SKY,
      'CCC.............',
      '.............c..',
      '...........#####',
      '...........#####',
    ],
    F: [
      ...rows('...............#', 10),
      '...............D',
      '...............D',
      '..B............D',
      '################',
      '################',
    ],
    X: room.left,
    Y: room.right,
  },
};
