import type { Move } from '../game/types';

export type MoveAssetRole = 'melee' | 'projectile' | 'area' | 'self' | 'hazard' | 'weather';

/** Shared presentation fallback; this never affects move rules or seeded RNG. */
export function moveAssetRole(move?: Move): MoveAssetRole {
  if (!move) return 'melee';
  if (move.effects?.some(effect => effect.kind === 'weather' || effect.kind === 'trick-room')) return 'weather';
  // Secondary tile effects on a damaging move do not replace its hit animation.
  if (move.category !== 'Status') {
    if (move.area) return 'area';
    return move.delivery === 'melee' ? 'melee' : 'projectile';
  }
  if (move.effects?.some(effect => effect.kind === 'tile') || move.tags.includes('hazard')) return 'hazard';
  if (move.area) return 'area';
  return move.target === 'tile' ? 'area' : 'self';
}
