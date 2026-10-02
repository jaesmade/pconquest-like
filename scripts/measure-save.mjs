import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const bundle = await build({
  stdin: { contents: "export { newRun, startBattle } from './src/game/engine.ts'; export { snapshotRun } from './src/persistence/save.ts'; export { cloneBattleForCommand } from './src/game/clone.ts'; export { AttackPositionSearch } from './src/game/grid.ts'; export { MAPS } from './src/content/maps.ts'; export { createRoute } from './src/game/route.ts';", resolveDir: process.cwd(), sourcefile: 'measure-entry.ts' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  plugins: [{
    name: 'csv-raw',
    setup(plugin) {
      plugin.onResolve({ filter: /\.csv\?raw$/ }, args => ({ path: resolve(args.resolveDir, args.path.replace('?raw', '')), namespace: 'csv-raw' }));
      plugin.onLoad({ filter: /.*/, namespace: 'csv-raw' }, async args => ({ contents: await readFile(args.path, 'utf8'), loader: 'text' }));
    },
  }],
});
// A file keeps failed stack traces readable instead of printing the full base64 bundle.
const bundlePath = join(tmpdir(), `pokemon-measure-save-${randomUUID()}.mjs`);
await writeFile(bundlePath, bundle.outputFiles[0].contents);
let game;
try { game = await import(pathToFileURL(bundlePath).href); }
finally { await unlink(bundlePath); }
const { newRun, startBattle, snapshotRun, cloneBattleForCommand, AttackPositionSearch, MAPS, createRoute } = game;

function measure(label, fn, iterations) {
  for (let i = 0; i < 20; i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  return `${label}: ${((performance.now() - start) / iterations).toFixed(3)} ms`;
}

function syntheticRun(size) {
  const run = startBattle(newRun(['bulbasaur']));
  run.seed = run.rngState = run.battle.rngState = 12345;
  run.route = createRoute(run.seed);
  // Each case has its own immutable authored map, like production content.
  const authored = {
    id: `measure-${size}`, name: `Synthetic ${size}×${size}`, weather: 'clear',
    tiles: Array.from({ length: size }, () => Array.from({ length: size }, () => ({ kind: 'plain', height: 0 }))),
    zones: Array.from({ length: size }, () => Array.from({ length: size }, (_, x) => x < 2 ? 'ally' : x >= size - 2 ? 'enemy' : 'neutral')),
    playerSpawns: [[1, 1]], enemySpawns: [[size - 2, 1]],
  };
  MAPS[authored.id] = authored;
  run.battle.map = structuredClone(authored);
  run.battle.weather = 'clear';
  run.battle.weatherUntil = 0;
  run.battle.units.forEach((unit, i) => { unit.x = unit.side === 'player' ? 1 : size - 2; unit.y = i + 1; });
  return run;
}

for (const size of [8, 32]) {
  const run = syntheticRun(size);
  const iterations = 1000;
  const json = JSON.stringify({ savedAt: new Date().toISOString(), run });
  const bytes = Buffer.byteLength(json, 'utf8');
  const snapshot = snapshotRun(run), compact = JSON.stringify(snapshot), schema = `v${snapshot.schemaVersion}`;
  assert.equal(run.battle.map.tiles.length, size);
  assert.equal(run.battle.map.tiles[0].length, size);
  assert.deepEqual(snapshot.run.battle.map.changes, []);
  console.log(`${size}×${size}: full-map ${bytes} bytes; ${schema} ${Buffer.byteLength(compact, 'utf8')} bytes; ${measure('full clone', () => structuredClone(run.battle), 100)}; ${measure('command clone', () => cloneBattleForCommand(run.battle), iterations)}; ${measure('full-map stringify', () => JSON.stringify({ savedAt: '', run }), iterations)}; ${measure(`${schema} stringify`, () => JSON.stringify(snapshotRun(run)), iterations)}`);

  const authored = MAPS[run.battle.map.id];
  run.battle.map.tiles[1][1].coverUntil = run.battle.time + 100;
  run.battle.tileChanges['1,1'] = { x: 1, y: 1, coverUntil: run.battle.time + 100 };
  const changed = snapshotRun(run).run.battle.map;
  assert.equal(changed.signature, snapshot.run.battle.map.signature);
  assert.equal(changed.objectSignature, snapshot.run.battle.map.objectSignature);
  assert.deepEqual(changed.changes, [run.battle.tileChanges['1,1']]);
  // New content with the same ID must get a new fingerprint by authored reference.
  MAPS[authored.id] = structuredClone(authored);
  MAPS[authored.id].tiles[1][1].object = 'fallen-log';
  const replacement = snapshotRun(run).run.battle.map;
  assert.equal(replacement.signature, snapshot.run.battle.map.signature);
  assert.notEqual(replacement.objectSignature, snapshot.run.battle.map.objectSignature);
  MAPS[authored.id] = authored;
}

// Synthetic future-cap state; current gameplay still limits deployment and roster size.
const capped = syntheticRun(32);
const partyBase = capped.party;
capped.party = Array.from({ length: 20 }, (_, i) => ({ ...partyBase[i % partyBase.length], id: `bench-party-${i}` }));
const unitBase = capped.battle.units;
capped.battle.units = Array.from({ length: 16 }, (_, i) => ({
  ...unitBase[i % unitBase.length], id: `bench-unit-${i}`, partyId: i < 8 ? capped.party[i].id : undefined,
  side: i < 8 ? 'player' : 'enemy', x: i < 8 ? 1 : 30, y: i % 8,
}));
capped.battle.turnOrder = capped.battle.units.map(unit => unit.id);
capped.battle.current = capped.battle.turnOrder[0];
const cappedSnapshot = snapshotRun(capped), cappedJson = JSON.stringify(cappedSnapshot), schema = `v${cappedSnapshot.schemaVersion}`;
assert.equal(capped.battle.map.tiles.length, 32);
console.log(`32×32 + 16 units + 20 owned: ${schema} ${Buffer.byteLength(cappedJson, 'utf8')} bytes; ${measure('command clone', () => cloneBattleForCommand(capped.battle), 1000)}; ${measure(`${schema} stringify`, () => JSON.stringify(snapshotRun(capped)), 1000)}`);

const pursuer = capped.battle.units[8], target = capped.battle.units[0];
const search = new AttackPositionSearch(capped.battle, pursuer, (x, y) => Math.abs(x - target.x) + Math.abs(y - target.y) === 1);
let batches = 0, result;
const searchStart = performance.now();
do { result = search.advance(32); batches++; } while (!result.done);
console.log(`32×32 open-grid far pursuit: ${batches} planner batches at 32 nodes/batch; ${(performance.now() - searchStart).toFixed(2)} ms search CPU; ${result.path.length} path tiles`);
console.log('PASS: authored fingerprints, transient tile deltas, and same-ID content replacement.');
