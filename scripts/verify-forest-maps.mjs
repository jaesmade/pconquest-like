import assert from 'node:assert/strict';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// Bundle the same CSV content imports that Vite serves, so these checks exercise
// the authored maps and real battle rules without needing a browser or server.
const rawCsv = { name: 'vite-raw-csv', setup(builder) {
  builder.onResolve({ filter: /\.csv\?raw$/ }, args => ({ path: resolve(args.resolveDir, args.path.slice(0, -4)), namespace: 'raw-csv' }));
  builder.onLoad({ filter: /\.csv$/, namespace: 'raw-csv' }, async args => ({ contents: await readFile(args.path, 'utf8'), loader: 'text' }));
} };
const bundle = await build({
  stdin: {
    contents: `
      export { MAPS, NORMAL_MAP_IDS, ELITE_MAP_ID } from './src/content/maps.ts';
      export { ENCOUNTERS } from './src/content/encounters.ts';
      export { validateCatalog } from './src/content/catalog.ts';
      export { TERRAIN_OBJECTS, objectBlocksMovement, objectBlocksSight } from './src/content/terrainObjects.ts';
      export { terrainReachable, canTraverseTerrain, hasLineOfSight } from './src/game/grid.ts';
      export { canDeploy, zoneCells } from './src/game/deployment.ts';
      export { newRun, encounterDefinition, startBattle } from './src/game/engine.ts';
      export { ROUTE_COLUMNS } from './src/game/route.ts';
      export { tileCenter, tileDepth, tileOrigin, tileTopPoints, gridAtWorld } from './src/battle/topDown.ts';
      export { terrainEdges, terrainArt } from './src/battle/terrainArt.ts';
      export { unitAnimationKey, unitSet, facingBetween } from './src/battle/unitAnimations.ts';
    `,
    resolveDir: process.cwd(), sourcefile: 'forest-check-entry.ts',
  },
  bundle: true, platform: 'node', format: 'esm', write: false,
  logLevel: 'silent', plugins: [rawCsv],
});
const bundlePath = join(tmpdir(), `pokemon-forest-check-${randomUUID()}.mjs`);
await writeFile(bundlePath, bundle.outputFiles[0].contents);
let game;
try { game = await import(pathToFileURL(bundlePath).href); }
finally { await unlink(bundlePath); }
const { MAPS, NORMAL_MAP_IDS, ELITE_MAP_ID, ENCOUNTERS, validateCatalog,
  TERRAIN_OBJECTS, objectBlocksMovement, objectBlocksSight, terrainReachable,
  canTraverseTerrain, hasLineOfSight, canDeploy, zoneCells, newRun,
  encounterDefinition, startBattle, ROUTE_COLUMNS, tileCenter, tileDepth,
  gridAtWorld, tileOrigin, tileTopPoints, terrainEdges, terrainArt } = game;

assert.deepEqual(validateCatalog(), [], 'the complete content catalog should remain valid');
const retainedIds = ['mossveil-grove', 'fernroot-woods', 'sunshade-thicket', 'moonpool-elite', 'ancient-heartwood'];
for (const id of retainedIds) assert.ok(MAPS[id], `existing saved map ID ${id} must remain available`);
assert.equal(NORMAL_MAP_IDS.length, 5, 'normal battles should use five forest maps');
assert.equal(new Set(NORMAL_MAP_IDS).size, 5, 'normal map IDs must be distinct');
assert.equal(Object.keys(MAPS).length, 7, 'campaign should contain five normal maps, an elite, and a boss');
const bossId = ENCOUNTERS.at(-1).mapId;
assert.equal(bossId, 'ancient-heartwood', 'the existing boss map ID should be retained');
assert.ok(!NORMAL_MAP_IDS.includes(ELITE_MAP_ID) && !NORMAL_MAP_IDS.includes(bossId), 'special arenas must stay outside normal rotation');

const ground = { canFly: false, canSwim: false };
const offsets = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
const objectUse = new Set();
let groundCells = 0, ramps = 0, cliffEdges = 0, squareCenters = 0;
const pickingFailures = [];

