import cliPackageJson from '../../package.json' with { type: 'json' };

const DEV_CLI_VERSION = '0.0.0-dev';
const SEMVER_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;
const PACKAGE_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export const CLI_PACKAGE_VERSION = cliPackageJson.version;

export const CLI_VERSION =
  process.env.COMPANY_BRAIN_CLI_VERSION || releaseVersionFromPackageVersion(CLI_PACKAGE_VERSION);

export function isReleaseVersion(version: string): boolean {
  return /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version);
}

export function packageVersionFromReleaseVersion(version: string): string {
  if (!isReleaseVersion(version)) {
    throw new Error(`Release version must look like v1.2.3, got: ${version}`);
  }

  return version.slice(1);
}

export function releaseVersionFromPackageVersion(version: string): string {
  if (version === '0.0.0') {
    return DEV_CLI_VERSION;
  }

  if (!PACKAGE_VERSION_PATTERN.test(version)) {
    throw new Error(`CLI package version must look like 1.2.3, got: ${version}`);
  }

  return `v${version}`;
}

export function compareVersions(left: string, right: string): number {
  const a = parseVersion(left);
  const b = parseVersion(right);

  for (const part of ['major', 'minor', 'patch'] as const) {
    const diff = a[part] - b[part];
    if (diff !== 0) {
      return Math.sign(diff);
    }
  }

  if (a.prerelease === b.prerelease) {
    return 0;
  }
  if (!a.prerelease) {
    return 1;
  }
  if (!b.prerelease) {
    return -1;
  }

  return a.prerelease.localeCompare(b.prerelease);
}

export function versionSatisfiesMinimum(current: string, minimum: string): boolean {
  if (current.endsWith('-dev')) {
    return true;
  }

  return compareVersions(current, minimum) >= 0;
}

function parseVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
  prerelease: string;
} {
  const match = SEMVER_PATTERN.exec(version);
  if (!match) {
    throw new Error(`Invalid semantic version: ${version}`);
  }

  const [, major, minor, patch, prerelease = ''] = match;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease,
  };
}
