import { describe, expect, it } from 'bun:test';
import { awsDestroyPhrase, localDestroyPhrase } from './destroy-confirmation.ts';

describe('destroy confirmation phrases', () => {
  it('uses a short dash-delimited local phrase', () => {
    expect(localDestroyPhrase()).toBe('destroy-local');
  });

  it('uses environment and AWS account for hosted teardown', () => {
    expect(awsDestroyPhrase('dev', '123456789012')).toBe('destroy-dev-123456789012');
  });
});
