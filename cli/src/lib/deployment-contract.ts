import type { AwsOutputs } from './aws-config.ts';

export const DEPLOYMENT_IMAGES = [
  {
    key: 'nango',
    imageUriKey: 'nangoImageUri',
    imageEnvVar: 'NANGO_IMAGE_URI',
    repositoryOutputKey: 'nangoEcrRepositoryUrl',
    githubRepositoryOutput: 'nango_ecr_repository_url',
    context: './nango',
    dockerfile: './nango/Dockerfile',
    cacheScope: 'nango',
  },
  {
    key: 'brain',
    imageUriKey: 'brainImageUri',
    imageEnvVar: 'BRAIN_IMAGE_URI',
    repositoryOutputKey: 'brainEcrRepositoryUrl',
    githubRepositoryOutput: 'brain_ecr_repository_url',
    context: '.',
    dockerfile: 'backend/Dockerfile',
    cacheScope: 'brain',
  },
  {
    key: 'pg-backup',
    imageUriKey: 'pgBackupImageUri',
    imageEnvVar: 'PG_BACKUP_IMAGE_URI',
    repositoryOutputKey: 'pgBackupEcrRepositoryUrl',
    githubRepositoryOutput: 'pg_backup_ecr_repository_url',
    context: 'infra/pg-backup',
    dockerfile: 'infra/pg-backup/Dockerfile',
    cacheScope: 'pg-backup',
  },
] as const;

export type DeploymentImage = (typeof DEPLOYMENT_IMAGES)[number];
export type DeploymentImageKey = DeploymentImage['key'];
export type DeploymentImageUriKey = DeploymentImage['imageUriKey'];
export type DeploymentImageUris = Record<DeploymentImageUriKey, string>;

export type CiDeploymentEnvironment = {
  environment: string;
  awsRegion: string;
  terraformBackendConfig: string;
  ssmSecretPrefix: string;
  githubRepo: string;
  githubBranch: string;
  enableGithubDeploy: boolean;
  instanceType: string;
  rootVolumeSize: number;
  dataVolumeSize: number;
  deployGroup: string;
  nangoHostname: string;
  nangoConnectHostname: string;
  brainHostname: string;
  dozzleHostname: string;
};

export const CI_DEPLOYMENT_ENVIRONMENTS = {
  dev: {
    environment: 'dev',
    awsRegion: 'eu-west-2',
    terraformBackendConfig: 'backends/dev.conf',
    ssmSecretPrefix: '/company-brain/dev',
    githubRepo: 'onfabric/company-brain',
    githubBranch: 'main',
    enableGithubDeploy: true,
    instanceType: 't3.large',
    rootVolumeSize: 50,
    dataVolumeSize: 50,
    deployGroup: 'company-brain-dev',
    nangoHostname: 'nango-dev.onfabric.io',
    nangoConnectHostname: 'nango-auth-dev.onfabric.io',
    brainHostname: 'brain-dev.onfabric.io',
    dozzleHostname: 'dozzle-dev.onfabric.io',
  },
} as const satisfies Record<string, CiDeploymentEnvironment>;

export type GithubImageMatrixItem = {
  key: DeploymentImageKey;
  repository_output: DeploymentImage['githubRepositoryOutput'];
  context: DeploymentImage['context'];
  dockerfile: DeploymentImage['dockerfile'];
  cache_scope: DeploymentImage['cacheScope'];
};

export type SsmDeploymentEnvInput = {
  bundleUrl: string;
  deployGroup: string;
  dataVolumeId: string;
  artifactsBucket: string;
  imageUris: DeploymentImageUris;
  ssmSecretPrefix: string;
  nangoHostname: string;
  nangoConnectHostname: string;
  brainHostname: string;
  dozzleHostname: string;
  acmeEmail: string;
  awsRegion: string;
};

export function resolveCiDeploymentEnvironment(name: string): CiDeploymentEnvironment {
  const environments: Record<string, CiDeploymentEnvironment> = CI_DEPLOYMENT_ENVIRONMENTS;
  const environment = environments[name];
  if (!environment) {
    throw new Error(`Unknown CI deployment environment: ${name}`);
  }

  return environment;
}

export function githubImageMatrix(): GithubImageMatrixItem[] {
  return DEPLOYMENT_IMAGES.map((image) => ({
    key: image.key,
    repository_output: image.githubRepositoryOutput,
    context: image.context,
    dockerfile: image.dockerfile,
    cache_scope: image.cacheScope,
  }));
}

export function ciTerraformVars(environment: CiDeploymentEnvironment): Record<string, unknown> {
  return {
    region: environment.awsRegion,
    environment: environment.environment,
    instance_type: environment.instanceType,
    root_volume_size: environment.rootVolumeSize,
    data_volume_size: environment.dataVolumeSize,
    hostname: environment.nangoHostname,
    nango_hostname: environment.nangoHostname,
    nango_connect_hostname: environment.nangoConnectHostname,
    brain_hostname: environment.brainHostname,
    dozzle_hostname: environment.dozzleHostname,
    ssm_secret_prefix: environment.ssmSecretPrefix,
    enable_github_deploy: environment.enableGithubDeploy,
    github_repo: environment.githubRepo,
    github_branch: environment.githubBranch,
  };
}

export function deploymentImageUris(
  repositories: Pick<
    AwsOutputs,
    'nangoEcrRepositoryUrl' | 'brainEcrRepositoryUrl' | 'pgBackupEcrRepositoryUrl'
  >,
  imageTag: string,
): DeploymentImageUris {
  const imageUris = {} as DeploymentImageUris;
  for (const image of DEPLOYMENT_IMAGES) {
    imageUris[image.imageUriKey] = imageUri(repositories[image.repositoryOutputKey], imageTag);
  }

  return imageUris;
}

export function imageUri(repositoryUrl: string, imageTag: string): string {
  return `${repositoryUrl}:${imageTag}`;
}

export function latestImageUri(repositoryUrl: string): string {
  return imageUri(repositoryUrl, 'latest');
}

export function runtimeBundleUrl(
  artifactsBucket: string,
  environment: string,
  deployId: string,
): string {
  return `s3://${artifactsBucket}/${environment}/${deployId}.tar.gz`;
}

export function buildSsmDeploymentEnv(input: SsmDeploymentEnvInput): Record<string, string> {
  const env: Record<string, string> = {
    BUNDLE_URL: input.bundleUrl,
    DEPLOY_GROUP: input.deployGroup,
    DATA_VOLUME_ID: input.dataVolumeId,
    ARTIFACTS_BUCKET: input.artifactsBucket,
    SSM_SECRET_PREFIX: input.ssmSecretPrefix,
    NANGO_HOSTNAME: input.nangoHostname,
    NANGO_CONNECT_HOSTNAME: input.nangoConnectHostname,
    BRAIN_HOSTNAME: input.brainHostname,
    DOZZLE_HOSTNAME: input.dozzleHostname,
    ACME_EMAIL: input.acmeEmail,
    AWS_REGION: input.awsRegion,
  };

  for (const image of DEPLOYMENT_IMAGES) {
    env[image.imageEnvVar] = input.imageUris[image.imageUriKey];
  }

  return env;
}
