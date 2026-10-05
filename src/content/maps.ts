import type { BattleMap, DeploymentZone, GridPoint, SlopeDirection, TerrainObjectId, Tile, Weather } from '../game/types';
import { objectBlocksMovement } from './terrainObjects';
import { canTraverseTerrain, terrainReachable } from '../game/grid';

type MapSource = {
  id: string;
  name: string;
  weather: Weather;
  terrain: string[];
  elevation: string[];
  slopes?: string[];
  objects?: string[];
  surfaces?: string[];
  zones: string[];
  playerSpawns: GridPoint[];
  enemySpawns: GridPoint[];
  capture?: GridPoint;
};

const terrainKinds: Record<string, Tile['kind']> = { '.': 'plain', '~': 'water', '^': 'lava', '#': 'wall' };
const slopeKinds: Record<string, SlopeDirection> = { '^': 'north', v: 'south', '>': 'east', '<': 'west' };
const objectKinds: Record<string, TerrainObjectId> = { T: 'tree', P: 'pine-tree', R: 'rock', B: 'bush', L: 'fallen-log', S: 'tree-stump', V: 'fern', M: 'mushrooms', F: 'flower', G: 'grass-tuft', H: 'ancient-tree', O: 'standing-stone' };
const surfaceKinds: Record<string, NonNullable<Tile['surface']>> = { ':': 'path', ',': 'moss', '=': 'stone', '*': 'seal' };
const slopeOffsets: Record<SlopeDirection, GridPoint> = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
const zoneKinds: Record<string, DeploymentZone> = { A: 'ally', N: 'neutral', E: 'enemy' };
export const MAX_MAP_SIZE = 32;
function deploymentZones(size: number): string[] {
  return Array.from({ length: size }, (_, y) => (y < 2 ? 'E' : y >= size - 2 ? 'A' : 'N').repeat(size));
}

function edgeSpawns(size: number, y: number): GridPoint[] {
  const count = Math.min(6, size - 2);
  const first = Math.floor((size - count) / 2);
  return Array.from({ length: count }, (_, index): GridPoint => [first + index, y]);
}

type ObjectMarker = 'T' | 'P' | 'R' | 'B' | 'L' | 'S' | 'V' | 'M' | 'F' | 'G' | 'H' | 'O';
type ForestSource = {
  id: string;
  name: string;
  weather: Weather;
  size?: number;
  terraces: Array<{ height: 1 | 2; cells: GridPoint[] }>;
  ramps: Array<{ point: GridPoint; facing: SlopeDirection }>;
  objects: Partial<Record<ObjectMarker, GridPoint[]>>;
  paths: GridPoint[][];
  moss: GridPoint[];
  stone?: GridPoint[];
  seals?: GridPoint[];
  water?: GridPoint[];
  capture?: GridPoint;
};

/** Small authored regions keep the terrace shapes and forest clusters easy to edit. */
function patch(x: number, y: number, width: number, height: number): GridPoint[] {
  return Array.from({ length: height }, (_, row) => Array.from({ length: width }, (_, column): GridPoint => [x + column, y + row])).flat();
}

/** Consecutive waypoints describe an axis-aligned dirt trail, including its bends. */
function trail(...waypoints: GridPoint[]): GridPoint[] {
  const cells: GridPoint[] = [];
  for (let index = 0; index < waypoints.length; index++) {
    const [x, y] = waypoints[index];
    if (!index) { cells.push([x, y]); continue; }
    const [previousX, previousY] = waypoints[index - 1];
    if (previousX !== x && previousY !== y) throw new Error('Forest trail waypoints must share a grid axis.');
    const distance = Math.abs(x - previousX) + Math.abs(y - previousY);
    for (let step = 1; step <= distance; step++) cells.push([previousX + Math.sign(x - previousX) * step, previousY + Math.sign(y - previousY) * step]);
  }
  return cells;
}

