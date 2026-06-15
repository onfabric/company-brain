#!/usr/bin/env bun

import {
  buildSsmDeploymentEnv,
  ciTerraformVars,
  deploymentImageUris,
  githubImageMatrix,
  resolveCiDeploymentEnvironment,
  runtimeBundleUrl,
} from '../lib/deployment-contract.ts';

const [command, environmentName = 'dev'] = Bun.argv.slice(2);

switch (command) {
  case 'github-outputs':
    writeGithubOutputs(environmentName);
    break;
  case 'terraform-vars':
    writeTerraformVars(environmentName);
    break;
  case 'bundle-output':
    writeBundleOutput(environmentName);
    break;
  case 'ssm-env':
    writeSsmEnv(environmentName);
    break;
  default:
    throw new Error(
      [
        'Usage: github-deploy-plan.ts <command> [environment]',
        'Commands: github-outputs, terraform-vars, bundle-output, ssm-env',
      ].join('\n'),
    );
}

function writeGithubOutputs(environmentName: string): void {
  const environment = resolveCiDeploymentEnvironment(environmentName);
  writeKeyValues({
    environment: environment.environment,
    aws_region: environment.awsRegion,
    terraform_backend_config: environment.terraformBackendConfig,
    ssm_secret_prefix: environment.ssmSecretPrefix,
    deploy_group: environment.deployGroup,
    deploy_id: requiredEnv('GITHUB_SHA'),
    nango_hostname: environment.nangoHostname,
    nango_connect_hostname: environment.nangoConnectHostname,
    brain_hostname: environment.brainHostname,
    dozzle_hostname: environment.dozzleHostname,
    image_matrix: JSON.stringify(githubImageMatrix()),
  });
}

function writeTerraformVars(environmentName: string): void {
  const environment = resolveCiDeploymentEnvironment(environmentName);
  console.log(`${JSON.stringify(ciTerraformVars(environment), null, 2)}\n`);
}

function writeBundleOutput(environmentName: string): void {
  const environment = resolveCiDeploymentEnvironment(environmentName);
  writeKeyValues({
    bundle_url: runtimeBundleUrl(
      requiredEnv('ARTIFACTS_BUCKET'),
      environment.environment,
      requiredEnv('DEPLOY_ID'),
    ),
  });
}

function writeSsmEnv(environmentName: string): void {
  const environment = resolveCiDeploymentEnvironment(environmentName);
  const deployId = requiredEnv('DEPLOY_ID');
  const artifactsBucket = requiredEnv('ARTIFACTS_BUCKET');
  const imageUris = deploymentImageUris(
    {
      nangoEcrRepositoryUrl: requiredEnv('NANGO_ECR_REPOSITORY_URL'),
      brainEcrRepositoryUrl: requiredEnv('BRAIN_ECR_REPOSITORY_URL'),
      pgBackupEcrRepositoryUrl: requiredEnv('PG_BACKUP_ECR_REPOSITORY_URL'),
    },
    deployId,
  );

  writeKeyValues(
    buildSsmDeploymentEnv({
      bundleUrl:
        process.env.BUNDLE_URL ||
        runtimeBundleUrl(artifactsBucket, environment.environment, deployId),
      deployGroup: process.env.DEPLOY_GROUP || environment.deployGroup,
      dataVolumeId: requiredEnv('DATA_VOLUME_ID'),
      artifactsBucket,
      imageUris,
      ssmSecretPrefix: environment.ssmSecretPrefix,
      nangoHostname: environment.nangoHostname,
      nangoConnectHostname: environment.nangoConnectHostname,
      brainHostname: environment.brainHostname,
      dozzleHostname: environment.dozzleHostname,
      acmeEmail: requiredEnv('ACME_EMAIL'),
      awsRegion: environment.awsRegion,
      brainAllowedEmailsRegex: environment.brainAllowedEmailsRegex,
    }),
  );
}

function writeKeyValues(values: Record<string, string>): void {
  for (const [key, value] of Object.entries(values)) {
    console.log(`${key}=${value}`);
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
