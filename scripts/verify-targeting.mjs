import assert from 'node:assert/strict';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { build } from 'esbuild';

// Run the same planner against the former, deliberately broad candidate bounds.
// Keep all scoring, yielding, and routing rules shared so this isolates aim pruning.
const plannerSource = await readFile('src/game/enemyPlanner.ts', 'utf8');
assert.ok(plannerSource.includes('aimBoundsForTarget, '), 'planner must use shared aim bounds');
const bundle = await build({
  stdin: { contents: `export { MOVES } from './src/content/moves';
    export { aimBoundsForTarget, affectedTiles, canHitAtTarget, canHitWithMove, createLabBattle } from './src/game/engine';
    export { AttackPositionSearch } from './src/game/grid';
    export { EnemyPlanner } from './src/game/enemyPlanner';
    export { EnemyPlanner as LegacyEnemyPlanner } from 'legacy-planner';`, resolveDir: process.cwd(), sourcefile: 'targeting-verification.ts' },
  bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'targeting-fixtures', setup(builder) {
    builder.onResolve({ filter: /^legacy-(planner|targeting)$/ }, args => ({ path: args.path, namespace: 'targeting-fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'targeting-fixture' }, args => ({
      contents: args.path === 'legacy-planner'
        ? `${plannerSource.replace('aimBoundsForTarget, ', '')}\nimport { aimBoundsForTarget } from 'legacy-targeting';`
        : `import { MOVES } from '../content/moves';
          export function aimBoundsForTarget(map, moveId, target) {
            const move = MOVES[moveId], radiusX = move.area?.width ?? 1, radiusY = move.area?.height ?? 1;
            return { minX: Math.max(0, target.x - radiusX), maxX: Math.min(map.tiles[0].length - 1, target.x + radiusX),
              minY: Math.max(0, target.y - radiusY), maxY: Math.min(map.tiles.length - 1, target.y + radiusY) };
          }`,
      loader: 'ts', resolveDir: resolve('src/game'),
    }));
    builder.onResolve({ filter: /\.csv\?raw$/ }, args => ({ path: resolve(args.resolveDir, args.path.slice(0, -4)), namespace: 'raw-csv' }));
    builder.onLoad({ filter: /.*/, namespace: 'raw-csv' }, async args => ({ contents: await readFile(args.path, 'utf8'), loader: 'text' }));
  } }],
});
const bundlePath = join(tmpdir(), `pokemon-targeting-${randomUUID()}.mjs`);
await writeFile(bundlePath, bundle.outputFiles[0].contents);
let api;
try { api = await import(pathToFileURL(bundlePath).href); }
finally { await unlink(bundlePath); }
const { MOVES, aimBoundsForTarget, affectedTiles, canHitAtTarget, canHitWithMove, createLabBattle,
  AttackPositionSearch, EnemyPlanner, LegacyEnemyPlanner } = api;

const battle = createLabBattle({ allySpecies: 'lapras', enemySpecies: 'pikachu', allyLevel: 10, enemyLevel: 10,
  allyItem: 'None', enemyItem: 'None', weather: 'clear', seed: 20261002 });
const [target, source] = battle.units;
target.id = 'target'; source.id = 'source'; battle.current = source.id;
source.ap = 8; source.maxAp = 8;
function mapTiles(width, height, variant = 0) {
  return Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => {
    const tile = { kind: 'plain', height: 0 };
    if (variant === 1 && (x + y * 3) % 7 === 0) tile.kind = 'wall';
    if (variant === 2) {
      tile.height = (x + y) % 3;
      if ((x + y) % 4 === 0) tile.object = 'tree';
      else if ((x + y) % 4 === 1) tile.object = 'fallen-log';
      tile.slope = ['north', 'south', 'east', 'west'][x % 4];
    }
    if (variant === 3) {
      tile.kind = (x + y) % 5 === 0 ? 'water' : (x + y) % 5 === 1 ? 'lava' : 'plain';
      tile.coverUntil = (x + y) % 3 === 0 ? 150 : 151;
      tile.mudUntil = 151; tile.hazardUntil = 151;
    }
    return tile;
  }));
}
function boundedAims(map, moveId, unit) {
  const bounds = aimBoundsForTarget(map, moveId, unit), aims = [];
  if (bounds) for (let y = bounds.minY; y <= bounds.maxY; y++)
    for (let x = bounds.minX; x <= bounds.maxX; x++) aims.push([x, y]);
  return aims;
}
function exhaustiveAims(map, moveId, unit) {
  const move = MOVES[moveId], aims = [];
  for (let y = 0; y < map.tiles.length; y++) for (let x = 0; x < map.tiles[y].length; x++) {
    const includesTarget = move.target === 'unit' ? x === unit.x && y === unit.y
      : move.target === 'tile' && affectedTiles(map, moveId, x, y).some(([tx, ty]) => tx === unit.x && ty === unit.y);
    if (includesTarget) aims.push([x, y]);
  }
  return aims;
}
function exhaustiveCanHit(state, attacker, moveId, defender) {
  for (let y = 0; y < state.map.tiles.length; y++) for (let x = 0; x < state.map.tiles[y].length; x++)
    if (canHitAtTarget(state, attacker, moveId, x, y, defender)) return true;
  return false;
}
function legacyCanHit(state, attacker, moveId, defender) {
  const move = MOVES[moveId];
  if (!move?.power || defender.side === attacker.side || defender.hp <= 0) return false;
  if (move.target === 'unit') return canHitAtTarget(state, attacker, moveId, defender.x, defender.y, defender);
  if (move.target !== 'tile') return false;
  const radiusX = move.area?.width ?? 1, radiusY = move.area?.height ?? 1;
  for (let y = Math.max(0, defender.y - radiusY); y <= Math.min(state.map.tiles.length - 1, defender.y + radiusY); y++)
    for (let x = Math.max(0, defender.x - radiusX); x <= Math.min(state.map.tiles[0].length - 1, defender.x + radiusX); x++)
      if (canHitAtTarget(state, attacker, moveId, x, y, defender)) return true;
  return false;
}

