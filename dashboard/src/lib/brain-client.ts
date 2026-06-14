import type { App } from '@company-brain/backend/types';
import { type edenFetch, treaty } from '@elysiajs/eden';
import { redirectToSignIn } from '#/lib/auth.ts';
import { HTTP_UNAUTHORIZED } from '#/lib/constants.ts';

// The dashboard is served from the same origin as the brain API. Treaty needs an
// absolute base (an empty domain resolves the first path segment as the host), and
// the origin keeps the vite dev proxy and production on the same path.
// parseDate:false keeps ISO datetime fields as strings. By default Treaty revives
// them into Date objects at runtime even though the types say string, which both
// breaks string operations (e.g. slicing created_at) and diverges from the types.
export const brain = treaty<App>(window.location.origin, {
  fetch: { credentials: 'include' },
  headers: { accept: 'application/json' },
  parseDate: false,
});

// Treaty exposes routes as a nested proxy rather than a flat path map, so the route
// union for brainPath is borrowed from edenFetch's path-string signature (type only).
export type BrainRoute = Parameters<ReturnType<typeof edenFetch<App>>>[0];

type PathParam<P extends string> = P extends `${string}:${infer Rest}`
  ? Rest extends `${infer Name}/${infer Tail}`
    ? Name | PathParam<`/${Tail}`>
    : Rest
  : never;

// Builds a backend URL from a route template, checked against the live route map:
// a stale path or prefix is a type error, and routes with `:params` require them.
// Use for paths that are navigated to rather than fetched (iframes, links).
export function brainPath<P extends BrainRoute>(
  ...args: [PathParam<P>] extends [never]
    ? [route: P]
    : [route: P, params: Record<PathParam<P>, string>]
): string {
  const [route, params] = args;
  let path: string = route;
  for (const [key, value] of Object.entries(params ?? {})) {
    path = path.replace(`:${key}`, encodeURIComponent(String(value)));
  }
  return path;
}

export class BrainApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

type EdenResult = {
  data: unknown;
  error: { status: number; value: unknown } | null;
  status: number;
};

type EdenData<R extends EdenResult> = R extends { error: null } ? R['data'] : never;

export function unwrap<R extends EdenResult>(result: R): EdenData<R> {
  if (result.error) {
    if (result.status === HTTP_UNAUTHORIZED) {
      redirectToSignIn();
    }
    throw new BrainApiError(errorMessage(result.status, result.error.value), result.status);
  }
  return result.data as EdenData<R>;
}

function errorMessage(status: number, value: unknown) {
  if (status === HTTP_UNAUTHORIZED) {
    return 'Your session has expired. Redirecting to sign in...';
  }
  const detail = messageDetail(value);
  return detail ? `Brain API ${status}: ${detail}` : `Brain API ${status}: request failed.`;
}

function messageDetail(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }
  return value == null ? '' : JSON.stringify(value);
}
