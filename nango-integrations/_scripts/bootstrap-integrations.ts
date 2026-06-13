import { bootstrapIntegrations } from './lib/bootstrap-integrations.js';
import { firstPositionalArg, flagValue, hasFlag, optionalEnv, requiredEnv } from './lib/env.js';
import { NangoApi } from './lib/nango-api.js';
import { parseIntegrationSelection } from './nango-resources.js';

const args = Bun.argv.slice(2);
const environment = firstPositionalArg(args) ?? optionalEnv('NANGO_ENV') ?? 'dev';
const baseUrl = requiredEnv('NANGO_HOSTPORT', 'NANGO_BASE_URL').replace(/\/+$/, '');
const secretKey = requiredEnv(`NANGO_SECRET_KEY_${environment.toUpperCase()}`, 'NANGO_SECRET_KEY');

await bootstrapIntegrations({
  api: new NangoApi(baseUrl, secretKey),
  updateExisting: hasFlag('--update-existing', args),
  dryRun: hasFlag('--dry-run', args),
  selectedIntegrationIds: parseIntegrationSelection(flagValue('--only', args)),
  env: Bun.env,
  log: console.log,
});
