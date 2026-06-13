import { randomBytes, randomUUID } from 'node:crypto';

export function randomBase64(bytes: number): string {
  return randomBytes(bytes).toString('base64');
}

export function randomToken(bytes: number): string {
  return randomBytes(bytes).toString('base64url');
}

export function randomUuid(): string {
  return randomUUID();
}
