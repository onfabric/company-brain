import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { readEnvFile, upsertEnvFile, writeEnvFromTemplate } from './env-file.ts';
import { rootEnvExamplePath, rootEnvPath } from './paths.ts';
import type { ReleaseManifest } from './release.ts';
import { randomBase64, randomUuid } from './secrets.ts';

const SECRET_BYTES = 32;
const IMAGE_URI_KEYS = ['NANGO_IMAGE_URI', 'BRAIN_IMAGE_URI', 'PG_BACKUP_IMAGE_URI'] as const;

export type EnsureRootEnvOptions = {
  force?: boolean;
  allowedDashboardAccountsEmailsRegex?: string;
  release?: ReleaseManifest;
};

export async function readRootEnv(): Promise<Record<string, string>> {
  return await readEnvFile(rootEnvPath);
}

export async function ensureRootEnv(options: EnsureRootEnvOptions = {}): Promise<void> {
  const existing = await readRootEnv();
  const values = rootEnvValues(
    existing,
    options.allowedDashboardAccountsEmailsRegex,
    options.release,
    Boolean(options.force),
  );

  if (!existsSync(rootEnvPath) || options.force) {
    await mkdir(dirname(rootEnvPath), { recursive: true });
    await writeEnvFromTemplate({
      templatePath: rootEnvExamplePath,
      outputPath: rootEnvPath,
      values: options.force ? { ...existing, ...values } : values,
    });
    return;
  }

  await upsertEnvFile(rootEnvPath, envUpdates(existing, values, Boolean(options.release)));
}

function rootEnvValues(
  existing: Record<string, string>,
  allowedDashboardAccountsEmailsRegex?: string,
  release?: ReleaseManifest,
  reset = false,
): Record<string, string> {
  const regex =
    allowedDashboardAccountsEmailsRegex || existing.ALLOWED_DASHBOARD_ACCOUNTS_EMAILS_REGEX;
  return {
    BRAIN_API_KEY: existing.BRAIN_API_KEY || randomUuid(),
    BETTER_AUTH_SECRET: replaceLocalDefault(
      existing.BETTER_AUTH_SECRET,
      'local-dev-better-auth-secret-change-me-0000',
      randomBase64(SECRET_BYTES),
    ),
    NANGO_DB_PASSWORD: keepExisting(existing.NANGO_DB_PASSWORD, 'nango', reset),
    BRAIN_DB_PASSWORD: keepExisting(existing.BRAIN_DB_PASSWORD, 'brain', reset),
    BRAIN_PUBLIC_URL: keepExisting(existing.BRAIN_PUBLIC_URL, 'http://localhost:3010', reset),
    NANGO_SERVER_URL: keepExisting(existing.NANGO_SERVER_URL, 'http://localhost:3003', reset),
    NANGO_PUBLIC_SERVER_URL: keepExisting(
      existing.NANGO_PUBLIC_SERVER_URL,
      'http://localhost:3003',
      reset,
    ),
    NANGO_PUBLIC_CONNECT_URL: keepExisting(
      existing.NANGO_PUBLIC_CONNECT_URL,
      'http://localhost:3009',
      reset,
    ),
    ...(regex ? { ALLOWED_DASHBOARD_ACCOUNTS_EMAILS_REGEX: regex } : {}),
    NANGO_IMAGE_URI: release?.images.nango ?? keepExisting(existing.NANGO_IMAGE_URI, '', reset),
    BRAIN_IMAGE_URI: release?.images.brain ?? keepExisting(existing.BRAIN_IMAGE_URI, '', reset),
    PG_BACKUP_IMAGE_URI:
      release?.images.pgBackup ?? keepExisting(existing.PG_BACKUP_IMAGE_URI, '', reset),
  };
}

function keepExisting(existing: string | undefined, generated: string, reset: boolean): string {
  return !reset && existing ? existing : generated;
}

function missingValues(
  existing: Record<string, string>,
  values: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).filter(([key, value]) => !existing[key] && value.length > 0),
  );
}

function envUpdates(
  existing: Record<string, string>,
  values: Record<string, string>,
  updateImages: boolean,
): Record<string, string> {
  return {
    ...missingValues(existing, values),
    ...(updateImages ? selectedValues(values, IMAGE_URI_KEYS) : {}),
  };
}

function selectedValues(
  values: Record<string, string>,
  keys: readonly string[],
): Record<string, string> {
  const selected: Record<string, string> = {};
  for (const key of keys) {
    const value = values[key];
    if (value) {
      selected[key] = value;
    }
  }

  return selected;
}

function replaceLocalDefault(
  existing: string | undefined,
  defaultValue: string,
  generated: string,
): string {
  return !existing || existing === defaultValue ? generated : existing;
}
