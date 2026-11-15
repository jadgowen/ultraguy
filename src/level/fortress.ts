import type { StageData } from './Level';
import { SKY, bossRoom, rows, water } from './rooms';

// The FORTRESS: three stages played in order once all eight bosses are
// beaten, each mixing hazards from the boss stages and ending at a goal
// capsule ('*'), then the final boss stage.

const CEIL = '################';
const FLOOR = '################';

/** Fortress 1: GATE. Conveyors, barriers, lava and a flooded hall. */
export const FORTRESS_1: StageData = {
  id: 'fortress1',
  name: 'FORTRESS GATE',
  theme: 'fortress',
  layout: ['ABCDEF', '.....GHIJKL'],
  screens: {
    A: [CEIL, CEIL, ...rows(SKY, 8), '..........###...', SKY, '..P.......w.....', FLOOR, FLOOR],
    B: [CEIL, CEIL, ...rows(SKY, 6), '..........t.....', '.........###....', SKY, SKY, '...........g....', '###>>>>^^#######', FLOOR],
    C: [CEIL, CEIL, ...rows(SKY, 7), '...###....###...', '....Z......Z....', '....Z......Z....', '..c.Z...k..Z....', FLOOR, FLOOR],
    D: [CEIL, CEIL, ...rows(SKY, 5), '.....f.....f....', SKY, SKY, '.......###......', SKY, '..h.............', '######...#######', '######...#######'],
    E: [CEIL, CEIL, ...rows(SKY, 7), '..........j.....', '.........####...', '......#######...', '.o.##########...', FLOOR, FLOOR],
    F: [CEIL, CEIL, ...rows('...............#', 10), '...w...........#', '############H###', '############H###'],
    G: ['############H###', ...rows('#...........H..#', 9), '#...........H...', '#..........cH...', '#...........H...', FLOOR, FLOOR],
    H: [...rows(CEIL, 6), ...rows(SKY, 6), '.....p..........', 'IIIIIIII^^IIIIII', FLOOR],
    I: [...rows(CEIL, 6), ...rows(SKY, 6), '...e....e.......', '##LLL##LLL######', FLOOR],
    // Flooded hall: big underwater jumps over the urchins.
    J: water([...rows(CEIL, 6), SKY, SKY, SKY, '......u.........', SKY, SKY, '...q.......q....', FLOOR, FLOOR]),
    K: water([...rows(CEIL, 6), ...rows(SKY, 4), '.....###........', SKY, SKY, '##^^^^^^^^^^####', FLOOR]),
    L: [...rows(CEIL, 6), ...rows('...............#', 6), '..........*....#', FLOOR, FLOOR],
  },
};

/** Fortress 2: DEPTHS. Two ladders down through ice, lava, barriers and water. */
export const FORTRESS_2: StageData = {
  id: 'fortress2',
  name: 'FORTRESS DEPTHS',
  theme: 'fortress',
  layout: ['ABC', '..DEFG', '.....HIJKL'],
  screens: {
    A: [CEIL, CEIL, ...rows(SKY, 8), '.....#####......', SKY, '..P.....l.......', FLOOR, FLOOR],
    B: [CEIL, CEIL, ...rows(SKY, 7), '..........s.....', '.........###....', SKY, '...h............', '######^^########', FLOOR],
    C: [CEIL, CEIL, ...rows('...............#', 8), '.......f.......#', '...............#', '...w...........#', '############H###', '############H###'],
    D: ['############H###', ...rows('#...........H..#', 9), '#...........H...', '#..........cH...', '#...........H...', 'IIIIIIIIIIIIIIII', FLOOR],
    E: [...rows(CEIL, 6), '...i......i.....', ...rows(SKY, 5), '.........p......', 'IIIIIII..IIIIIII', 'IIIIIII..IIIIIII'],
    F: [...rows(CEIL, 6), ...rows(SKY, 4), '.........##.....', SKY, '...m.....e......', '#######LLL######', FLOOR],
    G: [...rows(CEIL, 6), ...rows('...............#', 7), '############H###', '############H###'],
    H: ['############H###', ...rows('#...........H..#', 9), '#...........H...', '#..........cH...', '#...........H...', '>>>>>>>>>>>>>>>>', FLOOR],
    I: [...rows(CEIL, 6), SKY, SKY, SKY, '..###....###....', '...Z......Z.....', '...Z......Z.....', '...Z..o...Z.....', FLOOR, FLOOR],
    J: [...rows(CEIL, 6), SKY, SKY, '...........g....', '..........###...', '.......######...', '....#########...', '.############...', FLOOR, FLOOR],
    K: water([...rows(CEIL, 6), SKY, SKY, '....u.....u.....', SKY, SKY, SKY, '..q.........q...', FLOOR, FLOOR]),
    L: [...rows(CEIL, 6), ...rows('...............#', 6), '..........*....#', FLOOR, FLOOR],
  },
};

