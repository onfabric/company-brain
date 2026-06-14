import { existsSync } from 'node:fs';
import { readEnvFile, upsertEnvFile, writeEnvFromTemplate } from './env-file.ts';
import { nangoEnvExamplePath, nangoEnvPath } from './paths.ts';
import { randomToken } from './secrets.ts';

const WEBHOOK_SECRET_BYTES = 32;

export type NangoEnvValues = Record<string, string>;

export type NangoEnvOverrides = {
  nangoHostport?: string;
  nangoSecretKey?: string;
};

export async function readNangoEnv(): Promise<Record<string, string>> {
  return await readEnvFile(nangoEnvPath);
}

export async function ensureNangoEnvBase(force = false): Promise<void> {
  const existing = await readNangoEnv();
  const values = {
    NANGO_HOSTPORT: force
      ? 'http://localhost:3003'
      : existing.NANGO_HOSTPORT || 'http://localhost:3003',
    AGENT_SYNC_WEBHOOK_SECRET:
      existing.AGENT_SYNC_WEBHOOK_SECRET || randomToken(WEBHOOK_SECRET_BYTES),
  };

  if (!existsSync(nangoEnvPath) || force) {
    await writeEnvFromTemplate({
      templatePath: nangoEnvExamplePath,
      outputPath: nangoEnvPath,
      values: force ? { ...existing, ...values } : values,
    });
    return;
  }

  await upsertEnvFile(nangoEnvPath, values);
}

export async function upsertNangoEnv(values: NangoEnvValues): Promise<void> {
  await upsertEnvFile(nangoEnvPath, values);
}

export function processNangoEnv(overrides: NangoEnvOverrides = {}): NangoEnvValues {
  const values: NangoEnvValues = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (value) {
      values[key] = value;
    }
  }

  return applyNangoEnvOverrides(values, overrides);
}

export function applyNangoEnvOverrides(
  values: NangoEnvValues,
  overrides: NangoEnvOverrides = {},
): NangoEnvValues {
  return {
    ...values,
    ...(overrides.nangoHostport
      ? { NANGO_HOSTPORT: normalizeNangoHostport(overrides.nangoHostport) }
      : {}),
    ...(overrides.nangoSecretKey ? { NANGO_SECRET_KEY_DEV: overrides.nangoSecretKey } : {}),
  };
}

export function normalizeNangoHostport(value: string): string {
  return value.trim().replace(/\/+$/, '');
}
