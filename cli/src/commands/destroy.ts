import { defineCommand } from '@parshjs/core';
import { requireCloudProvider } from '../lib/cloud-provider.ts';

export const command = defineCommand('destroy', {
  description: 'Destroy hosted Company Brain resources.',
  options: {},
  handler: async ({ rootOptions, print }) =>
    await (await requireCloudProvider()).destroy({ rootOptions, print }),
});
