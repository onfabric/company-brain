import { defineCommand } from '@parshjs/core';
import { z } from 'zod';

import { writeOutput } from '../cli-output.js';
import { loadConfig } from '../config.js';
import { scanLocalSessions } from '../session-scanner.js';
import { writeStatus } from '../status.js';
import { AgentSyncStore } from '../store.js';
import { nowIso } from '../utils.js';

export const command = defineCommand('sync-now', {
  description: 'Scan local sessions and push new conversations once.',
  options: {
    all: {
      schema: z.boolean().optional(),
      description: 'Rescan all known conversations.',
    },
    json: {
      schema: z.boolean().optional(),
      description: 'Print machine-readable JSON.',
    },
  },
  handler: async ({ options, print }) => {
    const config = await loadConfig();
    const result = await scanLocalSessions(new AgentSyncStore(config.dataDir), config, {
      all: options.all === true,
    });
    const updatedAt = nowIso();
    await writeStatus(config.dataDir, {
      state: result.setup_needed ? 'setup-needed' : result.failed > 0 ? 'sync-failed' : 'ok',
      updated_at: updatedAt,
      last_sync_at: updatedAt,
      last_sync_result: result,
      missing_config: result.missing_config,
    });
    writeOutput(print, result, options.json === true, JSON.stringify(result, null, 2));
  },
});
