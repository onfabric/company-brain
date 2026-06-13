import { existsSync } from 'node:fs';
import { readEnvFile, upsertEnvFile, writeEnvFromTemplate } from './env-file.ts';
import { nangoEnvExamplePath, nangoEnvPath } from './paths.ts';
import { randomToken } from './secrets.ts';

const WEBHOOK_SECRET_BYTES = 32;

export type NangoEnvValues = Record<string, string>;

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