for (const [id, map] of Object.entries(MAPS)) {
  const size = id === bossId ? 8 : 16;
  assert.equal(map.tiles.length, size, `${id}: expected ${size} rows`);
  assert.ok(map.tiles.every(row => row.length === size), `${id}: expected ${size} columns`);
  assert.ok(map.zones.every((row, y) => row.every(zone => zone === (y < 2 ? 'enemy' : y >= size - 2 ? 'ally' : 'neutral'))), `${id}: deployment must stay on the top/bottom two rows`);
  const reachable = terrainReachable(map, map.playerSpawns[0], ground);
  const heights = new Set();
  let mapPlain = 0, mapRamps = 0;

  // The new terraces must be playable; catalog validation alone allows isolated
  // neutral ground, which can otherwise strand a unit or hide an unused plateau.
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const tile = map.tiles[y][x], label = `${id}: ${x},${y}`;
    assert.ok(Number.isInteger(tile.height) && tile.height >= 0 && tile.height <= 2, `${label}: elevation must remain 0–2`);
    if (tile.object) {
      objectUse.add(tile.object);
      assert.ok(TERRAIN_OBJECTS[tile.object], `${label}: object needs a catalog definition`);
      assert.equal(tile.kind, 'plain', `${label}: scenery must stand on plain ground`);
      assert.equal(tile.slope, undefined, `${label}: scenery cannot cover a ramp`);
    }
    if (tile.surface) {
      assert.equal(tile.kind, 'plain', `${label}: authored floor surfaces belong on plain ground`);
      assert.ok(['path', 'moss', 'stone', 'seal'].includes(tile.surface), `${label}: unknown forest surface`);
    }
    if (tile.kind === 'plain' && !objectBlocksMovement(tile)) {
      heights.add(tile.height);
      mapPlain++;
      assert.ok(reachable.has(`${x},${y}`), `${label}: every usable plain tile needs a grounded route from ally deployment`);
    }
    {
      squareCenters++;
      const center = tileCenter(map, x, y), picked = gridAtWorld(map, center.x, center.y);
      if (!picked || picked[0] !== x || picked[1] !== y) pickingFailures.push(`${label} -> ${picked?.join(',') ?? 'none'}`);
    }
    if (tile.slope) {
      const [dx, dy] = offsets[tile.slope], lower = map.tiles[y + dy]?.[x + dx];
      assert.ok(lower && lower.height === tile.height - 1 && ['plain', 'lava'].includes(lower.kind), `${label}: ramp must face traversable ground one level lower`);
      assert.equal(tile.object, undefined, `${label}: ramps must have no scenery`);
      assert.equal(lower.object, undefined, `${label}: ramp entrances must have no scenery`);
      assert.ok(canTraverseTerrain(map, ground, x, y, x + dx, y + dy), `${label}: a grounded unit must ascend the ramp`);
      assert.ok(canTraverseTerrain(map, ground, x + dx, y + dy, x, y), `${label}: a grounded unit must descend the ramp`);
      assert.ok(!terrainEdges(map, x, y).some(edge => edge.texture === `ground-ledge-${tile.slope}`), `${label}: ramp entrance must stay open`);
      mapRamps++;
    }
    // The elevation affordance must also prevent walking straight up a cliff.
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const neighbor = map.tiles[y + dy]?.[x + dx];
      if (!neighbor || tile.kind !== 'plain' || neighbor.kind !== 'plain'
        || objectBlocksMovement(tile) || objectBlocksMovement(neighbor) || tile.height === neighbor.height) continue;
      const high = tile.height > neighbor.height ? tile : neighbor;
      const rampEdge = tile.height > neighbor.height ? (dx ? 'east' : 'south') : (dx ? 'west' : 'north');
      const hasRamp = Math.abs(tile.height - neighbor.height) === 1 && high.slope === rampEdge;
      assert.equal(canTraverseTerrain(map, ground, x + dx, y + dy, x, y), hasRamp, `${label}: cliff/ramp ascent rule`);
      assert.equal(canTraverseTerrain(map, ground, x, y, x + dx, y + dy), hasRamp, `${label}: cliff/ramp descent rule`);
      if (!hasRamp) cliffEdges++;
    }
  }
  assert.ok(heights.has(1), `${id}: the forest should have a reachable raised terrace`);
  if (NORMAL_MAP_IDS.includes(id)) assert.ok(heights.has(2), `${id}: normal forests should have a reachable upper terrace`);
  assert.ok(mapRamps > 0, `${id}: raised terrain needs authored ramps`);
  for (const point of [...map.playerSpawns, ...map.enemySpawns, ...(map.capture ? [map.capture] : [])]) {
    const [x, y] = point;
    assert.equal(map.tiles[y][x].object, undefined, `${id}: spawn/capture ${point} must remain clear of scenery`);
    assert.equal(map.tiles[y][x].slope, undefined, `${id}: spawn/capture ${point} must remain off ramps`);
  }
  for (const zone of ['ally', 'enemy']) {
    const cells = zoneCells(map, zone).filter(point => canDeploy(map, 'bulbasaur', point, zone));
    assert.ok(cells.length >= 8, `${id}: ${zone} needs at least eight grounded deployment positions`);
    for (const point of cells) assert.ok(reachable.has(point.join(',')), `${id}: legal deployment ${point} must lead into the arena`);
  }
  groundCells += mapPlain;
  ramps += mapRamps;
  console.log(`${map.name}: ${size}×${size}, ${mapPlain} connected ground cells, ${mapRamps} ramps, reachable heights ${[...heights].sort().join('/')}.`);
}
assert.deepEqual(pickingFailures, [], 'every square cell center must pick itself, including elevated ramps');
// Square projection must work at cell edges, all ramp orientations, and outside bounds.
for (const direction of Object.keys(offsets)) {
  const fixture = { tiles: Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => ({ kind: 'plain', height: 0 }))) };
  fixture.tiles[1][1] = { kind: 'plain', height: 1, slope: direction };
  const origin = tileOrigin(fixture, 1, 1);
  assert.deepEqual(tileTopPoints(fixture, 1, 1), [{x:128,y:128},{x:192,y:128},{x:192,y:192},{x:128,y:192}]);
  assert.deepEqual(tileCenter(fixture, 1, 1), {x:160,y:160}, 'height and ramps never displace the cell');
  for (const u of [.01, .5, .99]) for (const v of [.01, .5, .99])
    assert.deepEqual(gridAtWorld(fixture, origin.x + u * 64, origin.y + v * 64), [1,1]);
  for (const point of [[63,96],[96,63],[256,96],[96,256]]) assert.equal(gridAtWorld(fixture, ...point), undefined);
  assert.deepEqual(gridAtWorld(fixture, 192, 160), [2,1], 'a shared edge belongs to the next square');
  assert.equal(tileDepth(fixture, 0, 1), tileDepth(fixture, 2, 1), 'row depth ignores column');
  assert.ok(tileDepth(fixture, 1, 2) > tileDepth(fixture, 1, 1), 'lower row paints in front');
}
const water = { tiles: [[{kind:'plain',height:0},{kind:'water',height:0}],[{kind:'water',height:0},{kind:'water',height:0}]] };
assert.ok(terrainEdges(water,1,0).some(edge => edge.texture === 'ground-bank-west'));
assert.ok(!terrainEdges(water,1,0).some(edge => edge.texture === 'ground-bank-south'), 'joined water has no internal bank');
const ledge = { tiles: [[{kind:'plain',height:1},{kind:'plain',height:0}]] };
assert.ok(terrainEdges(ledge,0,0).some(edge => edge.texture === 'ground-ledge-east'));
ledge.tiles[0][0].slope = 'east';
assert.ok(!terrainEdges(ledge,0,0).some(edge => edge.texture === 'ground-ledge-east'));
assert.deepEqual(game.unitSet('bulbasaur').facingRows, [0,6,2,4], 'cardinal source rows replace diagonal isometric rows');
assert.ok(game.unitAnimationKey('bulbasaur',3,'idle').endsWith('-4'), 'allies face straight up');
assert.ok(game.unitAnimationKey('bulbasaur',0,'idle').endsWith('-0'), 'enemies face straight down');
for (const [to, expected] of [[[1,0],2],[[-1,0],1],[[0,-1],3],[[0,1],0]]) assert.equal(game.facingBetween([0,0],to,0),expected);

