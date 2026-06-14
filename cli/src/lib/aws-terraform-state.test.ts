import { describe, expect, it } from 'bun:test';
import {
  createStateBucketCommand,
  terraformBackendConfigArgs,
  terraformStateBucketName,
  terraformStateKey,
} from './aws-terraform-state.ts';

describe('Terraform S3 state backend', () => {
  it('derives an account-scoped state bucket and environment-scoped key', () => {
    expect(terraformStateBucketName('904233092606', 'eu-west-2')).toBe(
      'company-brain-tfstate-904233092606-eu-west-2',
    );
    expect(terraformStateKey('mez')).toBe('company-brain/mez/terraform.tfstate');
  });

  it('builds backend config args for terraform init', () => {
    expect(
      terraformBackendConfigArgs({
        bucket: 'company-brain-tfstate-904233092606-eu-west-2',
        key: 'company-brain/mez/terraform.tfstate',
        region: 'eu-west-2',
      }),
    ).toEqual([
      '-backend-config=bucket=company-brain-tfstate-904233092606-eu-west-2',
      '-backend-config=key=company-brain/mez/terraform.tfstate',
      '-backend-config=region=eu-west-2',
      '-backend-config=encrypt=true',
      '-backend-config=use_lockfile=true',
    ]);
  });

  it('omits create-bucket LocationConstraint for us-east-1', () => {
    expect(createStateBucketCommand('company-brain-tfstate-123-us-east-1', 'us-east-1')).toEqual([
      'aws',
      's3api',
      'create-bucket',
      '--bucket',
      'company-brain-tfstate-123-us-east-1',
      '--region',
      'us-east-1',
    ]);
  });
});
