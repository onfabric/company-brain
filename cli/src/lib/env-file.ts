import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

export type EnvMap = Record<string, string>;

export async function readEnvFile(path: string): Promise<EnvMap> {
  if (!existsSync(path)) {
    return {};
  }

  return parseEnv(await readFile(path, 'utf8'));
}

export async function writeEnvFromTemplate({
  templatePath,
  outputPath,
  values,
}: {
  templatePath: string;
  outputPath: string;
  values: EnvMap;
}): Promise<void> {
  const template = await readFile(templatePath, 'utf8');
  const used = new Set<string>();
  const lines = template.split('\n').map((line) => {
    const key = envLineKey(line);
    if (!key || !(key in values)) {
      return line;
    }

    used.add(key);
    return `${key}=${values[key]}`;
  });

  const missing = Object.entries(values)
    .filter(([key]) => !used.has(key))
    .map(([key, value]) => `${key}=${value}`);

  await writeFile(outputPath, ensureTrailingNewline([...lines, ...missing].join('\n')));
}

export async function upsertEnvFile(path: string, values: EnvMap): Promise<void> {
  const current = existsSync(path) ? await readFile(path, 'utf8') : '';
  const used = new Set<string>();
  const lines = current
    .split('\n')
    .filter((line, index, all) => line.length > 0 || index < all.length - 1)
    .map((line) => {
      const key = envLineKey(line);
      if (!key || !(key in values)) {
        return line;
      }

      used.add(key);
      return `${key}=${values[key]}`;
    });

  const missing = Object.entries(values)
    .filter(([key]) => !used.has(key))
    .map(([key, value]) => `${key}=${value}`);

  await writeFile(path, ensureTrailingNewline([...lines, ...missing].join('\n')));
}

export function parseEnv(content: string): EnvMap {
  const values: EnvMap = {};

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const index = line.indexOf('=');
    if (index === -1) {
      continue;
    }

    const key = line.slice(0, index).trim();
    values[key] = stripQuotes(line.slice(index + 1).trim());
  }

  return values;
}

function envLineKey(line: string): string | undefined {
  if (!line || line.trimStart().startsWith('#')) {
    return undefined;
  }

  const match = /^([A-Z0-9_]+)=/.exec(line);
  return match?.[1];
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith('\n') ? value : `${value}\n`;
}