const syntheticIds = [];
for (const anchor of ['corner', 'center']) for (const width of [1, 2, 3, 4]) for (const height of [1, 2, 3, 4]) {
  const id = `test-${anchor}-${width}-${height}`;
  MOVES[id] = { ...MOVES.bubble, area: { width, height, anchor } }; syntheticIds.push(id);
}
MOVES['test-tile-no-area'] = { ...MOVES.bubble, area: undefined }; syntheticIds.push('test-tile-no-area');
MOVES['test-unit-with-area'] = { ...MOVES.ember, area: { width: 4, height: 2, anchor: 'center' } }; syntheticIds.push('test-unit-with-area');
const moveIds = Object.keys(MOVES);
let geometryChecks = 0, hitChecks = 0;
battle.map.tiles = mapTiles(7, 5);
for (const moveId of moveIds) for (let y = 0; y < 5; y++) for (let x = 0; x < 7; x++) {
  assert.deepEqual(boundedAims(battle.map, moveId, { x, y }), exhaustiveAims(battle.map, moveId, { x, y }), `aim order/coverage: ${moveId} at ${x},${y}`);
  geometryChecks++;
}
for (let variant = 0; variant < 4; variant++) {
  battle.map.tiles = mapTiles(7, 5, variant); battle.time = variant === 3 ? 150 : 149;
  battle.weather = ['clear', 'rain', 'sandstorm', 'sun'][variant];
  for (const moveId of moveIds) for (let sy = 0; sy < 5; sy++) for (let sx = 0; sx < 7; sx++)
    for (let ty = 0; ty < 5; ty++) for (let tx = 0; tx < 7; tx++) {
      source.x = sx; source.y = sy; target.x = tx; target.y = ty;
      const expected = exhaustiveCanHit(battle, source, moveId, target);
      assert.equal(canHitWithMove(battle, source, moveId, target), expected, `hit: variant ${variant}, ${moveId}, ${sx},${sy} -> ${tx},${ty}`);
      hitChecks++;
    }
}
for (const moveId of moveIds) {
  target.hp = 0;
  assert.equal(canHitWithMove(battle, source, moveId, target), false, 'fainted targets');
  target.hp = target.maxHp; target.side = source.side;
  assert.equal(canHitWithMove(battle, source, moveId, target), false, 'same-side targets');
  target.side = 'player';
}

function settle(Planner, state, budget) {
  const planner = new Planner(); let batches = 0, result;
  do { result = planner.plan(state, budget); batches++; assert.ok(batches < 10000, 'bounded planner must settle'); } while (result.pending);
  return { action: result.action, batches };
}
const loadouts = [['ember', 'tackle', 'iceShard', 'swift'], ['bubble', 'thunderbolt', 'harden', 'howl'],
  ['test-center-3-2', 'test-corner-4-3', 'tailWhip', 'sunnyDay'], ['stealthRock', 'trickRoom', 'harden', 'howl']];
