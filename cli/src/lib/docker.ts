import { existsSync } from 'node:fs';
import { nangoSubmodulePath, repoRoot } from './paths.ts';
import { commandSucceeds, run } from './shell.ts';

const HEALTH_TIMEOUT_SECONDS = 600;
const HEALTH_POLL_MS = 5000;
const MILLISECONDS_PER_SECOND = 1000;

export async function verifyLocalPrerequisites(): Promise<string[]> {
  const issues: string[] = [];

  if (!(await commandSucceeds(['docker', 'info']))) {
    issues.push('Docker is not running or the Docker CLI cannot reach the daemon.');
  }

  if (!existsSync(nangoSubmodulePath)) {
    issues.push('The nango submodule is missing. Run `git submodule update --init --recursive`.');
  }

  return issues;
}

export async function startLocalStack(verbose = false): Promise<void> {
  await run(['docker', 'compose', 'up', '-d', '--build'], { cwd: repoRoot, verbose });
  await waitForComposeHealth(verbose);
}

export async function waitForComposeHealth(verbose = false): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < HEALTH_TIMEOUT_SECONDS * MILLISECONDS_PER_SECOND) {
    const rows = await composeServices();
    const unhealthy = rows.filter((row) => !isComposeServiceReady(row));

    if (rows.length > 0 && unhealthy.length === 0) {
      return;
    }

    if (verbose && unhealthy.length > 0) {
      console.log(`Waiting for services: ${unhealthy.map((row) => row.name).join(', ')}`);
    }

    await Bun.sleep(HEALTH_POLL_MS);
  }

  const rows = await composeServices();
  const unhealthy = rows.filter((row) => !isComposeServiceReady(row));
  throw new Error(
    `Timed out waiting for local services: ${unhealthy.map((row) => `${row.name} ${row.state}/${row.health}`).join(', ')}`,
  );
}

export type ComposeService = {
  name: string;
  state: string;
  health: string;
  exitCode: string;
  status: string;
};

export async function composeServices(): Promise<ComposeService[]> {
  const output = await run(
    [
      'docker',
      'compose',
      'ps',
      '-a',
      '--format',
      '{{.Name}}|{{.State}}|{{.Health}}|{{.ExitCode}}|{{.Status}}',
    ],
    {
      cwd: repoRoot,
      capture: true,
    },
  );

  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [name = '', state = '', health = '', exitCode = '', status = ''] = line.split('|');
      return { name, state, health, exitCode, status };
    });
}

export function isComposeServiceReady(row: ComposeService): boolean {
  if (row.health) {
    return row.health === 'healthy';
  }

  if (row.state === 'exited') {
    return row.exitCode === '0';
  }

  return row.state === 'running';
}
