import type { Move, Unit } from '../game/types';
import { megaFormFor } from './species';

type ItemDefinition = {
  description: string;
  teachesMove?: string;
  evolution?: { from: string; into: string };
  abilityUse?: 'capsule' | 'patch';
  periodicHealFraction?: number;
  thresholdHeal?: { atOrBelowHpRatio: number; fraction: number; consume: boolean };
  specialDefenseMultiplier?: number;
  blocksStatusMoves?: boolean;
  special?: { kind: 'attack-boost'; apCost: number; attackMultiplier: number; consume: boolean } | { kind: 'mega-evolve'; apCost: number; consume: false };
};

/** Item names are saved in parties and battles; rename one only with a save migration. */
export const ITEM_DEFINITIONS = {
  None: { description: 'No held item.' },
  'Ability Capsule': {
    description: 'Replace a given ability or unlocked hidden ability with one of three random choices. Use from the Bag. Single use.',
    abilityUse: 'capsule',
  },
  'Ability Patch': {
    description: 'Unlock a Pokémon’s hidden ability so both abilities are active. Use from the Bag. Single use.',
    abilityUse: 'patch',
  },
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
  'Fire Stone': {
    description: 'Use from the route Bag to evolve Vulpix into Ninetales. Single use.',
    evolution: { from: 'vulpix', into: 'ninetales' },
  },
  'TM Swift': {
    description: 'Teach Swift to a compatible Pokémon from the route Bag. Single use.',
    teachesMove: 'swift',
  },
  'TM Thunderbolt': {
    description: 'Teach Thunderbolt to a compatible Pokémon from the route Bag. Single use.',
    teachesMove: 'thunderbolt',
  },
} as const satisfies Record<string, ItemDefinition>;

export type ItemId = keyof typeof ITEM_DEFINITIONS;
export const ITEMS = Object.keys(ITEM_DEFINITIONS) as ItemId[];
export const STARTING_HELD_ITEMS: ItemId[] = ['Leftovers', 'Sitrus Berry', 'None'];
export const STARTING_BAG: ItemId[] = ['Assault Vest', 'X Attack', 'Charizardite X', 'TM Swift', 'Fire Stone', 'Ability Capsule', 'Ability Patch'];

const definitions: Record<string, ItemDefinition> = ITEM_DEFINITIONS;
export const itemFor = (id: string): ItemDefinition | undefined => Object.hasOwn(definitions, id) ? definitions[id] : undefined;
export const tmMoveFor = (id: string): string | undefined => itemFor(id)?.teachesMove;
export const itemEvolutionFor = (id: string) => itemFor(id)?.evolution;
export const abilityItemFor = (id: string) => itemFor(id)?.abilityUse;

export function itemCanEquip(item: string, speciesId: string): boolean {
  const definition = itemFor(item);
  if (!definition) return false;
  if (definition.teachesMove || definition.evolution || definition.abilityUse) return false;
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
