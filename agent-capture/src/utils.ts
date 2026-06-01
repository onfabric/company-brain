import fs from 'node:fs';
import path from 'node:path';

const PATH_FIELD_PATTERN = /(?:^|_)(?:file|path|filename|filepath)(?:_|$)/i;
const ABSOLUTE_PATH_PATTERN = /(?:\/[A-Za-z0-9._~+@%=-]+)+/g;
const MARKDOWN_HEADING_PATTERN = /[#*_`[\]<>]/g;
const TITLE_MAX_LENGTH = 90;
const TOOL_TEXT_MAX_LENGTH = 20_000;
const JSON_MAX_LENGTH = 12_000;
const ISO_DATE_LENGTH = 10;

export function toIso(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function laterIso(left: string | undefined, right: string | undefined): string | undefined {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  return Date.parse(right) > Date.parse(left) ? right : left;
}

export function earlierIso(
  left: string | undefined,
  right: string | undefined,
): string | undefined {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  return Date.parse(right) < Date.parse(left) ? right : left;
}

export function compactText(value: string, maxLength = TOOL_TEXT_MAX_LENGTH): string {
  const normalized = value.replace(/\r\n/g, '\n').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  const omitted = normalized.length - maxLength;
  return `${normalized.slice(0, maxLength).trimEnd()}\n\n[truncated ${omitted} characters]`;
}

export function stringifyCompact(value: unknown, maxLength = JSON_MAX_LENGTH): string {
  if (typeof value === 'string') {
    return compactText(value, maxLength);
  }

  try {
    return compactText(JSON.stringify(value, null, 2), maxLength);
  } catch {
    return compactText(String(value), maxLength);
  }
}

export function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
  ).sort();
}

export function titleFromText(text: string): string {
  const singleLine = text.replace(/\s+/g, ' ').replace(MARKDOWN_HEADING_PATTERN, '').trim();
  if (singleLine.length <= TITLE_MAX_LENGTH) {
    return singleLine || 'Untitled agent conversation';
  }
  return `${singleLine.slice(0, TITLE_MAX_LENGTH).trimEnd()}...`;
}

export function collectPathValues(value: unknown): string[] {
  const paths: string[] = [];
  collectPaths(value, paths, undefined);
  return uniqueStrings(paths);
}

export function workspaceNameFromCwd(cwd: string | undefined): string | undefined {
  if (!cwd) {
    return undefined;
  }
  return path.basename(cwd);
}

export function repoNameFromCwd(cwd: string | undefined): string | undefined {
  const root = findGitRoot(cwd);
  return root ? path.basename(root) : undefined;
}

export function safeSegment(value: string): string {
  return encodeURIComponent(value).replaceAll('%', '_');
}

export function dateOnly(value: string): string {
  return value.slice(0, ISO_DATE_LENGTH);
}

export async function readJsonFile(filePath: string): Promise<unknown> {
  const content = await fs.promises.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  await fs.promises.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`);
  await fs.promises.rename(tempPath, filePath);
}

function collectPaths(value: unknown, paths: string[], key: string | undefined): void {
  if (typeof value === 'string') {
    if (key && PATH_FIELD_PATTERN.test(key)) {
      paths.push(value);
    }
    for (const match of value.matchAll(ABSOLUTE_PATH_PATTERN)) {
      const [pathValue] = match;
      paths.push(pathValue);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectPaths(item, paths, key);
    }
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  for (const [childKey, childValue] of Object.entries(value)) {
    collectPaths(childValue, paths, childKey);
  }
}

function findGitRoot(cwd: string | undefined): string | undefined {
  if (!cwd) {
    return undefined;
  }

  let current = path.resolve(cwd);
  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}
