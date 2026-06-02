import { Elysia, StatusMap } from 'elysia';

import { BadRequestError } from '#lib/errors.ts';
import { GetUsageQuerySchema, GetUsageResponseSchema } from '#routes/api/usage/model.ts';
import { loggerPlugin, UsageServicePlugin } from '#services/plugins.ts';
import type { UsageDimension, UsageFilters } from '#types.ts';

const DEFAULT_RANGE_DAYS = 30;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const usageController = new Elysia()
  .use(loggerPlugin('usageController'))
  .use(UsageServicePlugin)
  .get(
    '/api/usage',
    async ({ query, usageService, logger, status }) => {
      const filters = parseUsageFilters(query);
      logger.info(`handling usage dashboard request grouped by ${filters.dimension}`);
      const result = await usageService.dashboard(filters);
      return status(StatusMap.OK, result);
    },
    {
      query: GetUsageQuerySchema,
      response: {
        [StatusMap.OK]: GetUsageResponseSchema,
      },
    },
  );

function parseUsageFilters(query: {
  dimension?: UsageDimension | undefined;
  from?: string | undefined;
  model?: string | undefined;
  source?: string | undefined;
  to?: string | undefined;
  user?: string | undefined;
}): UsageFilters {
  const now = new Date();
  const fallbackFrom = new Date(now);
  fallbackFrom.setUTCDate(fallbackFrom.getUTCDate() - DEFAULT_RANGE_DAYS);

  const from = query.from ? parseDateParam(query.from, false) : fallbackFrom;
  const to = query.to ? parseDateParam(query.to, true) : now;
  if (from >= to) {
    throw new BadRequestError('from must be before to');
  }

  return {
    from,
    to,
    dimension: query.dimension ?? 'user',
    user: trimFilter(query.user),
    source: trimFilter(query.source),
    model: trimFilter(query.model),
  };
}

function parseDateParam(value: string, dateOnlyAddsDay: boolean): Date {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new BadRequestError(`Invalid date: ${value}`);
  }

  if (dateOnlyAddsDay && DATE_ONLY.test(value)) {
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return date;
}

function trimFilter(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
