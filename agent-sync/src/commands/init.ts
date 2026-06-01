import { defineCommand } from '@parshjs/core';
import { z } from 'zod';

import { InitMissingConfigError } from '../cli-errors.js';
import { formatInitResult, writeOutput } from '../cli-output.js';
import { initializeAgentSync } from '../init.js';

export const command = defineCommand('init', {
  description: 'Configure agent-sync and install the macOS LaunchAgent.',
  options: {
    'missing-only': {
      schema: z.boolean().optional(),
      description: 'Only prompt for missing required config.',
    },
    'skip-daemon': {
      schema: z.boolean().optional(),
      description: 'Configure without installing the LaunchAgent.',
    },
    json: {
      schema: z.boolean().optional(),
      description: 'Print machine-readable JSON.',
    },
  },
  handler: async ({ options, print }) => {
    const result = await initializeAgentSync({
      missingOnly: options['missing-only'] === true,
      skipDaemon: options['skip-daemon'] === true,
    });
    writeOutput(print, result, options.json === true, formatInitResult(result));
    if (result.missing.length > 0) {
      throw new InitMissingConfigError();
    }
  },
});
