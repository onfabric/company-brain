#!/usr/bin/env bun

import {
  buildSsmDeploymentEnv,
  CURRENT_DEPLOYMENT_CONTRACT_VERSION,
  CURRENT_INFRA_VERSION,
  ciTerraformVars,
  githubDeploymentImageUris,
  githubImageMatrix,
  githubReleaseImageMatrix,
  releaseDeploymentImageUris,
  resolveCiDeploymentEnvironment,
  runtimeBundleUrl,
} from '../lib/deployment-contract.ts';
import {
  CLI_PACKAGE_VERSION,
  isReleaseVersion,
  packageVersionFromReleaseVersion,
} from '../lib/version.ts';

const [command, arg = 'dev'] = Bun.argv.slice(2);

switch (command) {
  case 'github-outputs':
    writeGithubOutputs(arg);
    break;
  case 'release-outputs':
    writeReleaseOutputs(arg);
    break;
  case 'release-manifest':
    writeReleaseManifest();
    break;
  case 'verify-release-version':
    verifyReleaseVersion(arg);
    break;
  case 'terraform-vars':
    writeTerraformVars(arg);
    break;
  case 'bundle-output':
    writeBundleOutput(arg);
    break;
  case 'ssm-env':
    writeSsmEnv(arg);
    break;
  default:
    throw new Error(
      [
        'Usage: github-deploy-plan.ts <command> [environment]',
        'Commands: github-outputs, release-outputs, release-manifest, verify-release-version, terraform-vars, bundle-output, ssm-env',
      ].join('\n'),
    );
}

function writeGithubOutputs(environmentName: string): void {
  const environment = resolveCiDeploymentEnvironment(environmentName);
  const gitSha = requiredEnv('GITHUB_SHA');
  const nangoSubmoduleSha = gitRevParse('HEAD:nango');
  const imageInput = { gitSha, nangoSubmoduleSha };
  const imageUris = githubDeploymentImageUris(imageInput);

  writeKeyValues({
    environment: environment.environment,
    aws_region: environment.awsRegion,
    terraform_backend_config: environment.terraformBackendConfig,
    ssm_secret_prefix: environment.ssmSecretPrefix,
    deploy_group: environment.deployGroup,
    deploy_id: gitSha,
    nango_hostname: environment.nangoHostname,
    nango_connect_hostname: environment.nangoConnectHostname,
    brain_hostname: environment.brainHostname,
    dozzle_hostname: environment.dozzleHostname,
    nango_image_uri: imageUris.nangoImageUri,
    brain_image_uri: imageUris.brainImageUri,
    pg_backup_image_uri: imageUris.pgBackupImageUri,
    image_matrix: JSON.stringify(githubImageMatrix(imageInput)),
  });
}

function writeReleaseOutputs(version: string): void {
  if (!isReleaseVersion(version)) {
    throw new Error(`Release version must look like v1.2.3, got: ${version}`);
  }

  const gitSha = requiredEnv('GITHUB_SHA');
  const nangoSubmoduleSha = gitRevParse('HEAD:nango');
  const imageInput = { version, gitSha, nangoSubmoduleSha };
  const imageUris = releaseDeploymentImageUris(imageInput);

  writeKeyValues({
    version,
    nango_image_uri: imageUris.nangoImageUri,
    brain_image_uri: imageUris.brainImageUri,
    pg_backup_image_uri: imageUris.pgBackupImageUri,
    image_matrix: JSON.stringify(githubReleaseImageMatrix(imageInput)),
  });
}

function writeTerraformVars(environmentName: string): void {
  const environment = resolveCiDeploymentEnvironment(environmentName);
  console.log(`${JSON.stringify(ciTerraformVars(environment), null, 2)}\n`);
}

function verifyReleaseVersion(version: string): void {
  const expectedPackageVersion = packageVersionFromReleaseVersion(version);
  if (CLI_PACKAGE_VERSION !== expectedPackageVersion) {
    throw new Error(
      `Release ${version} requires cli/package.json version ${expectedPackageVersion}, got ${CLI_PACKAGE_VERSION}`,
    );
  }

  console.log(`Release ${version} matches cli/package.json version ${CLI_PACKAGE_VERSION}.`);
}

function writeReleaseManifest(): void {
  const version = requiredEnv('VERSION');
  if (!isReleaseVersion(version)) {
    throw new Error(`Release version must look like v1.2.3, got: ${version}`);
  }

  console.log(
    `${JSON.stringify(
      {
        version,
        gitSha: requiredEnv('GITHUB_SHA'),
        nangoSubmoduleSha: gitRevParse('HEAD:nango'),
        cli: {
          minVersion: version,
        },
        deployment: {
          contractVersion: CURRENT_DEPLOYMENT_CONTRACT_VERSION,
          infraVersion: CURRENT_INFRA_VERSION,
        },
        images: {
          nango: requiredEnv('NANGO_IMAGE_URI'),
          brain: requiredEnv('BRAIN_IMAGE_URI'),
          pgBackup: requiredEnv('PG_BACKUP_IMAGE_URI'),
        },
        assets: {
          runtime: {
            url: releaseAssetUrl(version, 'company-brain-runtime.tar.gz'),
            sha256: requiredEnv('RUNTIME_SHA256'),
          },
          integrations: {
            url: releaseAssetUrl(version, 'company-brain-integrations.tar.gz'),
            sha256: requiredEnv('INTEGRATIONS_SHA256'),
          },
        },
      },
      null,
      2,
    )}\n`,
  );
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

  writeKeyValues(
    buildSsmDeploymentEnv({
      bundleUrl:
        process.env.BUNDLE_URL ||
        runtimeBundleUrl(artifactsBucket, environment.environment, deployId),
      deployGroup: process.env.DEPLOY_GROUP || environment.deployGroup,
      dataVolumeId: requiredEnv('DATA_VOLUME_ID'),
      artifactsBucket,
      imageUris: {
        nangoImageUri: requiredEnv('NANGO_IMAGE_URI'),
        brainImageUri: requiredEnv('BRAIN_IMAGE_URI'),
        pgBackupImageUri: requiredEnv('PG_BACKUP_IMAGE_URI'),
      },
      ssmSecretPrefix: environment.ssmSecretPrefix,
      nangoHostname: environment.nangoHostname,
      nangoConnectHostname: environment.nangoConnectHostname,
      brainHostname: environment.brainHostname,
      dozzleHostname: environment.dozzleHostname,
      acmeEmail: requiredEnv('ACME_EMAIL'),
      awsRegion: environment.awsRegion,
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

function releaseAssetUrl(version: string, asset: string): string {
  return `https://github.com/onfabric/company-brain/releases/download/${version}/${asset}`;
}

function gitRevParse(revision: string): string {
  const proc = Bun.spawnSync(['git', 'rev-parse', revision], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  if (proc.exitCode !== 0) {
    throw new Error(
      `Could not resolve ${revision}: ${new TextDecoder().decode(proc.stderr).trim()}`,
    );
  }

  return new TextDecoder().decode(proc.stdout).trim();
}
