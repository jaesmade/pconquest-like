import { SPECIES } from './species';

export const STARTING_PARTY_POINTS = 6;
export const MAX_RUN_POKEMON = 20;
export const DEFAULT_PARTY_COST = 2;

/** Content may set a higher or lower draft cost; standard Pokémon cost two points. */
export function partyCost(speciesId: string): number {
  return SPECIES[speciesId]?.partyCost ?? DEFAULT_PARTY_COST;
}

export function partyDraftCost(speciesIds: string[]): number {
  return speciesIds.reduce((total, speciesId) => total + partyCost(speciesId), 0);
}
