import type { StageExpiry, StatStages, Unit } from './types';

export const MAX_STAGE = 6;
// Move-effect durations use the legacy 100-unit clock; 500 units equal five AV cycles.
export const STAGE_DURATION = 500;
export const STAGE_STATS: (keyof StatStages)[] = ['attack', 'defense', 'specialAttack', 'specialDefense', 'speed'];

export function emptyStages(): StatStages {
  return { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 };
}

export function emptyStageExpiry(): StageExpiry {
  return emptyStages();
}

export function statWithStage(value: number, stage: number): number {
  const capped = Math.max(-MAX_STAGE, Math.min(MAX_STAGE, stage));
  const numerator = capped >= 0 ? 2 + capped : 2;
  const denominator = capped >= 0 ? 2 : 2 - capped;
  return value * numerator / denominator;
}

export function changeStage(unit: Unit, stat: keyof StatStages, delta: number, until: number) {
  const next = Math.max(-MAX_STAGE, Math.min(MAX_STAGE, unit.stages[stat] + delta));
  unit.stages[stat] = next;
  unit.stageUntil[stat] = next === 0 ? 0 : until;
}

export function expireStages(unit: Unit, time: number) {
  for (const stat of STAGE_STATS) if (unit.stages[stat] !== 0 && unit.stageUntil[stat] <= time) {
    unit.stages[stat] = 0;
    unit.stageUntil[stat] = 0;
  }
}
