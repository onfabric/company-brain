import { withTypes } from '@ilbertt/bun-sqlgen';
import { SQL } from 'bun';
import { env } from '#lib/env.ts';

export const sql = withTypes(new SQL(env.databaseUrl));
