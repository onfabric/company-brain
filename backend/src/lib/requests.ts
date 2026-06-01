import type { PreHandler } from 'elysia';
import { createLogger } from '#lib/logger.ts';

const requestLogger = createLogger('http');

type RequestHandlerOptions = Parameters<PreHandler>[0];

export function elysiaRequestHandler({ request }: RequestHandlerOptions): void {
  requestLogger.info(`→ ${request.method} ${new URL(request.url).pathname}`);
}
