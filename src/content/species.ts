import type { Species } from '../game/types';

export const SPECIES: Record<string, Species> = {
  bulbasaur: { name: 'Bulbasaur', types: ['Grass'], ability: 'Chlorophyll', hiddenAbility: 'Technician', stats: [60, 49, 49, 65, 65, 45, 3], moves: ['vineWhip', 'tackle', 'razorLeaf', 'tailWhip'], learn: { 11: 'harden' }, tmMoves: ['swift'], evolves: { level: 12, into: 'ivysaur' } },
  ivysaur: { name: 'Ivysaur', types: ['Grass'], ability: 'Chlorophyll', hiddenAbility: 'Technician', stats: [76, 62, 63, 80, 80, 60, 3], moves: ['vineWhip', 'tackle', 'razorLeaf', 'tailWhip'], learn: { 11: 'harden' }, tmMoves: ['swift'] },
  squirtle: { name: 'Squirtle', types: ['Water'], mobility: { swim: true }, ability: 'Torrent', hiddenAbility: 'Water Absorb', stats: [62, 48, 65, 50, 64, 43, 3], moves: ['waterPulse', 'tackle', 'bubble', 'tailWhip'], learn: { 11: 'harden' }, tmMoves: ['swift'], evolves: { level: 12, into: 'wartortle' } },
  wartortle: { name: 'Wartortle', types: ['Water'], mobility: { swim: true }, ability: 'Torrent', hiddenAbility: 'Water Absorb', stats: [78, 63, 80, 65, 80, 58, 3], moves: ['waterPulse', 'tackle', 'bubble', 'tailWhip'], learn: { 11: 'harden' }, tmMoves: ['swift'] },
  lapras: { name: 'Lapras', types: ['Ice', 'Water'], mobility: { swim: true }, ability: 'Water Absorb', hiddenAbility: 'Torrent', stats: [78, 62, 65, 68, 80, 60, 2], moves: ['iceShard', 'waterPulse', 'bubble', 'tackle'], learn: { 12: 'harden', 14: 'trickRoom' }, tmMoves: ['swift', 'thunderbolt'] },
  geodude: { name: 'Geodude', types: ['Ground', 'Rock'], ability: 'Sand Veil', hiddenAbility: 'Tough Claws', stats: [62, 76, 90, 36, 35, 20, 2], moves: ['rockThrow', 'mudSlap', 'rockSmash', 'tackle'], learn: { 11: 'harden', 12: 'stealthRock', 13: 'sandstorm' }, tmMoves: ['swift'] },
  pikachu: { name: 'Pikachu', types: ['Electric'], ability: 'Static', hiddenAbility: 'Technician', stats: [52, 55, 40, 60, 50, 90, 4], moves: ['thunderShock', 'tackle', 'quickAttack', 'tailWhip'], learn: { 11: 'thunderbolt' }, tmMoves: ['swift', 'thunderbolt'] },
  meowth: { name: 'Meowth', types: ['Normal'], ability: 'Technician', hiddenAbility: 'Tough Claws', stats: [58, 45, 40, 40, 40, 90, 4], moves: ['tackle', 'tailWhip', 'scratch', 'quickAttack'], learn: { 11: 'howl' }, tmMoves: ['swift'] },
  vulpix: { name: 'Vulpix', types: ['Fire'], ability: 'Flash Fire', hiddenAbility: 'Blaze', stats: [56, 41, 40, 57, 65, 65, 3], moves: ['ember', 'tackle', 'quickAttack', 'tailWhip'], learn: { 12: 'sunnyDay' }, tmMoves: ['swift'] },
  ninetales: { name: 'Ninetales', types: ['Fire'], ability: 'Flash Fire', hiddenAbility: 'Blaze', stats: [73, 76, 75, 81, 100, 100, 3], moves: ['ember', 'tackle', 'quickAttack', 'tailWhip'], learn: { 12: 'sunnyDay' }, tmMoves: ['swift'] },
  charmander: { name: 'Charmander', types: ['Fire'], ability: 'Blaze', hiddenAbility: 'Flash Fire', stats: [58, 52, 43, 60, 50, 65, 3], moves: ['ember', 'tackle', 'scratch', 'quickAttack'], learn: { 12: 'sunnyDay' }, tmMoves: ['swift'] },
  'charizard-mega-x': { name: 'Mega Charizard', types: ['Fire'], mobility: { fly: true }, ability: 'Tough Claws', hiddenAbility: 'Blaze', stats: [90, 96, 78, 86, 75, 100, 4], moves: ['ember', 'tackle', 'scratch', 'quickAttack'], learn: { 12: 'sunnyDay' }, tmMoves: ['swift'], form: { kind: 'mega', from: 'charmander', stone: 'Charizardite X' } },
};

const megaForms = new Map<string, string>();
for (const [id, species] of Object.entries(SPECIES)) if (species.form?.kind === 'mega') megaForms.set(`${species.form.from}:${species.form.stone}`, id);
export function megaFormFor(speciesId: string, stone: string): { id: string; species: Species } | undefined {
  const id = megaForms.get(`${speciesId}:${stone}`);
  return id ? { id, species: SPECIES[id] } : undefined;
}

export const STARTERS = ['bulbasaur', 'squirtle', 'lapras', 'geodude', 'pikachu', 'meowth'];
export const RECRUITS = ['vulpix', 'charmander', ...STARTERS];
