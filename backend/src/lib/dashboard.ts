import { existsSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { StatusMap } from 'elysia';

// The build copies the dashboard bundle next to the compiled binary (build.ts);
// it is absent only in non-binary runs (bun test/run).
const dashboardDir = join(dirname(process.execPath), 'public');
const indexPath = join(dashboardDir, 'index.html');

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const SECONDS_PER_DAY = SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY;
// biome-ignore lint/style/noMagicNumbers: a year is plainly 365 days
const ONE_YEAR_SECONDS = 365 * SECONDS_PER_DAY;

// Serves a built file when the path maps to one (hashed assets cached immutably),
// else the SPA shell so client-side routes resolve on reload. Bun.file sets the
// content type.
export function serveDashboard(request: Request): Response {
  const { pathname } = new URL(request.url);
  const filePath = resolveAssetPath(pathname);
  if (filePath) {
    const init = pathname.startsWith('/assets/')
      ? { headers: { 'cache-control': `public, max-age=${ONE_YEAR_SECONDS}, immutable` } }
      : undefined;
    return new Response(Bun.file(filePath), init);
  }
  if (!existsSync(indexPath)) {
    return new Response('Dashboard has not been built.', { status: StatusMap['Not Found'] });
  }
  return new Response(Bun.file(indexPath));
}

// Resolves a URL path to a file in the bundle, or null (the caller then serves
// the SPA shell). Rejects paths that escape dashboardDir.
function resolveAssetPath(pathname: string): string | null {
  const target = join(dashboardDir, decodeURIComponent(pathname));
  const rel = relative(dashboardDir, target);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    return null;
  }
  return existsSync(target) && statSync(target).isFile() ? target : null;
}
