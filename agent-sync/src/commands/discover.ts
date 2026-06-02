import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import { writeOutput } from '../cli-output.js';
import { loadConfig, missingRequiredConfig } from '../config.js';
import { discoverConversations, formatDiscovery } from '../discovery.js';
import { writeStatus } from '../status.js';
import { nowIso } from '../utils.js';

export const command = defineCommand('discover', {
  description: 'Summarize local agent conversation directories.',
  options: {
    json: {
      schema: z.boolean().optional(),
      description: 'Print machine-readable JSON.',
    },
  },
  handler: async ({ options, print }) => {
    const config = await loadConfig();
    const result = await discoverConversations(config);
    const missingConfig = missingRequiredConfig(config);
    const updatedAt = nowIso();
    await writeStatus(config.dataDir, {
      state: missingConfig.length > 0 ? 'setup-needed' : 'ok',
      updated_at: updatedAt,
      last_discovery_at: updatedAt,
      missing_config: missingConfig,
    });
    writeOutput(print, result, options.json === true, formatDiscovery(result));
  },
});
