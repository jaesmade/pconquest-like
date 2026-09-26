import type { Species } from '../game/types';

export const SPECIES: Record<string, Species> = {
  bulbasaur: { name: 'Bulbasaur', types: ['Grass'], ability: 'Chlorophyll', stats: [60, 49, 49, 65, 65, 4, 3], moves: ['vineWhip', 'tackle'], learn: { 11: 'harden' }, evolves: { level: 12, into: 'ivysaur' } },
  ivysaur: { name: 'Ivysaur', types: ['Grass'], ability: 'Chlorophyll', stats: [76, 62, 63, 80, 80, 5, 3], moves: ['vineWhip', 'tackle'], learn: { 11: 'harden' } },
  squirtle: { name: 'Squirtle', types: ['Water'], mobility: { swim: true }, ability: 'Torrent', stats: [62, 48, 65, 50, 64, 4, 3], moves: ['waterPulse', 'tackle'], learn: { 11: 'harden' }, evolves: { level: 12, into: 'wartortle' } },
  wartortle: { name: 'Wartortle', types: ['Water'], mobility: { swim: true }, ability: 'Torrent', stats: [78, 63, 80, 65, 80, 5, 3], moves: ['waterPulse', 'tackle'], learn: { 11: 'harden' } },
  lapras: { name: 'Lapras', types: ['Ice', 'Water'], mobility: { swim: true }, ability: 'Water Absorb', stats: [78, 62, 65, 68, 80, 3, 2], moves: ['iceShard', 'waterPulse'], learn: { 12: 'harden' } },
  geodude: { name: 'Geodude', types: ['Ground', 'Rock'], ability: 'Sand Veil', stats: [62, 76, 90, 36, 35, 2, 2], moves: ['rockThrow', 'mudSlap'], learn: { 11: 'harden', 12: 'stealthRock', 13: 'sandstorm' } },
  pikachu: { name: 'Pikachu', types: ['Electric'], ability: 'Static', stats: [52, 55, 40, 60, 50, 7, 4], moves: ['thunderShock', 'tackle'], learn: { 11: 'thunderbolt' } },
  meowth: { name: 'Meowth', types: ['Normal'], ability: 'Technician', stats: [58, 45, 40, 40, 40, 6, 4], moves: ['tackle', 'tailWhip'], learn: { 11: 'howl' } },
  vulpix: { name: 'Vulpix', types: ['Fire'], ability: 'Flash Fire', stats: [56, 41, 40, 57, 65, 5, 3], moves: ['ember', 'tackle'], learn: { 12: 'sunnyDay' } },
  charmander: { name: 'Charmander', types: ['Fire'], ability: 'Blaze', stats: [58, 52, 43, 60, 50, 5, 3], moves: ['ember', 'tackle'], learn: { 12: 'sunnyDay' } },
  'charizard-mega-x': { name: 'Mega Charizard', types: ['Fire'], mobility: { fly: true }, ability: 'Tough Claws', stats: [90, 96, 78, 86, 75, 7, 4], moves: ['ember', 'tackle'], learn: { 12: 'sunnyDay' }, form: { kind: 'mega', from: 'charmander', stone: 'Charizardite X' } },
};

const megaForms = new Map<string, string>();
for (const [id, species] of Object.entries(SPECIES)) if (species.form?.kind === 'mega') megaForms.set(`${species.form.from}:${species.form.stone}`, id);
export function megaFormFor(speciesId: string, stone: string): { id: string; species: Species } | undefined {
  const id = megaForms.get(`${speciesId}:${stone}`);
  return id ? { id, species: SPECIES[id] } : undefined;
}

export const STARTERS = ['bulbasaur', 'squirtle', 'lapras', 'geodude', 'pikachu', 'meowth'];
export const RECRUITS = ['vulpix', 'charmander', ...STARTERS];
