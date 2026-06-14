import type { AwsConfig } from './aws-config.ts';
import { awsCommandEnv } from './aws-credentials.ts';
import { normalizeAwsEnvironment } from './aws-environment.ts';
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
  const env = awsCommandEnv(config);
  const accountId = await resolveAwsAccountId(context, env);
  const backend = {
    bucket: terraformStateBucketName(accountId, config.region, config.environment),
    key: terraformStateKey(config.environment),
    region: config.region,
  };

  if (!(await stateBucketExists(backend.bucket, context, env))) {
    await runVisible(createStateBucketCommand(backend.bucket, backend.region), context, {
      approve: true,
      env,
      purpose: 'Create the Terraform state bucket.',
    });
    await runVisible(
      ['aws', 's3api', 'wait', 'bucket-exists', '--bucket', backend.bucket],
      context,
      {
        env,
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
      env,
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
      env,
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
      env,
      purpose: 'Enable encryption on the Terraform state bucket.',
    },
  );

  return backend;
}

export function terraformStateBucketName(
  accountId: string,
  region: string,
  environment: string,
): string {
  return `company-brain-${normalizeAwsEnvironment(environment)}-tfstate-${accountId}-${region}`;
}

export function terraformStateKey(environment: string): string {
  return `company-brain/${normalizeAwsEnvironment(environment)}/terraform.tfstate`;
}

export function terraformBackendConfigArgs(
  backend: TerraformBackend,
  awsProfile?: string,
): string[] {
  const args = [
    `-backend-config=bucket=${backend.bucket}`,
    `-backend-config=key=${backend.key}`,
    `-backend-config=region=${backend.region}`,
    '-backend-config=encrypt=true',
    '-backend-config=use_lockfile=true',
  ];
  if (awsProfile) {
    args.push(`-backend-config=profile=${awsProfile}`);
  }

  return args;
}

export function createStateBucketCommand(bucket: string, region: string): string[] {
  const cmd = ['aws', 's3api', 'create-bucket', '--bucket', bucket, '--region', region];
  if (region !== 'us-east-1') {
    cmd.push('--create-bucket-configuration', `LocationConstraint=${region}`);
  }

  return cmd;
}

async function resolveAwsAccountId(
  context: VisibleCommandContext,
  env: Record<string, string>,
): Promise<string> {
  const accountId = (
    await runVisible(
      ['aws', 'sts', 'get-caller-identity', '--query', 'Account', '--output', 'text'],
      context,
      { capture: true, env },
    )
  ).trim();
  if (!/^\d{12}$/.test(accountId)) {
    throw new Error(`AWS account id is invalid: ${accountId}`);
  }

  return accountId;
}

async function stateBucketExists(
  bucket: string,
  context: VisibleCommandContext,
  env: Record<string, string>,
): Promise<boolean> {
  try {
    await runVisible(['aws', 's3api', 'head-bucket', '--bucket', bucket], context, {
      capture: true,
      env,
    });
    return true;
  } catch {
    return false;
  }
}
