import type { StageExpiry, StatStages, Unit } from './types';

export const MAX_STAGE = 3;
export const STAGE_DURATION = 200;
export const STAGE_STATS: (keyof StatStages)[] = ['attack', 'defense', 'specialAttack', 'specialDefense'];

export function emptyStageExpiry(): StageExpiry {
  return { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0 };
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
