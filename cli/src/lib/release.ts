import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { z } from 'zod';
import { downloadsPath, nangoIntegrationsPath, releaseStatePath, runtimePath } from './paths.ts';
import { run } from './shell.ts';

const DEFAULT_RELEASE_BASE_URL = 'https://github.com/onfabric/company-brain/releases';
const DEFAULT_RELEASES_API_URL =
  'https://api.github.com/repos/onfabric/company-brain/releases?per_page=100';
const RELEASE_MARKER = '.company-brain-release';
const MIN_GIT_SHA_LENGTH = 7;
const DOWNLOAD_HASH_PREFIX_LENGTH = 16;
const RELEASE_MANIFEST_ASSET = 'company-brain-release.json';

const ReleaseAssetSchema = z.object({
  url: z.string().url(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

const ReleaseManifestSchema = z.object({
  version: z.string().min(1),
  gitSha: z.string().min(MIN_GIT_SHA_LENGTH),
  nangoSubmoduleSha: z.string().min(MIN_GIT_SHA_LENGTH).optional(),
  minimumCliVersion: z.string().min(1).optional(),
  images: z.object({
    nango: z.string().min(1),
    brain: z.string().min(1),
    pgBackup: z.string().min(1),
  }),
  assets: z.object({
    runtime: ReleaseAssetSchema,
    integrations: ReleaseAssetSchema,
  }),
});

const ReleaseStateSchema = z.object({
  version: z.string(),
  gitSha: z.string(),
  runtimeSha256: z.string(),
  integrationsSha256: z.string(),
});

const GithubReleaseSchema = z.object({
  tag_name: z.string().min(1),
  draft: z.boolean().default(false),
  prerelease: z.boolean().default(false),
  assets: z.array(z.object({ name: z.string() })).default([]),
});

export type ReleaseManifest = z.infer<typeof ReleaseManifestSchema>;

export type ReleaseAssets = {
  manifest: ReleaseManifest;
  runtimePath: string;
  nangoIntegrationsPath: string;
};

export async function ensureReleaseAssets(): Promise<ReleaseAssets> {
  const manifest = await loadReleaseManifest();
  await ensureAsset('runtime', runtimePath, manifest.assets.runtime, manifest);
  await ensureAsset('integrations', nangoIntegrationsPath, manifest.assets.integrations, manifest);
  await writeReleaseState(manifest);

  return { manifest, runtimePath, nangoIntegrationsPath };
}

export async function ensureNangoIntegrationsAssets(): Promise<void> {
  if (process.env.COMPANY_BRAIN_INTEGRATIONS_DIR && existsSync(nangoIntegrationsPath)) {
    return;
  }

  const manifest = await loadReleaseManifest();
  await ensureAsset('integrations', nangoIntegrationsPath, manifest.assets.integrations, manifest);
  await writeReleaseState(manifest);
}

export async function loadReleaseManifest(): Promise<ReleaseManifest> {
  const manifestPath = process.env.COMPANY_BRAIN_RELEASE_MANIFEST_PATH;
  if (manifestPath) {
    return ReleaseManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
  }

  const manifestUrl = await resolveReleaseManifestUrl();
  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(`Could not download Company Brain release manifest: ${manifestUrl}`);
  }

  return ReleaseManifestSchema.parse(await response.json());
}

export async function resolveReleaseManifestUrl(): Promise<string> {
  const explicit = process.env.COMPANY_BRAIN_RELEASE_MANIFEST_URL;
  if (explicit) {
    return explicit;
  }

  const version = process.env.COMPANY_BRAIN_RELEASE_VERSION;
  const resolvedVersion =
    version && version !== 'latest' ? version : await latestCompanyBrainReleaseVersion();
  return releaseManifestUrl(resolvedVersion);
}

export function releaseManifestUrl(version: string): string {
  return `${DEFAULT_RELEASE_BASE_URL}/download/${version}/${RELEASE_MANIFEST_ASSET}`;
}

async function latestCompanyBrainReleaseVersion(): Promise<string> {
  const response = await fetch(
    process.env.COMPANY_BRAIN_RELEASES_API_URL || DEFAULT_RELEASES_API_URL,
    {
      headers: {
        accept: 'application/vnd.github+json',
        'user-agent': 'company-brain-cli',
      },
    },
  );
  if (!response.ok) {
    throw new Error('Could not resolve the latest Company Brain release.');
  }

  const releases = z.array(GithubReleaseSchema).parse(await response.json());
  const release = releases.find(
    (candidate) =>
      !candidate.draft &&
      !candidate.prerelease &&
      candidate.assets.some((asset) => asset.name === RELEASE_MANIFEST_ASSET),
  );
  if (!release) {
    throw new Error(`Could not find a Company Brain release containing ${RELEASE_MANIFEST_ASSET}.`);
  }

  return release.tag_name;
}

async function ensureAsset(
  kind: 'runtime' | 'integrations',
  destination: string,
  asset: z.infer<typeof ReleaseAssetSchema>,
  manifest: ReleaseManifest,
): Promise<void> {
  if (await assetIsCurrent(destination, kind, asset.sha256, manifest)) {
    return;
  }

  const archive = await downloadAsset(kind, asset);
  const actualHash = await sha256File(archive);
  if (actualHash !== asset.sha256) {
    throw new Error(
      `Downloaded ${kind} asset checksum mismatch: expected ${asset.sha256}, got ${actualHash}`,
    );
  }

  const staging = `${destination}.staging-${Date.now()}`;
  await rm(staging, { force: true, recursive: true });
  await mkdir(staging, { recursive: true });
  await run(['tar', 'xzf', archive, '-C', staging], { capture: true });

  await rm(destination, { force: true, recursive: true });
  await rename(staging, destination);
  await writeMarker(destination, kind, asset.sha256, manifest);
}

async function downloadAsset(
  kind: 'runtime' | 'integrations',
  asset: z.infer<typeof ReleaseAssetSchema>,
): Promise<string> {
  await mkdir(downloadsPath, { recursive: true });
  const filename = `${kind}-${asset.sha256.slice(0, DOWNLOAD_HASH_PREFIX_LENGTH)}-${basename(new URL(asset.url).pathname)}`;
  const destination = join(downloadsPath, filename);
  if (existsSync(destination) && (await sha256File(destination)) === asset.sha256) {
    return destination;
  }

  const response = await fetch(asset.url);
  if (!response.ok) {
    throw new Error(`Could not download Company Brain ${kind} asset: ${asset.url}`);
  }

  await writeFile(destination, new Uint8Array(await response.arrayBuffer()));
  return destination;
}

async function assetIsCurrent(
  destination: string,
  kind: 'runtime' | 'integrations',
  sha256: string,
  manifest: ReleaseManifest,
): Promise<boolean> {
  if (!existsSync(destination)) {
    return false;
  }

  const markerPath = join(destination, RELEASE_MARKER);
  if (!existsSync(markerPath)) {
    return false;
  }

  try {
    const marker = ReleaseStateSchema.parse(JSON.parse(await readFile(markerPath, 'utf8')));
    const markerSha = kind === 'runtime' ? marker.runtimeSha256 : marker.integrationsSha256;
    return marker.version === manifest.version && markerSha === sha256;
  } catch {
    return false;
  }
}

async function writeMarker(
  destination: string,
  kind: 'runtime' | 'integrations',
  sha256: string,
  manifest: ReleaseManifest,
): Promise<void> {
  await mkdir(dirname(join(destination, RELEASE_MARKER)), { recursive: true });
  await writeFile(
    join(destination, RELEASE_MARKER),
    `${JSON.stringify(releaseState(manifest, kind, sha256), null, 2)}\n`,
  );
}

async function writeReleaseState(manifest: ReleaseManifest): Promise<void> {
  await mkdir(dirname(releaseStatePath), { recursive: true });
  await writeFile(
    releaseStatePath,
    `${JSON.stringify(
      {
        version: manifest.version,
        gitSha: manifest.gitSha,
        runtimeSha256: manifest.assets.runtime.sha256,
        integrationsSha256: manifest.assets.integrations.sha256,
      },
      null,
      2,
    )}\n`,
  );
}

function releaseState(
  manifest: ReleaseManifest,
  kind: 'runtime' | 'integrations',
  sha256: string,
): z.infer<typeof ReleaseStateSchema> {
  return {
    version: manifest.version,
    gitSha: manifest.gitSha,
    runtimeSha256: kind === 'runtime' ? sha256 : manifest.assets.runtime.sha256,
    integrationsSha256: kind === 'integrations' ? sha256 : manifest.assets.integrations.sha256,
  };
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  hash.update(await readFile(path));
  return hash.digest('hex');
}
