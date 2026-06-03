import { type AfterResponseHandler, type PreHandler, StatusMap } from 'elysia';

import { createLogger } from '#lib/logger.ts';

const requestLogger = createLogger('http');

const requestStart = new WeakMap<Request, number>();

type RequestHandlerOptions = Parameters<PreHandler>[0];
type AfterResponseOptions = Parameters<AfterResponseHandler>[0];

export function elysiaRequestHandler({ request }: RequestHandlerOptions): void {
  requestStart.set(request, performance.now());
  requestLogger.info(`→ ${request.method} ${new URL(request.url).pathname}`);
}

export function elysiaAfterResponseHandler({ request, set }: AfterResponseOptions): void {
  const status =
    typeof set.status === 'string' ? StatusMap[set.status] : (set.status ?? StatusMap.OK);
  const start = requestStart.get(request);
  requestStart.delete(request);
  const elapsed = start === undefined ? '' : ` (${Math.round(performance.now() - start)}ms)`;
  requestLogger.info(`← ${request.method} ${new URL(request.url).pathname} ${status}${elapsed}`);
}
