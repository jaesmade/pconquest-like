import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const bundle = await build({
  stdin: { contents: "export { newRun, startBattle } from './src/game/engine.ts'; export { snapshotRun } from './src/persistence/save.ts'; export { cloneBattleForCommand } from './src/game/clone.ts'; export { MAPS } from './src/content/maps.ts';", resolveDir: process.cwd(), sourcefile: 'measure-entry.ts' },
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
const { newRun, startBattle, snapshotRun, cloneBattleForCommand, MAPS } = await import(`data:text/javascript;base64,${source}`);

function measure(label, fn, iterations) {
  for (let i = 0; i < 5; i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  return `${label}: ${((performance.now() - start) / iterations).toFixed(3)} ms`;
}

for (const size of [8, 64, 128]) {
  const run = startBattle(newRun('bulbasaur'));
  const base = run.battle.map.tiles;
  run.battle.map.tiles = Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => ({ ...base[y % base.length][x % base[0].length] })));
  MAPS[run.battle.map.id].tiles = run.battle.map.tiles;
  const iterations = size === 128 ? 20 : 100;
  const json = JSON.stringify({ schemaVersion: 6, savedAt: new Date().toISOString(), run });
  const bytes = Buffer.byteLength(json, 'utf8');
  const compact = JSON.stringify(snapshotRun(run));
  console.log(`${size}×${size}: v6 ${bytes} bytes; v7 ${Buffer.byteLength(compact, 'utf8')} bytes; ${measure('full clone', () => structuredClone(run.battle), iterations)}; ${measure('command clone', () => cloneBattleForCommand(run.battle), iterations)}; ${measure('v6 stringify', () => JSON.stringify({ schemaVersion: 6, savedAt: '', run }), iterations)}; ${measure('v7 stringify', () => JSON.stringify(snapshotRun(run)), iterations)}`);
}
