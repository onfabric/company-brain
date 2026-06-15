import { describe, expect, it } from 'bun:test';
import {
  buildSsmDeploymentEnv,
  ciTerraformVars,
  deploymentImageUris,
  githubImageMatrix,
  resolveCiDeploymentEnvironment,
  runtimeBundleUrl,
} from './deployment-contract.ts';

describe('deployment contract', () => {
  it('exposes the GitHub image matrix from the shared image specs', () => {
    expect(githubImageMatrix()).toEqual([
      {
        key: 'nango',
        repository_output: 'nango_ecr_repository_url',
        context: './nango',
        dockerfile: './nango/Dockerfile',
        cache_scope: 'nango',
      },
      {
        key: 'brain',
        repository_output: 'brain_ecr_repository_url',
        context: '.',
        dockerfile: 'backend/Dockerfile',
        cache_scope: 'brain',
      },
      {
        key: 'pg-backup',
        repository_output: 'pg_backup_ecr_repository_url',
        context: 'infra/pg-backup',
        dockerfile: 'infra/pg-backup/Dockerfile',
        cache_scope: 'pg-backup',
      },
    ]);
  });

  it('builds immutable image URIs from Terraform repository outputs', () => {
    expect(
      deploymentImageUris(
        {
          nangoEcrRepositoryUrl: '123.dkr.ecr.eu-west-2.amazonaws.com/nango',
          brainEcrRepositoryUrl: '123.dkr.ecr.eu-west-2.amazonaws.com/brain',
          pgBackupEcrRepositoryUrl: '123.dkr.ecr.eu-west-2.amazonaws.com/pg-backup',
        },
        'abc123',
      ),
    ).toEqual({
      nangoImageUri: '123.dkr.ecr.eu-west-2.amazonaws.com/nango:abc123',
      brainImageUri: '123.dkr.ecr.eu-west-2.amazonaws.com/brain:abc123',
      pgBackupImageUri: '123.dkr.ecr.eu-west-2.amazonaws.com/pg-backup:abc123',
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
          nangoImageUri: 'repo/nango:abc123',
          brainImageUri: 'repo/brain:abc123',
          pgBackupImageUri: 'repo/pg-backup:abc123',
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
      NANGO_IMAGE_URI: 'repo/nango:abc123',
      BRAIN_IMAGE_URI: 'repo/brain:abc123',
      PG_BACKUP_IMAGE_URI: 'repo/pg-backup:abc123',
    });
  });
});
