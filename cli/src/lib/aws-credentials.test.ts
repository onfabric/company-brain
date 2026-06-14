import { describe, expect, it } from 'bun:test';
import {
  awsCommandEnv,
  awsSdkEnv,
  detectAwsProfile,
  normalizeAwsProfile,
  parseAwsCredentialProcessOutput,
  withAwsCredentials,
} from './aws-credentials.ts';

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

  it('passes the selected profile to AWS CLI commands', () => {
    expect(awsCommandEnv({ awsProfile: 'onfabric' })).toEqual({
      AWS_EC2_METADATA_DISABLED: 'true',
      AWS_SDK_LOAD_CONFIG: '1',
      AWS_PROFILE: 'onfabric',
      AWS_DEFAULT_PROFILE: 'onfabric',
    });
  });

  it('lets AWS CLI commands continue to resolve credentials through the selected profile', () => {
    expect(
      awsCommandEnv({
        awsProfile: 'onfabric',
        awsCredentials: {
          accessKeyId: 'access-key',
          secretAccessKey: 'secret-key',
        },
      }),
    ).toEqual({
      AWS_EC2_METADATA_DISABLED: 'true',
      AWS_SDK_LOAD_CONFIG: '1',
      AWS_PROFILE: 'onfabric',
      AWS_DEFAULT_PROFILE: 'onfabric',
    });
  });

  it('passes exported AWS CLI credentials to SDK based tools and clears profile selection', () => {
    expect(
      awsSdkEnv({
        awsProfile: 'onfabric',
        awsCredentials: {
          accessKeyId: 'access-key',
          secretAccessKey: 'secret-key',
          sessionToken: 'session-token',
        },
      }),
    ).toEqual({
      AWS_EC2_METADATA_DISABLED: 'true',
      AWS_SDK_LOAD_CONFIG: '1',
      AWS_PROFILE: undefined,
      AWS_DEFAULT_PROFILE: undefined,
      AWS_ACCESS_KEY_ID: 'access-key',
      AWS_SECRET_ACCESS_KEY: 'secret-key',
      AWS_SESSION_TOKEN: 'session-token',
    });
  });

  it('parses AWS CLI credential process output', () => {
    expect(
      parseAwsCredentialProcessOutput(
        JSON.stringify({
          Version: 1,
          AccessKeyId: 'access-key',
          SecretAccessKey: 'secret-key',
          SessionToken: 'session-token',
          Expiration: '2026-06-14T13:30:00Z',
        }),
      ),
    ).toEqual({
      accessKeyId: 'access-key',
      secretAccessKey: 'secret-key',
      sessionToken: 'session-token',
      expiration: '2026-06-14T13:30:00Z',
    });
  });

  it('adds runtime credentials without mutating the saved config object', () => {
    const config = { awsProfile: 'onfabric', region: 'eu-west-2' };

    expect(
      withAwsCredentials(config, {
        awsCredentials: {
          accessKeyId: 'access-key',
          secretAccessKey: 'secret-key',
        },
      }),
    ).toEqual({
      awsProfile: 'onfabric',
      region: 'eu-west-2',
      awsCredentials: {
        accessKeyId: 'access-key',
        secretAccessKey: 'secret-key',
      },
    });
    expect(config).toEqual({ awsProfile: 'onfabric', region: 'eu-west-2' });
  });

  it('normalizes blank profiles to undefined', () => {
    expect(normalizeAwsProfile('   ')).toBeUndefined();
  });
});
