import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  assertReleaseCompatible,
  type ReleaseManifest,
  releaseManifestUrl,
  resolveReleaseManifestUrl,
} from './release.ts';

const originalFetch = globalThis.fetch;
const SHA256_LENGTH = 64;

describe('release manifest URL resolution', () => {
  beforeEach(() => {
    delete process.env.COMPANY_BRAIN_RELEASE_MANIFEST_URL;
    delete process.env.COMPANY_BRAIN_RELEASE_VERSION;
    delete process.env.COMPANY_BRAIN_RELEASES_API_URL;
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('builds an exact release manifest URL', () => {
    expect(releaseManifestUrl('v1.2.3')).toBe(
      'https://github.com/onfabric/company-brain/releases/download/v1.2.3/company-brain-release.json',
    );
  });

  it('uses an explicit manifest URL without release discovery', async () => {
    process.env.COMPANY_BRAIN_RELEASE_MANIFEST_URL = 'https://example.com/manifest.json';

    expect(await resolveReleaseManifestUrl()).toBe('https://example.com/manifest.json');
  });

  it('uses an exact release version when one is configured', async () => {
    process.env.COMPANY_BRAIN_RELEASE_VERSION = 'v2.0.0';

    expect(await resolveReleaseManifestUrl()).toBe(
      'https://github.com/onfabric/company-brain/releases/download/v2.0.0/company-brain-release.json',
    );
  });

  it('selects the newest release containing the Company Brain manifest asset', async () => {
    process.env.COMPANY_BRAIN_RELEASES_API_URL = 'https://example.com/releases';
    globalThis.fetch = ((url) => {
      expect(String(url)).toBe('https://example.com/releases');
      return Promise.resolve(
        new Response(
          JSON.stringify([
            {
              tag_name: 'agent-sync-v0.1.0',
              draft: false,
              prerelease: false,
              assets: [{ name: 'company-brain-agent-sync-darwin-arm64.tar.gz' }],
            },
            {
              tag_name: 'v1.2.3',
              draft: false,
              prerelease: false,
              assets: [{ name: 'company-brain-release.json' }],
            },
          ]),
        ),
      );
    }) as typeof fetch;

    expect(await resolveReleaseManifestUrl()).toBe(
      'https://github.com/onfabric/company-brain/releases/download/v1.2.3/company-brain-release.json',
    );
  });
});

describe('release compatibility', () => {
  const manifest = (overrides: Partial<ReleaseManifest> = {}): ReleaseManifest => ({
    version: 'v1.2.3',
    gitSha: 'abc1234',
    nangoSubmoduleSha: 'def5678',
    cli: { minVersion: 'v1.2.0' },
    deployment: { contractVersion: 1, infraVersion: 1 },
    images: {
      nango: 'ghcr.io/onfabric/company-brain-nango:v1.2.3@sha256:nango',
      brain: 'ghcr.io/onfabric/company-brain-brain:v1.2.3@sha256:brain',
      pgBackup: 'ghcr.io/onfabric/company-brain-pg-backup:v1.2.3@sha256:pg',
    },
    assets: {
      runtime: {
        url: 'https://example.com/runtime.tar.gz',
        sha256: 'a'.repeat(SHA256_LENGTH),
      },
      integrations: {
        url: 'https://example.com/integrations.tar.gz',
        sha256: 'b'.repeat(SHA256_LENGTH),
      },
    },
    ...overrides,
  });

  it('accepts a CLI version that satisfies the manifest minimum', () => {
    expect(() => assertReleaseCompatible(manifest(), 'v1.2.0')).not.toThrow();
    expect(() => assertReleaseCompatible(manifest(), 'v1.3.0')).not.toThrow();
  });

  it('accepts source dev CLIs for contributor workflows', () => {
    expect(() => assertReleaseCompatible(manifest(), '0.0.0-dev')).not.toThrow();
  });

  it('rejects a CLI older than the manifest minimum', () => {
    expect(() => assertReleaseCompatible(manifest(), 'v1.1.9')).toThrow(
      'requires company-brain CLI v1.2.0 or newer',
    );
  });

  it('rejects unsupported deployment contracts', () => {
    expect(() =>
      assertReleaseCompatible(manifest({ deployment: { contractVersion: 2, infraVersion: 1 } })),
    ).toThrow('uses deployment contract 2');
  });
});
