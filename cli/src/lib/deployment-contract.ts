import type { ReleaseManifest } from './release.ts';

export const PUBLIC_IMAGE_REGISTRY = 'ghcr.io/onfabric';
export const CURRENT_DEPLOYMENT_CONTRACT_VERSION = 1;
export const CURRENT_INFRA_VERSION = 1;
const NANGO_IMAGE_TAG_VERSION = 'v1';

export const DEPLOYMENT_IMAGES = [
  {
    key: 'nango',
    imageUriKey: 'nangoImageUri',
    imageEnvVar: 'NANGO_IMAGE_URI',
    repository: `${PUBLIC_IMAGE_REGISTRY}/company-brain-nango`,
    context: './nango',
    dockerfile: './nango/Dockerfile',
    cacheScope: 'nango',
  },
  {
    key: 'brain',
    imageUriKey: 'brainImageUri',
    imageEnvVar: 'BRAIN_IMAGE_URI',
    repository: `${PUBLIC_IMAGE_REGISTRY}/company-brain-brain`,
    context: '.',
    dockerfile: 'backend/Dockerfile',
    cacheScope: 'brain',
  },
  {
    key: 'pg-backup',
    imageUriKey: 'pgBackupImageUri',
    imageEnvVar: 'PG_BACKUP_IMAGE_URI',
    repository: `${PUBLIC_IMAGE_REGISTRY}/company-brain-pg-backup`,
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
  repository: DeploymentImage['repository'];
  image_tag: string;
  extra_tags: string;
  image_uri: string;
  context: DeploymentImage['context'];
  dockerfile: DeploymentImage['dockerfile'];
  cache_scope: DeploymentImage['cacheScope'];
};

export type GithubDeploymentImageInput = {
  gitSha: string;
  nangoSubmoduleSha: string;
};

export type ReleaseDeploymentImageInput = GithubDeploymentImageInput & {
  version: string;
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

export function githubDeploymentImageTags(
  input: GithubDeploymentImageInput,
): Record<DeploymentImageKey, string> {
  return {
    nango: `nango-${NANGO_IMAGE_TAG_VERSION}-${input.nangoSubmoduleSha}`,
    brain: `sha-${input.gitSha}`,
    'pg-backup': `sha-${input.gitSha}`,
  };
}

export function releaseDeploymentImageTags(
  input: ReleaseDeploymentImageInput,
): Record<DeploymentImageKey, string> {
  return {
    nango: input.version,
    brain: input.version,
    'pg-backup': input.version,
  };
}

export function githubDeploymentImageUris(input: GithubDeploymentImageInput): DeploymentImageUris {
  const tags = githubDeploymentImageTags(input);
  const uris = {} as DeploymentImageUris;

  for (const image of DEPLOYMENT_IMAGES) {
    uris[image.imageUriKey] = imageUri(image.repository, tags[image.key]);
  }

  return uris;
}

export function releaseDeploymentImageUris(
  input: ReleaseDeploymentImageInput,
): DeploymentImageUris {
  const tags = releaseDeploymentImageTags(input);
  const uris = {} as DeploymentImageUris;

  for (const image of DEPLOYMENT_IMAGES) {
    uris[image.imageUriKey] = imageUri(image.repository, tags[image.key]);
  }

  return uris;
}

export function githubImageMatrix(input: GithubDeploymentImageInput): GithubImageMatrixItem[] {
  const tags = githubDeploymentImageTags(input);

  return DEPLOYMENT_IMAGES.map((image) => {
    const tag = tags[image.key];

    return {
      key: image.key,
      repository: image.repository,
      image_tag: tag,
      extra_tags: '',
      image_uri: imageUri(image.repository, tag),
      context: image.context,
      dockerfile: image.dockerfile,
      cache_scope: image.cacheScope,
    };
  });
}

export function githubReleaseImageMatrix(
  input: ReleaseDeploymentImageInput,
): GithubImageMatrixItem[] {
  const releaseTags = releaseDeploymentImageTags(input);
  const contentTags = githubDeploymentImageTags(input);

  return DEPLOYMENT_IMAGES.map((image) => {
    const tag = releaseTags[image.key];

    return {
      key: image.key,
      repository: image.repository,
      image_tag: tag,
      extra_tags: contentTags[image.key],
      image_uri: imageUri(image.repository, tag),
      context: image.context,
      dockerfile: image.dockerfile,
      cache_scope: image.cacheScope,
    };
  });
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

export function deploymentImageUrisFromManifest(
  manifest: Pick<ReleaseManifest, 'images'>,
): DeploymentImageUris {
  return {
    nangoImageUri: manifest.images.nango,
    brainImageUri: manifest.images.brain,
    pgBackupImageUri: manifest.images.pgBackup,
  };
}

export function imageUri(repositoryUrl: string, imageTag: string): string {
  return `${repositoryUrl}:${imageTag}`;
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
