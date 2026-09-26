import type { BattleMap, DeploymentZone, GridPoint, Tile, Weather } from '../game/types';

type MapSource = {
  id: string;
  name: string;
  weather: Weather;
  terrain: string[];
  elevation: string[];
  zones: string[];
  playerSpawns: GridPoint[];
  enemySpawns: GridPoint[];
  capture?: GridPoint;
};

const terrainKinds: Record<string, Tile['kind']> = { '.': 'plain', '~': 'water', '^': 'lava', '#': 'wall' };
const zoneKinds: Record<string, DeploymentZone> = { A: 'ally', N: 'neutral', E: 'enemy' };
export const MAX_MAP_SIZE = 32;
const standardZones = ['EEEEEEEE', 'EEEEEEEE', ...Array<string>(4).fill('NNNNNNNN'), 'AAAAAAAA', 'AAAAAAAA'];
const bottom: GridPoint[] = [[0, 7], [1, 7], [2, 7]];
const top: GridPoint[] = [[0, 0], [1, 0], [2, 0]];

export function createMap(source: MapSource): BattleMap {
  const height = source.terrain.length;
  const width = source.terrain[0]?.length ?? 0;
  if (!height || !width || source.elevation.length !== height || source.zones.length !== height
    || source.terrain.some(row => row.length !== width) || source.elevation.some(row => row.length !== width)
    || source.zones.some(row => row.length !== width)) {
    throw new Error(`Map ${source.id}: terrain, elevation, and zones must be nonempty rectangles of equal size.`);
  }
  if (width > MAX_MAP_SIZE || height > MAX_MAP_SIZE) throw new Error(`Map ${source.id}: maximum size is ${MAX_MAP_SIZE}×${MAX_MAP_SIZE}.`);
  const tiles = source.terrain.map((row, y) => [...row].map((symbol, x): Tile => {
    const kind = terrainKinds[symbol];
    const level = Number(source.elevation[y][x]);
    if (!kind || !Number.isInteger(level) || level < 0 || level > 2) throw new Error(`Map ${source.id}: invalid tile at ${x},${y}.`);
    return { kind, height: level };
  }));
  const zones = source.zones.map((row, y) => [...row].map((symbol, x): DeploymentZone => {
    const zone = zoneKinds[symbol];
    if (!zone) throw new Error(`Map ${source.id}: invalid zone at ${x},${y}. Use A, N, or E.`);
    return zone;
  }));
  for (const zone of ['ally', 'neutral', 'enemy'] as const) if (!zones.some(row => row.includes(zone))) throw new Error(`Map ${source.id}: missing ${zone} zone.`);
  for (const zone of ['ally', 'enemy'] as const) {
    const safe = zones.flatMap((row, y) => row.filter((cell, x) => cell === zone && tiles[y][x].kind === 'plain')).length;
    if (safe < 8) throw new Error(`Map ${source.id}: ${zone} zone needs at least eight safe deployment tiles.`);
  }
  const points = [...source.playerSpawns, ...source.enemySpawns, ...(source.capture ? [source.capture] : [])];
  for (const [x, y] of points) if (!tiles[y]?.[x] || tiles[y][x].kind === 'wall') throw new Error(`Map ${source.id}: invalid spawn or capture tile at ${x},${y}.`);
  const spawnKeys = [...source.playerSpawns, ...source.enemySpawns].map(([x, y]) => `${x},${y}`);
  if (!source.playerSpawns.length || !source.enemySpawns.length) throw new Error(`Map ${source.id}: both teams need spawn tiles.`);
  if (new Set(spawnKeys).size !== spawnKeys.length) throw new Error(`Map ${source.id}: spawn tiles must be unique.`);
  for (const [x, y] of source.playerSpawns) if (zones[y][x] !== 'ally') throw new Error(`Map ${source.id}: player spawn ${x},${y} must be in the ally zone.`);
  for (const [x, y] of source.enemySpawns) if (zones[y][x] !== 'enemy') throw new Error(`Map ${source.id}: enemy spawn ${x},${y} must be in the enemy zone.`);
  // A Flying unit can cross water and elevation, so walls must not isolate the teams or objective.
  const connected = new Set<string>();
  const frontier: GridPoint[] = [source.playerSpawns[0]];
  for (let index = 0; index < frontier.length; index++) {
    const [x, y] = frontier[index], key = `${x},${y}`;
    if (connected.has(key)) continue;
    connected.add(key);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nextX = x + dx, nextY = y + dy;
      if (tiles[nextY]?.[nextX] && tiles[nextY][nextX].kind !== 'wall' && !connected.has(`${nextX},${nextY}`)) frontier.push([nextX, nextY]);
    }
  }
  for (const [x, y] of points) if (!connected.has(`${x},${y}`)) throw new Error(`Map ${source.id}: spawn or capture tile at ${x},${y} is isolated by walls.`);
  return { id: source.id, name: source.name, weather: source.weather, tiles, zones, playerSpawns: source.playerSpawns, enemySpawns: source.enemySpawns, capture: source.capture };
}

export const MAPS: Record<string, BattleMap> = Object.fromEntries([
  createMap({ id: 'verdant-crossing', name: 'Verdant Crossing', weather: 'snow', terrain: ['........', '........', '..~~....', '...~....', '....##..', '..^.....', '........', '........'], elevation: ['00000000','00110000','00000000','00000000','00000000','00000000','00011000','00000000'], zones: standardZones, playerSpawns: bottom, enemySpawns: top }),
  createMap({ id: 'cinder-ford', name: 'Cinder Ford', weather: 'sun', terrain: ['........', '...^^...', '..#.....', '..~~....', '...~....', '......#.', '........', '........'], elevation: ['00000000','00000000','00100000','00000000','00000000','00000010','00000000','00000000'], zones: standardZones, playerSpawns: bottom, enemySpawns: top }),
  createMap({ id: 'storm-ridge', name: 'Storm Ridge', weather: 'rain', terrain: ['........', '..~~....', '..~~....', '...#....', '....^...', '....^...', '........', '........'], elevation: ['00000000','00000000','00000000','00000000','00000000','00000000','01100000','00000000'], zones: standardZones, playerSpawns: bottom, enemySpawns: top }),
  createMap({ id: 'crown-citadel', name: 'Crown Citadel', weather: 'sandstorm', terrain: ['........', '....#...', '..^^....', '........', '...##...', '........', '........', '........'], elevation: ['00000000','00000000','00000000','00122100','00000000','00000000','00000000','00000000'], zones: standardZones, playerSpawns: bottom, enemySpawns: top, capture: [6, 4] }),
].map(map => [map.id, map]));

export const mapWidth = (map: BattleMap) => map.tiles[0]?.length ?? 0;
export const mapHeight = (map: BattleMap) => map.tiles.length;
