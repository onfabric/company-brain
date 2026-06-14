import { defineRootCommand } from '@parshjs/core';
import { z } from 'zod';

export const command = defineRootCommand({
  options: {
    verbose: {
      schema: z.boolean().optional(),
      forwardToChildren: true,
      description: 'Print command details while running setup steps.',
    },
    'non-interactive': {
      schema: z.boolean().optional(),
      forwardToChildren: true,
      description: 'Fail instead of prompting for missing required values.',
    },
  },
});
