import manifest from '../../public/assets/animations/animation-manifest.json';
import type { GridPoint, Unit } from '../game/types';

export type UnitClip = keyof typeof manifest.unitSets.placeholder.clips;
type UnitSet = { facingRows: number[]; normal?: string | null; clips: Record<UnitClip, { url: string; frameWidth: number; frameHeight: number; frames: number; rows: number; fps: number; impactFrame?: number; loop: boolean }> };

const unitIds: Record<string, string> = manifest.units;
const unitSets: Record<string, UnitSet> = manifest.unitSets;

export function unitSetId(species: string): string {
  return unitIds[species] ?? unitIds[manifest.fallbackUnit];
}

export function unitSet(speciesOrSet: string): UnitSet {
  return unitSets[speciesOrSet] ?? unitSets[unitSetId(speciesOrSet)];
}

export function unitTextureKey(setId: string, clip: UnitClip): string {
  return `unit-${setId}-${clip}`;
}

export function unitAnimationKey(species: string, facing: number, clip: UnitClip): string {
  const set = unitSet(species);
  const spec = set.clips[clip];
  const row = spec.rows === 1 ? 0 : set.facingRows[facing] ?? set.facingRows[0];
  return `${unitTextureKey(unitSetId(species), clip)}-${row}`;
}

export function facingBetween(from: GridPoint, to: GridPoint, fallback: number): number {
  return to[0] > from[0] ? 2 : to[0] < from[0] ? 1 : to[1] < from[1] ? 3 : to[1] > from[1] ? 0 : fallback;
}

export function impactDelay(species: string, clip: UnitClip, fast: boolean): number {
  if (fast) return 50;
  const spec = unitSet(species).clips[clip];
  return spec.impactFrame === undefined ? 100 : Math.round(spec.impactFrame * 1000 / spec.fps);
}

export function restingClip(unit: Unit, time: number): UnitClip {
  return unit.status.sleep > time || unit.status.asleep > time || unit.status.paralyzed > time ? 'sleep' : 'idle';
}

export function visualClip(visual?: string): UnitClip | undefined {
  if (visual === 'move') return 'walk';
  if (visual === 'hurt' || visual === 'faint') return 'hurt';
  if (visual === 'buff' || visual === 'debuff' || visual === 'special') return 'charge';
  return undefined;
}