let plannerChecks = 0, currentBatches = 0, legacyBatches = 0;
const plannerActions = new Map();
for (let scenario = 0; scenario < 32; scenario++) {
  battle.map.tiles = mapTiles(7, 5, scenario % 4);
  battle.time = scenario % 2 ? 150 : 149; battle.weather = ['clear', 'rain', 'sandstorm', 'sun'][scenario % 4];
  source.x = scenario % 7; source.y = scenario % 5;
  target.x = (scenario * 3 + 1) % 7; target.y = (scenario * 2 + 1) % 5;
  // Occupancy participates in pursuit; several targets also exercise stable damage/distance ordering.
  battle.units = [source, target, { ...target, id: 'second-target', x: (target.x + 2) % 7, y: (target.y + 2) % 5 },
    { ...source, id: 'blocker', x: (source.x + 1) % 7, y: source.y }];
  source.moves = loadouts[scenario % loadouts.length]; source.ap = [0, 1, 3, 8][Math.floor(scenario / 4) % 4];
  source.movedThisTurn = scenario >= 24; source.attackedThisTurn = scenario >= 28;
  const snapshot = JSON.stringify(battle);
  for (const budget of [1, 2, 32, 10000]) {
    const current = settle(EnemyPlanner, battle, budget), legacy = settle(LegacyEnemyPlanner, battle, budget);
    assert.deepEqual(current.action, legacy.action, `planner action: scenario ${scenario}, budget ${budget}`);
    assert.equal(JSON.stringify(battle), snapshot, 'planning must not mutate battle state or RNG');
    plannerActions.set(current.action.kind, (plannerActions.get(current.action.kind) ?? 0) + 1);
    currentBatches += current.batches; legacyBatches += legacy.batches; plannerChecks++;
  }
}
for (const moves of loadouts.slice(0, 3)) {
  battle.map.tiles = mapTiles(16, 16); battle.time = 150; battle.weather = 'clear';
  source.x = 14; source.y = 14; target.x = 1; target.y = 1;
  source.moves = moves; source.ap = 3; source.movedThisTurn = false; source.attackedThisTurn = false;
  battle.units = [source, target, { ...source, id: 'blocker', x: 13, y: 14 }];
  const snapshot = JSON.stringify(battle);
  for (const budget of [1, 2, 32, 10000]) {
    const current = settle(EnemyPlanner, battle, budget), legacy = settle(LegacyEnemyPlanner, battle, budget);
    assert.deepEqual(current.action, legacy.action, `far pursuit action: ${moves.join(',')}, budget ${budget}`);
    assert.equal(JSON.stringify(battle), snapshot, 'pursuit planning must not mutate battle state or RNG');
    plannerActions.set(current.action.kind, (plannerActions.get(current.action.kind) ?? 0) + 1);
    currentBatches += current.batches; legacyBatches += legacy.batches; plannerChecks++;
  }
}
for (const kind of ['move', 'move-use', 'pass']) assert.ok(plannerActions.has(kind), `planner fixtures must cover ${kind}`);
console.log(`Verified ${geometryChecks} ordered aim sets, ${hitChecks} exhaustive hit comparisons, and ${plannerChecks} planner actions/state checks.`);
console.log(`Planner fixture totals: ${legacyBatches} legacy batches -> ${currentBatches} optimized batches (budgets 1/2/32/10000).`);

// Benchmark the affected search callback on a fixed synthetic 32×32, 16-unit map.
battle.map.tiles = mapTiles(32, 32); battle.time = 150; battle.weather = 'clear';
source.x = 30; source.y = 30; source.moves = ['bubble']; source.ap = 3; source.movedThisTurn = false; source.attackedThisTurn = false;
target.x = 1; target.y = 1;
battle.units = [source, target, ...Array.from({ length: 14 }, (_, index) => ({ ...target, id: `bench-unit-${index}`, side: index < 7 ? 'player' : 'enemy', x: 16, y: index * 2 + 1 }))];
function pursuit(canHit) {
  const search = new AttackPositionSearch(battle, source, (x, y) => canHit(battle, { ...source, x, y }, 'bubble', target));
  let batches = 0, result;
  do { result = search.advance(32); batches++; } while (!result.done);
  return { path: result.path, batches };
}
assert.deepEqual(pursuit(canHitWithMove), pursuit(legacyCanHit), 'pursuit must preserve exact path and search batches');
function cpuSample(fn) {
  const start = performance.now();
  for (let i = 0; i < 10; i++) fn();
  return (performance.now() - start) / 10;
}
const legacySamples = [], currentSamples = [];
for (let i = 0; i < 20; i++) { pursuit(legacyCanHit); pursuit(canHitWithMove); }
for (let sample = 0; sample < 15; sample++) {
  if (sample % 2) {
    currentSamples.push(cpuSample(() => pursuit(canHitWithMove))); legacySamples.push(cpuSample(() => pursuit(legacyCanHit)));
  } else {
    legacySamples.push(cpuSample(() => pursuit(legacyCanHit))); currentSamples.push(cpuSample(() => pursuit(canHitWithMove)));
  }
}
const median = samples => samples.sort((a, b) => a - b)[Math.floor(samples.length / 2)];
const legacyMs = median(legacySamples), currentMs = median(currentSamples);
const route = pursuit(canHitWithMove);
console.log(`32×32, 16-unit Bubble pursuit: ${route.batches} batches, identical ${route.path.length}-tile path; median CPU ${legacyMs.toFixed(3)} ms legacy -> ${currentMs.toFixed(3)} ms optimized.`);
console.log('Node CPU timings exclude browser frame scheduling/rendering and vary by machine.');
for (const id of syntheticIds) delete MOVES[id];
