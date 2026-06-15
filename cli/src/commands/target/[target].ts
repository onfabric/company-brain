import { defineCommand } from '@parshjs/core';
import { TargetSchema } from '../../lib/deployment-target.ts';
import { writeSelectedTarget } from '../../lib/target.ts';

export const command = defineCommand('target [target]', {
  description: 'Save local or cloud as the target for later commands.',
  params: {
    target: {
      schema: TargetSchema,
      description: 'local or cloud',
    },
  },
  options: {},
  handler: async ({ params, print }) => {
    await writeSelectedTarget(params.target);
    print.success(`Selected target: ${params.target}`);
  },
});
