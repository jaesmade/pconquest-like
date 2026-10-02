import { ABILITIES } from './abilities';
import { ENCOUNTERS } from './encounters';
import { itemEvolutionFor, itemFor, ITEMS } from './items';
import { ELITE_MAP_ID, MAPS, MAX_MAP_SIZE, NORMAL_MAP_IDS } from './maps';
import { MAX_EQUIPPED_MOVES, MOVES, MOVE_TAGS } from './moves';
import { RECRUITS, SPECIES, STARTERS } from './species';
import { TYPES } from './typeChart';
import { canDeploy, zoneCells } from '../game/deployment';
import { terrainReachable } from '../game/grid';
import { mobilityFor } from '../game/mobility';
import { STARTING_PARTY_POINTS } from './roster';
import { validateMoveEffect } from '../game/moveEffects';

/** Content references are checked once at startup so new packs fail with useful IDs. */
export function validateCatalog(): string[] {
  const errors: string[] = [];
  for (const [id, move] of Object.entries(MOVES)) {
    if (!Array.isArray(move.tags) || move.tags.some(tag => !MOVE_TAGS.includes(tag)) || new Set(move.tags).size !== move.tags.length) errors.push(`Move ${id}: tags must be unique known move tags`);
    if (!TYPES.includes(move.type)) errors.push(`Move ${id}: unknown type ${move.type}`);
    if (!Number.isInteger(move.range) || move.range < 0 || !Number.isInteger(move.power) || move.power < 0 || !Number.isInteger(move.apCost) || move.apCost < 1) errors.push(`Move ${id}: range and power must be nonnegative integers, and AP cost must be a positive integer`);
    if (move.category === 'Status' ? move.power !== 0 : move.power <= 0) errors.push(`Move ${id}: Status moves need zero power and damaging moves need positive power`);
    if (move.category === 'Status' ? move.delivery !== undefined : move.delivery !== 'melee' && move.delivery !== 'ranged') errors.push(`Move ${id}: damaging moves need melee or ranged delivery; Status moves have no attack delivery`);
    if (move.area && (!Number.isInteger(move.area.width) || !Number.isInteger(move.area.height) || move.area.width < 1 || move.area.height < 1)) errors.push(`Move ${id}: area must have positive integer dimensions`);
    for (const effect of move.effects ?? []) for (const message of validateMoveEffect(effect, move)) errors.push(`Move ${id}: ${message}`);
  }
  const formLinks = new Set<string>();
  for (const [id, species] of Object.entries(SPECIES)) {
    if (species.moves.length !== MAX_EQUIPPED_MOVES || new Set(species.moves).size !== MAX_EQUIPPED_MOVES)
      errors.push(`Species ${id}: provide ${MAX_EQUIPPED_MOVES} distinct starting moves`);
    if (species.partyCost !== undefined && (!Number.isInteger(species.partyCost) || species.partyCost < 1 || species.partyCost > STARTING_PARTY_POINTS))
      errors.push(`Species ${id}: party cost must be an integer from 1 to ${STARTING_PARTY_POINTS}`);
    if (!ABILITIES[species.ability]) errors.push(`Species ${id}: unknown ability ${species.ability}`);
    for (const type of species.types) if (!TYPES.includes(type)) errors.push(`Species ${id}: unknown type ${type}`);
    for (const move of [...species.moves, ...Object.values(species.learn), ...(species.tmMoves ?? [])]) if (!MOVES[move]) errors.push(`Species ${id}: unknown move ${move}`);
    if (species.tmMoves && new Set(species.tmMoves).size !== species.tmMoves.length) errors.push(`Species ${id}: duplicate TM move`);
    if (species.evolves && !SPECIES[species.evolves.into]) errors.push(`Species ${id}: unknown evolution ${species.evolves.into}`);
    if (species.evolves && SPECIES[species.evolves.into]?.form) errors.push(`Species ${id}: ordinary evolution cannot target temporary form ${species.evolves.into}`);
    if (species.stats.length !== 7 || species.stats.some(value => !Number.isInteger(value) || value <= 0)) errors.push(`Species ${id}: expected seven positive integer stats`);
    if (species.form?.kind === 'mega') {
      const { from, stone } = species.form, source = SPECIES[from], link = `${from}:${stone}`;
      if (!source || source.form || from === id) errors.push(`Species ${id}: Mega source ${from} must be a normal species`);
      if (!ITEMS.includes(stone) || itemFor(stone)?.special?.kind !== 'mega-evolve') errors.push(`Species ${id}: invalid Mega Stone ${stone}`);
      if (formLinks.has(link)) errors.push(`Species ${id}: duplicate Mega form for ${from} and ${stone}`);
      formLinks.add(link);
    }
  }
  for (const item of ITEMS) {
    const definition = itemFor(item);
    const moveId = definition?.teachesMove;
    if (moveId && !MOVES[moveId]) errors.push(`Item ${item}: unknown TM move ${moveId}`);
    const evolution = itemEvolutionFor(item);
    if (evolution && (!SPECIES[evolution.from] || !SPECIES[evolution.into] || SPECIES[evolution.from]?.form || SPECIES[evolution.into]?.form)) {
      errors.push(`Item ${item}: evolution must reference existing non-temporary species`);
    }
  }
  for (const id of [...STARTERS, ...RECRUITS]) {
    if (!SPECIES[id]) errors.push(`Roster: unknown species ${id}`);
    else if (SPECIES[id].form?.kind === 'mega') errors.push(`Roster: temporary Mega form ${id} cannot be recruited directly`);
  }
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
    const allyCells = zoneCells(map, 'ally'), enemyCells = zoneCells(map, 'enemy');
    const groundRoute = terrainReachable(map, map.playerSpawns[0], { canFly: false, canSwim: false });
    const groundEnemy = enemyCells.find(([x, y]) => map.tiles[y][x].kind === 'plain' && groundRoute.has(`${x},${y}`));
    const profileRoutes = new Map<string, Set<string>>();
    const routeFor = (speciesId: string, origin: [number, number]) => {
      const mobility = mobilityFor(SPECIES[speciesId], map.tiles[origin[1]][origin[0]]);
      const key = `${origin[0]},${origin[1]}:${mobility.canFly}:${mobility.canSwim}`;
      let route = profileRoutes.get(key);
      if (!route) { route = terrainReachable(map, origin, mobility); profileRoutes.set(key, route); }
      return route;
    };
    const hasGroundShore = (x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .some(([dx, dy]) => groundRoute.has(`${x + dx},${y + dy}`));
    const playerForms = new Set([...STARTERS, ...RECRUITS]);
    for (const id of [...playerForms]) {
      let current = SPECIES[id];
      while (current?.evolves && !playerForms.has(current.evolves.into)) {
        playerForms.add(current.evolves.into);
        current = SPECIES[current.evolves.into];
      }
    }
    if (groundEnemy) for (const id of playerForms) {
      if (!SPECIES[id]) continue;
      const route = routeFor(id, groundEnemy);
      for (const [x, y] of allyCells) if (canDeploy(map, id, [x, y], 'ally') && !route.has(`${x},${y}`))
        errors.push(`Encounter ${encounter.id}: ${id} cannot reach the enemy zone from ally deployment ${x},${y}`);
    }
    for (const id of encounter.enemies) if (!SPECIES[id]) errors.push(`Encounter ${encounter.id}: unknown species ${id}`);
    encounter.enemies.forEach((id, index) => {
      const species = SPECIES[id], spawn = map.enemySpawns[index];
      if (!species || !spawn) return;
      const [x, y] = spawn;
      if (!canDeploy(map, id, spawn, 'enemy')) errors.push(`Encounter ${encounter.id}: ${id} cannot occupy enemy spawn ${x},${y}`);
      const route = routeFor(id, map.playerSpawns[0]);
      for (const [cellX, cellY] of enemyCells) {
        if (!canDeploy(map, id, [cellX, cellY], 'enemy')) continue;
        if (!route.has(`${cellX},${cellY}`)) errors.push(`Encounter ${encounter.id}: ${id} cannot reach ally ground from enemy deployment ${cellX},${cellY}`);
        if (map.tiles[cellY][cellX].kind === 'water' && !hasGroundShore(cellX, cellY))
          errors.push(`Encounter ${encounter.id}: deep-water enemy deployment ${cellX},${cellY} has no reachable shore for grounded opponents`);
      }
    });
    const occupied = new Set<string>();
    for (const id of encounter.enemies) {
      const point = zoneCells(map, 'enemy').find(([x, y]) => canDeploy(map, id, [x, y], 'enemy') && !occupied.has(`${x},${y}`));
      if (!point) errors.push(`Encounter ${encounter.id}: no distinct legal enemy-zone tile for ${id}`);
      else occupied.add(point.join(','));
    }
  }
  const eliteMap = MAPS[ELITE_MAP_ID];
  if (!NORMAL_MAP_IDS.length || new Set(NORMAL_MAP_IDS).size !== NORMAL_MAP_IDS.length) errors.push('Normal battles: provide distinct forest map IDs');
  for (const id of NORMAL_MAP_IDS as readonly string[]) {
    const map = MAPS[id];
    if (!map) { errors.push(`Normal battles: unknown map ${id}`); continue; }
    if (id === ELITE_MAP_ID || id === ENCOUNTERS.at(-1)?.mapId) errors.push(`Normal battles: special arena ${id} cannot enter the forest rotation`);
    if (map.enemySpawns.length < Math.max(...ENCOUNTERS.slice(0, -1).map(encounter => encounter.enemies.length)))
      errors.push(`Normal map ${id}: fewer enemy spawns than a normal team needs`);
  }
  if (!eliteMap) errors.push(`Elite battles: unknown map ${ELITE_MAP_ID}`);
  else {
    if (eliteMap.tiles.length !== 16 || eliteMap.tiles.some(row => row.length !== 16)) errors.push(`Elite map ${ELITE_MAP_ID}: expected a 16×16 battlefield`);
    if (eliteMap.enemySpawns.length < Math.max(...ENCOUNTERS.map(encounter => encounter.enemies.length + 1)))
      errors.push(`Elite map ${ELITE_MAP_ID}: fewer enemy spawns than an elite team needs`);
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
