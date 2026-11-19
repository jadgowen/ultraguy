import type { StageData } from './Level';
import { bossArena, bossHall, miniHall, rows, SKY } from './rooms';

/** The quiet hallway before the boss room (see bossHall). */
const lobby = bossHall();

// POWER PLANT. Built around switch blocks ('[' and ']' take turns being solid,
// blinking before they vanish) and the dark: in the unlit rooms you only see
// a circle around yourself, plus a flash every few seconds.
//  1. Lit: learn the switch blocks over a safe dip (A), then over spikes, past
//     an electric barrier (B).
//  2. Lights out: a dark room with a pit (C), switch blocks in the dark (D),
//     then a switch-block staircase up the dark shaft to a ladder (E).
//  3. Back in the light upstairs: rollers, then barriers and switch blocks in
//     the dark again (G), and a barrier run (H).
//  4. BLACKOUT (instead of a miniboss): past the crawlspace (1), walk into the
//     generator room (2, 3) and the power cuts out. Sparkers come out of the
//     dark. Find the three generators (red lamps blinking) and shoot each one;
//     with all three running the lights come back and the shutter opens.
//     Then VOLT.
//
// Layout:  row 0:  . . . . F G H 1 2 3 I | X Y
//          row 1:  A B C D E

const CEIL = '################';
// VOLT's switchyard: switch-block ledges take turns, and two live plates on
// the floor switch on and off with the barriers.
const room = bossArena('#', {
  11: '.....[[[........',
  12: '..........Z.....',
}, {
  11: '.....]]].......#',
  12: '...Z....X......#',
});
const hall = miniHall('#', false, true);

export const POWERPLANT: StageData = {
  id: 'powerplant',
  name: 'POWER PLANT',
  tagline: "LIGHTS OUT",
  theme: 'power',
  boss: 'volt',
  bossName: 'VOLT',
  bossWeapon: 'spark',
  signature: [{ kind: 'teslaCoil', from: 'roller', every: 1 }],
  layout: ['....FGH12378I|56|XY', 'ABCDE'],
  dark: 'CDEG',
  blackout: '23',
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
    // The generator room. One generator ('O') on the floor, one up the platforms...
    '2': [
      CEIL,
      CEIL,
      ...rows(SKY, 4),
      '.......O........',
      '......###.......',
      SKY,
      '..........###...',
      SKY,
      '.....###........',
      '..O.............',
      CEIL,
      CEIL,
    ],
    // ...and one past a barrier. The shutter ('Q') is the way out.
    '3': [
      CEIL,
      CEIL,
      ...rows('...............#', 6),
      '.........O.....#',
      '........###....#',
      '...Z...........Q',
      '...Z..###......Q',
      '...Z...........Q',
      CEIL,
      CEIL,
    ],
    I: [CEIL, CEIL, ...rows('...............#', 8), '...............D', '...............D', '...c...........D', CEIL, CEIL],
    // --- Extra stretch before the boss door: more of the stage's enemies, a bolt cache ---
    '7': ['################', '################', '................', '................', '................', '................', '................', '................', '................', '................', '........Z.......', '........Z.......', '..k.....Z...o...', '################', '################'],
    '8': ['################', '################', '................', '................', '................', '................', '.......f........', '................', '................', '................', '.............$..', '............###.', '................', '#####[[[]]]#####', '#####.....######'],
    '5': lobby.left,
    '6': lobby.right,
    X: room.left,
    Y: room.right,
  },
};
