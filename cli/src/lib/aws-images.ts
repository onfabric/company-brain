import type { AwsConfig } from './aws-config.ts';
import { awsCommandEnv } from './aws-credentials.ts';
import {
  DEPLOYMENT_IMAGES,
  type DeploymentImage,
  type DeploymentImageUris,
  imageUri,
  latestImageUri,
} from './deployment-contract.ts';
import { deployPath, repoRoot } from './paths.ts';
import { runVisible, type VisibleCommandContext } from './visible-command.ts';

export type ImageUris = DeploymentImageUris;

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
  const imageUris = {} as DeploymentImageUris;

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

  for (const image of DEPLOYMENT_IMAGES) {
    imageUris[image.imageUriKey] = await buildAndPushImage({
      image,
      repositoryUrl: outputs[image.repositoryOutputKey],
      deployId,
      context,
    });
  }

  return imageUris;
}

async function buildAndPushImage({
  image,
  repositoryUrl,
  deployId,
  context,
}: {
  image: DeploymentImage;
  repositoryUrl: string;
  deployId: string;
  context: VisibleCommandContext;
}): Promise<string> {
  const deployTag = imageUri(repositoryUrl, deployId);
  const latestTag = latestImageUri(repositoryUrl);

  await runVisible(['bash', `${deployPath}/build_and_push_image.sh`], context, {
    cwd: repoRoot,
    env: {
      ECR_REPOSITORY_URL: repositoryUrl,
      IMAGE_TAG: deployId,
      BUILD_CONTEXT: image.context,
      DOCKERFILE: image.dockerfile,
      CACHE_SCOPE: image.cacheScope,
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
    throw new Error('Missing Terraform outputs. Run `bun run company-brain deploy setup` first.');
  }

  return config.outputs;
}
