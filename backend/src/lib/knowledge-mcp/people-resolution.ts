import { BadRequestError } from '#lib/errors.ts';
import type { PeopleReader } from '#lib/knowledge-mcp/types.ts';

export async function resolvePersonIds(
  people: PeopleReader,
  namesOrEmails: string[] | undefined,
): Promise<string[] | undefined> {
  if (namesOrEmails === undefined) {
    return undefined;
  }
  const matches = await people.findByNameOrEmail(namesOrEmails);
  return unique(matches.map((person) => person.id));
}

export async function requirePersonIds(
  people: PeopleReader,
  namesOrEmails: string[] | undefined,
): Promise<string[]> {
  if (namesOrEmails === undefined || namesOrEmails.length === 0) {
    return [];
  }
  const matches = await people.findByNameOrEmail(namesOrEmails);
  const matchedValues = new Set(
    matches
      .flatMap((person) => [person.name, person.email])
      .filter(isString)
      .map(normalize),
  );
  const missing = unique(namesOrEmails.map((value) => value.trim()).filter(Boolean)).filter(
    (value) => !matchedValues.has(normalize(value)),
  );
  if (missing.length > 0) {
    throw new BadRequestError(`unknown people: ${missing.join(', ')}`);
  }
  return unique(matches.map((person) => person.id));
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function isString(value: string | null): value is string {
  return value !== null;
}
