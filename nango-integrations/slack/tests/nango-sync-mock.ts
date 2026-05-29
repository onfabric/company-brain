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

export class NangoSyncMock {
    private readonly fixture: any;
    private readonly apiIndexes = new Map<string, number>();

    constructor({ dirname, name }: MockOptions) {
        const filePath = path.resolve(dirname, `${name}.test.json`);
        this.fixture = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    async getMetadata(): Promise<unknown> {
        return this.fixture.nango?.getMetadata;
    }

    async getCheckpoint(): Promise<unknown> {
        return this.fixture.nango?.getCheckpoint;
    }

    async saveCheckpoint(): Promise<void> {}

    async trackDeletesStart(): Promise<void> {}

    async trackDeletesEnd(): Promise<void> {}

    async batchSave(): Promise<void> {}

    async batchDelete(): Promise<void> {}

    async post(config: ProxyConfig): Promise<{ data: unknown; status?: number; headers?: Record<string, string> }> {
        return this.apiResponse('post', config.endpoint);
    }

    async get(config: ProxyConfig): Promise<{ data: unknown; status?: number; headers?: Record<string, string> }> {
        return this.apiResponse('get', config.endpoint);
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

    async getBatchSaveData(model: string): Promise<unknown[]> {
        return this.fixture.nango?.batchSave?.[model] ?? [];
    }

    async getBatchDeleteData(model: string): Promise<unknown[]> {
        return this.fixture.nango?.batchDelete?.[model] ?? [];
    }

    private apiResponse(method: ApiMethod, endpoint: string): { data: unknown; status?: number; headers?: Record<string, string> } {
        const normalized = normalizeEndpoint(endpoint);
        const fixture = this.fixture.api?.[method]?.[normalized];

        if (!fixture) {
            return { data: {} };
        }

        const stored = Array.isArray(fixture) ? this.nextResponse(method, normalized, fixture) : fixture;
        return {
            data: stored.response ?? stored,
            status: stored.status,
            headers: stored.headers
        };
    }

    private nextResponse(method: ApiMethod, endpoint: string, responses: StoredResponse[]): StoredResponse {
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
