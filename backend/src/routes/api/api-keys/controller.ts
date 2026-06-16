import { Elysia, StatusMap } from 'elysia';
import { AuthMethod, authPlugin, REQUIRE_AUTH } from '#lib/auth/plugin.ts';
import { UNAUTHORIZED_ERROR, UnauthorizedErrorSchema } from '#routes/api/api-keys/errors.ts';
import {
  CreateApiKeyBodySchema,
  CreatedApiKeySchema,
  ListApiKeysResponseSchema,
} from '#routes/api/api-keys/model.ts';
import { ApiKeysServicePlugin, loggerPlugin } from '#services/plugins.ts';

export const apiKeysController = new Elysia()
  .use(loggerPlugin('apiKeysController'))
  .use(ApiKeysServicePlugin)
  .use(authPlugin)
  .get(
    '/api-keys',
    async ({ apiKeysService, logger, status }) => {
      logger.info('listing api keys');
      const api_keys = await apiKeysService.list();
      return status(StatusMap.OK, { api_keys });
    },
    {
      [REQUIRE_AUTH]: [AuthMethod.ApiKey, AuthMethod.Session],
      detail: {
        tags: ['API Keys'],
        summary: 'List API keys',
        description: 'Returns every API key, newest first. The secret itself is never returned.',
      },
      response: {
        [StatusMap.OK]: ListApiKeysResponseSchema,
      },
    },
  )
  .post(
    '/api-keys',
    async ({ body, session, apiKeysService, logger, status }) => {
      if (session.authType !== AuthMethod.Session) {
        return status(StatusMap.Unauthorized, UNAUTHORIZED_ERROR);
      }
      logger.info(`creating api key ${body.name}`);
      const created = await apiKeysService.create(body.name, session.user.id);
      return status(StatusMap.Created, created);
    },
    {
      [REQUIRE_AUTH]: [AuthMethod.ApiKey, AuthMethod.Session],
      parse: 'json',
      detail: {
        tags: ['API Keys'],
        summary: 'Create an API key',
        description:
          'Creates an API key and returns the full secret once. Store it now — it cannot be retrieved later. Requires a signed-in user; the key is owned by its creator.',
      },
      body: CreateApiKeyBodySchema,
      response: {
        [StatusMap.Created]: CreatedApiKeySchema,
        [StatusMap.Unauthorized]: UnauthorizedErrorSchema,
      },
    },
  );
