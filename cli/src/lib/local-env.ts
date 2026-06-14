import { existsSync } from 'node:fs';
import { readEnvFile, upsertEnvFile, writeEnvFromTemplate } from './env-file.ts';
import { rootEnvExamplePath, rootEnvPath } from './paths.ts';
import { randomBase64, randomUuid } from './secrets.ts';

const SECRET_BYTES = 32;

export type EnsureRootEnvOptions = {
  force?: boolean;
  workspaceDomain?: string;
};

export async function readRootEnv(): Promise<Record<string, string>> {
  return await readEnvFile(rootEnvPath);
}

export async function ensureRootEnv(options: EnsureRootEnvOptions = {}): Promise<void> {
  const existing = await readRootEnv();
  const values = rootEnvValues(existing, options.workspaceDomain, Boolean(options.force));

  if (!existsSync(rootEnvPath) || options.force) {
    await writeEnvFromTemplate({
      templatePath: rootEnvExamplePath,
      outputPath: rootEnvPath,
      values: options.force ? { ...existing, ...values } : values,
    });
    return;
  }

  await upsertEnvFile(rootEnvPath, missingValues(existing, values));
}

function rootEnvValues(
  existing: Record<string, string>,
  workspaceDomain?: string,
  reset = false,
): Record<string, string> {
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
    WORKSPACE_DOMAIN: workspaceDomain || existing.WORKSPACE_DOMAIN || 'example.com',
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

function replaceLocalDefault(
  existing: string | undefined,
  defaultValue: string,
  generated: string,
): string {
  return !existing || existing === defaultValue ? generated : existing;
}
