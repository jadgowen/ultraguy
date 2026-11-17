import type { StageData } from './Level';
import { rows, SKY } from './rooms';

// DOJO: a training hall, open from the title screen. Every weapon, free ammo,
// endless lives. Target dummies show the damage each hit does, and the back
// half is a lab for every way the hero can move: ladders, ice, the slide,
// conveyor belts, springs, water and updrafts. Ends at an exit.
//
// Layout:  A B C D E F G

const CEIL = [...rows('################', 2)];
const FLOOR = ['################', '################'];
const W = 256; // screen width in px

export const DOJO: StageData = {
  id: 'dojo',
  name: 'DOJO',
  theme: 'foundry',
  tagline: 'every weapon, free ammo, no lives lost',
  layout: ['ABCDEFG'],
  screens: {
    // Start.
    A: [...CEIL, ...rows(SKY, 10), '..P.............', ...FLOOR],
    // Standing targets, and one with a shield (only some weapons get past it).
    B: [...CEIL, ...rows(SKY, 10), '...d...d....n...', ...FLOOR],
    // Air targets, and a ledge to shoot from.
    C: [...CEIL, ...rows(SKY, 3), '....a.....a.....', ...rows(SKY, 3), '......###.......', ...rows(SKY, 2), '..............d.', ...FLOOR],
    // Ladder up to a ledge, then a run of ice.
    D: [...CEIL, ...rows(SKY, 4), '...H####........', ...rows('...H............', 6), 'IIIIIIIIIIIIIIII', '################'],
    // Slide tunnel (or hop over it), then conveyor belts both ways.
    E: [...CEIL, ...rows(SKY, 9), '..########......', '................', '#########<<<>>>#', '################'],
    // Spring, a pool of water, and an updraft.
    F: [...CEIL, ...rows('..........y.....', 7), ...rows('..~~~~~~..y.....', 3), '..~~~~~~........', '%###############', '################'],
    // Exit.
    G: [...CEIL, ...rows(SKY, 10), '.............*..', ...FLOOR],
  },
  decor: [
    { text: 'DOJO', x: 40, y: 60, color: '#f28c28', size: 16 },
    { text: 'EVERY WEAPON - FREE AMMO', x: 40, y: 84, color: '#fff1e0', size: 8 },
    { text: 'PAUSE TO PICK A WEAPON', x: 40, y: 96, color: '#8a8fa8', size: 8 },
    { text: 'TARGETS: DAMAGE SHOWN', x: W + 40, y: 60, color: '#fff1e0', size: 8 },
    { text: 'SHIELD', x: W + 182, y: 150, color: '#8a8fa8', size: 8 },
    { text: 'AIR TARGETS', x: 2 * W + 40, y: 44, color: '#fff1e0', size: 8 },
    { text: 'LADDER / ICE', x: 3 * W + 90, y: 60, color: '#fff1e0', size: 8 },
    { text: 'SLIDE: DOWN + JUMP', x: 4 * W + 30, y: 150, color: '#fff1e0', size: 8 },
    { text: 'BELTS', x: 4 * W + 168, y: 190, color: '#8a8fa8', size: 8 },
    { text: 'SPRING / WATER / UPDRAFT', x: 5 * W + 20, y: 44, color: '#fff1e0', size: 8 },
    { text: 'EXIT', x: 6 * W + 200, y: 170, color: '#fff1e0', size: 8 },
  ],
};
