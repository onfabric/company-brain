import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AwsConfig } from './aws-config.ts';
import { awsCommandEnv } from './aws-credentials.ts';
import { deployPath, repoRoot } from './paths.ts';
import { runVisible, type VisibleCommandContext } from './visible-command.ts';

export async function uploadRuntimeBundle(
  config: AwsConfig,
  deployId: string,
  context: VisibleCommandContext,
): Promise<string> {
  const outputs = requiredOutputs(config);
  const bundlePath = join(tmpdir(), `company-brain-${deployId}.tar.gz`);
  const bundleUrl = `s3://${outputs.artifactsBucket}/${config.environment}/${deployId}.tar.gz`;

  await runVisible(['bash', `${deployPath}/package_runtime_bundle.sh`, bundlePath], context, {
    cwd: repoRoot,
    approve: true,
    purpose: 'Package the runtime bundle for the EC2 host.',
  });
  await runVisible(['aws', 's3', 'cp', bundlePath, bundleUrl], context, {
    approve: true,
    env: awsCommandEnv(config),
    purpose: 'Upload the runtime bundle to S3.',
  });

  return bundleUrl;
}

function requiredOutputs(config: AwsConfig): NonNullable<AwsConfig['outputs']> {
  if (!config.outputs) {
    throw new Error('Missing Terraform outputs. Run `bun run company-brain deploy setup` first.');
  }

  return config.outputs;
}
