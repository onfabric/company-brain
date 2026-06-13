import { firstPositionalArg, flagValue, hasFlag } from './lib/env.js';
import { parseIntegrationSelection, resolveSelectedSyncs, SYNC_SPECS } from './nango-resources.js';

const args = Bun.argv.slice(2);

if (hasFlag('--list', args)) {
  for (const sync of SYNC_SPECS) {
    console.log(`${sync.integrationId}\t${sync.syncName}\t${sync.label}`);
  }
  process.exit(0);
}

const environment = firstPositionalArg(args) ?? 'dev';
const selected = resolveSelectedSyncs(parseIntegrationSelection(flagValue('--only', args)));
const nangoArgs = stripWrapperArgs(args, environment);

await run(['bun', 'run', 'build:backend-client']);

if (selected.length === SYNC_SPECS.length && !flagValue('--only', args)) {
  await run(['bun', 'run', 'nango', 'deploy', environment, ...nangoArgs]);
} else {
  for (const sync of selected) {
    await run([
      'bun',
      'run',
      'nango',
      'deploy',
      environment,
      '--integration',
      sync.integrationId,
      ...nangoArgs,
    ]);
  }
}

function stripWrapperArgs(args: string[], environment: string): string[] {
  const output: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) {
      continue;
    }

    if (arg === environment) {
      continue;
    }

    if (arg === '--only') {
      index += 1;
      continue;
    }

    if (arg.startsWith('--only=')) {
      continue;
    }

    if (arg === '--list') {
      continue;
    }

    output.push(arg);
  }

  return output;
}

async function run(cmd: string[]): Promise<void> {
  const child = Bun.spawn({
    cmd,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const exitCode = await child.exited;
  if (exitCode !== 0) {
    throw new Error(`Command failed with exit ${exitCode}: ${cmd.join(' ')}`);
  }
}
