import type { StageData } from './Level';
import { bossRoom, rows, SKY } from './rooms';

// MEGAMART (secret): the Bargain Baron's flagship store, across the city
// rooftops. Rivet hands you the key once you've found every hidden 1-UP. A
// greatest-hits run of every stage's signature enemy, then the Baron himself.
//
// Signature enemies by letter: R hammerbot, S snapper, W snow roller,
// G gust fan, K tesla coil, V lava leaper, J magnet drone, Y jelly.
//
// Layout:  A B C D E F | X Y

const FLOOR = '################';
const room = bossRoom();

export const VAULT: StageData = {
  id: 'vault',
  name: 'MEGAMART',
  theme: 'city',
  boss: 'baron',
  bossName: 'BARGAIN BARON',
  tagline: "rivet's rival never closes",
  layout: ['ABCDEF|XY'],
  screens: {
    A: [...rows(SKY, 9), '..........###...', SKY, SKY, '..P.........R...', FLOOR, FLOOR],
    B: [...rows(SKY, 5), '.......G........', ...rows(SKY, 3), '....####........', SKY, SKY, '.............K..', '######..########', '######..########'],
    C: [...rows(SKY, 9), '....###...###...', SKY, SKY, '.c...S......S...', FLOOR, FLOOR],
    D: [...rows(SKY, 4), '......J.........', ...rows(SKY, 6), SKY, '...V......V.....', FLOOR, FLOOR],
    E: [...rows(SKY, 3), '.........Y......', ...rows(SKY, 7), SKY, '..c.......W.....', FLOOR, FLOOR],
    F: [...rows('...............#', 10), '...............D', '...............D', '...B....R......D', FLOOR, FLOOR],
    X: room.left,
    Y: room.right,
  },
  decor: [
    { text: 'MEGAMART', x: 5 * 256 + 60, y: 60, color: '#ffe14a', size: 16 },
    { text: 'EVERYTHING MUST GO', x: 5 * 256 + 50, y: 84, color: '#d83a4a', size: 8 },
  ],
};
