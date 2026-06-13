export const NOT_FOUND_STATUS = 404;

export type ConnectionData = {
  connection_id: string;
  provider_config_key: string;
};

export type ConnectionsData = {
  connections: ConnectionData[];
};

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

export async function parseConnectionResponse(
  response: Response,
  integrationId: string,
  connectionId: string,
): Promise<ConnectionData> {
  const body = (await response.json()) as unknown;
  if (isConnectionData(body)) {
    return body;
  }

  if (isRecord(body) && isConnectionData(body.data)) {
    return body.data;
  }

  throw new Error(`Nango returned no connection data for ${integrationId}/${connectionId}`);
}

export async function parseConnectionsResponse(
  response: Response,
  integrationId: string,
): Promise<ConnectionsData> {
  const body = (await response.json()) as unknown;
  if (!isRecord(body) || !Array.isArray(body.connections)) {
    throw new Error(`Nango returned no connection list for ${integrationId}`);
  }

  return {
    connections: body.connections.filter(isConnectionData),
  };
}

function isConnectionData(value: unknown): value is ConnectionData {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.connection_id === 'string' && typeof value.provider_config_key === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
