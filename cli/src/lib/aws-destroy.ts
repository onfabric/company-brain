import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AwsConfig, AwsOutputs } from './aws-config.ts';
import { awsSdkEnv, hasExportedAwsCredentials } from './aws-credentials.ts';
import { formatDnsRecords, removeRoute53Records } from './aws-dns.ts';
import {
  readTerraformOutputs,
  terraformDestroyPlanPath,
  terraformEnv,
  terraformPlanPath,
  terraformVarArgs,
} from './aws-terraform.ts';
import {
  terraformBackendConfigArgs,
  terraformStateBucketName,
  terraformStateKey,
} from './aws-terraform-state.ts';
import { awsConfigPath, terraformPath } from './paths.ts';
import { runVisible, type VisibleCommandContext } from './visible-command.ts';

const DATA_VOLUME_RESOURCE = 'aws_ebs_volume.data';
const DELETE_OBJECTS_BATCH_SIZE = 1000;
const DELETE_IMAGES_BATCH_SIZE = 100;

type Printer = {
  warn: (message: string) => void;
};

type DestroyArgs = {
  accountId: string;
  config: AwsConfig;
  context: VisibleCommandContext;
  print: Printer;
};

type VersionedObject = {
  Key: string;
  VersionId: string;
};

type AwsObjectVersion = Partial<VersionedObject> & Record<string, unknown>;

type EcrImageId = {
  imageDigest?: string;
  imageTag?: string;
};

type BatchDeleteImageResponse = {
  imageIds?: EcrImageId[];
  failures?: { failureCode?: string; failureReason?: string; imageId?: EcrImageId }[];
};

export async function destroyAwsDeployment({
  accountId,
  config,
  context,
  print,
}: DestroyArgs): Promise<void> {
  assertConfiguredAccountMatchesCurrentAccount(config, accountId);

  const terraform = config.terraformCommand ?? 'terraform';
  const env = terraformEnv(config);
  const backend = {
    bucket: terraformStateBucketName(accountId, config.region, config.environment),
    key: terraformStateKey(config.environment),
    region: config.region,
  };

  await runVisible(
    [
      terraform,
      'init',
      '-reconfigure',
      '-input=false',
      ...terraformBackendConfigArgs(
        backend,
        hasExportedAwsCredentials(config) ? undefined : config.awsProfile,
      ),
    ],
    context,
    {
      cwd: terraformPath,
      env,
      purpose: 'Initialize Terraform against the existing state backend.',
    },
  );

  const outputs = await terraformOutputsOrConfigOutputs(terraform, context, config);
  const destroyConfig = outputs ? { ...config, outputs } : config;
  const dataVolumeId =
    outputs?.dataVolumeId ??
    (await terraformResourceId(terraform, context, destroyConfig, DATA_VOLUME_RESOURCE));
  const deployGroupTag = outputs?.deployGroupTag ?? `company-brain-${destroyConfig.environment}`;

  if (destroyConfig.outputs) {
    await emptyDeploymentStorage(destroyConfig.outputs, destroyConfig, context);
  }

  if (destroyConfig.dns.mode === 'route53') {
    await removeRoute53Records(destroyConfig, context, print);
  } else if (destroyConfig.outputs) {
    print.warn('Manual DNS mode: remove these records from your DNS provider after AWS teardown.');
    console.log(formatDnsRecords(destroyConfig));
  }

  await forgetProtectedDataVolume(terraform, context, destroyConfig);
  await runVisible(
    [
      terraform,
      'plan',
      '-destroy',
      '-input=false',
      `-out=${terraformDestroyPlanPath()}`,
      ...terraformVarArgs(destroyConfig),
    ],
    context,
    {
      cwd: terraformPath,
      env: terraformEnv(destroyConfig),
      purpose: 'Create the Terraform destroy plan.',
    },
  );
  await runVisible([terraform, 'show', terraformDestroyPlanPath()], context, {
    cwd: terraformPath,
    env: terraformEnv(destroyConfig),
  });
  await runVisible([terraform, 'apply', '-input=false', terraformDestroyPlanPath()], context, {
    cwd: terraformPath,
    env: terraformEnv(destroyConfig),
    purpose: 'Apply the Terraform destroy plan.',
  });

  if (dataVolumeId) {
    await deleteDataVolume(dataVolumeId, destroyConfig, context, print);
  }
  await deleteBackupSnapshots(deployGroupTag, destroyConfig, context);

  await deleteVersionedBucket(backend.bucket, destroyConfig, context);
  await removeLocalAwsDestroyFiles();
}

