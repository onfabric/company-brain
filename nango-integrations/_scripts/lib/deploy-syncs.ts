import type { SyncSpec } from './catalog.js';

export function stripWrapperArgs(args: string[], environment: string): string[] {
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

export function buildDeployCommands(
  selected: SyncSpec[],
  environment: string,
  passthroughArgs: string[],
): string[][] {
  return selected.map((sync) => [
    'bun',
    'run',
    'nango',
    'deploy',
    environment,
    '--integration',
    sync.integrationId,
    ...passthroughArgs,
  ]);
}

export async function deploySyncs(
  selected: SyncSpec[],
  environment: string,
  passthroughArgs: string[],
): Promise<void> {
  if (process.env.COMPANY_BRAIN_PACKAGED_INTEGRATIONS !== 'true') {
    await run(['bun', 'run', 'build:backend-client']);
  }

  for (const command of buildDeployCommands(selected, environment, passthroughArgs)) {
    await run(command);
  }
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
