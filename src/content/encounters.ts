import type { EncounterTemplate } from '../game/types';

export const ENCOUNTERS: EncounterTemplate[] = [
  { id: 'crossing-scouts', kind: 'normal', mapId: 'mossveil-grove', normalPool: ['meowth', 'vulpix', 'squirtle'], elitePool: ['meowth', 'vulpix', 'squirtle'], enemyLevel: 9, objective: 'defeat', xp: 65, nextId: 'ford-patrol' },
  { id: 'ford-patrol', kind: 'normal', mapId: 'fernroot-woods', normalPool: ['vulpix', 'pikachu', 'bulbasaur'], elitePool: ['vulpix', 'pikachu', 'bulbasaur'], enemyLevel: 11, objective: 'defeat', xp: 65, nextId: 'ridge-guard' },
  { id: 'ridge-guard', kind: 'normal', mapId: 'sunshade-thicket', normalPool: ['lapras', 'charmander', 'geodude'], elitePool: ['lapras', 'charmander', 'geodude'], enemyLevel: 12, objective: 'defeat', xp: 65, nextId: 'citadel-boss' },
  { id: 'citadel-boss', kind: 'boss', mapId: 'ancient-heartwood', bossSpecies: 'charmander', normalPool: ['lapras', 'geodude', 'pikachu'], elitePool: ['geodude', 'pikachu'], enemyLevel: 21, objective: 'defeat-and-capture', xp: 100 },
];
