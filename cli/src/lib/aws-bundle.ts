import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AwsConfig } from './aws-config.ts';
import { repoRoot } from './paths.ts';
import { runVisible, type VisibleCommandContext } from './visible-command.ts';

export async function uploadRuntimeBundle(
  config: AwsConfig,
  deployId: string,
  context: VisibleCommandContext,
): Promise<string> {
  const outputs = requiredOutputs(config);
  const bundlePath = join(tmpdir(), `company-brain-${deployId}.tar.gz`);
  const bundleUrl = `s3://${outputs.artifactsBucket}/${config.environment}/${deployId}.tar.gz`;

  await runVisible(
    [
      'tar',
      'czf',
      bundlePath,
      'docker-compose.yml',
      'docker-compose.prod.yml',
      'db/prepare',
      'nango/packages/providers/providers.yaml',
      '-C',
      'infra',
      'caddy/Caddyfile',
      '-C',
      'deploy',
      'on_box_deploy.sh',
      'ensure_data_volume.sh',
    ],
    context,
    {
      cwd: repoRoot,
      approve: true,
      purpose: 'Package the runtime bundle for the EC2 host.',
    },
  );
  await runVisible(['aws', 's3', 'cp', bundlePath, bundleUrl], context, {
    approve: true,
    purpose: 'Upload the runtime bundle to S3.',
  });

  return bundleUrl;
}

function requiredOutputs(config: AwsConfig): NonNullable<AwsConfig['outputs']> {
  if (!config.outputs) {
    throw new Error('Missing Terraform outputs. Run `bun run company-brain aws setup` first.');
  }

  return config.outputs;
}
