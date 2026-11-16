import type { StageData } from './Level';
import { bossRoom, miniHall, rows, SKY } from './rooms';

// POWER PLANT. Built around switch blocks ('[' and ']' take turns being solid,
// blinking before they vanish) and the dark: in the unlit rooms you only see
// a circle around yourself, plus a flash every few seconds.
//  1. Lit: learn the switch blocks over a safe dip (A), then over spikes, past
//     an electric barrier (B).
//  2. Lights out: a dark room with a pit (C), switch blocks in the dark (D),
//     then a switch-block staircase up the dark shaft to a ladder (E).
//  3. Back in the light upstairs: rollers, then barriers and switch blocks in
//     the dark again (G), and a barrier run (H). Then the hall and VOLT.
//
// Layout:  row 0:  . . . . F G H 1 2 I | X Y
//          row 1:  A B C D E

const CEIL = '################';
const room = bossRoom();
const hall = miniHall('#');

export const POWERPLANT: StageData = {
  id: 'powerplant',
  name: 'POWER PLANT',
  theme: 'power',
  boss: 'volt',
  bossName: 'VOLT',
  bossWeapon: 'spark',
  layout: ['....FGH12I|XY', 'ABCDE'],
  miniboss: 'dynamo',
  dark: 'CDEG',
  screens: {
    // --- 1. Lit -----------------------------------------------------------------------
    // Orange blocks, then teal: stand on one set and step across as they swap.
    A: [CEIL, CEIL, ...rows(SKY, 10), '..P.............', '#######[[[]]]###', CEIL],
    // The same over spikes, past a barrier.
    B: [CEIL, CEIL, ...rows(SKY, 7), '..........o.....', '...Z............', '...Z............', '...Z............', '#######]]][[[###', '#######^^^^^^###'],

    // --- 2. Lights out ----------------------------------------------------------------
    C: [CEIL, CEIL, ...rows(SKY, 8), '.........###....', SKY, '..c.....k.......', '#####...########', '#####...########'],
    D: [CEIL, CEIL, ...rows(SKY, 8), '..........f.....', '.......]]]......', '...[[[.....[[[..', '###...........##', '###...........##'],
    // Up the dark shaft on switch blocks to the ladder.
    E: [
      '############H###',
      '#...........H..#',
      '#...........H..#',
      '#..........[[[.#',
      '#..............#',
      '#......]]].....#',
      '#..............#',
      '#...[[[........#',
      '#..............#',
      '#......]]]....f#',
      '...............#',
      '...[[[.........#',
      '...............#',
      CEIL,
      CEIL,
    ],

    // --- 3. Upstairs --------------------------------------------------------------------
    F: [CEIL, CEIL, ...rows(SKY, 10), '..c....o........', '############H###', '############H###'],
    // Barrier, then switch blocks over a pit, in the dark.
    G: [CEIL, CEIL, ...rows(SKY, 7), '..........f.....', '..Z.............', '..Z.............', '..Z.............', '#####[[[]]][[[##', '#####.........##'],
    // A barrier run back in the light, up to the hall.
    H: [CEIL, CEIL, ...rows(SKY, 7), '...........k....', '.....Z....Z.....', '.....Z....Z.....', '.....Z....Z.....', CEIL, CEIL],
    '1': hall.a,
    '2': hall.b,
    I: [CEIL, CEIL, ...rows('...............#', 8), '...............D', '...............D', '...B...........D', CEIL, CEIL],
    X: room.left,
    Y: room.right,
  },
};
