import type { Move, Unit } from '../game/types';
import { megaFormFor } from './species';

type ItemDefinition = {
  description: string;
  periodicHealFraction?: number;
  thresholdHeal?: { atOrBelowHpRatio: number; fraction: number; consume: boolean };
  specialDefenseMultiplier?: number;
  blocksStatusMoves?: boolean;
  special?: { kind: 'attack-boost'; apCost: number; attackMultiplier: number; consume: boolean } | { kind: 'mega-evolve'; apCost: number; consume: false };
};

/** Item names are saved in parties and battles; rename one only with a save migration. */
export const ITEM_DEFINITIONS = {
  None: { description: 'No held item.' },
  Leftovers: {
    description: 'Restores 1/16 maximum HP at each battle-time tick.',
    periodicHealFraction: 1 / 16,
  },
  'Sitrus Berry': {
    description: 'Restores 1/4 maximum HP after taking damage at half HP or less. Consumed on use.',
    thresholdHeal: { atOrBelowHpRatio: 0.5, fraction: 0.25, consume: true },
  },
  'Assault Vest': {
    description: 'Raises Special Defense by 50%, but prevents Status moves.',
    specialDefenseMultiplier: 1.5,
    blocksStatusMoves: true,
  },
  'X Attack': {
    description: 'Spend 2 AP with Special to double Attack for this battle. Consumed on use.',
    special: { kind: 'attack-boost', apCost: 2, attackMultiplier: 2, consume: true },
  },
  'Charizardite X': {
    description: 'Spend 3 AP with Special to Mega Evolve a compatible Pokémon once per battle.',
    special: { kind: 'mega-evolve', apCost: 3, consume: false },
  },
} as const satisfies Record<string, ItemDefinition>;

export type ItemId = keyof typeof ITEM_DEFINITIONS;
export const ITEMS = Object.keys(ITEM_DEFINITIONS) as ItemId[];
export const STARTING_HELD_ITEMS: ItemId[] = ['Leftovers', 'Sitrus Berry', 'None'];
export const STARTING_BAG: ItemId[] = ['Assault Vest', 'X Attack', 'Charizardite X'];

const definitions: Record<string, ItemDefinition> = ITEM_DEFINITIONS;
export const itemFor = (id: string): ItemDefinition | undefined => definitions[id];

export function itemCanEquip(item: string, speciesId: string): boolean {
  const definition = itemFor(item);
  if (!definition) return false;
  return definition.special?.kind !== 'mega-evolve' || !!megaFormFor(speciesId, item);
}

export function itemPeriodicHeal(unit: Unit): number {
  return itemFor(unit.item)?.periodicHealFraction ?? 0;
}

export function itemThresholdHeal(unit: Unit) {
  const effect = itemFor(unit.item)?.thresholdHeal;
  return effect && unit.hp > 0 && unit.hp <= unit.maxHp * effect.atOrBelowHpRatio ? effect : undefined;
}

export function itemSpecialDefenseMultiplier(unit: Unit): number {
  return itemFor(unit.item)?.specialDefenseMultiplier ?? 1;
}

export function itemBlocksMove(unit: Unit, move: Move): boolean {
  return !!itemFor(unit.item)?.blocksStatusMoves && move.category === 'Status';
}

export function itemSpecial(unit: Unit) {
  const special = itemFor(unit.item)?.special;
  if (!special || unit.ap < special.apCost) return undefined;
  if (special.kind === 'mega-evolve' && !megaFormFor(unit.species, unit.item)) return undefined;
  return special;
}
