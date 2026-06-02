import { describe, expect, it } from 'bun:test';
import { StatusMap } from 'elysia';

(process.env as Record<string, string | undefined>).DATABASE_URL ??=
  'postgresql://test:test@localhost:5432/test';
(process.env as Record<string, string | undefined>).USAGE_DASHBOARD_USERNAME = 'admin';
(process.env as Record<string, string | undefined>).USAGE_DASHBOARD_PASSWORD = 'secret';

describe('app', () => {
  it('builds the Elysia app without a database connection', async () => {
    const { createApp } = await import('../src/app.ts');
    expect(createApp()).toBeDefined();
  });

  it('protects the dashboard while leaving health public', async () => {
    const { createApp } = await import('../src/app.ts');
    const { basicAuthHandler } = await import('../src/lib/auth.ts');
    const app = createApp();

    const healthAuth = basicAuthHandler({ request: new Request('http://usage.test/health') });
    const dashboard = await app.handle(new Request('http://usage.test/'));
    const authorized = await app.handle(
      new Request('http://usage.test/', {
        headers: {
          authorization: `Basic ${Buffer.from('admin:secret').toString('base64')}`,
        },
      }),
    );

    expect(healthAuth).toBeUndefined();
    expect(dashboard.status).toBe(StatusMap.Unauthorized);
    expect(authorized.status).toBe(StatusMap.OK);
  });
});
