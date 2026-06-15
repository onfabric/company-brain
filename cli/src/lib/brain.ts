import { createBrainClient } from '@company-brain/backend-client';

export const DEFAULT_BRAIN_URL = 'http://localhost:3010';

const clients = new Map<string, ReturnType<typeof createBrainClient>>();

export function brainClient(baseUrl: string = DEFAULT_BRAIN_URL) {
  const cached = clients.get(baseUrl);
  if (cached) {
    return cached;
  }
  const client = createBrainClient({
    domain: baseUrl,
    treatyOptions: { headers: { accept: 'application/json' } },
  });
  clients.set(baseUrl, client);
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
