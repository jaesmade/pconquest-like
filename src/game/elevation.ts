import type { Tile } from './types';

/** A slope belongs to the higher tile and faces its one-level-lower neighbor. */
export function canCrossElevation(from: Tile, to: Tile, dx: number, dy: number, canFly: boolean): boolean {
  if (canFly || from.height === to.height) return true;
  if (Math.abs(from.height - to.height) !== 1) return false;
  const high = from.height > to.height ? from : to;
  const towardLowX = from.height > to.height ? dx : -dx;
  const towardLowY = from.height > to.height ? dy : -dy;
  const edge = towardLowX < 0 ? 'west' : towardLowX > 0 ? 'east' : towardLowY < 0 ? 'north' : 'south';
  return high.slope === edge;
}
