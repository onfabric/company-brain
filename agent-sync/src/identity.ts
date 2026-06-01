import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { readJsonFile, writeJsonFile } from './utils.js';

interface IdentityFile {
  user_identifier: string;
}

export async function ensureIdentity(dataDir: string): Promise<string> {
  const existing = await readIdentity(dataDir);
  if (existing) {
    return existing;
  }

  const userIdentifier = randomUUID();
  await writeJsonFile(identityPath(dataDir), { user_identifier: userIdentifier });
  return userIdentifier;
}

export async function readIdentity(dataDir: string): Promise<string | undefined> {
  const filePath = identityPath(dataDir);
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  const value = await readJsonFile(filePath);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const userIdentifier = (value as Partial<IdentityFile>).user_identifier;
  return typeof userIdentifier === 'string' && userIdentifier.trim().length > 0
    ? userIdentifier
    : undefined;
}

export function identityPath(dataDir: string): string {
  return path.join(dataDir, 'identity.json');
}
