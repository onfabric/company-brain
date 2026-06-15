import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { localConfigPath } from './paths.ts';

const LocalConfigSchema = z.object({
  installedIntegrationIds: z.array(z.string()).default([]),
  selectedIntegrationIds: z.array(z.string()).default([]),
});

export type LocalConfig = z.infer<typeof LocalConfigSchema>;

export async function readLocalConfig(): Promise<LocalConfig> {
  if (!existsSync(localConfigPath)) {
    return { installedIntegrationIds: [], selectedIntegrationIds: [] };
  }

  const raw = JSON.parse(await readFile(localConfigPath, 'utf8')) as unknown;
  return LocalConfigSchema.parse(raw);
}

export async function writeLocalConfig(config: LocalConfig): Promise<void> {
  await mkdir(dirname(localConfigPath), { recursive: true });
  await writeFile(localConfigPath, `${JSON.stringify(LocalConfigSchema.parse(config), null, 2)}\n`);
}
