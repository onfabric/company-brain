import fs from 'node:fs';
import path from 'node:path';

type ApiMethod = 'get' | 'post';

interface ProxyConfig {
  endpoint: string;
  paginate?: {
    response_path?: string;
  };
}

interface MockOptions {
  dirname: string;
  name: string;
}

interface StoredResponse {
  response?: unknown;
  status?: number;
  headers?: Record<string, string>;
}

interface ApiResponse {
  data: unknown;
  status?: number | undefined;
  headers?: Record<string, string> | undefined;
}

interface Fixture {
  nango?: {
    getMetadata?: unknown;
    getCheckpoint?: unknown;
    getConnection?: unknown;
    batchSave?: Record<string, unknown[]>;
    batchDelete?: Record<string, unknown[]>;
  };
  api?: Partial<Record<ApiMethod, Record<string, StoredResponse | StoredResponse[]>>>;
}

export class NangoSyncMock {
  private readonly fixture: Fixture;
  private readonly apiIndexes = new Map<string, number>();

  constructor({ dirname, name }: MockOptions) {
    const filePath = path.resolve(dirname, `${name}.test.json`);
    this.fixture = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Fixture;
  }

  getMetadata(): Promise<unknown> {
    return Promise.resolve(this.fixture.nango?.getMetadata);
  }

  getCheckpoint(): Promise<unknown> {
    return Promise.resolve(this.fixture.nango?.getCheckpoint);
  }

  getConnection(): Promise<unknown> {
    return Promise.resolve(this.fixture.nango?.getConnection);
  }

  async saveCheckpoint(_checkpoint?: unknown): Promise<void> {}

  async trackDeletesStart(): Promise<void> {}

  async trackDeletesEnd(): Promise<void> {}

  async batchSave(_data: unknown[], _model: string): Promise<void> {}

  async batchDelete(_data: unknown[], _model: string): Promise<void> {}

  async log(): Promise<void> {}

  post(config: ProxyConfig): Promise<ApiResponse> {
    return Promise.resolve(this.apiResponse('post', config.endpoint));
  }

  get(config: ProxyConfig): Promise<ApiResponse> {
    return Promise.resolve(this.apiResponse('get', config.endpoint));
  }

  async *paginate(config: ProxyConfig): AsyncGenerator<unknown[]> {
    const response = await this.get(config);
    const records = getPath(response.data, config.paginate?.response_path);

    if (Array.isArray(records)) {
      yield records;
      return;
    }

    yield [];
  }

  getBatchSaveData(model: string): Promise<unknown[]> {
    return Promise.resolve(this.fixture.nango?.batchSave?.[model] ?? []);
  }

  getBatchDeleteData(model: string): Promise<unknown[]> {
    return Promise.resolve(this.fixture.nango?.batchDelete?.[model] ?? []);
  }

  private apiResponse(method: ApiMethod, endpoint: string): ApiResponse {
    const normalized = normalizeEndpoint(endpoint);
    const fixture = this.fixture.api?.[method]?.[normalized];

    if (!fixture) {
      return { data: {} };
    }

    const stored = Array.isArray(fixture)
      ? this.nextResponse(method, normalized, fixture)
      : fixture;
    return {
      data: stored.response ?? stored,
      status: stored.status,
      headers: stored.headers,
    };
  }

  private nextResponse(
    method: ApiMethod,
    endpoint: string,
    responses: StoredResponse[],
  ): StoredResponse {
    const key = `${method}:${endpoint}`;
    const index = this.apiIndexes.get(key) ?? 0;
    this.apiIndexes.set(key, index + 1);
    return responses[Math.min(index, responses.length - 1)] ?? {};
  }
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
}

function getPath(value: unknown, dottedPath?: string): unknown {
  if (!dottedPath) {
    return value;
  }

  return dottedPath.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    return (current as Record<string, unknown>)[key];
  }, value);
}
