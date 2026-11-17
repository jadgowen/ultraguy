import type { StageData } from './Level';
import { bossRoom, miniHall, rows, SECRET_ROOM, SKY } from './rooms';

// FOUNDRY. Built around crushers ('!'): presses that wait, slam to the floor
// and slowly rise, in a rolling wave down a line.
//  1. Learn them on solid floor (B), then under a conveyor that drags you
//     back while you time your run (C).
//  2. Drop down a hole into an elevator shaft: ride the lift down past a spike
//     floor (E), then on through a corridor (e) and down again.
//  3. The press line: a long wave of crushers over a backward conveyor (G),
//     then presses between pits (H). Then the miniboss hall and ANVIL.
// The UltraBlaster is behind the fake right wall of D (into the secret room S).
//
// Layout:  row 0:  A B C D S
//          row 1:  . . . E e
//          row 2:  . . . . F G H I 1 2 J | X Y

const CEIL = '################';
const FLOOR = '################';
const room = bossRoom();
const hall = miniHall('#');

export const FOUNDRY: StageData = {
  id: 'foundry',
  name: 'FOUNDRY',
  tagline: "MIND THE PRESSES",
  theme: 'foundry',
  boss: 'anvil',
  bossName: 'ANVIL',
  bossWeapon: 'quake',
  signature: [{ kind: 'hammerbot', from: 'walker', every: 2 }, { kind: 'hammerbot', from: 'hopper', every: 1 }],
  layout: ['ABCDS', '...Ee', '....FGHI12J|XY'],
  miniboss: 'press',
  upgrade: 'blaster',
  screens: {
    // --- 1. Learn the presses ---------------------------------------------------
    A: [CEIL, CEIL, ...rows(SKY, 8), '..........###...', SKY, '..P.......w.....', FLOOR, FLOOR],
    // Two presses over plain floor: watch the rhythm, then walk under.
    B: [CEIL, CEIL, '...!.......!....', ...rows(SKY, 9), '................', FLOOR, FLOOR],
    // Presses over a belt that drags you backward.
    C: [CEIL, CEIL, '..!....!....!...', ...rows(SKY, 6), '.......###......', SKY, SKY, '................', '<<<<<<<<<<<<<<<<', FLOOR],
    // Drop through the hole. The right wall's bottom is fake: the UltraBlaster.
    D: [
      CEIL,
      CEIL,
      ...rows('...............#', 7),
      '..........t....#',
      '.........###...#',
      '...............F',
      '..c............F',
      '######...#######',
      '######...#######',
    ],
    S: SECRET_ROOM,

    // --- 2. The shaft ---------------------------------------------------------------
    // Land on the ledge, ride the lift down; the floor is spikes.
    E: [
      '######...#######',
      '#..............#',
      '#..............#',
      '#....#####v.....',
      ...rows('#.........:.....', 2),
      '#.f.......:.....',
      ...rows('#.........:.....', 2),
      '#.........:.....',
      '#.........:.....',
      '#.........:..###',
      '#^^^^^^^^^^^^###',
      FLOOR,
      FLOOR,
    ],
    e: [...rows(CEIL, 3), ...rows('...............#', 6), '..........h....#', '...............#', '####...#########', '####...#########', '####...#########', '####...#########'],

    // --- 3. The press line -------------------------------------------------------------
    F: ['####...#########', '####...#########', '#........!...!..', ...rows('#...............', 9), '#...c...........', '#>>>>>>>>>>>>>>>', FLOOR],
    // A long rolling wave of presses over a belt pushing you back.
    G: [CEIL, CEIL, '.!..!..!..!..!..', ...rows(SKY, 10), '<<<<<<<<<<<<<<<<', FLOOR],
    // Presses between pits.
    H: [CEIL, CEIL, '...!......!.....', ...rows(SKY, 7), '..............f.', SKY, SKY, '######..####..##', '######..####..##'],
    I: [CEIL, CEIL, ...rows(SKY, 8), '..........t.....', '.........#######', '.....w...#######', FLOOR, FLOOR],
    '1': hall.a,
    '2': hall.b,
    J: [...rows('...............#', 10), '...............D', '...............D', '...B...........D', FLOOR, FLOOR],
    X: room.left,
    Y: room.right,
  },
};
