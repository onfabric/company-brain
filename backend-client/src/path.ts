import type { App } from '@company-brain/backend/types';
import type { edenFetch } from '@elysiajs/eden';

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
