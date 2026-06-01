import { defineCommand } from '@parshjs/core';
import { z } from 'zod';

import { configureAgentSync } from '../configure.js';

export const command = defineCommand('configure', {
  description: 'Write local agent-sync configuration.',
  options: {
    'missing-only': {
      schema: z.boolean().optional(),
      description: 'Only prompt for missing required config.',
    },
  },
  handler: async ({ options, print }) => {
    const result = await configureAgentSync({ missingOnly: options['missing-only'] === true });
    print.info(JSON.stringify(result, null, 2));
  },
});
