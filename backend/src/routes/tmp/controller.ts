import { Elysia, StatusMap } from 'elysia';
import { SyncPingBodySchema, SyncPingResponseSchema } from '#routes/tmp/model.ts';
import { loggerPlugin } from '#services/plugins.ts';

// TEMP: debug endpoint to confirm Nango syncs reach the backend. Remove once done.
export const tmpController = new Elysia().use(loggerPlugin('tmpController')).post(
  '/tmp/sync-ping',
  ({ body, logger, status }) => {
    logger.info(`sync ping received: ${body.model} x${body.count}`);
    return status(StatusMap.OK, { received: true as const });
  },
  {
    body: SyncPingBodySchema,
    response: {
      [StatusMap.OK]: SyncPingResponseSchema,
    },
  },
);
