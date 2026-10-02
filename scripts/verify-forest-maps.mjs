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
      export { isoTileCenter, isoTileDepth, isoGridAtWorld } from './src/battle/isometric.ts';
      export { forestCliffFaces } from './src/battle/terrainArt.ts';
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
  encounterDefinition, startBattle, ROUTE_COLUMNS, isoTileCenter, isoTileDepth,
  isoGridAtWorld, forestCliffFaces } = game;

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
let groundCells = 0, ramps = 0, cliffEdges = 0, elevatedCenters = 0;
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
      assert.ok(['path', 'moss'].includes(tile.surface), `${label}: unknown forest surface`);
    }
    if (tile.kind === 'plain' && !objectBlocksMovement(tile)) {
      heights.add(tile.height);
      mapPlain++;
      assert.ok(reachable.has(`${x},${y}`), `${label}: every usable plain tile needs a grounded route from ally deployment`);
    }
    if (tile.height > 0) {
      elevatedCenters++;
      const center = isoTileCenter(map, x, y), picked = isoGridAtWorld(map, center.x, center.y);
      if (!picked || picked[0] !== x || picked[1] !== y) pickingFailures.push(`${label} -> ${picked?.join(',') ?? 'none'}`);
    }
    if (tile.slope) {
      const [dx, dy] = offsets[tile.slope], lower = map.tiles[y + dy]?.[x + dx];
      assert.ok(lower && lower.height === tile.height - 1 && ['plain', 'lava'].includes(lower.kind), `${label}: ramp must face traversable ground one level lower`);
      assert.equal(tile.object, undefined, `${label}: ramps must have no scenery`);
      assert.equal(lower.object, undefined, `${label}: ramp entrances must have no scenery`);
      assert.ok(canTraverseTerrain(map, ground, x, y, x + dx, y + dy), `${label}: a grounded unit must ascend the ramp`);
      assert.ok(canTraverseTerrain(map, ground, x + dx, y + dy, x, y), `${label}: a grounded unit must descend the ramp`);
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
assert.deepEqual(pickingFailures, [], 'elevated tile centers should pick their own grid cell');

// Soil buried beneath adjacent tiles must not become a foreground occluder.
// Small asymmetric fixtures distinguish south/east exposure and the exterior
// island edge, where the visible face also includes the base soil thickness.
const plateau = { tiles: [
  [{ kind: 'plain', height: 2 }, { kind: 'plain', height: 2 }],
  [{ kind: 'plain', height: 2 }, { kind: 'plain', height: 2 }],
] };
assert.deepEqual(forestCliffFaces(plateau, 0, 0).polygons, [], 'an internal same-height plateau must have no exposed front faces');
const ledge = { tiles: [
  [{ kind: 'plain', height: 2 }, { kind: 'plain', height: 1 }],
  [{ kind: 'plain', height: 0 }, { kind: 'plain', height: 0 }],
] };
const faceDepths = faces => faces.polygons.map(polygon => polygon[2].y - polygon[1].y);
assert.deepEqual(faceDepths(forestCliffFaces(ledge, 0, 0)), [40, 20], 'south/east cliff masks must expose two/one elevation steps respectively');
assert.deepEqual(faceDepths(forestCliffFaces(plateau, 1, 1)), [62, 62], 'a level-two map corner must expose full soil depth on both sides');
assert.deepEqual(faceDepths(forestCliffFaces({ tiles: [[{ kind: 'plain', height: 0 }]] }, 0, 0)), [22, 22], 'a ground-level exterior edge must preserve base soil depth');

// Elevation moves the art upward but cannot change its grid-footprint order.
// This is the Moonpool approach where a foreground upper terrace overlaps a
// ground-level actor; actors standing on that terrace must stay above its top.
const moonpool = MAPS[ELITE_MAP_ID];
assert.equal(moonpool.tiles[1][7].height, 0, 'Moonpool depth fixture needs a ground-level approach');
assert.equal(moonpool.tiles[2][8].height, 2, 'Moonpool depth fixture needs a foreground upper terrace');
const flatMoonpool = structuredClone(moonpool);
flatMoonpool.tiles[2][8].height = 0;
const upperDepth = isoTileDepth(moonpool, 8, 2);
assert.equal(upperDepth, isoTileDepth(flatMoonpool, 8, 2), 'changing elevation must preserve the footprint sort depth');
assert.equal(isoTileCenter(flatMoonpool, 8, 2).y - isoTileCenter(moonpool, 8, 2).y, 40, 'the depth fixture must still lift the upper terrace art');
assert.ok(isoTileDepth(moonpool, 7, 1) + 5 < upperDepth, 'the ground-level approach actor must draw behind the foreground upper top');
assert.ok(isoTileDepth(moonpool, 8, 2) + 5 > upperDepth, 'an actor on the upper terrace must draw above its own top');

// Check the actual movement and projectile behavior through a controlled corridor,
// rather than only inspecting catalog flags. Low logs/stumps still allow attacks.
const objectRules = {
  tree: [true, true], rock: [true, true], bush: [false, false],
  'fallen-log': [true, false], flower: [false, false], 'grass-tuft': [false, false],
  'tree-stump': [true, false], 'pine-tree': [true, true], fern: [false, false], mushrooms: [false, false],
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
for (const id of ['tree-stump', 'pine-tree', 'fern', 'mushrooms', 'fallen-log']) assert.ok(objectUse.has(id), `new forests should visibly use ${id}`);

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
const manifest = JSON.parse(await readFile('public/assets/environment/isometric/isometric-manifest.json', 'utf8'));
assert.deepEqual(manifest.tileTopPixels, [96, 48], 'tile top dimensions should match projection');
assert.equal(manifest.heightStepPixels, 20, 'art and projection elevation steps must agree');
const svgCache = new Map();
async function verifySvg(url, width, height, diamond = false) {
  assert.ok(typeof url === 'string' && url.startsWith('/assets/'), 'asset URL should use the public assets directory');
  let svg = svgCache.get(url);
  if (!svg) {
    svg = await readFile(resolve('public', url.slice(1)), 'utf8');
    svgCache.set(url, svg);
  }
  const opening = svg.match(/<svg\b[^>]*>/)?.[0];
  assert.ok(opening, `${url}: SVG root`);
  assert.match(opening, new RegExp(`\\bwidth=["']${width}["']`), `${url}: width`);
  assert.match(opening, new RegExp(`\\bheight=["']${height}["']`), `${url}: height`);
  assert.match(opening, new RegExp(`\\bviewBox=["']0 0 ${width} ${height}["']`), `${url}: viewBox`);
  if (diamond) assert.ok(/points=["']48,0 96,24 48,48 0,24["']/.test(svg), `${url}: aligned 96×48 top diamond`);
}
for (const variants of Object.values(manifest.tiles)) {
  assert.equal(variants.length, 3, 'each terrain kind needs levels 0–2');
  for (const [level, url] of variants.entries()) await verifySvg(url, 96, 72 + 20 * level, true);
}
for (const surface of ['grass', 'speckled', 'moss', 'path']) {
  const variants = manifest.forestTiles?.[surface];
  assert.ok(variants, `forest floor variant ${surface} must be registered`);
  assert.equal(variants.length, 3, `${surface}: height variants`);
  for (const [level, url] of variants.entries()) await verifySvg(url, 96, 72 + 20 * level, true);
}
assert.equal(manifest.forestCliffs?.length, 3, 'forest cliff overlays need levels 0–2');
for (const [level, url] of manifest.forestCliffs.entries()) await verifySvg(url, 96, 72 + 20 * level);
for (const direction of Object.keys(offsets)) await verifySvg(manifest.slopes[direction], 96, 48);
for (const [id, object] of Object.entries(TERRAIN_OBJECTS)) await verifySvg(manifest.decorations[object.asset], object.width, object.height);

console.log(`PASS: ${Object.keys(MAPS).length} forests; ${groundCells} connected ground cells; ${ramps} bidirectional ramps; ${cliffEdges} blocked cliff edges; ${elevatedCenters} elevated click centers; ${Object.keys(objectRules).length} object collision/LoS profiles; ${svgCache.size} SVG assets.`);
console.log('Terrain occlusion: buried plateau faces, asymmetric ledges, full border soil depth, and Moonpool footprint/actor ordering passed.');
console.log(`Normal campaign rotation: ${selectedMaps.join(' -> ')}. Elite and boss arena selection passed.`);
