import { Elysia, StatusMap } from 'elysia';

import { createLogger } from '#lib/logger.ts';

const requestLogger = createLogger('http');

export const requestResponsePlugin = new Elysia({ name: 'request-response' })
  .derive(() => ({ requestStartedAt: performance.now() }))
  .onRequest(({ request }) => {
    requestLogger.info(`→ ${request.method} ${new URL(request.url).pathname}`);
  })
  .onAfterResponse(({ request, set, requestStartedAt }) => {
    const status =
      typeof set.status === 'string' ? StatusMap[set.status] : (set.status ?? StatusMap.OK);
    const elapsed =
      requestStartedAt === undefined
        ? ''
        : ` (${Math.round(performance.now() - requestStartedAt)}ms)`;
    requestLogger.info(`← ${request.method} ${new URL(request.url).pathname} ${status}${elapsed}`);
  })
  .as('global');