// Check the actual movement and projectile behavior through a controlled corridor,
// rather than only inspecting catalog flags. Low logs/stumps still allow attacks.
const objectRules = {
  tree: [true, true], rock: [true, true], bush: [false, false],
  'fallen-log': [true, false], flower: [false, false], 'grass-tuft': [false, false],
  'tree-stump': [true, false], 'pine-tree': [true, true], fern: [false, false], mushrooms: [false, false],
  'ancient-tree': [true, true], 'standing-stone': [true, true],
};
for (const [id, [blocksMove, blocksSight]] of Object.entries(objectRules)) {
  const tile = { kind: 'plain', height: 0, object: id };
  assert.ok(TERRAIN_OBJECTS[id], `forest object ${id} should be registered`);
  assert.equal(objectBlocksMovement(tile), blocksMove, `${id}: movement collision`);
  assert.equal(objectBlocksSight(tile), blocksSight, `${id}: line-of-sight collision`);
  const corridor = { tiles: [[{ kind: 'plain', height: 0 }, tile, { kind: 'plain', height: 0 }]] };
  assert.equal(canTraverseTerrain(corridor, ground, 1, 0, 0, 0), !blocksMove, `${id}: grounded movement through footprint`);
  assert.equal(canTraverseTerrain(corridor, { canFly: true, canSwim: false }, 1, 0, 0, 0), !blocksMove, `${id}: flying movement through footprint`);
  assert.equal(hasLineOfSight({ map: corridor, time: 0 }, [0, 0], [2, 0]), !blocksSight, `${id}: ranged attack through footprint`);
}
for (const id of ['tree-stump', 'pine-tree', 'fern', 'mushrooms', 'fallen-log', 'ancient-tree', 'standing-stone']) assert.ok(objectUse.has(id), `new forests should visibly use ${id}`);

