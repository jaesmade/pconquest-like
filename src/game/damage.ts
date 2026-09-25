import { abilityAbsorption, abilityDamageMultiplier, effectiveness, itemSpecialDefenseMultiplier } from '../content/data';
import type { Battle, Move, StatStages, Unit } from './types';

export type DamageRoll = { critical: boolean; randomPercent: number };
export type DamageRange = { min: number; max: number; critMin: number; critMax: number; type: number; damage: number; crit: number };

// Modern Pokémon damage uses 4096-based modifiers, with exact half values rounded down.
function modify(value: number, multiplier: number): number {
  const fixed = Math.floor(multiplier * 4096);
  return Math.floor((Math.floor(value * fixed) + 2047) / 4096);
}

function stagedStat(unit: Unit, stat: keyof StatStages, index: number, critical: boolean, offensive: boolean): number {
  const stage = Math.max(-6, Math.min(6, unit.stages[stat] ?? 0));
  const effective = critical && ((offensive && stage < 0) || (!offensive && stage > 0)) ? 0 : stage;
  const numerator = effective >= 0 ? 2 + effective : 2;
  const denominator = effective >= 0 ? 2 : 2 - effective;
  return Math.max(1, Math.floor(unit.stats[index] * numerator / denominator));
}

function attackStat(source: Unit, move: Move, critical: boolean): number {
  if (move.category === 'Special') return stagedStat(source, 'specialAttack', 3, critical, true);
  return Math.max(1, modify(stagedStat(source, 'attack', 1, critical, true), source.itemAttackMultiplier));
}

function defenseStat(target: Unit, move: Move, battle: Battle, critical: boolean): number {
  if (move.category === 'Special') {
    let value = stagedStat(target, 'specialDefense', 4, critical, false);
    if (battle.weather === 'sandstorm' && target.types.includes('Rock')) value = modify(value, 1.5);
    return Math.max(1, modify(value, itemSpecialDefenseMultiplier(target)));
  }
  let value = stagedStat(target, 'defense', 2, critical, false);
  if (battle.weather === 'snow' && target.types.includes('Ice')) value = modify(value, 1.5);
  return Math.max(1, value);
}

function applyType(value: number, multiplier: number): number {
  if (multiplier > 1) return value * multiplier;
  if (multiplier < 1) {
    for (let resistance = multiplier; resistance < 1; resistance *= 2) value = Math.floor(value / 2);
  }
  return value;
}

/** Pure damage calculation: callers supply the critical result and one of 85–100 random rolls. */
export function calculateDamage(battle: Battle, source: Unit, target: Unit, move: Move, roll: DamageRoll): number {
  const type = effectiveness(move.type, target.types);
  if (move.category === 'Status' || move.power <= 0 || type === 0 || abilityAbsorption(target.ability, move.type)) return 0;
  const power = Math.max(1, modify(move.power, abilityDamageMultiplier(source, move)));
  const attack = attackStat(source, move, roll.critical);
  const defense = defenseStat(target, move, battle, roll.critical);
  const levelFactor = Math.floor(2 * source.level / 5 + 2);
  let damage = Math.floor(Math.floor(levelFactor * power * attack / defense) / 50) + 2;

  if (battle.weather === 'sun' || battle.weather === 'rain') {
    const boosted = battle.weather === 'sun' ? 'Fire' : 'Water';
    const weakened = battle.weather === 'sun' ? 'Water' : 'Fire';
    if (move.type === boosted) damage = modify(damage, 1.5);
    if (move.type === weakened) damage = modify(damage, 0.5);
  }
  if (roll.critical) damage = Math.floor(damage * 1.5);
  damage = Math.floor(damage * Math.max(85, Math.min(100, Math.floor(roll.randomPercent))) / 100);
  if (source.types.includes(move.type)) damage = modify(damage, 1.5);
  damage = applyType(damage, type);
  if (move.category === 'Physical' && source.status.burned > battle.time) damage = modify(damage, 0.5);
  return Math.max(1, damage);
}

/** No RNG is consumed by previews; the AI and UI see the same possible results as combat. */
export function damageRange(battle: Battle, source: Unit, target: Unit, move: Move): DamageRange {
  const type = effectiveness(move.type, target.types);
  const min = calculateDamage(battle, source, target, move, { critical: false, randomPercent: 85 });
  const max = calculateDamage(battle, source, target, move, { critical: false, randomPercent: 100 });
  const critMin = calculateDamage(battle, source, target, move, { critical: true, randomPercent: 85 });
  const critMax = calculateDamage(battle, source, target, move, { critical: true, randomPercent: 100 });
  return { min, max, critMin, critMax, type, damage: Math.round((min + max) / 2), crit: critMax };
}
