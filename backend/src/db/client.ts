import { withTypes } from '@ilbertt/bun-sqlgen';
import { SQL } from 'bun';
import type { Queries } from '#db/queries.gen.d.ts';
import { env } from '#lib/env.ts';

export const sql = withTypes<Queries>(new SQL(env.databaseUrl));