// The boss's ceremonial floor must remain an open fight, with independent
// grounded approaches and no obstacle planted over its original objective.
const bossMap = MAPS[bossId];
assert.deepEqual(bossMap.capture, [4, 4], 'Heartwood retains its capture coordinate');
assert.equal(bossMap.tiles[4][4].surface, 'seal', 'capture objective sits on the ceremonial seal');
for (let y = 2; y <= 5; y++) for (let x = 2; x <= 5; x++) {
  assert.ok(bossMap.tiles[y][x].height > 0, 'the fighting dais must form a raised central platform');
  assert.equal(objectBlocksMovement(bossMap.tiles[y][x]), false, 'the central arena must stay open for combat');
  if (bossMap.tiles[y][x].slope) assert.ok(terrainArt(bossMap.tiles[y][x], x, y).url.includes('/ramp-stone-'), 'boss ramps must share the dais paving');
}
for (const approach of [[3, 6], [4, 6], [1, 3], [6, 3]]) assert.ok(terrainReachable(bossMap, approach, ground).has('4,4'), `Heartwood: grounded approach ${approach} must reach the seal`);
assert.equal(bossMap.tiles.flat().filter(tile => tile.object === 'ancient-tree').length, 2, 'two old-growth guardians frame Heartwood');
assert.equal(bossMap.tiles.flat().filter(tile => tile.object === 'standing-stone').length, 4, 'four standing stones mark the arena perimeter');
for (const id of [...NORMAL_MAP_IDS, ELITE_MAP_ID]) assert.ok(MAPS[id].tiles.flat().every(tile => tile.surface !== 'stone' && tile.surface !== 'seal' && tile.object !== 'ancient-tree' && tile.object !== 'standing-stone'), `${id}: ceremonial art belongs to the boss arena`);

