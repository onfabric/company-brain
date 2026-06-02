import { createApp } from '#app.ts';
import { env } from '#lib/env.ts';
import { createLogger } from '#lib/logger.ts';

const { server } = createApp().listen({ port: env.port, hostname: '0.0.0.0' });

createLogger('usage-dashboard').info(`listening on ${server!.url.origin}`);
