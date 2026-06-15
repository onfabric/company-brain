import { createBrainClient } from '@company-brain/backend-client';

export const DEFAULT_BRAIN_URL = 'http://localhost:3010';

let client: ReturnType<typeof createBrainClient> | undefined;

export function brainClient(baseUrl: string = DEFAULT_BRAIN_URL) {
  client ??= createBrainClient({
    domain: baseUrl,
    treatyOptions: { headers: { accept: 'application/json' } },
  });
  return client;
}

export async function isBrainApiHealthy(baseUrl: string = DEFAULT_BRAIN_URL): Promise<boolean> {
  try {
    const { error } = await brainClient(baseUrl).brain.api.health.get();
    return error === null;
  } catch {
    return false;
  }
}
