import type { StageData } from './Level';
import { bossRoom, miniHall, rows, SKY, water } from './rooms';

// REEF. Start on the beach, drop through a hole into the sea. Underwater
// ('~') you fall slowly and jump much higher, which you need for the long
// sea-urchin beds. Puffers drift after you; clams hide behind their shells.
//
// Layout:  row 0:  A B C
//          row 1:  . . D E F G H
//          row 2:  . . . . . . I J K L M N | X Y

const ROCK = '################';
const room = bossRoom();

const hall = miniHall('#', true);

export const REEF: StageData = {
  id: 'reef',
  name: 'REEF',
  theme: 'water',
  boss: 'tide',
  bossName: 'TIDE',
  bossWeapon: 'bubble',
  layout: ['ABC', '..DEFGH', '......IJK12LMN|XY'],
  miniboss: 'angler',
  screens: {
    '1': hall.a,
    '2': hall.b,
    A: [...rows(SKY, 12), '..P.........w...', ROCK, ROCK],
    B: [...rows(SKY, 10), '......###.......', SKY, '...........w....', ROCK, ROCK],
    // Dive through the hole.
    C: [...rows('...............#', 13), '##########...###', '##########...###'],
    D: water(['##########...###', ...rows('#...............', 9), '#.......####....', '#...............', '#.........c.....', ROCK, ROCK]),
    E: water([ROCK, ROCK, ...rows(SKY, 8), '.....##.........', '.....##....u....', '.....##.......q.', ROCK, ROCK]),
    // Urchin bed: a big underwater jump (use the ledge in the middle).
    F: water([ROCK, ROCK, ...rows(SKY, 5), '..........u.....', SKY, SKY, SKY, '......###.......', SKY, '###^^^^^^^^#####', ROCK]),
    G: water([...rows(ROCK, 6), ...rows(SKY, 6), '...q.......q....', ROCK, ROCK]),
    H: water([ROCK, ROCK, ...rows('...............#', 10), '..u............#', '######...#######', '######...#######']),
    I: water(['######...#######', ...rows('#...............', 11), '#......c........', ROCK, ROCK]),
    // Kelp pillars from floor and ceiling.
    J: water([ROCK, ROCK, ...rows('....##......##..', 3), ...rows(SKY, 4), '........##......', '........##......', '........##...u..', '........##......', ROCK, ROCK]),
    K: water([ROCK, ROCK, ...rows(SKY, 9), '..........q.....', '.........###....', '##^^^^^##^^^^###', ROCK]),
    L: water([ROCK, ROCK, SKY, SKY, SKY, '...u.......u....', ...rows(SKY, 4), '......u.........', SKY, SKY, ROCK, ROCK]),
    M: water([ROCK, ROCK, ...rows(SKY, 8), '..........##....', '..........##....', '...q......##..q.', ROCK, ROCK]),
    N: water([ROCK, ROCK, ...rows('...............#', 8), '...............D', '...............D', '...B...........D', ROCK, ROCK]),
    X: water(room.left),
    Y: water(room.right),
  },
};
