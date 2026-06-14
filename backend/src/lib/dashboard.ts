import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { staticPlugin } from '@elysiajs/static';
import { Elysia, StatusMap } from 'elysia';

// The build copies the dashboard bundle to `public/` next to the compiled
// binary, so the directory is present whenever the app runs as that binary.
const dashboardDir = join(dirname(process.execPath), 'public');
const indexPath = join(dashboardDir, 'index.html');

// Serves the built dashboard files (hashed assets, etc.) from disk.
// `indexHTML: false` leaves the SPA shell to `serveDashboard`, so the root and
// unknown client-side routes get the same always-fresh `index.html`.
// `alwaysStatic` registers one route per file, never a catch-all that would
// shadow the root mount. A source or test run never builds the dashboard (and
// `process.execPath` is the bun binary, not our own), so guard on the bundle
// being present and otherwise mount nothing.
export const dashboardAssets: Elysia | Promise<Elysia> = existsSync(dashboardDir)
  ? staticPlugin({ assets: dashboardDir, prefix: '/', indexHTML: false, alwaysStatic: true })
  : new Elysia();

// The SPA shell, served for the root and every client-side route that maps to no
// built asset so they resolve on reload. The static plugin serves the built
// files; the shell is owned here (not by the plugin) so it stays fresh and a
// deploy's new asset hashes are always picked up.
export function serveDashboard(): Response {
  if (!existsSync(indexPath)) {
    return new Response('Dashboard has not been built.', { status: StatusMap['Not Found'] });
  }
  return new Response(Bun.file(indexPath));
}
