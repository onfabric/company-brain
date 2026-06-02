import { t } from 'elysia';

export const UsageDimensionSchema = t.Union([
  t.Literal('day'),
  t.Literal('model'),
  t.Literal('session'),
  t.Literal('source'),
  t.Literal('user'),
]);

export const GetUsageQuerySchema = t.Object({
  dimension: t.Optional(UsageDimensionSchema),
  from: t.Optional(t.String()),
  model: t.Optional(t.String()),
  source: t.Optional(t.String()),
  to: t.Optional(t.String()),
  user: t.Optional(t.String()),
});

export const GetUsageResponseSchema = t.Any();
