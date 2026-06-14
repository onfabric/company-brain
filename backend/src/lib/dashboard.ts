import { existsSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { StatusMap } from 'elysia';

// The build copies the dashboard bundle to `public/` next to the compiled binary
// (see build.ts), so it is present whenever the app runs as that binary; it is
// absent only in non-binary runs (`bun test`/`bun run`, where `process.execPath`
// is bun itself and the dashboard was never built).
const dashboardDir = join(dirname(process.execPath), 'public');
const indexPath = join(dashboardDir, 'index.html');

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const SECONDS_PER_DAY = SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY;
// biome-ignore lint/style/noMagicNumbers: a year is plainly 365 days
const ONE_YEAR_SECONDS = 365 * SECONDS_PER_DAY;

// The single place the dashboard is served from: a built file when the path maps
// to one — Vite's content-hashed assets, cached immutably — otherwise the SPA
// shell, so the root and every client-side route resolve on reload. `Bun.file`
// supplies the content type.
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

// Maps a URL path to a real file inside the bundle, or null when it is not a file
// (the caller then serves the SPA shell). Paths that escape `dashboardDir` are
// rejected.
function resolveAssetPath(pathname: string): string | null {
  const target = join(dashboardDir, decodeURIComponent(pathname));
  const rel = relative(dashboardDir, target);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    return null;
  }
  return existsSync(target) && statSync(target).isFile() ? target : null;
}
