import type { AwsConfig } from './aws-config.ts';
import { awsCommandEnv } from './aws-credentials.ts';
import { deployPath, repoRoot } from './paths.ts';
import { runVisible, type VisibleCommandContext } from './visible-command.ts';

export type ImageUris = {
  nangoImageUri: string;
  brainImageUri: string;
  pgBackupImageUri: string;
};

export async function buildAndPushImages(
  config: AwsConfig,
  deployId: string,
  context: VisibleCommandContext,
): Promise<ImageUris> {
  const outputs = requiredOutputs(config);
  const registry = outputs.nangoEcrRepositoryUrl.split('/')[0];
  if (!registry) {
    throw new Error('Could not derive ECR registry from Terraform outputs.');
  }
  const env = awsCommandEnv(config);

  const loginPassword = await runVisible(
    ['aws', 'ecr', 'get-login-password', '--region', config.region],
    context,
    { capture: true, env },
  );
  await runVisible(
    ['docker', 'login', '--username', 'AWS', '--password-stdin', registry],
    context,
    {
      input: loginPassword,
      approve: true,
      purpose: 'Authenticate Docker to ECR.',
    },
  );

  const nangoImageUri = await buildAndPushImage({
    repositoryUrl: outputs.nangoEcrRepositoryUrl,
    deployId,
    contextDir: './nango',
    dockerfile: './nango/Dockerfile',
    cacheScope: 'nango',
    context,
  });
  const brainImageUri = await buildAndPushImage({
    repositoryUrl: outputs.brainEcrRepositoryUrl,
    deployId,
    contextDir: '.',
    dockerfile: 'backend/Dockerfile',
    cacheScope: 'brain',
    context,
  });
  const pgBackupImageUri = await buildAndPushImage({
    repositoryUrl: outputs.pgBackupEcrRepositoryUrl,
    deployId,
    contextDir: 'infra/pg-backup',
    dockerfile: 'infra/pg-backup/Dockerfile',
    cacheScope: 'pg-backup',
    context,
  });

  return { nangoImageUri, brainImageUri, pgBackupImageUri };
}

async function buildAndPushImage({
  repositoryUrl,
  deployId,
  contextDir,
  dockerfile,
  cacheScope,
  context,
}: {
  repositoryUrl: string;
  deployId: string;
  contextDir: string;
  dockerfile: string;
  cacheScope: string;
  context: VisibleCommandContext;
}): Promise<string> {
  const deployTag = `${repositoryUrl}:${deployId}`;
  const latestTag = `${repositoryUrl}:latest`;

  await runVisible(['bash', `${deployPath}/build_and_push_image.sh`], context, {
    cwd: repoRoot,
    env: {
      ECR_REPOSITORY_URL: repositoryUrl,
      IMAGE_TAG: deployId,
      BUILD_CONTEXT: contextDir,
      DOCKERFILE: dockerfile,
      CACHE_SCOPE: cacheScope,
      CACHE_FROM: `type=registry,ref=${latestTag}`,
      CACHE_TO: 'type=inline',
      SOURCE_LABEL: 'https://github.com/onfabric/company-brain',
    },
    approve: true,
    purpose: `Build and push ${repositoryUrl}.`,
  });

  return deployTag;
}

function requiredOutputs(config: AwsConfig): NonNullable<AwsConfig['outputs']> {
  if (!config.outputs) {
    throw new Error('Missing Terraform outputs. Run `bun run company-brain aws setup` first.');
  }

  return config.outputs;
}
