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
  // Thin ice ('_') over freezing water: the miniboss's charges crack and break it.
  // Solid footholds stay (one under the miniboss), so there's always somewhere to stand.
  const floorA = thinIce ? ['IIIIIIIIIIII__I_', '############~~#~'] : floor;
  const floorB = thinIce ? ['__II___II__III__', '~~##~~~##~~###~~'] : floor;
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
