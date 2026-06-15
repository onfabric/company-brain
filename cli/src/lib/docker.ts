import { existsSync } from 'node:fs';
import { rootEnvPath, runtimePath } from './paths.ts';
import { commandSucceeds, run } from './shell.ts';

const HEALTH_TIMEOUT_SECONDS = 600;
const HEALTH_POLL_MS = 5000;
const MILLISECONDS_PER_SECOND = 1000;
const LOCAL_COMPANY_BRAIN_CONTAINERS = [
  'postgres-db',
  'nango-server',
  'nango-orchestrator',
  'nango-persist',
  'nango-jobs',
  'nango-redis',
  'nango-elasticsearch',
  'db-prepare',
  'brain',
  'dozzle',
] as const;
const LOCAL_COMPOSE_PROJECT = 'company-brain';
const LOCAL_DESTROY_ENV = {
  NANGO_DB_USER: 'nango',
  NANGO_DB_NAME: 'nango',
  NANGO_DB_PASSWORD: 'nango',
  NANGO_DB_SCHEMA: 'nango',
  NANGO_RECORDS_DATABASE_SCHEMA: 'nango_records',
  NANGO_ENCRYPTION_KEY: '',
  NANGO_SERVER_URL: 'http://localhost:3003',
  NANGO_PUBLIC_SERVER_URL: 'http://localhost:3003',
  NANGO_PUBLIC_CONNECT_URL: 'http://localhost:3009',
  NANGO_SECRET_KEY_DEV: '',
  FLAG_AUTH_ENABLED: 'false',
  NANGO_DASHBOARD_USERNAME: 'admin',
  NANGO_DASHBOARD_PASSWORD: 'admin',
  LOG_LEVEL: 'info',
  NANGO_SERVER_PORT: '3003',
  NANGO_CONNECT_UI_PORT: '3009',
  REDIS_PORT: '6379',
  ELASTICSEARCH_PORT: '9200',
  BRAIN_DB_USER: 'brain',
  BRAIN_DB_PASSWORD: 'brain',
  BRAIN_API_KEY: 'local',
  BRAIN_PUBLIC_URL: 'http://localhost:3010',
  BETTER_AUTH_SECRET: 'local',
  GOOGLE_CLIENT_ID: 'local',
  GOOGLE_CLIENT_SECRET: 'local',
  BRAIN_SERVER_PORT: '3010',
  DOZZLE_PORT: '8080',
};

export async function verifyLocalPrerequisites(): Promise<string[]> {
  const issues: string[] = [];

  if (!(await dockerDaemonIsReachable())) {
    issues.push('Docker is not running or the Docker CLI cannot reach the daemon.');
  }

  return issues;
}

export async function verifyDockerDaemon(): Promise<void> {
  if (!(await dockerDaemonIsReachable())) {
    throw new Error('Docker is not running or the Docker CLI cannot reach the daemon.');
  }
}

export async function startLocalStack(verbose = false): Promise<void> {
  await run([...composeCommand(), 'pull'], { cwd: runtimePath, verbose });
  await run([...composeCommand(), 'up', '-d', '--remove-orphans'], { cwd: runtimePath, verbose });
  await waitForComposeHealth(verbose);
}

export async function destroyLocalStack(verbose = false): Promise<void> {
  await run([...composeCommand(false), 'down', '--volumes', '--remove-orphans'], {
    cwd: runtimePath,
    env: LOCAL_DESTROY_ENV,
    verbose,
  });
  for (const container of LOCAL_COMPANY_BRAIN_CONTAINERS) {
    if (await commandSucceeds(['docker', 'container', 'inspect', container])) {
      await run(['docker', 'container', 'rm', '--force', container], { verbose });
    }
  }
  await removeLabeledComposeObjects('volume', verbose);
  await removeLabeledComposeObjects('network', verbose);
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

async function dockerDaemonIsReachable(): Promise<boolean> {
  return await commandSucceeds(['docker', 'info']);
}

async function removeLabeledComposeObjects(kind: 'network' | 'volume', verbose: boolean) {
  const objects = await run(
    [
      'docker',
      kind,
      'ls',
      '--filter',
      `label=com.docker.compose.project=${LOCAL_COMPOSE_PROJECT}`,
      '--format',
      '{{.Name}}',
    ],
    { capture: true },
  );

  for (const name of objects.split('\n').filter(Boolean)) {
    await run(['docker', kind, 'rm', name], { verbose });
  }
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
      ...composeCommand(false),
      'ps',
      '-a',
      '--format',
      '{{.Name}}|{{.State}}|{{.Health}}|{{.ExitCode}}|{{.Status}}',
    ],
    {
      cwd: runtimePath,
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

function composeCommand(requireEnvFile = true): string[] {
  return [
    'docker',
    'compose',
    '--project-name',
    LOCAL_COMPOSE_PROJECT,
    '--project-directory',
    runtimePath,
    ...(requireEnvFile || existsSync(rootEnvPath) ? ['--env-file', rootEnvPath] : []),
    '-f',
    `${runtimePath}/docker-compose.yml`,
  ];
}
