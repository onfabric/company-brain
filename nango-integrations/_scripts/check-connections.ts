import { CONNECTION_INTEGRATION_IDS } from './lib/catalog.js';
import { checkConnections } from './lib/check-connections.js';
import { firstPositionalArg, flagValue, optionalEnv, requiredEnv } from './lib/env.js';
import { NangoApi } from './lib/nango-api.js';
import { parseSelection } from './lib/selection.js';

const args = Bun.argv.slice(2);
const environment = firstPositionalArg(args) ?? optionalEnv('NANGO_ENV') ?? 'dev';
const baseUrl = requiredEnv('NANGO_HOSTPORT', 'NANGO_BASE_URL').replace(/\/+$/, '');
const secretKey = requiredEnv(`NANGO_SECRET_KEY_${environment.toUpperCase()}`, 'NANGO_SECRET_KEY');
const only = flagValue('--only', args);

await checkConnections({
  api: new NangoApi(baseUrl, secretKey),
  env: Bun.env,
  selectedIntegrationIds: only ? parseSelection(only, CONNECTION_INTEGRATION_IDS) : undefined,
  summaryPath: optionalEnv('GITHUB_STEP_SUMMARY'),
  log: console.log,
});
