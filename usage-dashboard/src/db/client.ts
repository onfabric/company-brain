import { SQL } from 'bun';

import { env } from '#lib/env.ts';

export const sql = new SQL(env.databaseUrl);
