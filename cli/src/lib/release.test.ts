import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { releaseManifestUrl, resolveReleaseManifestUrl } from './release.ts';

const originalFetch = globalThis.fetch;

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
