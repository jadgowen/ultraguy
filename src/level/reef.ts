import type { StageData } from './Level';
import { SKY, bossArena, bossHall, challengeRoom, miniHall, rows, water } from './rooms';

/** The quiet hallway before the boss room (see bossHall). */
const lobby = bossHall();
/** Where the stage's boss challenges you to their own game (see challengeRoom). */
const duel = challengeRoom('#', true);

// REEF. Built around the water itself: currents ('{' pushes left, '}' right)
// and bubble columns ('y') that lift you.
//  1. The beach, then down a hole into the sea (A, B). A current carries you
//     over a bed of urchins (C); then one pushes against you, so you swim
//     under it (D); then a bubble column lifts you over a coral wall (E).
//  2. Down into the trench (F, G): the current there drags you toward a
//     spiked wall, so get out of it fast.
//  3. A bubble column up into a fast current that rides you over a long
//     urchin bed (H, I).
//  4. The ANGLER's trench (1, 2): pitch dark. Its lure is the only light down
//     there besides your own; the lure flickers and dims just before it
//     lunges. Its shots glow. Then TIDE.
//
// Layout:  row 0:  A B
//          row 1:  . C D E F
//          row 2:  . . . . G H I 1 2 J | X Y

const ROCK = '################';
// TIDE's trench: a spike pit in each half of the floor, and a ledge in each
// half with spikes hanging over it (a full jump off a ledge reaches them).
const room = bossArena('#', {
  2: '....^^^^........',
  8: '...CCCCCC.......',
  13: '########^^^#####',
}, {
  2: '.........^^^^..#',
  8: '........CCCCCC.#',
  13: '###^^^#########' + '#',
});
const hall = miniHall('#', true, true);

export const REEF: StageData = {
  id: 'reef',
  name: 'REEF',
  tagline: "GO WITH THE FLOW",
  theme: 'water',
  boss: 'tide',
  bossName: 'TIDE',
  bossWeapon: 'bubble',
  signature: [{ kind: 'jelly', from: 'puffer', every: 1 }],
  layout: ['AB', '.CDEF', '....GHI129078J|56|XY'],
  miniboss: 'angler',
  dark: '12',
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
    // The bubble column rises into the middle of the current, which carries you over the urchins.
    H: water([ROCK, ROCK, SKY, ...rows('}}}}}}}}}}}}}}}}', 2), ...rows('}}yyy}}}}}}}}}}}', 3), ...rows('..yyy...........', 5), '#####^^^^^^^^^^^', ROCK]),
    I: water([ROCK, ROCK, SKY, ...rows('}}}}}}}}}.......', 5), ...rows(SKY, 3), '..........######', '..........######', '^^^^^^^^########', ROCK]),
    '1': hall.a,
    '2': hall.b,
    J: water([...rows(ROCK, 6), ...rows('...............#', 4), '...............D', '...............D', '...c...........D', ROCK, ROCK]),
    // --- Extra stretch before the boss door: more of the stage's enemies, a bolt cache ---
    // --- The boss's challenge: their own game, before the last stretch ---
    '9': duel.a,
    '0': duel.b,
    '7': water(['################', '################', '................', '................', '................', '................', '......u.........', '................', '................', '................', '................', '................', '......##....q...', '################', '################']),
    '8': water(['################', '################', '................', '.........u......', '................', '................', '}}}}}}}}}}}}}}}}', '}}}}}}}}}}}}}}}}', '................', '................', '................', '................', '...$......q.....', '################', '################']),
    '5': water(lobby.left),
    '6': water(lobby.right),
    X: water(room.left),
    Y: water(room.right),
  },
};
