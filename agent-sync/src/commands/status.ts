import { defineCommand } from '@parshjs/core';
import { z } from 'zod';

import { writeOutput } from '../cli-output.js';
import { loadConfig, missingRequiredConfig } from '../config.js';
import { readIdentity } from '../identity.js';
import { readStatus } from '../status.js';

export const command = defineCommand('status', {
  description: 'Print local agent-sync configuration and daemon status.',
  options: {
    json: {
      schema: z.boolean().optional(),
      description: 'Print machine-readable JSON.',
    },
  },
  handler: async ({ options, print }) => {
    const config = await loadConfig();
    const identity = await readIdentity(config.dataDir);
    const status = await readStatus(config.dataDir);
    const value = {
      dataDir: config.dataDir,
      configPath: config.configPath,
      user_identifier: identity,
      missing_config: missingRequiredConfig(config),
      status,
    };
    writeOutput(print, value, options.json === true, JSON.stringify(value, null, 2));
  },
});
