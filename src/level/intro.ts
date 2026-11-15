import type { StageData } from './Level';
import { SKY, rows } from './rooms';

// INTRO: a city street (no pits, no spikes) leading to the QUIK MART. Inside,
// BLACK JARED waits behind the register. No weapon: this stage just
// introduces the boss fight.
//
// Layout:  A B C D E F G H | X Y      (X-Y is the store)

const FLOOR = '################';
const CEIL = '################';
const H_X = 7 * 256; // world x of screen H
const STORE_X = 8 * 256; // world x of the store (screens X, Y)

export const INTRO: StageData = {
  id: 'intro',
  name: 'DOWNTOWN',
  theme: 'city',
  boss: 'jared',
  bossName: 'BLACK JARED',
  layout: ['ABCDEFGH|XY'],
  screens: {
    A: [...rows(SKY, 10), '..........##....', SKY, '..P.............', FLOOR, FLOOR],
    B: [...rows(SKY, 11), '.........###....', '...w.....###....', FLOOR, FLOOR],
    C: [...rows(SKY, 7), '.....f..........', ...rows(SKY, 4), '..........h.....', FLOOR, FLOOR],
    D: [...rows(SKY, 9), '..........t.....', '.........###....', SKY, '..c.............', FLOOR, FLOOR],
    E: [...rows(SKY, 11), '....##..........', '....##.....o....', FLOOR, FLOOR],
    F: [...rows(SKY, 6), '...f.......f....', ...rows(SKY, 5), '.......w........', FLOOR, FLOOR],
    G: [...rows(SKY, 10), '.......###......', SKY, '..c.........h...', FLOOR, FLOOR],
    // The storefront: the wall above the door gets the QUIK MART facade.
    H: [SKY, SKY, ...rows('..........######', 8), '...............D', '...............D', '...B...........D', FLOOR, FLOOR],
    // Inside the store. The counter (tiles + scenery) stands in front of Jared.
    X: [CEIL, CEIL, ...rows(SKY, 11), FLOOR, FLOOR],
    Y: [CEIL, CEIL, ...rows('...............#', 9), '.........###...#', '.........##X...#', FLOOR, FLOOR],
  },
  decor: [
    // Store interior wall (hides the skyline), with a green and orange stripe.
    { rect: { w: 512, h: 176, fill: 0xf4f1ea }, x: STORE_X, y: 32, depth: 0.5 },
    { rect: { w: 512, h: 6, fill: 0x2e9a4a }, x: STORE_X, y: 96, depth: 0.6 },
    { rect: { w: 512, h: 4, fill: 0xf07a28 }, x: STORE_X, y: 102, depth: 0.6 },
    { rect: { w: 512, h: 8, fill: 0xd8d4cc }, x: STORE_X, y: 200, depth: 0.6 },
    { tex: 'storefront', x: H_X + 160, y: 32 },
    { text: 'QUIK MART', x: H_X + 166, y: 37, color: '#ffffff', size: 12 },
    { tex: 'store_shelf', x: STORE_X + 60, y: 152 },
    { tex: 'store_shelf', x: STORE_X + 120, y: 152 },
    { tex: 'store_shelf', x: STORE_X + 180, y: 152 },
    { tex: 'store_cooler', x: STORE_X + 300, y: 144 },
    { text: 'QUIK MART', x: STORE_X + 190, y: 46, color: '#f07a28', size: 16 },
    { text: 'OPEN 24 HOURS   HOT DOGS 2 FOR $3', x: STORE_X + 150, y: 68, color: '#2e9a4a', size: 8 },
    // The counter is drawn in front of Jared (depth 7 > boss depth 6).
    { tex: 'store_counter', x: STORE_X + 256 + 144, y: 164, depth: 7 },
  ],
};
