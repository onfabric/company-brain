import { openapi } from '@elysiajs/openapi';
import { staticPlugin } from '@elysiajs/static';
import { Elysia } from 'elysia';
import { apiKeySecuritySchemes } from '#lib/auth/api-key.ts';
import { sessionSecuritySchemes } from '#lib/auth/better-auth.ts';
import { dashboardDir } from '#lib/dashboard.ts';
import { elysiaErrorHandler } from '#lib/errors.ts';
import { requestResponsePlugin } from '#lib/request-response.ts';
import { apiController } from '#routes/api/controller.ts';
import { rootController } from '#routes/controller.ts';

export function createApp() {
  return (
    new Elysia()
      .onError(elysiaErrorHandler)
      .use(requestResponsePlugin)
      .use(
        openapi({
          documentation: {
            info: {
              title: 'Company Brain API',
              version: '1.0.0',
            },
            tags: [
              {
                name: 'People',
                description: 'List, update, and merge the people derived from ingested records.',
              },
              {
                name: 'Records',
                description: 'Search ingested records.',
              },
              {
                name: 'Data Sources',
                description: 'Inspect the data sources that have ingested records.',
              },
              {
                name: 'Knowledge',
                description: 'Search and read knowledge distilled from records.',
              },
              {
                name: 'Knowledge Types',
                description: 'Manage the controlled vocabulary of knowledge types.',
              },
            ],
            components: {
              securitySchemes: {
                ...apiKeySecuritySchemes,
                ...sessionSecuritySchemes,
              },
            },
          },
        }),
      )
      .use(apiController)
      // Serve the built dashboard files (hashed assets, etc.) from disk.
      // `indexHTML: false` leaves the SPA shell to `rootController`, so the root
      // and unknown client-side routes get the same always-fresh `index.html`.
      // `alwaysStatic` registers one route per file so the plugin never adds a
      // catch-all that would shadow the root mount. When the bundle is absent (a
      // backend-only `bun test` run never builds the dashboard) the plugin's
      // directory scan rejects, so recover to a no-op rather than crash startup.
      .use(
        staticPlugin({
          assets: dashboardDir,
          prefix: '/',
          indexHTML: false,
          alwaysStatic: true,
        }).catch(() => new Elysia()),
      )
      .use(rootController)
  );
}
