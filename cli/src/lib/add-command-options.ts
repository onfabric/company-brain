import { z } from 'zod';

const nangoConnectionOptions = {
  'nango-secret-key': {
    schema: z.string().optional(),
    description: 'Nango dev API key.',
  },
  'nango-url': {
    schema: z.string().optional(),
    description: 'Nango dashboard/API base URL.',
  },
} as const;

export const addIntegrationsOptions = {
  ...nangoConnectionOptions,
  only: {
    schema: z.string().optional(),
    description: 'Comma-separated integration IDs or numbers, such as notion,slack.',
  },
  all: {
    schema: z.boolean().optional(),
    description: 'Select every managed Company Brain integration.',
  },
  force: {
    schema: z.boolean().optional(),
    description: 'Prompt for URL and credentials even when they already exist.',
  },
} as const;

export const addSyncsOptions = {
  ...nangoConnectionOptions,
  only: {
    schema: z.string().optional(),
    description: 'Comma-separated sync integration IDs or numbers, such as notion,slack.',
  },
  all: {
    schema: z.boolean().optional(),
    description: 'Select every managed Company Brain sync.',
  },
} as const;
