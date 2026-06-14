import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { staticPlugin } from '@elysiajs/static';
import { Elysia, StatusMap } from 'elysia';

// The build copies the dashboard bundle to `public/` next to the compiled binary
// (see build.ts), so it is always present in the shipped container. It is absent
// only in non-binary runs — `bun test`/`bun run`, where `process.execPath` is the
// bun executable rather than our server and the dashboard was never built. This
// single signal decides whether to serve it; in the container it is always true.
const dashboardDir = join(dirname(process.execPath), 'public');
const indexPath = join(dashboardDir, 'index.html');
const dashboardBuilt = existsSync(indexPath);

// Static file server for the built bundle (hashed assets, etc.). `indexHTML:
// false` leaves the SPA shell to `serveDashboard`; `alwaysStatic` registers one
// route per file so it never adds a catch-all that would shadow the root mount.
// Mount nothing when the bundle is absent — the plugin's startup directory scan
// would otherwise throw.
export const dashboardAssets: Elysia | Promise<Elysia> = dashboardBuilt
  ? staticPlugin({ assets: dashboardDir, prefix: '/', indexHTML: false, alwaysStatic: true })
  : new Elysia();

// The SPA shell, served for the root and every client-side route that maps to no
// built asset so they resolve on reload — this is `rootController`'s fallback,
// not the static plugin. Kept uncached so a deploy's new asset hashes are picked
// up. `Bun.file` on a missing path yields a broken 200, so the absent-bundle
// case (non-binary runs) returns a clean message instead.
export function serveDashboard(): Response {
  if (!dashboardBuilt) {
    return new Response('Dashboard has not been built.', { status: StatusMap['Not Found'] });
  }
  return new Response(Bun.file(indexPath));
}
