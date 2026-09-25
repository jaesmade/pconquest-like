import type { Species } from '../game/types';

export const SPECIES: Record<string, Species> = {
  bulbasaur: { name: 'Bulbasaur', types: ['Grass'], ability: 'Chlorophyll', stats: [84, 49, 49, 65, 65, 4, 3], moves: ['vineWhip', 'tackle'], learn: { 3: 'harden', 5: 'vineWhip' }, evolves: { level: 4, into: 'ivysaur' } },
  ivysaur: { name: 'Ivysaur', types: ['Grass'], ability: 'Chlorophyll', stats: [106, 62, 63, 80, 80, 5, 3], moves: ['vineWhip', 'tackle'], learn: { 5: 'harden' } },
  squirtle: { name: 'Squirtle', types: ['Water'], mobility: { swim: true }, ability: 'Torrent', stats: [86, 48, 65, 50, 64, 4, 3], moves: ['waterPulse', 'tackle'], learn: { 3: 'harden' }, evolves: { level: 4, into: 'wartortle' } },
  wartortle: { name: 'Wartortle', types: ['Water'], mobility: { swim: true }, ability: 'Torrent', stats: [108, 63, 80, 65, 80, 5, 3], moves: ['waterPulse', 'tackle'], learn: { 4: 'harden' } },
  lapras: { name: 'Lapras', types: ['Ice', 'Water'], mobility: { swim: true }, ability: 'Water Absorb', stats: [120, 62, 65, 68, 80, 3, 2], moves: ['iceShard', 'waterPulse'], learn: { 4: 'harden' } },
  geodude: { name: 'Geodude', types: ['Ground', 'Rock'], ability: 'Sand Veil', stats: [90, 76, 90, 36, 35, 2, 2], moves: ['rockThrow', 'mudSlap'], learn: { 3: 'harden', 4: 'stealthRock', 5: 'sandstorm' } },
  pikachu: { name: 'Pikachu', types: ['Electric'], ability: 'Static', stats: [76, 55, 40, 60, 50, 7, 4], moves: ['thunderShock', 'tackle'], learn: { 3: 'thunderbolt' } },
  meowth: { name: 'Meowth', types: ['Normal'], ability: 'Technician', stats: [78, 45, 40, 40, 40, 6, 4], moves: ['tackle', 'tailWhip'], learn: { 3: 'howl' } },
  vulpix: { name: 'Vulpix', types: ['Fire'], ability: 'Flash Fire', stats: [80, 41, 40, 57, 65, 5, 3], moves: ['ember', 'tackle'], learn: { 3: 'sunnyDay' } },
  charmander: { name: 'Charmander', types: ['Fire'], ability: 'Blaze', stats: [78, 52, 43, 60, 50, 5, 3], moves: ['ember', 'tackle'], learn: { 4: 'sunnyDay' }, mega: { stone: 'Charizardite X', name: 'Mega Charizard', ability: 'Tough Claws', stats: [120, 96, 78, 86, 75, 7, 4], mobility: { fly: true } } },
};

export const STARTERS = ['bulbasaur', 'squirtle', 'lapras', 'geodude', 'pikachu', 'meowth'];
export const RECRUITS = ['vulpix', 'charmander', ...STARTERS];
