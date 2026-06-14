import { describe, expect, it } from 'bun:test';
import { awsCommandEnv, detectAwsProfile, normalizeAwsProfile } from './aws-credentials.ts';

describe('AWS credential environment', () => {
  it('uses AWS_PROFILE before AWS_DEFAULT_PROFILE', () => {
    expect(
      detectAwsProfile({
        AWS_PROFILE: 'primary',
        AWS_DEFAULT_PROFILE: 'fallback',
      }),
    ).toBe('primary');
  });

  it('uses AWS_DEFAULT_PROFILE when AWS_PROFILE is not set', () => {
    expect(
      detectAwsProfile({
        AWS_DEFAULT_PROFILE: 'onfabric',
      }),
    ).toBe('onfabric');
  });

  it('passes the selected profile to AWS SDK based tools', () => {
    expect(awsCommandEnv({ awsProfile: 'onfabric' })).toEqual({
      AWS_EC2_METADATA_DISABLED: 'true',
      AWS_SDK_LOAD_CONFIG: '1',
      AWS_PROFILE: 'onfabric',
      AWS_DEFAULT_PROFILE: 'onfabric',
    });
  });

  it('normalizes blank profiles to undefined', () => {
    expect(normalizeAwsProfile('   ')).toBeUndefined();
  });
});
