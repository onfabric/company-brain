import type { App } from '@company-brain/backend/types';
import type { edenFetch } from '@elysiajs/eden';
import type { NangoSync } from 'nango';

// The brain Data Transformation Service, reachable by service name on the compose
// network.
const BACKEND_BASE_URL = 'http://brain:3010';

// A thin wrapper over the SDK's uncontrolledFetch, typed with the exact type
// Eden's `edenFetch` would return, so every route, method, and response stays typed
// off the live Elysia server. This folder is compiled on its own (see
// tsconfig.backend-client.json) into dist/, which the sandboxed syncs import as
// plain JS — the backend's source never reaches Nango's compiler.
export type BackendClient = ReturnType<typeof edenFetch<App>>;

type FetchCaller = Pick<NangoSync, 'uncontrolledFetch'>;
type FetchOptions = Parameters<FetchCaller['uncontrolledFetch']>[0];

type RequestOptions = {
  method?: FetchOptions['method'];
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: unknown;
};

export function createBackendClient(
  nango: FetchCaller,
  baseUrl: string = BACKEND_BASE_URL,
): BackendClient {
  const call = async (endpoint: string, options?: RequestOptions) => {
    const url = new URL(endpoint, baseUrl);
    for (const [key, value] of Object.entries(options?.query ?? {})) {
      url.searchParams.set(key, value);
    }

    let response: Response;
    try {
      response = await nango.uncontrolledFetch({
        url,
        method: options?.method ?? 'GET',
        headers: options?.headers,
        body: options?.body === undefined ? null : JSON.stringify(options.body),
      });
    } catch (error) {
      return {
        data: null,
        error: { status: 0, value: String(error) },
        status: 0,
        headers: {},
        retry: noop,
      };
    }

    const data = await readJson(response);
    const envelope = { status: response.status, headers: {}, retry: noop };
    return response.ok
      ? { ...envelope, data, error: null }
      : { ...envelope, data: null, error: { status: response.status, value: data } };
  };

  return call as unknown as BackendClient;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function noop(): Promise<void> {}
