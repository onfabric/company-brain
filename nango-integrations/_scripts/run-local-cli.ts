import { existsSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_NANGO_HOSTPORT = 'http://localhost:3003';
const NANGO_BIN = join(import.meta.dir, '../node_modules/.bin/nango');

const args = Bun.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: bun run nango <command> [...args]');
  process.exit(1);
}

if (!existsSync(NANGO_BIN)) {
  console.error('Local Nango CLI not found. Run `bun install` from the repository root.');
  process.exit(1);
}

const child = Bun.spawn({
  cmd: [NANGO_BIN, ...args],
  cwd: join(import.meta.dir, '..'),
  env: {
    ...process.env,
    NANGO_HOSTPORT: process.env.NANGO_HOSTPORT ?? DEFAULT_NANGO_HOSTPORT,
    NANGO_CLI_UPGRADE_MODE: process.env.NANGO_CLI_UPGRADE_MODE ?? 'ignore',
    NANGO_CLI_DEPENDENCY_UPDATE: process.env.NANGO_CLI_DEPENDENCY_UPDATE ?? 'false',
  },
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
});

process.exit(await child.exited);
