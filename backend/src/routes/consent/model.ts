import type { OAuthAuthorizationQuery } from '@better-auth/oauth-provider';
import { type Static, t } from 'elysia';

export const ConsentQuerySchema = t.Object({
  client_id: t.String(),
  scope: t.Optional(t.String()),
});

type AssignableTo<T extends U, U> = T;

/**
 * Pins the consent page's query params to the subset of better-auth's signed
 * authorize query it actually reads, so an upstream rename of `client_id` or
 * `scope` fails the build here instead of 400-ing the consent page at runtime.
 */
export type ConsentQueryContract = AssignableTo<
  Static<typeof ConsentQuerySchema>,
  Pick<OAuthAuthorizationQuery, keyof Static<typeof ConsentQuerySchema>>
>;
