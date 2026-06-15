import { describe, expect, it } from 'bun:test';
import {
  compareVersions,
  isReleaseVersion,
  packageVersionFromReleaseVersion,
  releaseVersionFromPackageVersion,
  versionSatisfiesMinimum,
} from './version.ts';

describe('version helpers', () => {
  it('recognizes release versions', () => {
    expect(isReleaseVersion('v1.2.3')).toBe(true);
    expect(isReleaseVersion('v1.2.3-beta.1')).toBe(true);
    expect(isReleaseVersion('1.2.3')).toBe(false);
    expect(isReleaseVersion('latest')).toBe(false);
  });

  it('compares semantic versions', () => {
    expect(compareVersions('v1.2.3', 'v1.2.3')).toBe(0);
    expect(compareVersions('v1.2.4', 'v1.2.3')).toBe(1);
    expect(compareVersions('v1.2.3', 'v1.3.0')).toBe(-1);
    expect(compareVersions('v1.2.3-beta.1', 'v1.2.3')).toBe(-1);
  });

  it('maps between release tags and package versions', () => {
    expect(packageVersionFromReleaseVersion('v1.2.3')).toBe('1.2.3');
    expect(releaseVersionFromPackageVersion('1.2.3')).toBe('v1.2.3');
    expect(releaseVersionFromPackageVersion('1.2.3-beta.1')).toBe('v1.2.3-beta.1');
    expect(releaseVersionFromPackageVersion('0.0.0')).toBe('0.0.0-dev');
  });

  it('checks minimum versions and lets source dev builds pass', () => {
    expect(versionSatisfiesMinimum('v1.2.3', 'v1.2.0')).toBe(true);
    expect(versionSatisfiesMinimum('v1.1.9', 'v1.2.0')).toBe(false);
    expect(versionSatisfiesMinimum('0.0.0-dev', 'v99.0.0')).toBe(true);
  });
});
