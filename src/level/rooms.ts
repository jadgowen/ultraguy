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
