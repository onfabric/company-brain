import { Elysia, StatusMap } from 'elysia';

import { createLogger } from '#lib/logger.ts';

const httpLogger = createLogger('http');

function resolveStatus(status: number | keyof StatusMap | undefined): number {
  return typeof status === 'string' ? StatusMap[status] : (status ?? StatusMap.OK);
}

function formatElapsed(startedAt: number | undefined): string {
  return startedAt === undefined ? '' : ` (${Math.round(performance.now() - startedAt)}ms)`;
}

export const requestResponsePlugin = new Elysia({ name: 'request-response' })
  .derive(() => ({ requestStartedAt: performance.now() }))
  .onRequest(({ request }) => {
    httpLogger.info(`→ ${request.method} ${new URL(request.url).pathname}`);
  })
  .onAfterResponse(({ request, set, requestStartedAt }) => {
    const status = resolveStatus(set.status);
    const elapsed = formatElapsed(requestStartedAt);
    httpLogger.info(`← ${request.method} ${new URL(request.url).pathname} ${status}${elapsed}`);
  })
  .as('global');
