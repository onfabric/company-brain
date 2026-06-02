import { rm } from 'node:fs/promises';
import { join } from 'node:path';

const APP_DIR = import.meta.dir;
const DIST_DIR = join(APP_DIR, 'dist');
const SERVER_OUT = join(DIST_DIR, 'server');

console.log('Cleaning dist...');
await rm(DIST_DIR, { recursive: true, force: true });

console.log('Compiling binary...');
const buildResult = await Bun.build({
  entrypoints: ['./src/index.ts'],
  compile: { outfile: SERVER_OUT },
  minify: { whitespace: true, syntax: true },
  target: 'bun',
});

if (!buildResult.success) {
  console.error('Build failed:', JSON.stringify(buildResult, null, 2));
  process.exit(1);
}

console.log('Done');
