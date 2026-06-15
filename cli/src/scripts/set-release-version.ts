#!/usr/bin/env bun

import { readFile, writeFile } from 'node:fs/promises';
import { packageVersionFromReleaseVersion } from '../lib/version.ts';

const [version] = Bun.argv.slice(2);
if (!version) {
  throw new Error('Usage: set-release-version.ts v1.2.3');
}

const packagePath = new URL('../../package.json', import.meta.url);
const packageJson = JSON.parse(await readFile(packagePath, 'utf8')) as {
  version?: unknown;
};
const packageVersion = packageVersionFromReleaseVersion(version);

packageJson.version = packageVersion;
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

console.log(`Set cli/package.json version to ${packageVersion}.`);
