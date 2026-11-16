import type { StageData } from './Level';
import { bossRoom, miniHall, rows, SKY, water } from './rooms';

// REEF. Built around the water itself: currents ('{' pushes left, '}' right)
// and bubble columns ('y') that lift you.
//  1. The beach, then down a hole into the sea (A, B). A current carries you
//     over a bed of urchins (C); then one pushes against you, so you swim
//     under it (D); then a bubble column lifts you over a coral wall (E).
//  2. Down into the trench (F, G): the current there drags you toward a
//     spiked wall, so get out of it fast.
//  3. A bubble column up into a fast current that rides you over a long
//     urchin bed (H, I). Then the hall and TIDE.
//
// Layout:  row 0:  A B
//          row 1:  . C D E F
//          row 2:  . . . . G H I 1 2 J | X Y

const ROCK = '################';
const room = bossRoom();
const hall = miniHall('#', true);

export const REEF: StageData = {
  id: 'reef',
  name: 'REEF',
  tagline: "GO WITH THE FLOW",
  theme: 'water',
  boss: 'tide',
  bossName: 'TIDE',
  bossWeapon: 'bubble',
  layout: ['AB', '.CDEF', '....GHI12J|XY'],
  miniboss: 'angler',
  screens: {
    // --- 1. Into the sea ------------------------------------------------------------------
    A: [...rows(SKY, 10), '..........###...', SKY, '..P.............', ROCK, ROCK],
    B: [...rows(SKY, 12), '..c.............', '#####......#####', '#####......#####'],
    // A current carries you over the urchins.
    C: water([
      '#####......#####',
      ...rows('#...............', 6),
      '#...}}}}}}}}}}}}',
      '#...}}}}}}}}}}}}',
      ...rows('#...............', 2),
      '#..........q....',
      '#...............',
      '#####^^^^^^^^###',
      ROCK,
    ]),
    // This one pushes back: swim under it.
    D: water([ROCK, ROCK, SKY, SKY, '{{{{{{{{{{{{{{{{', '{{{{{{{{{{{{{{{{', '{{{{{{{{{{{{{{{{', SKY, '......u.........', SKY, '...###....###...', SKY, SKY, '###^^^###^^^####', ROCK]),
    // A bubble column lifts you over the coral wall.
    E: water([ROCK, ROCK, SKY, SKY, '..........###...', ...rows('.......yyy###...', 8), ROCK, ROCK]),

    // --- 2. The trench ------------------------------------------------------------------
    F: water([ROCK, ROCK, ...rows(SKY, 3), '....u...........', ...rows(SKY, 4), '..c.............', SKY, SKY, '######.....#####', '######.....#####']),
    // The current drags you toward the spiked wall.
    G: water([
      '######.....#####',
      ...rows('#...............', 6),
      ...rows('#^{{{{{{{{......', 4),
      '#^..............',
      '#^.......q......',
      ROCK,
      ROCK,
    ]),

    // --- 3. The fast current -------------------------------------------------------------
    H: water([ROCK, ROCK, SKY, '}}}}}}}}}}}}}}}}', '}}}}}}}}}}}}}}}}', SKY, ...rows('..yyy...........', 7), '#####^^^^^^^^^^^', ROCK]),
    I: water([ROCK, ROCK, SKY, '}}}}}}..........', '}}}}}}..........', ...rows(SKY, 6), '..........######', '..........######', '^^^^^^^^########', ROCK]),
    '1': hall.a,
    '2': hall.b,
    J: water([...rows(ROCK, 6), ...rows('...............#', 4), '...............D', '...............D', '...B...........D', ROCK, ROCK]),
    X: water(room.left),
    Y: water(room.right),
  },
};
