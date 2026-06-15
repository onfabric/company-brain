import { describe, expect, it } from 'bun:test';
import {
  buildSsmDeploymentEnv,
  ciTerraformVars,
  deploymentImageUrisFromManifest,
  githubDeploymentImageTags,
  githubDeploymentImageUris,
  githubImageMatrix,
  resolveCiDeploymentEnvironment,
  runtimeBundleUrl,
} from './deployment-contract.ts';

describe('deployment contract', () => {
  const githubImageInput = {
    gitSha: 'abc123',
    nangoSubmoduleSha: 'def456',
  };

  it('uses the Nango submodule SHA for the Nango image tag', () => {
    expect(githubDeploymentImageTags(githubImageInput)).toEqual({
      nango: 'nango-v1-def456',
      brain: 'sha-abc123',
      'pg-backup': 'sha-abc123',
    });
  });

  it('builds GitHub deployment image URIs from per-image tags', () => {
    expect(githubDeploymentImageUris(githubImageInput)).toEqual({
      nangoImageUri: 'ghcr.io/onfabric/company-brain-nango:nango-v1-def456',
      brainImageUri: 'ghcr.io/onfabric/company-brain-brain:sha-abc123',
      pgBackupImageUri: 'ghcr.io/onfabric/company-brain-pg-backup:sha-abc123',
    });
  });

  it('exposes the GitHub image matrix from the shared image specs', () => {
    expect(githubImageMatrix(githubImageInput)).toEqual([
      {
        key: 'nango',
        repository: 'ghcr.io/onfabric/company-brain-nango',
        image_tag: 'nango-v1-def456',
        image_uri: 'ghcr.io/onfabric/company-brain-nango:nango-v1-def456',
        context: './nango',
        dockerfile: './nango/Dockerfile',
        cache_scope: 'nango',
      },
      {
        key: 'brain',
        repository: 'ghcr.io/onfabric/company-brain-brain',
        image_tag: 'sha-abc123',
        image_uri: 'ghcr.io/onfabric/company-brain-brain:sha-abc123',
        context: '.',
        dockerfile: 'backend/Dockerfile',
        cache_scope: 'brain',
      },
      {
        key: 'pg-backup',
        repository: 'ghcr.io/onfabric/company-brain-pg-backup',
        image_tag: 'sha-abc123',
        image_uri: 'ghcr.io/onfabric/company-brain-pg-backup:sha-abc123',
        context: 'infra/pg-backup',
        dockerfile: 'infra/pg-backup/Dockerfile',
        cache_scope: 'pg-backup',
      },
    ]);
  });

  it('builds image URIs from the release manifest', () => {
    expect(
      deploymentImageUrisFromManifest({
        images: {
          nango: 'ghcr.io/onfabric/company-brain-nango@sha256:nango',
          brain: 'ghcr.io/onfabric/company-brain-brain@sha256:brain',
          pgBackup: 'ghcr.io/onfabric/company-brain-pg-backup@sha256:pg',
        },
      }),
    ).toEqual({
      nangoImageUri: 'ghcr.io/onfabric/company-brain-nango@sha256:nango',
      brainImageUri: 'ghcr.io/onfabric/company-brain-brain@sha256:brain',
      pgBackupImageUri: 'ghcr.io/onfabric/company-brain-pg-backup@sha256:pg',
    });
  });

  it('uses the fixed CI environment as Terraform vars', () => {
    expect(ciTerraformVars(resolveCiDeploymentEnvironment('dev'))).toMatchObject({
      region: 'eu-west-2',
      environment: 'dev',
      instance_type: 't3.large',
      root_volume_size: 50,
      data_volume_size: 50,
      enable_github_deploy: true,
      nango_hostname: 'nango-dev.onfabric.io',
      brain_hostname: 'brain-dev.onfabric.io',
    });
  });

  it('builds the runtime bundle URL', () => {
    expect(runtimeBundleUrl('company-brain-deploy-123-dev', 'dev', 'abc123')).toBe(
      's3://company-brain-deploy-123-dev/dev/abc123.tar.gz',
    );
  });

  it('builds the SSM deploy environment', () => {
    expect(
      buildSsmDeploymentEnv({
        bundleUrl: 's3://bucket/dev/abc123.tar.gz',
        deployGroup: 'company-brain-dev',
        dataVolumeId: 'vol-1',
        artifactsBucket: 'bucket',
        imageUris: {
          nangoImageUri: 'ghcr.io/onfabric/company-brain-nango:v1',
          brainImageUri: 'ghcr.io/onfabric/company-brain-brain:v1',
          pgBackupImageUri: 'ghcr.io/onfabric/company-brain-pg-backup:v1',
        },
        ssmSecretPrefix: '/company-brain/dev',
        nangoHostname: 'nango-dev.onfabric.io',
        nangoConnectHostname: 'nango-auth-dev.onfabric.io',
        brainHostname: 'brain-dev.onfabric.io',
        dozzleHostname: 'dozzle-dev.onfabric.io',
        acmeEmail: 'ops@example.com',
        awsRegion: 'eu-west-2',
      }),
    ).toEqual({
      BUNDLE_URL: 's3://bucket/dev/abc123.tar.gz',
      DEPLOY_GROUP: 'company-brain-dev',
      DATA_VOLUME_ID: 'vol-1',
      ARTIFACTS_BUCKET: 'bucket',
      SSM_SECRET_PREFIX: '/company-brain/dev',
      NANGO_HOSTNAME: 'nango-dev.onfabric.io',
      NANGO_CONNECT_HOSTNAME: 'nango-auth-dev.onfabric.io',
      BRAIN_HOSTNAME: 'brain-dev.onfabric.io',
      DOZZLE_HOSTNAME: 'dozzle-dev.onfabric.io',
      ACME_EMAIL: 'ops@example.com',
      AWS_REGION: 'eu-west-2',
      NANGO_IMAGE_URI: 'ghcr.io/onfabric/company-brain-nango:v1',
      BRAIN_IMAGE_URI: 'ghcr.io/onfabric/company-brain-brain:v1',
      PG_BACKUP_IMAGE_URI: 'ghcr.io/onfabric/company-brain-pg-backup:v1',
    });
  });
});
