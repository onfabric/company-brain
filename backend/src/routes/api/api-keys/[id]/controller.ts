import { Elysia, StatusMap } from 'elysia';
import { AuthMethod, authPlugin, REQUIRE_AUTH } from '#lib/auth/plugin.ts';
import {
  ApiKeyParamsSchema,
  ApiKeyResponseSchema,
  DeleteApiKeyResponseSchema,
  UpdateApiKeyBodySchema,
} from '#routes/api/api-keys/[id]/model.ts';
import { UNAUTHORIZED_ERROR, UnauthorizedErrorSchema } from '#routes/api/api-keys/errors.ts';
import { ApiKeysServicePlugin, loggerPlugin } from '#services/plugins.ts';

export const apiKeysIdController = new Elysia()
  .use(loggerPlugin('apiKeysIdController'))
  .use(ApiKeysServicePlugin)
  .use(authPlugin)
  .patch(
    '/api-keys/:id',
    async ({ params, body, session, apiKeysService, logger, status }) => {
      if (session.authType !== AuthMethod.Session) {
        return status(StatusMap.Unauthorized, UNAUTHORIZED_ERROR);
      }
      logger.info(`updating api key ${params.id}`);
      const updated = await apiKeysService.update(params.id, body.name, session.user.id);
      return status(StatusMap.OK, updated);
    },
    {
      [REQUIRE_AUTH]: [AuthMethod.ApiKey, AuthMethod.Session],
      parse: 'json',
      detail: {
        tags: ['API Keys'],
        summary: 'Rename an API key',
        description:
          'Updates an API key’s label. The secret is unchanged. Only the user who created the key may rename it.',
      },
      params: ApiKeyParamsSchema,
      body: UpdateApiKeyBodySchema,
      response: {
        [StatusMap.OK]: ApiKeyResponseSchema,
        [StatusMap.Unauthorized]: UnauthorizedErrorSchema,
      },
    },
  )
  .delete(
    '/api-keys/:id',
    async ({ params, apiKeysService, logger, status }) => {
      logger.info(`deleting api key ${params.id}`);
      const id = await apiKeysService.remove(params.id);
      return status(StatusMap.OK, { id });
    },
    {
      [REQUIRE_AUTH]: [AuthMethod.ApiKey, AuthMethod.Session],
      detail: {
        tags: ['API Keys'],
        summary: 'Delete an API key',
        description: 'Revokes an API key. Requests using it will no longer authenticate.',
      },
      params: ApiKeyParamsSchema,
      response: {
        [StatusMap.OK]: DeleteApiKeyResponseSchema,
      },
    },
  );
