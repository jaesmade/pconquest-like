import type { Encounter } from '../game/types';

export const ENCOUNTERS: Encounter[] = [
  { id: 'crossing-scouts', mapId: 'verdant-crossing', enemies: ['geodude', 'meowth', 'squirtle'], enemyLevel: 2, objective: 'defeat', xp: 65, nextId: 'ford-patrol' },
  { id: 'ford-patrol', mapId: 'cinder-ford', enemies: ['vulpix', 'pikachu', 'bulbasaur'], enemyLevel: 3, objective: 'defeat', xp: 65, nextId: 'ridge-guard' },
  { id: 'ridge-guard', mapId: 'storm-ridge', enemies: ['lapras', 'charmander', 'geodude'], enemyLevel: 4, objective: 'defeat', xp: 65, nextId: 'citadel-boss' },
  { id: 'citadel-boss', mapId: 'crown-citadel', enemies: ['charmander', 'lapras', 'pikachu'], enemyLevel: 5, objective: 'defeat-and-capture', xp: 65 },
];
