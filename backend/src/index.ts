import { runMigrations } from '#db/migrate.ts';
import { env } from '#lib/env.ts';
import { createLogger } from '#lib/logger.ts';

await runMigrations();

// Import the app dynamically to let the migrations run first.
const { createApp } = await import('#app.ts');

const { server } = createApp().listen({ port: env.port, hostname: '0.0.0.0' });

createLogger('brain').info(`listening on ${server!.url.origin}`);