export function summarizeAwsDestroy(config: AwsConfig, accountId: string, phrase: string): string {
  const outputs = config.outputs;
  return [
    'This permanently deletes the AWS Company Brain deployment and its data.',
    'It is intended only when you want a clean rerun of `bun run company-brain aws setup`.',
    '',
    `AWS account: ${accountId}`,
    `AWS region: ${config.region}`,
    `Environment: ${config.environment}`,
    `Terraform state bucket: ${terraformStateBucketName(accountId, config.region, config.environment)}`,
    `SSM secret prefix: ${config.ssmSecretPrefix}`,
    '',
    'AWS resources:',
    `- EC2 instance: ${outputs?.instanceId ?? 'from Terraform state'}`,
    `- persistent data volume: ${outputs?.dataVolumeId ?? 'from Terraform state'}`,
    `- backup snapshots tagged: ${outputs?.deployGroupTag ?? `company-brain-${config.environment}`}`,
    `- ECR repositories: ${formatRepositoryNames(outputs)}`,
    `- deploy artifact bucket: ${outputs?.artifactsBucket ?? 'from Terraform state'}`,
    '- VPC, subnet, routes, security group, Elastic IP, IAM roles/policies, SSM parameters, DLM policy',
    `- DNS records: ${config.dns.mode === 'route53' ? 'deleted from Route53' : 'manual provider cleanup required'}`,
    '',
    `Confirmation phrase: ${phrase}`,
  ].join('\n');
}

export function manualDnsCleanupMessage(config: AwsConfig): string | undefined {
  if (config.dns.mode !== 'manual') {
    return undefined;
  }

  return [
    'Delete these DNS records from your DNS provider before reusing these hostnames:',
    '',
    formatDnsRecords(config),
  ].join('\n');
}

export function assertConfiguredAccountMatchesCurrentAccount(
  config: AwsConfig,
  accountId: string,
): void {
  const configured = configuredAccountId(config.outputs);
  if (configured && configured !== accountId) {
    throw new Error(
      `.company-brain.aws.json points at AWS account ${configured}, but current credentials are for ${accountId}.`,
    );
  }
}

export function configuredAccountId(outputs: AwsOutputs | undefined): string | undefined {
  const candidates = [
    outputs?.nangoEcrRepositoryUrl,
    outputs?.brainEcrRepositoryUrl,
    outputs?.pgBackupEcrRepositoryUrl,
  ]
    .map((url) => url?.match(/^(\d{12})\.dkr\.ecr\./)?.[1])
    .filter((value): value is string => Boolean(value));

  return candidates[0];
}

export function repositoryNameFromUrl(repositoryUrl: string): string {
  const slash = repositoryUrl.indexOf('/');
  return slash === -1 ? repositoryUrl : repositoryUrl.slice(slash + 1);
}

async function terraformOutputsOrConfigOutputs(
  terraform: string,
  context: VisibleCommandContext,
  config: AwsConfig,
): Promise<AwsOutputs | undefined> {
  try {
    return await readTerraformOutputs(terraform, context, config);
  } catch {
    return config.outputs;
  }
}

async function forgetProtectedDataVolume(
  terraform: string,
  context: VisibleCommandContext,
  config: AwsConfig,
): Promise<void> {
  const state = await terraformStateList(terraform, context, config);
  if (!state.includes(DATA_VOLUME_RESOURCE)) {
    return;
  }

  await runVisible([terraform, 'state', 'rm', DATA_VOLUME_RESOURCE], context, {
    cwd: terraformPath,
    env: terraformEnv(config),
    purpose:
      'Remove the protected data volume from Terraform state so it can be deleted explicitly after detach.',
  });
}

async function terraformStateList(
  terraform: string,
  context: VisibleCommandContext,
  config: AwsConfig,
): Promise<string[]> {
  try {
    const output = await runVisible([terraform, 'state', 'list'], context, {
      cwd: terraformPath,
      env: terraformEnv(config),
      capture: true,
      purpose: 'Read Terraform state before destroy.',
    });
    return output
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    if (formatError(error).includes('No state file was found')) {
      return [];
    }
    throw error;
  }
}

async function terraformResourceId(
  terraform: string,
  context: VisibleCommandContext,
  config: AwsConfig,
  resource: string,
): Promise<string | undefined> {
  try {
    const output = await runVisible([terraform, 'state', 'show', '-no-color', resource], context, {
      cwd: terraformPath,
      env: terraformEnv(config),
      capture: true,
      purpose: `Read Terraform state for ${resource}.`,
    });

    return output.match(/^\s*id\s+=\s+"?([^"\n]+)"?/m)?.[1];
  } catch {
    return undefined;
  }
}