function forestMap(source: ForestSource): BattleMap {
  const size = source.size ?? 16;
  const layer = (fill: string) => Array.from({ length: size }, () => Array<string>(size).fill(fill));
  const terrain = layer('.'), elevation = layer('0'), slopes = layer('.'), objects = layer('.'), surfaces = layer('.');
  const put = (rows: string[][], [x, y]: GridPoint, marker: string) => {
    if (!rows[y]?.[x]) throw new Error(`Map ${source.id}: authored point ${x},${y} is outside the forest.`);
    rows[y][x] = marker;
  };
  for (const point of source.water ?? []) put(terrain, point, '~');
  for (const terrace of source.terraces) for (const point of terrace.cells) put(elevation, point, String(terrace.height));
  const slopeMarkers: Record<SlopeDirection, string> = { north: '^', south: 'v', east: '>', west: '<' };
  for (const ramp of source.ramps) put(slopes, ramp.point, slopeMarkers[ramp.facing]);
  for (const [marker, cells] of Object.entries(source.objects)) for (const point of cells) {
    const [x, y] = point;
    if (objects[y]?.[x] !== '.') throw new Error(`Map ${source.id}: duplicate object at ${x},${y}.`);
    put(objects, point, marker);
  }
  for (const point of source.moss) put(surfaces, point, ',');
  for (const cells of source.paths) for (const point of cells) put(surfaces, point, ':');
  for (const point of source.stone ?? []) put(surfaces, point, '=');
  for (const point of source.seals ?? []) put(surfaces, point, '*');
  const rows = (cells: string[][]) => cells.map(row => row.join(''));
  const map = createMap({
    id: source.id, name: source.name, weather: source.weather,
    terrain: rows(terrain), elevation: rows(elevation), slopes: rows(slopes), objects: rows(objects), surfaces: rows(surfaces),
    zones: deploymentZones(size), playerSpawns: edgeSpawns(size, size - 2), enemySpawns: edgeSpawns(size, 1), capture: source.capture,
  });
  const grounded = { canFly: false, canSwim: false };
  const connected = terrainReachable(map, map.playerSpawns[0], grounded);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const tile = map.tiles[y][x];
    if (tile.kind === 'plain' && !objectBlocksMovement(tile) && !connected.has(`${x},${y}`))
      throw new Error(`Map ${source.id}: forest ground ${x},${y} is isolated from its trails.`);
    if (tile.slope) {
      const [dx, dy] = slopeOffsets[tile.slope];
      if (map.tiles[y + dy]?.[x + dx]?.object) throw new Error(`Map ${source.id}: ramp ${x},${y} needs a clear approach.`);
    }
  }
  for (const cells of source.paths) for (let index = 0; index < cells.length; index++) {
    const [x, y] = cells[index];
    const [fromX, fromY] = cells[Math.max(0, index - 1)];
    if (!canTraverseTerrain(map, grounded, x, y, fromX, fromY)) throw new Error(`Map ${source.id}: dirt trail cannot enter ${x},${y} from ${fromX},${fromY}.`);
  }
  return map;
}

