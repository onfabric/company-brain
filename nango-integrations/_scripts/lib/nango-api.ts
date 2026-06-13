import { NOT_FOUND_STATUS } from '../nango-resources.js';

export type NangoRequestOptions = {
  method: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  allowNotFound?: boolean;
};

export class NangoApi {
  constructor(
    private readonly baseUrl: string,
    private readonly secretKey: string,
  ) {}

  async request(path: string, options: NangoRequestOptions): Promise<Response> {
    const headers = new Headers({
      authorization: `Bearer ${this.secretKey}`,
    });

    let body: string | undefined;
    if (options.body !== undefined) {
      headers.set('content-type', 'application/json');
      body = JSON.stringify(options.body);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method,
      headers,
      body,
    });

    if (options.allowNotFound && response.status === NOT_FOUND_STATUS) {
      return response;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${options.method} ${path} failed with ${response.status}: ${text}`);
    }

    return response;
  }
}

export async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
