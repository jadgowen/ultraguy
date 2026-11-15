import type { StageData } from './Level';
import { bossRoom, miniHall, rows, SKY } from './rooms';

// STRATOS (sky). Hop between cloud platforms ('C', one-way: jump up through
// them) high above a bottomless drop, while bombers and lightning-throwing
// sparkers harass you from above.
//
// Layout:  row 0:  A B C D E F | X Y

const room = bossRoom();

const hall = miniHall('#');

export const STRATOS: StageData = {
  id: 'stratos',
  name: 'STRATOS',
  theme: 'sky',
  boss: 'gale',
  bossName: 'GALE',
  bossWeapon: 'cyclone',
  layout: ['AaBbCcDd12EegF|XY'],
  miniboss: 'kite',
  upgrade: 'armor',
  screens: {
    '1': hall.a,
    '2': hall.b,
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
      '..............U.',
      '.............CCC',
      '.....CCC........',
      SKY,
      'CCC.............',
      '.............c..',
      '...........#####',
      '...........#####',
    ],
    // --- added screens (longer stage); each joins its neighbors at the same height ---
    a: [SKY, SKY, SKY, '...........b....', ...rows(SKY, 5), '......CCC.......', SKY, '...CCC.....CCC..', SKY, 'CC..............', SKY],
    b: [...rows(SKY, 5), '........z.......', ...rows(SKY, 6), '.....c..........', 'CCC.####...CC.CC', '....####........'],
    c: [SKY, SKY, SKY, '....b...........', ...rows(SKY, 6), 'CC..........CC..', SKY, '....CCC..CCC....', SKY, SKY],
    d: [...rows(SKY, 5), '.......z........', SKY, SKY, SKY, '.....CCC........', SKY, 'CCC.......CCC...', SKY, SKY, SKY],
    e: [...rows(SKY, 4), '..........b.....', ...rows(SKY, 5), SKY, '.....CCC........', '..c.............', '####.......#####', '####.......#####'],
    g: [...rows(SKY, 6), '........f.......', SKY, SKY, SKY, '.........CCC....', SKY, '....CCC.........', 'CC...........###', '.............###'],
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
