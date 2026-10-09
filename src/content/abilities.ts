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
export const ABILITY_IDS = Object.keys(ABILITIES) as AbilityId[];

const definitions: Record<string, AbilityDefinition> = ABILITIES;
export const abilityFor = (id: string): AbilityDefinition | undefined => Object.hasOwn(definitions, id) ? definitions[id] : undefined;
type AbilitySubject = Pick<Unit, 'ability' | 'hiddenAbility'> | string;

/** Given first, then unlocked hidden. A legacy string still denotes one passive. */
export function activeAbilities(subject: AbilitySubject): AbilityId[] {
  const ids = typeof subject === 'string' ? [subject] : [subject.ability, subject.hiddenAbility];
  return [...new Set(ids.filter((id): id is AbilityId => !!id && !!abilityFor(id)))];
}

export function abilitySpeedEffects(unit: AbilitySubject, weather: Weather) {
  return activeAbilities(unit).flatMap(ability => {
    const bonus = abilityFor(ability)?.speed;
    return bonus?.weather === weather ? [{ ability, multiplier: bonus.multiplier }] : [];
  });
}

export function abilitySpeedMultiplier(unit: Unit, weather: Weather): number {
  return abilitySpeedEffects(unit, weather).reduce((value, effect) => value * effect.multiplier, 1);
}

export function abilityDamageEffects(unit: Unit, move: Move) {
  return activeAbilities(unit).flatMap(ability => {
    const multiplier = (abilityFor(ability)?.damage ?? []).reduce((multiplier, bonus) => {
      if (bonus.moveType && bonus.moveType !== move.type) return multiplier;
      if (bonus.maxApCost !== undefined && move.apCost > bonus.maxApCost) return multiplier;
      if (bonus.belowHpRatio !== undefined && unit.hp >= unit.maxHp * bonus.belowHpRatio) return multiplier;
      if (bonus.requiresStatus && !unit.status[bonus.requiresStatus]) return multiplier;
      if (bonus.requiredTag && !hasMoveTag(move, bonus.requiredTag)) return multiplier;
      return multiplier * bonus.multiplier;
    }, 1);
    return multiplier !== 1 ? [{ ability, multiplier }] : [];
  });
}

export function abilityDamageMultiplier(unit: Unit, move: Move): number {
  return abilityDamageEffects(unit, move).reduce((value, effect) => value * effect.multiplier, 1);
}

export function abilityAbsorption(subject: AbilitySubject, moveType: string) {
  for (const ability of activeAbilities(subject)) {
    const absorption = abilityFor(ability)?.absorption;
    if (absorption?.moveType === moveType) return { ...absorption, ability };
  }
  return undefined;
}

export function abilityEvasionEffects(subject: AbilitySubject, weather: Weather) {
  return activeAbilities(subject).flatMap(ability => {
    const evasion = abilityFor(ability)?.evasion;
    return evasion?.weather === weather ? [{ ability, hitChance: evasion.hitChance }] : [];
  });
}

export function abilityHitChance(subject: AbilitySubject, weather: Weather): number {
  return abilityEvasionEffects(subject, weather).reduce((value, effect) => value * effect.hitChance, 1);
}

export function abilityContactReactions(subject: AbilitySubject) {
  return activeAbilities(subject).flatMap(ability => {
    const reaction = abilityFor(ability)?.contactReaction;
    return reaction ? [{ ...reaction, ability }] : [];
  });
}

export const abilityContactReaction = (id: string) => abilityFor(id)?.contactReaction;
