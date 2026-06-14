import type { AwsConfig } from './aws-config.ts';
import { runVisible, type VisibleCommandContext } from './visible-command.ts';

const PUBLIC_ACCESS_BLOCK = [
  'BlockPublicAcls=true',
  'IgnorePublicAcls=true',
  'BlockPublicPolicy=true',
  'RestrictPublicBuckets=true',
].join(',');

const BUCKET_ENCRYPTION = JSON.stringify({
  Rules: [
    {
      ApplyServerSideEncryptionByDefault: {
        SSEAlgorithm: 'AES256',
      },
    },
  ],
});

export type TerraformBackend = {
  bucket: string;
  key: string;
  region: string;
};

export async function ensureTerraformStateBackend(
  config: AwsConfig,
  context: VisibleCommandContext,
): Promise<TerraformBackend> {
  const accountId = await resolveAwsAccountId(context);
  const backend = {
    bucket: terraformStateBucketName(accountId, config.region),
    key: terraformStateKey(config.environment),
    region: config.region,
  };

  if (!(await stateBucketExists(backend.bucket, context))) {
    await runVisible(createStateBucketCommand(backend.bucket, backend.region), context, {
      approve: true,
      purpose: 'Create the Terraform state bucket.',
    });
    await runVisible(
      ['aws', 's3api', 'wait', 'bucket-exists', '--bucket', backend.bucket],
      context,
      {
        purpose: 'Wait for the Terraform state bucket to exist.',
      },
    );
  }
  await runVisible(
    [
      'aws',
      's3api',
      'put-public-access-block',
      '--bucket',
      backend.bucket,
      '--public-access-block-configuration',
      PUBLIC_ACCESS_BLOCK,
    ],
    context,
    {
      approve: true,
      purpose: 'Block public access on the Terraform state bucket.',
    },
  );
  await runVisible(
    [
      'aws',
      's3api',
      'put-bucket-versioning',
      '--bucket',
      backend.bucket,
      '--versioning-configuration',
      'Status=Enabled',
    ],
    context,
    {
      approve: true,
      purpose: 'Enable versioning on the Terraform state bucket.',
    },
  );
  await runVisible(
    [
      'aws',
      's3api',
      'put-bucket-encryption',
      '--bucket',
      backend.bucket,
      '--server-side-encryption-configuration',
      BUCKET_ENCRYPTION,
    ],
    context,
    {
      approve: true,
      purpose: 'Enable encryption on the Terraform state bucket.',
    },
  );

  return backend;
}

export function terraformStateBucketName(accountId: string, region: string): string {
  return `company-brain-tfstate-${accountId}-${region}`;
}

export function terraformStateKey(environment: string): string {
  return `company-brain/${environment}/terraform.tfstate`;
}

export function terraformBackendConfigArgs(backend: TerraformBackend): string[] {
  return [
    `-backend-config=bucket=${backend.bucket}`,
    `-backend-config=key=${backend.key}`,
    `-backend-config=region=${backend.region}`,
    '-backend-config=encrypt=true',
    '-backend-config=use_lockfile=true',
  ];
}

export function createStateBucketCommand(bucket: string, region: string): string[] {
  const cmd = ['aws', 's3api', 'create-bucket', '--bucket', bucket, '--region', region];
  if (region !== 'us-east-1') {
    cmd.push('--create-bucket-configuration', `LocationConstraint=${region}`);
  }

  return cmd;
}

async function resolveAwsAccountId(context: VisibleCommandContext): Promise<string> {
  const accountId = (
    await runVisible(
      ['aws', 'sts', 'get-caller-identity', '--query', 'Account', '--output', 'text'],
      context,
      { capture: true },
    )
  ).trim();
  if (!/^\d{12}$/.test(accountId)) {
    throw new Error(`AWS account id is invalid: ${accountId}`);
  }

  return accountId;
}

async function stateBucketExists(bucket: string, context: VisibleCommandContext): Promise<boolean> {
  try {
    await runVisible(['aws', 's3api', 'head-bucket', '--bucket', bucket], context, {
      capture: true,
    });
    return true;
  } catch {
    return false;
  }
}
