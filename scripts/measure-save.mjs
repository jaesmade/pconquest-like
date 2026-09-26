import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const bundle = await build({
  stdin: { contents: "export { newRun, startBattle } from './src/game/engine.ts'; export { snapshotRun } from './src/persistence/save.ts'; export { cloneBattleForCommand } from './src/game/clone.ts'; export { AttackPositionSearch } from './src/game/grid.ts'; export { MAPS } from './src/content/maps.ts';", resolveDir: process.cwd(), sourcefile: 'measure-entry.ts' },
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
const source = Buffer.from(bundle.outputFiles[0].contents).toString('base64');
const { newRun, startBattle, snapshotRun, cloneBattleForCommand, AttackPositionSearch, MAPS } = await import(`data:text/javascript;base64,${source}`);

function measure(label, fn, iterations) {
  for (let i = 0; i < 5; i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  return `${label}: ${((performance.now() - start) / iterations).toFixed(3)} ms`;
}

for (const size of [8, 32]) {
  const run = startBattle(newRun('bulbasaur'));
  const base = run.battle.map.tiles;
  const baseZones = run.battle.map.zones;
  run.battle.map.tiles = Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => ({ ...base[y % base.length][x % base[0].length] })));
  run.battle.map.zones = Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => baseZones[y % baseZones.length][x % baseZones[0].length]));
  MAPS[run.battle.map.id].tiles = run.battle.map.tiles;
  MAPS[run.battle.map.id].zones = run.battle.map.zones;
  const iterations = 100;
  const json = JSON.stringify({ savedAt: new Date().toISOString(), run });
  const bytes = Buffer.byteLength(json, 'utf8');
  const compact = JSON.stringify(snapshotRun(run));
  console.log(`${size}×${size}: full-map ${bytes} bytes; v9 ${Buffer.byteLength(compact, 'utf8')} bytes; ${measure('full clone', () => structuredClone(run.battle), iterations)}; ${measure('command clone', () => cloneBattleForCommand(run.battle), iterations)}; ${measure('full-map stringify', () => JSON.stringify({ savedAt: '', run }), iterations)}; ${measure('v9 stringify', () => JSON.stringify(snapshotRun(run)), iterations)}`);
}

// Synthetic future-cap state; current gameplay still limits deployment and roster size.
const capped = startBattle(newRun('bulbasaur'));
const partyBase = capped.party;
capped.party = Array.from({ length: 20 }, (_, i) => ({ ...partyBase[i % partyBase.length], id: `bench-party-${i}` }));
const unitBase = capped.battle.units;
capped.battle.units = Array.from({ length: 16 }, (_, i) => ({
  ...unitBase[i % unitBase.length], id: `bench-unit-${i}`, partyId: i < 8 ? capped.party[i].id : undefined,
  side: i < 8 ? 'player' : 'enemy', x: i < 8 ? 1 : 30, y: i % 8,
}));
capped.battle.turnOrder = capped.battle.units.map(unit => unit.id);
capped.battle.current = capped.battle.turnOrder[0];
const cappedJson = JSON.stringify(snapshotRun(capped));
console.log(`32×32 + 16 units + 20 owned: v9 ${Buffer.byteLength(cappedJson, 'utf8')} bytes; ${measure('command clone', () => cloneBattleForCommand(capped.battle), 1000)}; ${measure('v9 stringify', () => JSON.stringify(snapshotRun(capped)), 1000)}`);

capped.battle.map.tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => ({ kind: 'plain', height: 0 })));
const pursuer = capped.battle.units[8], target = capped.battle.units[0];
const search = new AttackPositionSearch(capped.battle, pursuer, (x, y) => Math.abs(x - target.x) + Math.abs(y - target.y) === 1);
let batches = 0, result;
const searchStart = performance.now();
do { result = search.advance(32); batches++; } while (!result.done);
console.log(`32×32 open-grid far pursuit: ${batches} planner batches at 32 nodes/batch; ${(performance.now() - searchStart).toFixed(2)} ms search CPU; ${result.path.length} path tiles`);