// Exercise map choice and legal battle creation at every campaign column. The
// synthetic node removes route randomness from this content-coverage check.
const selectedMaps = [];
for (let column = 1; column < ROUTE_COLUMNS; column++) {
  const run = newRun(['bulbasaur', 'squirtle', 'charmander']);
  const node = { id: `forest-check-${column}`, column, lane: 1.5, kind: 'battle' };
  run.route.nodes = [node];
  run.currentNodeId = node.id;
  run.phase = 'prepare';
  const definition = encounterDefinition(run);
  assert.equal(definition.mapId, NORMAL_MAP_IDS[(column - 1) % NORMAL_MAP_IDS.length], `normal route column ${column}: map rotation`);
  assert.equal(definition.objective, 'defeat', 'normal forests retain the defeat objective');
  const started = startBattle(run);
  assert.equal(started.battle.map.id, definition.mapId, `column ${column}: battle loads selected forest`);
  assert.equal(new Set(started.battle.units.map(unit => `${unit.x},${unit.y}`)).size, started.battle.units.length, `column ${column}: both teams deploy into distinct cells`);
  for (const unit of started.battle.units) assert.equal(unit.facing, unit.side === 'player' ? 3 : 0, 'team deployment uses north/south facing');
  for (const unit of started.battle.units) assert.ok(canDeploy(started.battle.map, unit.species, [unit.x, unit.y], unit.side === 'player' ? 'ally' : 'enemy'), `column ${column}: ${unit.name} should have a legal start`);
  selectedMaps.push(definition.mapId);
}
assert.equal(new Set(selectedMaps).size, NORMAL_MAP_IDS.length, 'every new normal forest should occur in the campaign rotation');
for (const [kind, column, expectedMap, objective] of [['elite', 3, ELITE_MAP_ID, 'defeat'], ['boss', ROUTE_COLUMNS, bossId, 'defeat-and-capture']]) {
  const run = newRun(['bulbasaur']);
  run.route.nodes = [{ id: `forest-check-${kind}`, column, lane: 1.5, kind }];
  run.currentNodeId = run.route.nodes[0].id;
  run.phase = 'prepare';
  assert.equal(encounterDefinition(run).mapId, expectedMap, `${kind}: dedicated arena`);
  assert.equal(encounterDefinition(run).objective, objective, `${kind}: objective`);
  assert.equal(startBattle(run).battle.map.id, expectedMap, `${kind}: dedicated battle creation`);
}

// Every registered forest tile and prop must be loadable with the geometry used
// by the battle renderer and preparation SVG. Missing files can pass TypeScript.
const manifest = JSON.parse(await readFile('public/assets/environment/top-down/top-down-manifest.json', 'utf8'));
assert.deepEqual(manifest.tilePixels, [64,64]);
const urls = new Set([...Object.values(manifest.tiles).flat(), ...Object.values(manifest.ramps).flatMap(Object.values), ...Object.values(manifest.edges), ...Object.values(manifest.decorations)]);
for (const url of urls) {
  const svg = await readFile(resolve('public',url.slice(1)), 'utf8');
  assert.match(svg, /width="64" height="64" viewBox="0 0 64 64"/, `${url}: square art dimensions`);
}
for (const object of Object.values(TERRAIN_OBJECTS)) assert.ok(manifest.decorations[object.asset], 'every object needs top-down art');
for (const map of Object.values(MAPS)) for (let y=0;y<map.tiles.length;y++) for (let x=0;x<map.tiles[y].length;x++) {
  assert.ok(urls.has(terrainArt(map.tiles[y][x],x,y).url), 'all authored floors resolve to registered art');
  for (const edge of terrainEdges(map,x,y)) assert.ok(urls.has(edge.url), 'all neighbor borders resolve');
}
console.log(`PASS: ${Object.keys(MAPS).length} forests; ${groundCells} connected ground cells; ${ramps} bidirectional ramps; ${cliffEdges} blocked cliff edges; ${squareCenters} square click centers; ${Object.keys(objectRules).length} object collision/LoS profiles; ${urls.size} square SVG assets.`);
console.log('Square picking, cardinal facing, open ramps, shoreline borders, and row depth passed.');
console.log(`Normal campaign rotation: ${selectedMaps.join(' -> ')}. Elite and boss arena selection passed.`);
