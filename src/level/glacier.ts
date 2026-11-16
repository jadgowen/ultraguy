import type { StageData } from './Level';
import { bossRoom, miniHall, rows, SECRET_ROOM, SKY } from './rooms';

// GLACIER (ice). Built around cracking ice ('x': it holds for a moment, then
// breaks) and snowball chutes ('@').
//  1. On the surface: snowballs rolling across slippery ice (A), cracking ice
//     over a safe dip (B), then a field of it you'll fall through (C).
//  2. The descent: three layers of cracking ice in a shaft (D). Steer toward
//     the middle as each one breaks.
//  3. Under the ice: a staircase with a chute at the top sending snowballs
//     down it (F), then cracking bridges over pits under falling icicles (G).
//     Then the miniboss hall and FROSTLINE.
// The Helmet is behind C's frozen blocks (melt them with Flame Burst).
//
// Layout:  row 0:  A B C S
//          row 1:  . . D
//          row 2:  . . E F G 1 2 H | X Y

const ROCK = '################';
const room = bossRoom('I');
const hall = miniHall('I');

export const GLACIER: StageData = {
  id: 'glacier',
  name: 'GLACIER',
  tagline: "THE ICE WON'T HOLD",
  theme: 'ice',
  boss: 'frostline',
  bossName: 'FROSTLINE',
  bossWeapon: 'frost',
  layout: ['ABCS', '..D', '..EFG12H|XY'],
  miniboss: 'mammoth',
  upgrade: 'helmet',
  screens: {
    // --- 1. The surface -------------------------------------------------------------
    // Snowballs roll at you across the ice: jump them.
    A: [...rows(SKY, 9), '........#######.', '........i...i...', SKY, '..P...........@.', 'IIIIIIIIIIIIIIII', ROCK],
    // Cracking ice over a shallow dip: fall in and hop out.
    B: [...rows(SKY, 12), '..........p.....', 'IIIIxxxxxxIIIIII', ROCK],
    // A field of cracking ice: stand on it to fall through to the caves.
    // The ledges cross it to the frozen wall (Flame Burst melts it: the Helmet).
    C: [
      ...rows('...............#', 11),
      '.....###..###..&',
      '..c............&',
      'IIIIxxxxxxxxIIII',
      '####........####',
    ],
    S: SECRET_ROOM,

    // --- 2. The descent -----------------------------------------------------------------
    D: [
      '####........####',
      ...rows('#..............#', 3),
      '#...xxxxxxxx...#',
      ...rows('#..............#', 3),
      '#xxxxx....xxxxx#',
      '#..............#',
      '#.......f......#',
      '#..............#',
      '#..............#',
      '#....xxxxxx....#',
      '#IIII......IIII#',
    ],

    // --- 3. Under the ice ----------------------------------------------------------------
    E: ['#####......#####', '#####......#####', ...rows('#...............', 10), '#.c.............', 'IIIIIIIIIIIIIIII', ROCK],
    // Climb the stairs while snowballs bounce down them.
    F: [ROCK, ROCK, ...rows(SKY, 6), '..............@.', '............####', '.........#######', '......##########', '...#############', 'IIII############', ROCK],
    // Cracking bridges over the drop, icicles above.
    G: [ROCK, ROCK, '....i....i....i.', ...rows(SKY, 6), '###xxx..xxx..xxx', ...rows(SKY, 5)],
    '1': hall.a,
    '2': hall.b,
    H: [...rows(ROCK, 6), ...rows('...............#', 4), '...............D', '...............D', '...B.....p.....D', 'IIIIIIIIIIIIII##', ROCK],
    X: room.left,
    Y: room.right,
  },
};
