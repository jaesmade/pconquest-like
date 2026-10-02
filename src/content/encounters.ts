import type { Encounter } from '../game/types';

export const ENCOUNTERS: Encounter[] = [
  { id: 'crossing-scouts', mapId: 'mossveil-grove', enemies: ['meowth', 'vulpix', 'squirtle'], enemyLevel: 9, objective: 'defeat', xp: 65, nextId: 'ford-patrol' },
  { id: 'ford-patrol', mapId: 'fernroot-woods', enemies: ['vulpix', 'pikachu', 'bulbasaur'], enemyLevel: 11, objective: 'defeat', xp: 65, nextId: 'ridge-guard' },
  { id: 'ridge-guard', mapId: 'sunshade-thicket', enemies: ['lapras', 'charmander', 'geodude'], enemyLevel: 12, objective: 'defeat', xp: 65, nextId: 'citadel-boss' },
  { id: 'citadel-boss', mapId: 'ancient-heartwood', enemies: ['charmander', 'lapras', 'pikachu'], enemyLevel: 14, objective: 'defeat-and-capture', xp: 65 },
];