/** Fortress 3: SPIRE. Climb the tower (clouds and ladders), then run the roof. */
export const FORTRESS_3: StageData = {
  id: 'fortress3',
  name: 'FORTRESS SPIRE',
  theme: 'fortress',
  layout: ['..IJKL', '..GH', '..EF', 'ABCD'],
  screens: {
    A: [CEIL, CEIL, ...rows(SKY, 8), '.........###....', SKY, '..P.......w.....', FLOOR, FLOOR],
    B: [CEIL, CEIL, ...rows(SKY, 10), '.........h......', '<<<<<<<<<<<<<<<<', FLOOR],
    C: [CEIL, CEIL, ...rows(SKY, 6), '..........t.....', '.........###....', SKY, SKY, '..c.............', '#####^^#########', FLOOR],
    D: ['############H###', '############H###', ...rows('............H..#', 10), '...w........H..#', FLOOR, FLOOR],
    // Climbing room: clouds up and to the left, then the ladder in E.
    E: [
      '####H###########',
      '####H###########',
      '#...H...........',
      '#...H...........',
      '#...H...........',
      '#...###########.',
      ...rows('#...............', 7),
      FLOOR,
      FLOOR,
    ],
    F: [
      CEIL,
      CEIL,
      ...rows('...............#', 5),
      '.CCC.....CCC...#',
      '...............#',
      '....CCC........#',
      '...............#',
      '.........CCC...#',
      '...............#',
      '############H###',
      '############H###',
    ],
    G: [CEIL, CEIL, ...rows('#...............', 7), '#............CCC', '#...............', '#.......CCC.....', '#...............', '####H###########', '####H###########'],
    H: ['############H###', '############H###', ...rows('............H..#', 5), '..###########..#', '...............#', '........f......#', '...............#', '...............#', '...............#', FLOOR, FLOOR],
    // The roof: open sky.
    I: [...rows(SKY, 10), '....###.........', SKY, '.........w......', FLOOR, FLOOR],
    J: [SKY, SKY, '......b.........', ...rows(SKY, 9), '...c............', '############H###', '############H###'],
    K: [...rows(SKY, 4), '.......z........', ...rows(SKY, 6), '....CCC...CCC...', SKY, '###.........####', '###.........####'],
    L: [...rows(SKY, 12), '..........*.....', FLOOR, FLOOR],
  },
};

const finalRoom = bossRoom();

/** The final stage: a short walk to the last door. */
export const FINALE: StageData = {
  id: 'finale',
  name: 'THRONE',
  theme: 'fortress',
  boss: 'overlord',
  bossName: 'OVERLORD',
  layout: ['AB|XY'],
  screens: {
    A: [...rows(CEIL, 6), ...rows(SKY, 6), '..P.............', FLOOR, FLOOR],
    B: [...rows(CEIL, 6), ...rows('...............#', 4), '...............D', '...............D', '...B...........D', FLOOR, FLOOR],
    X: finalRoom.left,
    Y: finalRoom.right,
  },
};

const rematchRoom = bossRoom();

/**
 * BOSS HALL: before the throne, eight teleporter capsules ('T'), one per
 * stage boss. Press UP in a capsule to refight that boss; the exit capsule
 * opens once all eight are beaten. Bosses are fought in the room below.
 */
export const GAUNTLET: StageData = {
  id: 'gauntlet',
  name: 'BOSS HALL',
  theme: 'fortress',
  layout: ['AB', 'XY'],
  screens: {
    A: [CEIL, CEIL, ...rows(SKY, 10), '.P...T..T..T..T.', FLOOR, FLOOR],
    B: [CEIL, CEIL, ...rows(SKY, 10), '.T..T..T..T...*.', FLOOR, FLOOR],
    X: rematchRoom.left,
    Y: rematchRoom.right,
  },
};