async function deleteDataVolume(
  volumeId: string,
  config: AwsConfig,
  context: VisibleCommandContext,
  print: Printer,
): Promise<void> {
  try {
    await runVisible(
      [
        'aws',
        'ec2',
        'wait',
        'volume-available',
        '--volume-ids',
        volumeId,
        '--region',
        config.region,
      ],
      context,
      {
        env: awsSdkEnv(config),
        purpose: 'Wait for the persistent data volume to detach.',
      },
    );
  } catch (error) {
    print.warn(`Could not confirm data volume ${volumeId} is available: ${formatError(error)}`);
  }

  await runAwsDelete(
    ['aws', 'ec2', 'delete-volume', '--volume-id', volumeId, '--region', config.region],
    context,
    config,
    ['InvalidVolume.NotFound'],
    `Delete persistent data volume ${volumeId}.`,
  );
}

async function emptyDeploymentStorage(
  outputs: AwsOutputs,
  config: AwsConfig,
  context: VisibleCommandContext,
): Promise<void> {
  await emptyBucket(outputs.artifactsBucket, config, context);

  for (const repositoryUrl of [
    outputs.nangoEcrRepositoryUrl,
    outputs.brainEcrRepositoryUrl,
    outputs.pgBackupEcrRepositoryUrl,
  ]) {
    await emptyEcrRepository(repositoryNameFromUrl(repositoryUrl), config, context);
  }
}

async function emptyEcrRepository(
  repositoryName: string,
  config: AwsConfig,
  context: VisibleCommandContext,
): Promise<void> {
  if (!(await ecrRepositoryExists(repositoryName, config, context))) {
    return;
  }

  while (true) {
    const images = await listEcrImages(repositoryName, config, context);
    if (images.length === 0) {
      return;
    }

    for (const batch of chunks(images, DELETE_IMAGES_BATCH_SIZE)) {
      const output = await runVisible(
        [
          'aws',
          'ecr',
          'batch-delete-image',
          '--repository-name',
          repositoryName,
          '--image-ids',
          JSON.stringify(batch),
          '--output',
          'json',
          '--region',
          config.region,
        ],
        context,
        {
          capture: true,
          env: awsSdkEnv(config),
          purpose: `Delete ${batch.length} image(s) from ECR repository ${repositoryName}.`,
        },
      );
      const result = JSON.parse(output) as BatchDeleteImageResponse;
      const deleted = result.imageIds?.length ?? 0;
      const failures = result.failures ?? [];
      if (deleted === 0 && failures.length > 0) {
        throw new Error(
          `Could not empty ECR repository ${repositoryName}: ${failures
            .map((failure) => failure.failureReason ?? failure.failureCode ?? 'unknown failure')
            .join('; ')}`,
        );
      }
    }
  }
}

async function ecrRepositoryExists(
  repositoryName: string,
  config: AwsConfig,
  context: VisibleCommandContext,
): Promise<boolean> {
  try {
    await runVisible(
      [
        'aws',
        'ecr',
        'describe-repositories',
        '--repository-names',
        repositoryName,
        '--region',
        config.region,
      ],
      context,
      {
        capture: true,
        env: awsSdkEnv(config),
      },
    );
    return true;
  } catch {
    return false;
  }
}

async function listEcrImages(
  repositoryName: string,
  config: AwsConfig,
  context: VisibleCommandContext,
): Promise<EcrImageId[]> {
  const output = await runVisible(
    [
      'aws',
      'ecr',
      'list-images',
      '--repository-name',
      repositoryName,
      '--filter',
      'tagStatus=ANY',
      '--query',
      'imageIds',
      '--output',
      'json',
      '--region',
      config.region,
    ],
    context,
    {
      capture: true,
      env: awsSdkEnv(config),
      purpose: `List images in ECR repository ${repositoryName}.`,
    },
  );

  return (JSON.parse(output) as EcrImageId[]).filter(
    (image) => image.imageDigest || image.imageTag,
  );
}

async function deleteBackupSnapshots(
  deployGroupTag: string,
  config: AwsConfig,
  context: VisibleCommandContext,
): Promise<void> {
  const output = await runVisible(
    [
      'aws',
      'ec2',
      'describe-snapshots',
      '--owner-ids',
      'self',
      '--filters',
      `Name=tag:Backup,Values=${deployGroupTag}`,
      '--query',
      'Snapshots[].SnapshotId',
      '--output',
      'json',
      '--region',
      config.region,
    ],
    context,
    {
      capture: true,
      env: awsSdkEnv(config),
      purpose: `Find backup snapshots tagged Backup=${deployGroupTag}.`,
    },
  );
  const snapshotIds = JSON.parse(output) as string[];

  for (const snapshotId of snapshotIds) {
    await runAwsDelete(
      ['aws', 'ec2', 'delete-snapshot', '--snapshot-id', snapshotId, '--region', config.region],
      context,
      config,
      ['InvalidSnapshot.NotFound'],
      `Delete backup snapshot ${snapshotId}.`,
    );
  }
}

