import type { StageData } from './Level';
import { bossHall, bossRoom, rows, SKY } from './rooms';

/** The quiet hallway before the boss room (see bossHall). */
const lobby = bossHall();

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
  layout: ['ABCDEF|56|XY'],
  screens: {
    A: [...rows(SKY, 9), '..........###...', SKY, SKY, '..P.........R...', FLOOR, FLOOR],
    B: [...rows(SKY, 5), '.......G........', ...rows(SKY, 3), '....####........', SKY, SKY, '.............K..', '######..########', '######..########'],
    C: [...rows(SKY, 9), '....###...###...', SKY, SKY, '.c...S......S...', FLOOR, FLOOR],
    D: [...rows(SKY, 4), '......J.........', ...rows(SKY, 6), SKY, '...V......V.....', FLOOR, FLOOR],
    E: [...rows(SKY, 3), '.........Y......', ...rows(SKY, 7), SKY, '..c.......W.....', FLOOR, FLOOR],
    F: [...rows('...............#', 10), '...............D', '...............D', '...c....R......D', FLOOR, FLOOR],
    '5': lobby.left,
    '6': lobby.right,
    X: room.left,
    Y: room.right,
  },
  // The rooftops on the way in (billboards, water towers, stock left out) and the megastore's front.
  decor: [
    { tex: 'mega_billboard', x: 24, y: 152 },
    { text: 'BARON BUCKS', x: 44, y: 159, color: '#fff4b0' },
    { text: 'PRICES SLASHED!', x: 34, y: 170, color: '#ffd040' },
    { tex: 'mega_ac', x: 216, y: 184 },
    { tex: 'mega_cart', x: 256 + 24, y: 188 },
    { tex: 'mega_tower', x: 256 + 160, y: 144 },
    { tex: 'mega_pallet', x: 512 + 28, y: 184 },
    { tex: 'mega_ac', x: 512 + 130, y: 184 },
    { tex: 'mega_banner', x: 512 + 176, y: 180 },
    { text: 'SALE', x: 512 + 198, y: 186, color: '#b82838' },
    { tex: 'mega_cart', x: 768 + 20, y: 188 },
    { tex: 'mega_billboard', x: 768 + 100, y: 152 },
    { text: 'CUT-RATE!', x: 768 + 126, y: 159, color: '#fff4b0' },
    { text: 'ALL 90% OFF*', x: 768 + 116, y: 170, color: '#ffd040' },
    { tex: 'mega_tower', x: 1024 + 30, y: 144 },
    { tex: 'mega_banner', x: 1024 + 110, y: 180 },
    { text: 'SALE', x: 1024 + 132, y: 186, color: '#b82838' },
    { tex: 'mega_pallet', x: 1024 + 190, y: 184 },
    { tex: 'mega_facade', x: 5 * 256 + 64, y: 16, depth: 0.5 },
    { text: 'MEGAMART', x: 5 * 256 + 112, y: 34, color: '#ffe14a', size: 16 },
    { text: 'EVERYTHING MUST GO', x: 5 * 256 + 107, y: 54, color: '#fff4b0' },
    { tex: 'mega_neon', x: 5 * 256 + 121, y: 76 },
    { text: 'OPEN 24/7', x: 5 * 256 + 129, y: 79, color: '#ff9ad8' },
    { tex: 'mega_pallet', x: 5 * 256 + 22, y: 184 },
    { tex: 'mega_cart', x: 5 * 256 + 210, y: 188 },
  ],
};
