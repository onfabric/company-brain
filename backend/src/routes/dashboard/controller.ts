import { existsSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Elysia, StatusMap } from 'elysia';

const sourceDashboardDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../dashboard/dist',
);
const dashboardDir = existsSync(sourceDashboardDir)
  ? sourceDashboardDir
  : join(dirname(process.execPath), 'dashboard');
const indexPath = join(dashboardDir, 'index.html');

export const dashboardController = new Elysia()
  .get('/dashboard', () => serveIndex())
  .get('/dashboard/', () => serveIndex())
  .get('/dashboard/*', ({ params }) => serveDashboardPath(params['*']));

function serveDashboardPath(path: string | undefined) {
  const assetPath = resolveDashboardPath(path ?? '');
  if (!assetPath) {
    return new Response('Not found', { status: StatusMap['Not Found'] });
  }
  if (existsSync(assetPath) && statSync(assetPath).isFile()) {
    return fileResponse(assetPath);
  }
  return serveIndex();
}

function serveIndex() {
  if (!existsSync(indexPath)) {
    return new Response('Dashboard has not been built.', { status: StatusMap['Not Found'] });
  }
  return fileResponse(indexPath);
}

function resolveDashboardPath(path: string) {
  const target = join(dashboardDir, path);
  const relativePath = relative(dashboardDir, target);
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    return null;
  }
  return target;
}

function fileResponse(path: string) {
  return new Response(Bun.file(path), {
    headers: {
      'content-type': contentTypeFor(path),
    },
  });
}

function contentTypeFor(path: string) {
  switch (extname(path)) {
    case '.css':
      return 'text/css; charset=utf-8';
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}
