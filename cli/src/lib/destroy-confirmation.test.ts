import { describe, expect, it } from 'bun:test';
import { awsDestroyPhrase } from './destroy-confirmation.ts';

describe('destroy confirmation phrases', () => {
  it('uses environment and AWS account for hosted teardown', () => {
    expect(awsDestroyPhrase('dev', '123456789012')).toBe('destroy-dev-123456789012');
  });
});
