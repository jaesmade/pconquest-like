import { ABILITIES } from './abilities';
import { ENCOUNTERS } from './encounters';
import { itemFor, ITEMS } from './items';
import { MAPS, MAX_MAP_SIZE } from './maps';
import { MOVES, MOVE_TAGS } from './moves';
import { RECRUITS, SPECIES, STARTERS } from './species';
import { TYPES } from './typeChart';
import { canDeploy, zoneCells } from '../game/deployment';

/** Content references are checked once at startup so new packs fail with useful IDs. */
export function validateCatalog(): string[] {
  const errors: string[] = [];
  for (const [id, move] of Object.entries(MOVES)) {
    if (!Array.isArray(move.tags) || move.tags.some(tag => !MOVE_TAGS.includes(tag)) || new Set(move.tags).size !== move.tags.length) errors.push(`Move ${id}: tags must be unique known move tags`);
    if (!TYPES.includes(move.type)) errors.push(`Move ${id}: unknown type ${move.type}`);
    if (!Number.isInteger(move.range) || move.range < 0 || !Number.isInteger(move.power) || move.power < 0 || !Number.isInteger(move.apCost) || move.apCost < 1) errors.push(`Move ${id}: range and power must be nonnegative integers, and AP cost must be a positive integer`);
    if (move.category === 'Status' ? move.power !== 0 : move.power <= 0) errors.push(`Move ${id}: Status moves need zero power and damaging moves need positive power`);
    if (move.area && (!Number.isInteger(move.area.width) || !Number.isInteger(move.area.height) || move.area.width < 1 || move.area.height < 1)) errors.push(`Move ${id}: area must have positive integer dimensions`);
    for (const effect of move.effects ?? []) {
      if ('chance' in effect && (!Number.isFinite(effect.chance) || effect.chance < 0 || effect.chance > 1)) errors.push(`Move ${id}: effect chance must be between 0 and 1`);
      if ('duration' in effect && (!Number.isInteger(effect.duration) || effect.duration < 1)) errors.push(`Move ${id}: effect duration must be a positive integer`);
      if (effect.kind === 'chain' && (!Number.isFinite(effect.damageFraction) || effect.damageFraction <= 0)) errors.push(`Move ${id}: chain damage fraction must be positive`);
      if (effect.kind === 'stage' && (!Number.isInteger(effect.delta) || effect.delta === 0)) errors.push(`Move ${id}: stage change must be a nonzero integer`);
      if (effect.kind === 'displace' && (!Number.isInteger(effect.tiles) || effect.tiles < 1)) errors.push(`Move ${id}: displacement must be a positive tile count`);
    }
  }
  for (const [id, species] of Object.entries(SPECIES)) {
    if (!ABILITIES[species.ability]) errors.push(`Species ${id}: unknown ability ${species.ability}`);
    if (species.mega && !ABILITIES[species.mega.ability]) errors.push(`Species ${id}: unknown Mega ability ${species.mega.ability}`);
    for (const type of species.types) if (!TYPES.includes(type)) errors.push(`Species ${id}: unknown type ${type}`);
    for (const move of [...species.moves, ...Object.values(species.learn)]) if (!MOVES[move]) errors.push(`Species ${id}: unknown move ${move}`);
    if (species.evolves && !SPECIES[species.evolves.into]) errors.push(`Species ${id}: unknown evolution ${species.evolves.into}`);
    if (species.mega && (!ITEMS.includes(species.mega.stone) || itemFor(species.mega.stone)?.special?.kind !== 'mega-evolve')) errors.push(`Species ${id}: invalid Mega Stone ${species.mega.stone}`);
    if (species.stats.length !== 7 || species.stats.some(value => !Number.isInteger(value) || value <= 0)) errors.push(`Species ${id}: expected seven positive integer stats`);
    if (species.mega && (species.mega.stats.length !== 7 || species.mega.stats.some(value => !Number.isInteger(value) || value <= 0))) errors.push(`Species ${id}: expected seven positive integer Mega stats`);
  }
  for (const id of [...STARTERS, ...RECRUITS]) if (!SPECIES[id]) errors.push(`Roster: unknown species ${id}`);
  const encounterIds = new Set<string>();
  for (const encounter of ENCOUNTERS) {
    if (encounterIds.has(encounter.id)) errors.push(`Encounter: duplicate ID ${encounter.id}`);
    encounterIds.add(encounter.id);
    if (!encounter.enemies.length) errors.push(`Encounter ${encounter.id}: at least one enemy is required`);
    if (!Number.isInteger(encounter.enemyLevel) || encounter.enemyLevel < 1 || encounter.enemyLevel > 100 || !Number.isInteger(encounter.xp) || encounter.xp < 0) errors.push(`Encounter ${encounter.id}: invalid level or XP`);
    if (encounter.nextId && !ENCOUNTERS.some(next => next.id === encounter.nextId)) errors.push(`Encounter ${encounter.id}: unknown next encounter ${encounter.nextId}`);
    const map = MAPS[encounter.mapId];
    if (!map) { errors.push(`Encounter ${encounter.id}: unknown map ${encounter.mapId}`); continue; }
    if (map.tiles.length > MAX_MAP_SIZE || map.tiles.some(row => row.length > MAX_MAP_SIZE)) errors.push(`Encounter ${encounter.id}: map exceeds ${MAX_MAP_SIZE}×${MAX_MAP_SIZE}`);
    if (!Array.isArray(map.zones) || map.zones.length !== map.tiles.length
      || map.zones.some((row, y) => row.length !== map.tiles[y].length || row.some(zone => !['ally', 'neutral', 'enemy'].includes(zone)))) {
      errors.push(`Encounter ${encounter.id}: zones must cover every map tile exactly once`);
      continue;
    }
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
    const occupied = new Set<string>();
    for (const id of encounter.enemies) {
      const point = zoneCells(map, 'enemy').find(([x, y]) => canDeploy(map, id, [x, y], 'enemy') && !occupied.has(`${x},${y}`));
      if (!point) errors.push(`Encounter ${encounter.id}: no distinct legal enemy-zone tile for ${id}`);
      else occupied.add(point.join(','));
    }
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
