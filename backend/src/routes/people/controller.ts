import { Elysia, StatusMap } from 'elysia';
import { ListPeopleResponseSchema } from '#routes/people/model.ts';
import { loggerPlugin, PeopleServicePlugin } from '#services/plugins.ts';

export const peopleController = new Elysia()
  .use(loggerPlugin('peopleController'))
  .use(PeopleServicePlugin)
  .get(
    '/people',
    async ({ peopleService, logger, status }) => {
      logger.info('listing people');
      const result = await peopleService.listPeople();
      return status(StatusMap.OK, result);
    },
    {
      response: {
        [StatusMap.OK]: ListPeopleResponseSchema,
      },
    },
  );
