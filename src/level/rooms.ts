/** Shared screen pieces for stage files. */

export const SKY = '................';

/** n copies of a row. */
export function rows(row: string, n: number): string[] {
  return Array.from({ length: n }, () => row);
}

/**
 * Standard two-screen boss room (fills the 16:9 view). Put it right after a
 * screen ending in a 'D' door column, separated by '|' in the layout.
 */
export function bossRoom(floor = '#'): { left: string[]; right: string[] } {
  const ground = floor.repeat(16);
  return {
    left: [...rows('################', 2), ...rows(SKY, 11), ground, '################'],
    right: [
      ...rows('################', 2),
      ...rows('...............#', 10),
      '........X......#',
      ground.slice(0, 15) + '#',
      '################',
    ],
  };
}

/**
 * The hallway before a boss room (like the ones in the X games): two quiet
 * screens with no enemies, a low ceiling with beams hanging from it, the
 * checkpoint that is also the boss-test start ('B'), and the boss door at the
 * far end. Two screens because the camera needs a section at least as wide as
 * the view. Goes between the stage's own door screen and the boss room, each
 * side split off with '|': `...J|56|XY` (screens '5' and '6').
 */
export function bossHall(): { left: string[]; right: string[] } {
  const ceil = '################';
  const floor = '################';
  return {
    left: [...rows(ceil, 5), '....##......##..', ...rows(SKY, 6), '...B............', floor, floor],
    right: [...rows(ceil, 5), '....##......####', ...rows('...............#', 4), ...rows('...............D', 3), floor, floor],
  };
}

/**
 * A stage's own boss room: the standard room with some rows redrawn, by row
 * number, on the left and right screens. Keep the right screen's wall
 * (column 15) and its 'X' (row 12, column 8). Bosses walk on the floor and
 * fall through one-way ledges ('C'), so ledges never get in their way; solid
 * humps do (they also stop ground waves and rolling saws).
 */
export function bossArena(floor = '#', left: Record<number, string> = {}, right: Record<number, string> = {}): { left: string[]; right: string[] } {
  const r = bossRoom(floor);
  const pick = (rows: string[], over: Record<number, string>) =>
    rows.map((row, i) => {
      const o = over[i];
      if (o !== undefined && o.length !== 16) throw new Error(`boss arena row ${i} must be 16 wide: "${o}"`);
      return o ?? row;
    });
  return { left: pick(r.left, left), right: pick(r.right, right) };
}

/** Underwater screen: every '.' becomes water ('~'). */
export function water(screen: string[]): string[] {
  return screen.map((r) => r.replace(/\./g, '~'));
}

/**
 * Two-screen miniboss hall: a flat floor with the miniboss ('M') near the
 * right and a checkpoint before it. Just left of the fight a low block sits
 * on the floor; under it runs a one-tile crawlspace (only a slide gets in)
 * hiding the energy tank ('E'), a bolt cache ('$'), and a 1-UP ('+') too if `oneUp`. The game
 * draws the crawlspace as solid wall, notched at each end, until you're in.
 * `top` is the floor's surface tile ('I' for ice).
 */
export function miniHall(top = '#', underwater = false, oneUp = false, thinIce = false): { a: string[]; b: string[] } {
  const floor = [top.repeat(16), '################'];
  const crawl = oneUp ? '....+.E.$...c...' : '......E.$...c...';
  // Thin ice ('_') over freezing water: the Mammoth's charges crack and break it,
  // and it falls through where it's gone. Solid islands stay to stand on.
  // Thin stretches are five slabs wide (wider than the Mammoth, so it can fall
  // through), between two-slab islands of solid ice for you to stand on.
  const floorA = thinIce ? ['IIIIIIIII_____II', '#########~~~~~##'] : floor;
  const floorB = thinIce ? ['_____II_____II__', '~~~~~##~~~~~##~~'] : floor;
  const a = [...rows(SKY, 11), '..#########.....', crawl, ...floorA];
  const b = [...rows(SKY, 12), '............M...', ...floorB];
  return underwater ? { a: water(a), b: water(b) } : { a, b };
}

/**
 * Small hidden room holding an upgrade capsule ('U'). Goes right of a screen
 * whose right wall is solid; open that wall's bottom two cells with 'F'
 * (fake wall) or '&' (frozen block) to make the way in.
 */
export const SECRET_ROOM: string[] = [
  ...rows('################', 10),
  '.........#######',
  '.........#######',
  '.+..U..$.#######',
  '################',
  '################',
];

/**
 * Two-screen challenge room, two-thirds of the way through a stage: the
 * stage's boss waits at 'A' and takes you into their own game. A checkpoint on
 * the way in; beat the game and you carry on from where they stood. `top` is
 * the floor's surface tile.
 */
export function challengeRoom(top = '#', underwater = false): { a: string[]; b: string[] } {
  const ceil = '################';
  const floor = [top.repeat(16), '################'];
  const a = [ceil, ceil, '...##.......##..', ...rows(SKY, 9), '...c............', ...floor];
  const b = [ceil, ceil, '..##.......##...', ...rows(SKY, 9), '...........A....', ...floor];
  return underwater ? { a: water(a), b: water(b) } : { a, b };
}
