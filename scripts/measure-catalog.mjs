import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// Instrument only the temporary bundle; the game has no profiling counters.
const probes = { name: 'catalog-validation-probes', setup(builder) {
  builder.onResolve({ filter: /^catalog-validation-probes$/ }, () => ({ path: 'counts', namespace: 'catalog-probes' }));
  builder.onLoad({ filter: /.*/, namespace: 'catalog-probes' }, () => ({ contents: `
    export const counts = { reachability: 0, zoneScans: 0, deploymentChecks: 0 };
    export function resetCounts() { for (const key of Object.keys(counts)) counts[key] = 0; }
  `, loader: 'js' }));
  builder.onResolve({ filter: /\.csv\?raw$/ }, args => ({ path: resolve(args.resolveDir, args.path.slice(0, -4)), namespace: 'raw-csv' }));
  builder.onLoad({ filter: /\.csv$/, namespace: 'raw-csv' }, async args => ({ contents: await readFile(args.path, 'utf8'), loader: 'text' }));
  builder.onLoad({ filter: /[\\/]game[\\/](grid|deployment)\.ts$/ }, async args => {
    let contents = await readFile(args.path, 'utf8');
    const functions = args.path.endsWith('grid.ts') ? [['terrainReachable', 'reachability']]
      : [['zoneCells', 'zoneScans'], ['canDeploy', 'deploymentChecks']];
    for (const [name, counter] of functions) {
      const instrumented = contents.replace(new RegExp(`(export function ${name}\\([^\\n]+ \\{\\r?\\n)`), `$1  counts.${counter}++;\n`);
      assert.notEqual(instrumented, contents, `profiling hook missing for ${name}`);
      contents = instrumented;
    }
    return { contents: `import { counts } from 'catalog-validation-probes';\n${contents}`, loader: 'ts' };
  });
} };
const bundle = await build({
  stdin: {
    contents: `
      export { validateCatalog } from './src/content/catalog.ts';
      export { MAPS } from './src/content/maps.ts';
      export { ENCOUNTERS } from './src/content/encounters.ts';
      export { counts, resetCounts } from 'catalog-validation-probes';
    `,
    resolveDir: process.cwd(), sourcefile: 'catalog-measure-entry.ts',
  },
  bundle: true, platform: 'node', format: 'esm', write: false,
  logLevel: 'silent', plugins: [probes],
});
const bundlePath = join(tmpdir(), `pokemon-catalog-measure-${randomUUID()}.mjs`);
await writeFile(bundlePath, bundle.outputFiles[0].contents);
let catalog;
try { catalog = await import(pathToFileURL(bundlePath).href); }
finally { await unlink(bundlePath); }

catalog.resetCounts();
assert.deepEqual(catalog.validateCatalog(), [], 'the current catalog should validate');
const operations = { ...catalog.counts };

// Each call must observe in-place fixture changes and discard its cached routes.
const map = catalog.MAPS[catalog.ENCOUNTERS[0].mapId];
const [startX, startY] = map.playerSpawns[0], tile = map.tiles[startY][startX];
const originalKind = tile.kind;
try {
  tile.kind = 'wall';
  const errors = catalog.validateCatalog();
  assert.ok(errors.some(error => error.includes('cannot reach ally ground')), 'changed terrain should invalidate route checks');
  assert.deepEqual(catalog.validateCatalog(), errors, 'invalid-content diagnostics should stay ordered and repeatable');
} finally { tile.kind = originalKind; }
assert.deepEqual(catalog.validateCatalog(), [], 'restored terrain should validate again');

for (let warmup = 0; warmup < 10; warmup++) catalog.validateCatalog();
const samples = [];
for (let sample = 0; sample < 50; sample++) {
  catalog.resetCounts();
  const start = performance.now();
  const errors = catalog.validateCatalog();
  samples.push(performance.now() - start);
  assert.deepEqual(errors, []);
  assert.deepEqual(catalog.counts, operations, 'each validation should perform the same work');
}
samples.sort((a, b) => a - b);
console.log(JSON.stringify({ operationsPerValidation: operations,
  medianMs: samples[Math.floor(samples.length / 2)], p95Ms: samples[Math.floor(samples.length * .95)],
  samples: samples.length, terrainMutationChecks: 'passed',
  scope: 'warmed Node validation CPU; excludes module loading, browser rendering, and FPS',
}, null, 2));
