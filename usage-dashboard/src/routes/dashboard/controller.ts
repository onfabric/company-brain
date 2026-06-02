import { Elysia } from 'elysia';

import { DASHBOARD_HTML } from '#routes/dashboard/view.ts';

export const dashboardController = new Elysia().get(
  '/',
  () =>
    new Response(DASHBOARD_HTML, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
      },
    }),
);