export function createMap(source: MapSource): BattleMap {
  const height = source.terrain.length;
  const width = source.terrain[0]?.length ?? 0;
  if (!height || !width || source.elevation.length !== height || source.zones.length !== height
    || source.terrain.some(row => row.length !== width) || source.elevation.some(row => row.length !== width)
    || source.zones.some(row => row.length !== width)
    || (source.slopes !== undefined && (source.slopes.length !== height || source.slopes.some(row => row.length !== width)))
    || (source.objects !== undefined && (source.objects.length !== height || source.objects.some(row => row.length !== width)))
    || (source.surfaces !== undefined && (source.surfaces.length !== height || source.surfaces.some(row => row.length !== width)))) {
    throw new Error(`Map ${source.id}: terrain, elevation, and zones must be nonempty rectangles of equal size.`);
  }
  if (width > MAX_MAP_SIZE || height > MAX_MAP_SIZE) throw new Error(`Map ${source.id}: maximum size is ${MAX_MAP_SIZE}×${MAX_MAP_SIZE}.`);
  const tiles = source.terrain.map((row, y) => [...row].map((symbol, x): Tile => {
    const kind = terrainKinds[symbol];
    const level = Number(source.elevation[y][x]);
    if (!kind || !Number.isInteger(level) || level < 0 || level > 2) throw new Error(`Map ${source.id}: invalid tile at ${x},${y}.`);
    const marker = source.slopes?.[y][x] ?? '.';
    const slope = slopeKinds[marker];
    if (marker !== '.' && !slope) throw new Error(`Map ${source.id}: invalid slope at ${x},${y}.`);
    const objectMarker = source.objects?.[y][x] ?? '.';
    const object = objectKinds[objectMarker];
    if (objectMarker !== '.' && !object) throw new Error(`Map ${source.id}: invalid object at ${x},${y}.`);
    if (object && (kind !== 'plain' || slope)) throw new Error(`Map ${source.id}: object at ${x},${y} needs an ordinary plain tile.`);
    const surfaceMarker = source.surfaces?.[y][x] ?? '.';
    const surface = surfaceKinds[surfaceMarker];
    if (surfaceMarker !== '.' && !surface) throw new Error(`Map ${source.id}: invalid surface at ${x},${y}.`);
    if (surface && kind !== 'plain') throw new Error(`Map ${source.id}: forest surface at ${x},${y} needs plain ground.`);
    return { kind, height: level, ...(slope ? { slope } : {}), ...(object ? { object } : {}), ...(surface ? { surface } : {}) };
  }));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const tile = tiles[y][x];
    if (!tile.slope) continue;
    const [dx, dy] = slopeOffsets[tile.slope];
    const lower = tiles[y + dy]?.[x + dx];
    if (tile.kind !== 'plain' || tile.height < 1 || !lower || !['plain', 'lava'].includes(lower.kind) || lower.height !== tile.height - 1)
      throw new Error(`Map ${source.id}: slope at ${x},${y} must face a passable tile exactly one level lower.`);
  }
  const zones = source.zones.map((row, y) => [...row].map((symbol, x): DeploymentZone => {
    const zone = zoneKinds[symbol];
    if (!zone) throw new Error(`Map ${source.id}: invalid zone at ${x},${y}. Use A, N, or E.`);
    return zone;
  }));
  for (const zone of ['ally', 'neutral', 'enemy'] as const) if (!zones.some(row => row.includes(zone))) throw new Error(`Map ${source.id}: missing ${zone} zone.`);
  for (const zone of ['ally', 'enemy'] as const) {
    const safe = zones.flatMap((row, y) => row.filter((cell, x) => cell === zone && tiles[y][x].kind === 'plain' && !objectBlocksMovement(tiles[y][x]))).length;
    if (safe < 8) throw new Error(`Map ${source.id}: ${zone} zone needs at least eight safe deployment tiles.`);
  }
  const points = [...source.playerSpawns, ...source.enemySpawns, ...(source.capture ? [source.capture] : [])];
  for (const [x, y] of points) if (!tiles[y]?.[x] || tiles[y][x].kind === 'wall' || objectBlocksMovement(tiles[y][x])) throw new Error(`Map ${source.id}: invalid spawn or capture tile at ${x},${y}.`);
  for (const [x, y] of source.playerSpawns) if (tiles[y][x].kind !== 'plain') throw new Error(`Map ${source.id}: mixed-party player spawn ${x},${y} must be plain ground.`);
  for (const [x, y] of source.enemySpawns) if (tiles[y][x].kind === 'lava') throw new Error(`Map ${source.id}: enemy spawn ${x},${y} cannot be lava.`);
  const spawnKeys = [...source.playerSpawns, ...source.enemySpawns].map(([x, y]) => `${x},${y}`);
  if (!source.playerSpawns.length || !source.enemySpawns.length) throw new Error(`Map ${source.id}: both teams need spawn tiles.`);
  if (new Set(spawnKeys).size !== spawnKeys.length) throw new Error(`Map ${source.id}: spawn tiles must be unique.`);
  for (const [x, y] of source.playerSpawns) if (zones[y][x] !== 'ally') throw new Error(`Map ${source.id}: player spawn ${x},${y} must be in the ally zone.`);
  for (const [x, y] of source.enemySpawns) if (zones[y][x] !== 'enemy') throw new Error(`Map ${source.id}: enemy spawn ${x},${y} must be in the enemy zone.`);
  const map: BattleMap = { id: source.id, name: source.name, weather: source.weather, tiles, zones, playerSpawns: source.playerSpawns, enemySpawns: source.enemySpawns, capture: source.capture };
  const groundStarts: GridPoint[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (zones[y][x] !== 'neutral' && tiles[y][x].kind === 'plain' && !objectBlocksMovement(tiles[y][x])) groundStarts.push([x, y]);
  }
  const grounded = { canFly: false, canSwim: false };
  const connected = terrainReachable(map, source.playerSpawns[0], grounded);
  for (const [x, y] of groundStarts) if (!connected.has(`${x},${y}`))
    throw new Error(`Map ${source.id}: ${zones[y][x]} deployment tile ${x},${y} has no grounded route to the opposing zone.`);
  if (source.capture && !connected.has(`${source.capture[0]},${source.capture[1]}`))
    throw new Error(`Map ${source.id}: capture tile ${source.capture[0]},${source.capture[1]} has no grounded route from the ally zone.`);
  return map;
}

