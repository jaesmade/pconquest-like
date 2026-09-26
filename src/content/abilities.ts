import type { Move, MoveTag, Unit, Weather } from '../game/types';
import { hasMoveTag } from './moves';

type DamageBonus = {
  multiplier: number;
  moveType?: string;
  maxApCost?: number;
  belowHpRatio?: number;
  requiresStatus?: string;
  requiredTag?: MoveTag;
};

type AbilityDefinition = {
  description: string;
  speed?: { weather: Weather; multiplier: number };
  damage?: DamageBonus[];
  absorption?: { moveType: string; kind: 'heal' | 'charge'; healFraction?: number; status?: string };
  evasion?: { weather: Weather; hitChance: number };
  contactReaction?: { status: string; chance: number; duration: number };
};

/** Stable ability names are saved with battle units. Rename one only with a save migration. */
export const ABILITIES = {
  Chlorophyll: {
    description: 'Doubles Speed in sun.',
    speed: { weather: 'sun', multiplier: 2 },
  },
  Torrent: {
    description: 'Water attacks deal 50% more damage below half HP.',
    damage: [{ moveType: 'Water', belowHpRatio: 0.5, multiplier: 1.5 }],
  },
  'Water Absorb': {
    description: 'Water attacks heal this Pokémon for one quarter of its maximum HP.',
    absorption: { moveType: 'Water', kind: 'heal', healFraction: 0.25 },
  },
  'Sand Veil': {
    description: 'Attacks have an 80% chance to hit this Pokémon in sandstorm.',
    evasion: { weather: 'sandstorm', hitChance: 0.8 },
  },
  Static: {
    description: 'A contact attacker has a 30% chance to become paralyzed.',
    contactReaction: { status: 'paralyzed', chance: 0.3, duration: 200 },
  },
  Technician: {
    description: 'Damaging moves costing at most 2 AP deal 50% more damage.',
    damage: [{ maxApCost: 2, multiplier: 1.5 }],
  },
  'Flash Fire': {
    description: 'Absorbs Fire attacks, then deals 50% more Fire damage.',
    absorption: { moveType: 'Fire', kind: 'charge', status: 'flashFire' },
    damage: [{ moveType: 'Fire', requiresStatus: 'flashFire', multiplier: 1.5 }],
  },
  Blaze: {
    description: 'Fire attacks deal 50% more damage below half HP.',
    damage: [{ moveType: 'Fire', belowHpRatio: 0.5, multiplier: 1.5 }],
  },
  'Tough Claws': {
    description: 'Contact attacks deal 30% more damage.',
    damage: [{ requiredTag: 'contact', multiplier: 1.3 }],
  },
} as const satisfies Record<string, AbilityDefinition>;

export type AbilityId = keyof typeof ABILITIES;

const definitions: Record<string, AbilityDefinition> = ABILITIES;
export const abilityFor = (id: string): AbilityDefinition | undefined => definitions[id];

export function abilitySpeedMultiplier(unit: Unit, weather: Weather): number {
  const bonus = abilityFor(unit.ability)?.speed;
  return bonus && bonus.weather === weather ? bonus.multiplier : 1;
}

export function abilityDamageMultiplier(unit: Unit, move: Move): number {
  return (abilityFor(unit.ability)?.damage ?? []).reduce((multiplier, bonus) => {
    if (bonus.moveType && bonus.moveType !== move.type) return multiplier;
    if (bonus.maxApCost !== undefined && move.apCost > bonus.maxApCost) return multiplier;
    if (bonus.belowHpRatio !== undefined && unit.hp >= unit.maxHp * bonus.belowHpRatio) return multiplier;
    if (bonus.requiresStatus && !unit.status[bonus.requiresStatus]) return multiplier;
    if (bonus.requiredTag && !hasMoveTag(move, bonus.requiredTag)) return multiplier;
    return multiplier * bonus.multiplier;
  }, 1);
}

export function abilityAbsorption(id: string, moveType: string) {
  const absorption = abilityFor(id)?.absorption;
  return absorption?.moveType === moveType ? absorption : undefined;
}

export function abilityHitChance(id: string, weather: Weather): number {
  const evasion = abilityFor(id)?.evasion;
  return evasion?.weather === weather ? evasion.hitChance : 1;
}

export const abilityContactReaction = (id: string) => abilityFor(id)?.contactReaction;
