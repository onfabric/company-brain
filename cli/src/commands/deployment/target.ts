import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import {
  CLOUD_PROVIDER_IDS,
  formatCloudProvider,
  readCloudTarget,
  writeCloudTarget,
} from '../../lib/cloud-provider.ts';

export const command = defineCommand('deployment target', {
  description: 'View or set the cloud deployment provider.',
  options: {
    provider: {
      schema: z.enum(CLOUD_PROVIDER_IDS).optional(),
      description: 'Cloud provider to use for setup, update, resume, doctor, and destroy.',
    },
  },
  handler: async ({ options, print }) => {
    if (options.provider) {
      await writeCloudTarget(options.provider);
      print.success(`Cloud deployment target set to ${options.provider}.`);
      return;
    }

    const target = await readCloudTarget();
    if (!target) {
      print.warn('No cloud deployment target is configured.');
      return;
    }

    const source = target.source === 'saved' ? '' : ` (${formatTargetSource(target.source)})`;
    print.success(`Cloud deployment target: ${formatCloudProvider(target.provider)}${source}.`);
  },
});

function formatTargetSource(source: 'legacy-aws' | 'default' | 'saved'): string {
  if (source === 'legacy-aws') {
    return 'inferred from existing AWS config';
  }

  if (source === 'default') {
    return 'default';
  }

  return 'saved';
}
