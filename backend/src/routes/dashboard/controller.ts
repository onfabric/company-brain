import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { StatusMap } from 'elysia';

// The build copies the dashboard bundle to `public/` next to the compiled
// binary, so the directory is always present in the container.
export const dashboardDir = join(dirname(process.execPath), 'public');
const indexPath = join(dashboardDir, 'index.html');

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
