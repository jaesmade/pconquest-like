import { random } from './rng';
import type { BattleCategory, Encounter, EncounterEnemy, EncounterTemplate, EnemyRank, Unit } from './types';

export const ENEMY_RANKS = ['normal', 'elite', 'boss'] as const;
export const RANK_MULTIPLIERS: Record<EnemyRank, number> = { normal: 1, elite: 2, boss: 3 };
export const RANK_LABELS: Record<EnemyRank, string> = { normal: 'Normal', elite: 'Elite', boss: 'Boss' };
export const COMPOSITION_LEVELS = { minimum: 9, maximum: 21 } as const;
export const MAX_ENEMIES = 8;

/** Intrinsic stats: apply once to level-derived values, leaving Movement alone. */
export function rankedStats(stats: Unit['stats'], rank: EnemyRank): Unit['stats'] {
  return stats.map((value, index) => index === 6 ? value : value * RANK_MULTIPLIERS[rank]) as Unit['stats'];
}

export function enemyCounts(category: BattleCategory, level: number): Record<EnemyRank, number> {
  const progress = Math.max(0, Math.min(1, (level - COMPOSITION_LEVELS.minimum) / (COMPOSITION_LEVELS.maximum - COMPOSITION_LEVELS.minimum)));
  if (category === 'boss') return { boss: 1, elite: Math.floor(2 * progress), normal: 2 + Math.floor(3 * progress) };
  if (category === 'elite') return { boss: 0, elite: 1 + Math.floor(2 * progress), normal: 3 + Math.floor(2 * progress) };
  return { boss: 0, elite: 0, normal: 3 + Math.floor(5 * progress) };
}

/** Independent stream: previews and reloads never advance run/combat RNG. */
export function resolveEnemyEncounter(template: EncounterTemplate, category: BattleCategory, level: number, seed: number, nodeId: string): Encounter {
  let hash = seed >>> 0;
  for (const character of `${nodeId}:${category}:${level}:${template.id}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  const rng = { rngState: hash }, counts = enemyCounts(category, level), enemies: EncounterEnemy[] = [];
  if (counts.boss) {
    if (!template.bossSpecies) throw new Error(`Encounter ${template.id}: missing Boss species.`);
    enemies.push({ species: template.bossSpecies, rank: 'boss' });
  }
  for (const rank of ['elite', 'normal'] as const) {
    const pool = rank === 'elite' ? template.elitePool : template.normalPool;
    if (counts[rank] && !pool.length) throw new Error(`Encounter ${template.id}: empty ${rank} pool.`);
    let remaining: string[] = [];
    for (let index = 0; index < counts[rank]; index++) {
      if (!remaining.length) remaining = [...pool];
      const chosen = Math.floor(random(rng) * remaining.length);
      enemies.push({ species: remaining.splice(chosen, 1)[0], rank });
    }
  }
  return { id: template.id, mapId: template.mapId, enemyLevel: level, objective: template.objective, xp: template.xp, nextId: template.nextId, enemies };
}

export function enemyRankSummary(enemies: EncounterEnemy[]): string {
  return ENEMY_RANKS.map(rank => {
    const count = enemies.filter(enemy => enemy.rank === rank).length;
    return count ? `${count} ${RANK_LABELS[rank]}` : '';
  }).filter(Boolean).join(' · ');
}
