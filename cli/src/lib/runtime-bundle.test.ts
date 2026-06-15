import { describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dir, '../../..');
const scriptSource = join(repoRoot, 'infra/deploy/package_runtime_bundle.sh');

describe('runtime bundle packaging', () => {
  it('packages Caddyfile from the source checkout layout', async () => {
    const root = await prepareRuntimeFixture('infra/caddy');

    try {
      const entries = await packageFixture(root);

      expect(entries).toContain('caddy/Caddyfile');
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it('packages Caddyfile from the installed runtime layout', async () => {
    const root = await prepareRuntimeFixture('caddy');

    try {
      const entries = await packageFixture(root);

      expect(entries).toContain('caddy/Caddyfile');
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});

async function prepareRuntimeFixture(caddyDir: 'infra/caddy' | 'caddy'): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'company-brain-runtime-bundle-'));

  await writeFixtureFile(root, '.env.example', '');
  await writeFixtureFile(root, 'docker-compose.yml', 'services: {}\n');
  await writeFixtureFile(root, 'docker-compose.prod.yml', 'services: {}\n');
  await writeFixtureFile(root, 'db/prepare/entrypoint.sh', '#!/usr/bin/env bash\n');
  await writeFixtureFile(root, 'nango-integrations/.env.example', '');
  await writeFixtureFile(root, 'infra/terraform/main.tf', '');
  await writeFixtureFile(root, `${caddyDir}/Caddyfile`, ':80\n');

  const packageScript = await Bun.file(scriptSource).text();
  for (const script of [
    'on_box_deploy.sh',
    'ensure_data_volume.sh',
    'ssm_deploy.sh',
    'package_runtime_bundle.sh',
  ]) {
    await writeFixtureFile(
      root,
      `infra/deploy/${script}`,
      script === 'package_runtime_bundle.sh' ? packageScript : '#!/usr/bin/env bash\n',
    );
  }

  return root;
}

async function packageFixture(root: string): Promise<string[]> {
  const outputPath = join(root, 'bundle.tar.gz');
  const proc = Bun.spawn(
    ['bash', join(root, 'infra/deploy/package_runtime_bundle.sh'), outputPath],
    {
      cwd: root,
      stderr: 'pipe',
      stdout: 'pipe',
    },
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  expect(`${stdout}${stderr}`).not.toContain('Cannot stat');
  expect(exitCode).toBe(0);

  const listProc = Bun.spawn(['tar', 'tzf', outputPath], {
    stderr: 'pipe',
    stdout: 'pipe',
  });
  const [listStdout, listStderr, listExitCode] = await Promise.all([
    new Response(listProc.stdout).text(),
    new Response(listProc.stderr).text(),
    listProc.exited,
  ]);

  expect(listStderr).toBe('');
  expect(listExitCode).toBe(0);

  return listStdout.trim().split('\n');
}

async function writeFixtureFile(
  root: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const path = join(root, relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}
