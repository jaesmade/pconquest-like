import { MOVES } from '../content/moves';
import type { AttackVisualEvent } from '../game/types';

/** Only presentation cues live here. Combat outcomes and the action log are never discarded. */
export const MAX_PENDING_ATTACKS = 3;

const isWeather = (event: AttackVisualEvent) => MOVES[event.moveId]?.tags.includes('weather') ?? false;
const isCosmetic = (event: AttackVisualEvent) => event.targetIds.length === 0;

export function enqueueAttackCues(pending: AttackVisualEvent[], incoming: AttackVisualEvent[]) {
  const queue = [...pending];
  let skipped = 0;
  for (const event of incoming) {
    // An earlier weather cue is stale once a later weather action is committed.
    if (isWeather(event)) {
      for (let index = queue.length - 1; index >= 0; index--) {
        if (isWeather(queue[index])) { queue.splice(index, 1); skipped++; }
      }
    } else if (isCosmetic(event)) {
      for (let index = queue.length - 1; index >= 0; index--) {
        const old = queue[index];
        if (isCosmetic(old) && old.sourceId === event.sourceId && old.moveId === event.moveId
          && old.to[0] === event.to[0] && old.to[1] === event.to[1]) {
          queue.splice(index, 1); skipped++;
        }
      }
    }
    queue.push(event);
    while (queue.length > MAX_PENDING_ATTACKS) {
      const cosmetic = queue.findIndex(isCosmetic);
      queue.splice(cosmetic < 0 ? 0 : cosmetic, 1);
      skipped++;
    }
  }
  return { queue, skipped };
}
