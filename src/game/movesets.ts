import { MAX_EQUIPPED_MOVES } from '../content/moves';
import type { Species } from './types';

export function eligibleMovesAtLevel(species: Species, level: number): string[] {
  return [...species.moves, ...Object.entries(species.learn)
    .filter(([required]) => Number(required) <= level)
    .sort(([a], [b]) => Number(a) - Number(b)).map(([, move]) => move)];
}

/** Initial loadouts only. Owned equipped slots remain the player's choices. */
export function latestMovesAtLevel(species: Species, level: number): string[] {
  const newest = [...new Set(eligibleMovesAtLevel(species, level).reverse())];
  return newest.slice(0, MAX_EQUIPPED_MOVES).reverse();
}
