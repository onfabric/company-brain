import { describe, expect, it } from 'bun:test';
import { normalizeAwsEnvironment, validateAwsEnvironment } from './aws-environment.ts';

describe('AWS environment names', () => {
  it('normalizes saved mixed-case values for AWS resource names', () => {
    expect(normalizeAwsEnvironment(' meX ')).toBe('mex');
  });

  it('keeps environment names compatible with S3 bucket names', () => {
    expect(validateAwsEnvironment('mex')).toBeUndefined();
    expect(validateAwsEnvironment('me_x')).toBe(
      'Use lowercase letters, numbers, and hyphens only.',
    );
  });
});
