import { existsSync } from 'node:fs';
import { cp, rm } from 'node:fs/promises';
import { join } from 'node:path';

const APP_DIR = import.meta.dir;
const WORKSPACE_DIR = join(APP_DIR, '..');
const DIST_DIR = join(APP_DIR, 'dist');
const DASHBOARD_DIR = join(WORKSPACE_DIR, 'dashboard');
const DASHBOARD_DIST_SRC = join(DASHBOARD_DIR, 'dist');
const DASHBOARD_DIST_DST = join(DIST_DIR, 'dashboard');
const MIGRATIONS_SRC = join(APP_DIR, 'src/db/migrations');
const MIGRATIONS_DST = join(DIST_DIR, 'migrations');
const SERVER_OUT = join(DIST_DIR, 'server');

console.log('🧹 Cleaning dist...');
await rm(DIST_DIR, { recursive: true, force: true });

console.log('🖥️ Building dashboard...');
if (!existsSync(DASHBOARD_DIR)) {
  console.error('❌ Dashboard workspace is missing.');
  process.exit(1);
}
const dashboardBuild = Bun.spawn(['bun', '--filter', '@company-brain/dashboard', 'build'], {
  cwd: WORKSPACE_DIR,
  stdout: 'inherit',
  stderr: 'inherit',
});
if ((await dashboardBuild.exited) !== 0) {
  console.error('❌ Dashboard build failed');
  process.exit(1);
}

console.log('🔨 Compiling binary...');
const buildResult = await Bun.build({
  entrypoints: ['./src/index.ts'],
  compile: { outfile: SERVER_OUT },
  minify: { whitespace: true, syntax: true },
  target: 'bun',
});

if (!buildResult.success) {
  console.error('❌ Build failed:', JSON.stringify(buildResult, null, 2));
  process.exit(1);
}

console.log('📄 Copying migrations...');
await cp(MIGRATIONS_SRC, MIGRATIONS_DST, { recursive: true });

console.log('📄 Copying dashboard...');
await cp(DASHBOARD_DIST_SRC, DASHBOARD_DIST_DST, { recursive: true });

console.log('✅ Done');
