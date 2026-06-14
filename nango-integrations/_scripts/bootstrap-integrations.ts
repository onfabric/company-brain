import { bootstrapIntegrations } from './lib/bootstrap-integrations.js';
import { INTEGRATION_IDS } from './lib/catalog.js';
import { firstPositionalArg, flagValue, hasFlag, optionalEnv, requiredEnv } from './lib/env.js';
import { NangoApi } from './lib/nango-api.js';
import { parseSelection } from './lib/selection.js';

const args = Bun.argv.slice(2);
const environment = firstPositionalArg(args) ?? optionalEnv('NANGO_ENV') ?? 'dev';
const baseUrl = requiredEnv('NANGO_HOSTPORT', 'NANGO_BASE_URL').replace(/\/+$/, '');
const secretKey = requiredEnv(`NANGO_SECRET_KEY_${environment.toUpperCase()}`, 'NANGO_SECRET_KEY');
const only = flagValue('--only', args);

await bootstrapIntegrations({
  api: new NangoApi(baseUrl, secretKey),
  updateExisting: hasFlag('--update-existing', args),
  dryRun: hasFlag('--dry-run', args),
  selectedIntegrationIds: only ? parseSelection(only, INTEGRATION_IDS) : undefined,
  env: Bun.env,
  log: console.log,
});
