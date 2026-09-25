import type { Mobility, MobilityState, Species, Tile, Unit } from './types';

/** Capability is defined by species/form; state describes how the unit occupies its current tile. */
export function mobilityFor(species: Species, tile: Tile): Mobility {
  const canFly = species.mobility?.fly ?? species.types.includes('Flying');
  const canSwim = species.mobility?.swim ?? species.types.includes('Water');
  return { canFly, canSwim, state: mobilityState(canFly, canSwim, tile) };
}

export function mobilityState(canFly: boolean, canSwim: boolean, tile: Tile): MobilityState {
  if (canFly) return 'flying';
  return tile.kind === 'water' && canSwim ? 'swimming' : 'grounded';
}

export function syncMobility(unit: Unit, tile: Tile): void {
  unit.mobility.state = mobilityState(unit.mobility.canFly, unit.mobility.canSwim, tile);
}