async function deleteVersionedBucket(
  bucket: string,
  config: AwsConfig,
  context: VisibleCommandContext,
): Promise<void> {
  if (!(await bucketExists(bucket, config, context))) {
    return;
  }

  await emptyBucket(bucket, config, context);

  await runAwsDelete(
    ['aws', 's3api', 'delete-bucket', '--bucket', bucket, '--region', config.region],
    context,
    config,
    ['NoSuchBucket'],
    `Delete Terraform state bucket ${bucket}.`,
  );
}

async function emptyBucket(
  bucket: string,
  config: AwsConfig,
  context: VisibleCommandContext,
): Promise<void> {
  if (!(await bucketExists(bucket, config, context))) {
    return;
  }

  await runVisible(
    ['aws', 's3', 'rm', `s3://${bucket}`, '--recursive', '--region', config.region],
    context,
    {
      env: awsSdkEnv(config),
      purpose: `Delete current objects from S3 bucket ${bucket}.`,
    },
  );

  while (true) {
    const objects = await listBucketVersions(bucket, config, context);
    if (objects.length === 0) {
      return;
    }

    for (const batch of chunks(objects, DELETE_OBJECTS_BATCH_SIZE)) {
      await deleteBucketObjectVersions(bucket, batch, config, context);
    }
  }
}

async function bucketExists(
  bucket: string,
  config: AwsConfig,
  context: VisibleCommandContext,
): Promise<boolean> {
  try {
    await runVisible(
      ['aws', 's3api', 'head-bucket', '--bucket', bucket, '--region', config.region],
      context,
      {
        capture: true,
        env: awsSdkEnv(config),
      },
    );
    return true;
  } catch {
    return false;
  }
}

async function listBucketVersions(
  bucket: string,
  config: AwsConfig,
  context: VisibleCommandContext,
): Promise<VersionedObject[]> {
  const output = await runVisible(
    [
      'aws',
      's3api',
      'list-object-versions',
      '--bucket',
      bucket,
      '--output',
      'json',
      '--region',
      config.region,
    ],
    context,
    {
      capture: true,
      env: awsSdkEnv(config),
      purpose: `List object versions in ${bucket}.`,
    },
  );
  const parsed = JSON.parse(output) as {
    Versions?: AwsObjectVersion[];
    DeleteMarkers?: AwsObjectVersion[];
  };

  return normalizeObjectVersions([...(parsed.Versions ?? []), ...(parsed.DeleteMarkers ?? [])]);
}

export function normalizeObjectVersions(objects: AwsObjectVersion[]): VersionedObject[] {
  return objects
    .map((object) => ({ Key: object.Key, VersionId: object.VersionId }))
    .filter(
      (object): object is VersionedObject =>
        typeof object.Key === 'string' && typeof object.VersionId === 'string',
    );
}

async function deleteBucketObjectVersions(
  bucket: string,
  objects: VersionedObject[],
  config: AwsConfig,
  context: VisibleCommandContext,
): Promise<void> {
  const deleteFile = join(tmpdir(), `company-brain-delete-${bucket}-${Date.now()}.json`);
  await writeFile(deleteFile, JSON.stringify({ Objects: objects, Quiet: true }));
  try {
    await runVisible(
      [
        'aws',
        's3api',
        'delete-objects',
        '--bucket',
        bucket,
        '--delete',
        `file://${deleteFile}`,
        '--region',
        config.region,
      ],
      context,
      {
        env: awsSdkEnv(config),
        purpose: `Delete ${objects.length} object version(s) from ${bucket}.`,
      },
    );
  } finally {
    await rm(deleteFile, { force: true });
  }
}

async function runAwsDelete(
  cmd: string[],
  context: VisibleCommandContext,
  config: AwsConfig,
  ignoredCodes: string[],
  purpose: string,
): Promise<void> {
  try {
    await runVisible(cmd, context, { capture: true, env: awsSdkEnv(config), purpose });
  } catch (error) {
    const detail = formatError(error);
    if (!ignoredCodes.some((code) => detail.includes(code))) {
      throw error;
    }
  }
}

async function removeLocalAwsDestroyFiles(): Promise<void> {
  await rm(awsConfigPath, { force: true });
  await rm(terraformPlanPath(), { force: true });
  await rm(terraformDestroyPlanPath(), { force: true });
}

function formatRepositoryNames(outputs: AwsOutputs | undefined): string {
  if (!outputs) {
    return 'from Terraform state';
  }

  return [
    outputs.nangoEcrRepositoryUrl,
    outputs.brainEcrRepositoryUrl,
    outputs.pgBackupEcrRepositoryUrl,
  ]
    .map(repositoryNameFromUrl)
    .join(', ');
}

function chunks<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
