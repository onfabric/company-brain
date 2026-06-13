import { resolveSelectedSyncs, SYNC_INTEGRATION_IDS, SYNC_SPECS } from './lib/catalog.js';
import { deploySyncs, stripWrapperArgs } from './lib/deploy-syncs.js';
import { firstPositionalArg, flagValue, hasFlag } from './lib/env.js';
import { parseSelection } from './lib/selection.js';

const args = Bun.argv.slice(2);

if (hasFlag('--list', args)) {
  for (const sync of SYNC_SPECS) {
    console.log(`${sync.integrationId}\t${sync.syncName}\t${sync.label}`);
  }
  process.exit(0);
}

const environment = firstPositionalArg(args) ?? 'dev';
const only = flagValue('--only', args);
const selected = resolveSelectedSyncs(
  only ? parseSelection(only, SYNC_INTEGRATION_IDS) : undefined,
);
const passthroughArgs = stripWrapperArgs(args, environment);

await deploySyncs(selected, environment, passthroughArgs);
