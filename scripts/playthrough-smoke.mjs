import { build } from 'esbuild';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const rawCsv = { name: 'vite-raw-csv', setup(builder) {
  builder.onResolve({ filter: /\.csv\?raw$/ }, args => ({ path: resolve(args.resolveDir, args.path.slice(0, -4)), namespace: 'raw-csv' }));
  builder.onLoad({ filter: /\.csv$/, namespace: 'raw-csv' }, async args => ({ contents: `export default ${JSON.stringify(await readFile(args.path, 'utf8'))}`, loader: 'js' }));
} };
const bundle = await build({ entryPoints: ['scripts/playthrough-smoke-entry.ts'], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent', plugins: [rawCsv] });
const bundlePath = join(tmpdir(), `pokemon-playthrough-${randomUUID()}.mjs`);
await writeFile(bundlePath, bundle.outputFiles[0].contents);
try { await import(pathToFileURL(bundlePath).href); }
finally { await unlink(bundlePath); }
