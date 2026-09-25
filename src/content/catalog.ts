import { ABILITIES } from './abilities';
import { ENCOUNTERS } from './encounters';
import { itemFor, ITEMS } from './items';
import { MAPS } from './maps';
import { MOVES } from './moves';
import { RECRUITS, SPECIES, STARTERS } from './species';
import { TYPES } from './typeChart';

/** Content references are checked once at startup so new packs fail with useful IDs. */
export function validateCatalog(): string[] {
  const errors: string[] = [];
  for (const [id, move] of Object.entries(MOVES)) {
    if (!TYPES.includes(move.type)) errors.push(`Move ${id}: unknown type ${move.type}`);
    if (move.range < 0 || move.power < 0 || !Number.isInteger(move.apCost) || move.apCost < 1) errors.push(`Move ${id}: range and power must be nonnegative, and AP cost must be positive`);
    if (move.area && (move.area.width < 1 || move.area.height < 1)) errors.push(`Move ${id}: area must have positive dimensions`);
  }
  for (const [id, species] of Object.entries(SPECIES)) {
    if (!ABILITIES[species.ability]) errors.push(`Species ${id}: unknown ability ${species.ability}`);
    if (species.mega && !ABILITIES[species.mega.ability]) errors.push(`Species ${id}: unknown Mega ability ${species.mega.ability}`);
    for (const type of species.types) if (!TYPES.includes(type)) errors.push(`Species ${id}: unknown type ${type}`);
    for (const move of [...species.moves, ...Object.values(species.learn)]) if (!MOVES[move]) errors.push(`Species ${id}: unknown move ${move}`);
    if (species.evolves && !SPECIES[species.evolves.into]) errors.push(`Species ${id}: unknown evolution ${species.evolves.into}`);
    if (species.mega && (!ITEMS.includes(species.mega.stone) || itemFor(species.mega.stone)?.special?.kind !== 'mega-evolve')) errors.push(`Species ${id}: invalid Mega Stone ${species.mega.stone}`);
    if (species.stats.length !== 7 || species.stats.some(value => !Number.isFinite(value) || value <= 0)) errors.push(`Species ${id}: expected seven positive stats`);
  }
  for (const id of [...STARTERS, ...RECRUITS]) if (!SPECIES[id]) errors.push(`Roster: unknown species ${id}`);
  const encounterIds = new Set<string>();
  for (const encounter of ENCOUNTERS) {
    if (encounterIds.has(encounter.id)) errors.push(`Encounter: duplicate ID ${encounter.id}`);
    encounterIds.add(encounter.id);
    if (!encounter.enemies.length) errors.push(`Encounter ${encounter.id}: at least one enemy is required`);
    if (encounter.enemyLevel < 1 || encounter.xp < 0) errors.push(`Encounter ${encounter.id}: invalid level or XP`);
    if (encounter.nextId && !ENCOUNTERS.some(next => next.id === encounter.nextId)) errors.push(`Encounter ${encounter.id}: unknown next encounter ${encounter.nextId}`);
    const map = MAPS[encounter.mapId];
    if (!map) { errors.push(`Encounter ${encounter.id}: unknown map ${encounter.mapId}`); continue; }
    if (map.playerSpawns.length < 3) errors.push(`Encounter ${encounter.id}: fewer than three player spawns`);
    if (map.enemySpawns.length < encounter.enemies.length) errors.push(`Encounter ${encounter.id}: fewer enemy spawns than enemies`);
    if (encounter.objective === 'defeat-and-capture' && !map.capture) errors.push(`Encounter ${encounter.id}: capture tile required`);
    for (const [x, y] of map.playerSpawns) if (map.tiles[y]?.[x]?.kind === 'water') errors.push(`Encounter ${encounter.id}: player spawn ${x},${y} cannot be deep water for a mixed party`);
    for (const id of encounter.enemies) if (!SPECIES[id]) errors.push(`Encounter ${encounter.id}: unknown species ${id}`);
    encounter.enemies.forEach((id, index) => {
      const species = SPECIES[id], spawn = map.enemySpawns[index];
      if (!species || !spawn) return;
      const [x, y] = spawn;
      const canFly = species.mobility?.fly ?? species.types.includes('Flying');
      const canSwim = species.mobility?.swim ?? species.types.includes('Water');
      if (map.tiles[y]?.[x]?.kind === 'water' && !canFly && !canSwim) errors.push(`Encounter ${encounter.id}: ${id} cannot occupy deep-water spawn ${x},${y}`);
    });
  }
  for (const encounter of ENCOUNTERS) {
    const seen = new Set<string>();
    let current: typeof encounter | undefined = encounter;
    while (current?.nextId) {
      if (seen.has(current.id)) { errors.push(`Encounter ${encounter.id}: route contains a cycle at ${current.id}`); break; }
      seen.add(current.id);
      current = ENCOUNTERS.find(entry => entry.id === current!.nextId);
    }
  }
  return errors;
}
