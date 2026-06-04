import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearStoredBrainApiKey,
  readStoredBrainApiKey,
  storeBrainApiKey,
} from '../src/lib/api-key-storage.ts';

describe('API key storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns undefined when no API key is stored', () => {
    expect(readStoredBrainApiKey()).toBeUndefined();
  });

  it('stores trimmed API keys', () => {
    storeBrainApiKey('  secret-key  ');

    expect(readStoredBrainApiKey()).toBe('secret-key');
  });

  it('clears stored API keys', () => {
    storeBrainApiKey('secret-key');
    clearStoredBrainApiKey();

    expect(readStoredBrainApiKey()).toBeUndefined();
  });

  it('removes the stored API key when storing an empty value', () => {
    storeBrainApiKey('secret-key');
    storeBrainApiKey('   ');

    expect(readStoredBrainApiKey()).toBeUndefined();
  });
});