export const ELITE_MAP_ID = 'moonpool-elite';
export const NORMAL_MAP_IDS = ['mossveil-grove', 'fernroot-woods', 'sunshade-thicket', 'willowbrook-crossing', 'pinewatch-rise'] as const;

export const MAPS: Record<string, BattleMap> = Object.fromEntries([
  // A winding lowland trail separates two wooded shelves; the western shelf has a small summit.
  forestMap({
    id: 'mossveil-grove', name: 'Mossveil Grove', weather: 'clear',
    terraces: [
      { height: 1, cells: [...patch(2, 4, 4, 4), ...patch(3, 8, 3, 1), ...patch(10, 8, 4, 4)] },
      { height: 2, cells: patch(3, 5, 2, 2) },
    ],
    ramps: [
      { point: [2, 4], facing: 'north' }, { point: [2, 6], facing: 'west' }, { point: [5, 8], facing: 'south' }, { point: [5, 5], facing: 'east' },
      { point: [3, 5], facing: 'north' }, { point: [4, 6], facing: 'south' },
      { point: [10, 8], facing: 'north' }, { point: [13, 9], facing: 'east' }, { point: [10, 10], facing: 'west' }, { point: [12, 11], facing: 'south' },
    ],
    objects: {
      T: [[1, 2], [2, 2], [3, 2], [12, 2], [13, 2], [14, 3], [5, 4], [2, 7], [11, 8], [13, 10], [11, 11], [1, 11], [2, 12], [3, 13], [12, 13], [14, 12]],
      P: [[1, 4], [14, 5], [14, 10]], L: [[6, 7], [10, 5], [9, 11]], S: [[4, 10], [12, 5]],
      B: [[1, 3], [13, 3], [2, 11], [13, 12]], V: [[2, 5], [5, 6], [11, 9], [1, 9], [13, 11], [4, 12]],
      M: [[3, 6], [2, 8], [12, 10], [13, 4]], F: [[8, 4], [9, 9], [6, 11], [11, 13]], G: [[6, 3], [9, 6], [5, 12], [10, 13]],
    },
    paths: [
      trail([7, 1], [7, 5], [8, 5], [8, 10], [7, 10], [7, 14]),
      trail([7, 3], [2, 3], [2, 4], [3, 4], [3, 5], [4, 5], [4, 7], [5, 7], [5, 9], [7, 9]),
      trail([8, 10], [10, 10], [11, 10], [11, 9], [12, 9], [13, 9], [14, 9]),
      trail([4, 3], [4, 2]), trail([7, 12], [12, 12], [12, 11]),
    ],
    moss: [...patch(1, 2, 3, 2), ...patch(2, 4, 4, 5), ...patch(10, 8, 4, 4), ...patch(11, 2, 4, 3), ...patch(1, 10, 3, 4)],
  }),
  // Rain-soaked fern shelves and a small pond leave a broad central valley and outer flanks.
  forestMap({
    id: 'fernroot-woods', name: 'Fernroot Woods', weather: 'rain',
    terraces: [
      { height: 1, cells: [...patch(2, 3, 5, 3), ...patch(9, 9, 5, 4), ...patch(8, 10, 1, 2), ...patch(1, 10, 4, 3)] },
      { height: 2, cells: patch(10, 10, 2, 2) },
    ],
    ramps: [
      { point: [2, 3], facing: 'north' }, { point: [6, 4], facing: 'east' }, { point: [3, 5], facing: 'south' },
      { point: [9, 9], facing: 'north' }, { point: [13, 10], facing: 'east' }, { point: [11, 12], facing: 'south' }, { point: [8, 10], facing: 'west' },
      { point: [10, 10], facing: 'north' }, { point: [11, 11], facing: 'south' },
      { point: [1, 10], facing: 'north' }, { point: [4, 11], facing: 'east' }, { point: [2, 12], facing: 'south' },
    ],
    water: [[11, 4], [12, 4], [11, 5], [12, 5]],
    objects: {
      T: [[1, 2], [4, 3], [5, 3], [2, 4], [1, 6], [3, 7], [12, 2], [13, 2], [14, 3], [14, 6], [12, 9], [13, 11], [9, 12], [1, 11], [3, 12], [6, 13]],
      P: [[0, 4], [15, 9], [14, 12]], L: [[5, 6], [9, 6], [6, 10]], S: [[4, 8], [12, 8], [3, 10]],
      B: [[3, 2], [13, 3], [2, 7], [12, 12]], V: [[3, 3], [5, 4], [1, 7], [2, 10], [9, 10], [12, 10], [8, 12], [14, 11]],
      M: [[6, 3], [3, 4], [10, 11], [10, 5], [5, 12]], F: [[8, 3], [10, 4], [5, 9], [13, 13]], G: [[6, 7], [10, 6], [7, 12], [4, 13]],
    },
    paths: [
      trail([7, 1], [7, 4], [8, 4], [8, 8], [7, 8], [7, 14]),
      trail([7, 4], [6, 4], [4, 4], [4, 5], [3, 5], [3, 6], [2, 6], [2, 9], [1, 9], [1, 10]),
      trail([7, 10], [9, 10], [9, 9], [10, 9], [10, 10], [11, 10], [11, 11], [11, 13], [7, 13]),
      trail([7, 7], [13, 7], [13, 8], [14, 8], [14, 10], [13, 10]),
    ],
    moss: [...patch(1, 2, 6, 4), ...patch(1, 6, 3, 7), ...patch(9, 9, 5, 4), ...patch(10, 6, 5, 2)],
  }),
  // A sunny raised meadow offers a direct ascent while both forest edges remain open routes.
  forestMap({
    id: 'sunshade-thicket', name: 'Sunshade Thicket', weather: 'sun',
    terraces: [{ height: 1, cells: patch(5, 5, 6, 6) }, { height: 2, cells: patch(7, 7, 2, 2) }],
    ramps: [
      { point: [5, 6], facing: 'west' }, { point: [6, 5], facing: 'north' }, { point: [10, 8], facing: 'east' }, { point: [9, 10], facing: 'south' },
      { point: [7, 7], facing: 'north' }, { point: [8, 8], facing: 'south' },
    ],
    objects: {
      T: [[1, 2], [2, 2], [3, 3], [1, 5], [2, 6], [1, 8], [2, 10], [1, 12], [3, 13], [12, 2], [13, 3], [14, 3], [13, 5], [14, 6], [13, 8], [14, 10], [12, 11], [13, 12]],
      P: [[0, 6], [15, 7]], L: [[3, 7], [11, 6], [5, 12]], S: [[5, 8], [10, 10], [11, 4]],
      B: [[2, 3], [14, 4], [2, 12], [13, 11]], V: [[3, 5], [5, 7], [10, 6], [11, 9], [12, 12]],
      M: [[1, 9], [14, 7], [4, 10]], F: [[6, 6], [8, 6], [9, 7], [6, 9], [7, 9], [10, 9], [6, 11], [10, 12]], G: [[4, 3], [9, 4], [6, 10], [11, 13]],
    },
    paths: [
      trail([7, 1], [7, 3], [6, 3], [6, 6], [7, 6], [7, 7], [8, 7], [8, 9], [9, 9], [9, 11], [7, 11], [7, 14]),
      trail([6, 3], [4, 3], [4, 6], [5, 6]), trail([4, 6], [4, 12], [4, 13], [7, 13]),
      trail([7, 3], [12, 3], [12, 8], [10, 8]), trail([12, 8], [12, 10], [11, 10], [11, 13], [7, 13]),
    ],
    moss: [...patch(0, 2, 3, 12), ...patch(13, 2, 3, 12), ...patch(5, 8, 2, 2), ...patch(9, 5, 2, 2)],
  }),
  // The brook has a two-cell dry crossing, plus independent ground routes around each bank.
  forestMap({
    id: 'willowbrook-crossing', name: 'Willowbrook Crossing', weather: 'clear',
    terraces: [{ height: 1, cells: [...patch(2, 3, 4, 3), ...patch(10, 10, 4, 3)] }, { height: 2, cells: patch(11, 11, 2, 1) }],
    ramps: [
      { point: [2, 3], facing: 'north' }, { point: [5, 4], facing: 'east' }, { point: [3, 5], facing: 'south' },
      { point: [11, 10], facing: 'north' }, { point: [13, 11], facing: 'east' }, { point: [10, 11], facing: 'west' }, { point: [12, 12], facing: 'south' },
      { point: [11, 11], facing: 'north' }, { point: [12, 11], facing: 'south' },
    ],
    water: [...patch(3, 7, 4, 1), ...patch(9, 7, 4, 1), ...patch(4, 8, 3, 1), ...patch(9, 8, 3, 1), [5, 6], [10, 9]],
    objects: {
      T: [[1, 2], [2, 4], [4, 3], [5, 5], [0, 5], [1, 11], [2, 12], [3, 13], [12, 2], [13, 2], [14, 4], [15, 6], [13, 10], [10, 12], [14, 12]],
      P: [[0, 9], [15, 10]], L: [[1, 6], [12, 9], [8, 12]], S: [[6, 5], [9, 10], [2, 9]],
      B: [[1, 3], [4, 4], [13, 3], [13, 12]], V: [[3, 4], [4, 6], [3, 8], [6, 9], [9, 6], [12, 8], [10, 10], [13, 13]],
      M: [[1, 10], [4, 5], [11, 12], [14, 5]], F: [[6, 3], [8, 6], [8, 9], [12, 6], [9, 12]], G: [[3, 9], [6, 10], [11, 4], [11, 13]],
    },
    paths: [
      trail([7, 1], [7, 14]), trail([8, 6], [8, 9]),
      trail([7, 4], [5, 4], [3, 4], [3, 5], [3, 6], [2, 6], [2, 8], [3, 8], [3, 11], [7, 11]),
      trail([7, 4], [13, 4], [13, 6], [14, 6], [14, 11], [13, 11], [13, 12], [12, 12], [12, 11], [12, 13], [7, 13]),
      trail([7, 10], [8, 10], [8, 11], [10, 11], [10, 10], [11, 10], [11, 11]),
    ],
    moss: [...patch(1, 2, 5, 4), ...patch(1, 10, 3, 4), ...patch(10, 10, 4, 4), ...patch(12, 2, 3, 4), ...patch(9, 5, 4, 2), ...patch(3, 9, 4, 1)],
  }),
  // A pine-covered eastern ridge has several entries and a long summit, beside a low valley.
  forestMap({
    id: 'pinewatch-rise', name: 'Pinewatch Rise', weather: 'clear',
    terraces: [
      { height: 1, cells: [...patch(10, 3, 4, 10), ...patch(8, 6, 2, 4), ...patch(9, 10, 1, 2), ...patch(2, 6, 3, 3)] },
      { height: 2, cells: patch(11, 6, 2, 4) },
    ],
    ramps: [
      { point: [10, 3], facing: 'north' }, { point: [13, 4], facing: 'east' }, { point: [8, 7], facing: 'west' },
      { point: [9, 11], facing: 'west' }, { point: [11, 12], facing: 'south' }, { point: [13, 11], facing: 'east' },
      { point: [11, 6], facing: 'north' }, { point: [12, 9], facing: 'south' }, { point: [12, 7], facing: 'east' },
      { point: [2, 6], facing: 'north' }, { point: [4, 7], facing: 'east' }, { point: [3, 8], facing: 'south' },
    ],
    objects: {
      T: [[1, 3], [2, 4], [3, 3], [1, 10], [3, 11], [4, 12]],
      P: [[11, 3], [15, 3], [10, 4], [12, 4], [13, 5], [10, 7], [11, 8], [10, 9], [9, 9], [13, 10], [14, 12], [2, 8], [0, 7], [1, 12]],
      R: [[10, 11], [3, 6]], L: [[5, 5], [8, 4], [4, 10]], S: [[5, 8], [9, 12], [10, 8]],
      B: [[1, 4], [14, 3], [13, 12]], V: [[4, 6], [8, 8], [10, 5], [12, 8], [10, 12], [14, 10]],
      M: [[2, 7], [9, 8], [11, 9], [12, 5], [3, 12]], F: [[5, 3], [7, 10], [12, 13]], G: [[6, 6], [14, 7], [4, 13], [8, 12]],
    },
    paths: [
      trail([7, 1], [7, 5], [6, 5], [6, 10], [7, 10], [7, 14]),
      trail([6, 7], [4, 7], [3, 7], [3, 8], [3, 9], [6, 9]),
      trail([6, 7], [8, 7], [9, 7], [9, 6], [10, 6], [10, 5], [11, 5], [11, 6], [12, 6], [12, 9], [12, 10], [11, 10], [11, 13], [7, 13]),
      trail([7, 2], [14, 2], [14, 4], [13, 4]), trail([14, 4], [14, 11], [13, 11]),
    ],
    moss: [...patch(10, 3, 4, 10), ...patch(8, 6, 2, 4), ...patch(1, 3, 4, 2), ...patch(1, 10, 4, 3), ...patch(2, 6, 3, 3)],
  }),
  // The elite lake keeps two open shore lanes, with optional wooded overlooks on either side.
  forestMap({
    id: ELITE_MAP_ID, name: 'Moonpool Clearing', weather: 'clear',
    terraces: [
      { height: 1, cells: [...patch(1, 5, 3, 5), ...patch(12, 6, 3, 5), ...patch(6, 2, 4, 2)] },
      { height: 2, cells: patch(7, 2, 2, 1) },
    ],
    ramps: [
      { point: [1, 5], facing: 'north' }, { point: [1, 9], facing: 'south' }, { point: [3, 7], facing: 'east' },
      { point: [14, 6], facing: 'north' }, { point: [14, 10], facing: 'south' }, { point: [12, 8], facing: 'west' },
      { point: [6, 2], facing: 'north' }, { point: [9, 2], facing: 'north' }, { point: [6, 3], facing: 'south' }, { point: [9, 3], facing: 'south' },
      { point: [7, 2], facing: 'south' }, { point: [8, 2], facing: 'south' },
    ],
    water: [[7, 5], [8, 5], [6, 6], [7, 6], [8, 6], [9, 6], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [6, 9], [7, 9], [8, 9], [9, 9], [7, 10], [8, 10]],
    objects: {
      T: [[1, 2], [2, 2], [3, 3], [12, 2], [13, 2], [14, 3], [2, 5], [1, 7], [2, 8], [13, 6], [14, 8], [13, 10], [2, 12], [3, 13], [12, 12], [14, 13]],
      P: [[0, 5], [15, 9]], L: [[2, 4], [12, 6]], S: [[2, 10], [13, 4]],
      B: [[3, 4], [12, 3], [2, 13], [13, 12]], V: [[2, 6], [3, 8], [12, 7], [13, 9], [5, 6], [10, 5]],
      M: [[2, 9], [12, 10], [14, 7], [5, 3]], F: [[5, 4], [10, 4], [6, 11], [9, 11], [4, 10], [11, 10]], G: [[4, 5], [11, 6], [5, 9], [10, 9]],
    },
    paths: [
      trail([7, 1], [6, 1], [5, 1], [5, 4], [4, 4], [4, 11], [7, 11], [7, 14]),
      trail([8, 1], [10, 1], [10, 4], [11, 4], [11, 11], [8, 11], [8, 14]),
      trail([4, 4], [11, 4]), trail([4, 11], [11, 11]),
      trail([4, 7], [3, 7], [2, 7], [2, 6]), trail([11, 8], [12, 8], [13, 8]),
      trail([6, 4], [6, 3], [7, 3], [7, 2]), trail([9, 4], [9, 3], [8, 3], [8, 2]),
    ],
    moss: [...patch(1, 2, 3, 2), ...patch(12, 2, 3, 3), ...patch(1, 5, 3, 5), ...patch(12, 6, 3, 5), ...patch(6, 2, 4, 2), ...patch(1, 12, 3, 2), ...patch(12, 12, 3, 2)],
  }),
  // A ceremonial forest arena: open stone dais, twin processional ramps,
  // rear crown terrace, and an old-growth/monolith perimeter around the fight.
  forestMap({
    id: 'ancient-heartwood', name: 'Ancient Heartwood', weather: 'clear', size: 8, capture: [4, 4],
    terraces: [{ height: 1, cells: patch(2, 2, 4, 4) }, { height: 2, cells: [[3, 2], [4, 2]] }],
    ramps: [
      { point: [2, 3], facing: 'west' }, { point: [2, 4], facing: 'west' },
      { point: [5, 3], facing: 'east' }, { point: [5, 4], facing: 'east' },
      { point: [3, 5], facing: 'south' }, { point: [4, 5], facing: 'south' },
      { point: [3, 2], facing: 'south' }, { point: [4, 2], facing: 'south' },
    ],
    objects: {
      H: [[0, 3], [7, 3]], O: [[1, 0], [6, 0], [1, 5], [6, 5]],
      T: [[0, 0], [7, 0], [0, 2], [7, 2], [0, 4], [7, 4]], S: [[0, 5], [7, 5]],
      B: [[0, 6], [7, 6]], V: [[2, 0], [5, 0], [0, 7], [7, 7]],
      M: [[0, 1], [7, 1]], F: [[2, 2], [5, 2]], G: [[2, 7], [5, 7]],
    },
    paths: [
      trail([3, 7], [3, 2]), trail([4, 7], [4, 2]),
      trail([1, 1], [1, 3], [3, 3]), trail([6, 1], [6, 3], [4, 3]),
      trail([1, 4], [3, 4]), trail([6, 4], [4, 4]),
    ],
    moss: [...patch(0, 0, 8, 2), ...patch(0, 2, 2, 4), ...patch(6, 2, 2, 4)],
    stone: patch(2, 2, 4, 4), seals: [[4, 4]],
  }),
].map(map => [map.id, map]));

export const mapWidth = (map: BattleMap) => map.tiles[0]?.length ?? 0;
export const mapHeight = (map: BattleMap) => map.tiles.length;
