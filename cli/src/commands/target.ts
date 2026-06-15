import { defineCommand } from '@parshjs/core';
import { isNonInteractive } from '../lib/interaction.ts';
import { promptAndSaveTarget, readSelectedTarget } from '../lib/target.ts';

export const command = defineCommand('target', {
  description: 'Select the local or cloud target for later commands.',
  options: {},
  handler: async ({ rootOptions, print }) => {
    const previous = await readSelectedTarget();
    if (isNonInteractive(rootOptions['non-interactive'])) {
      if (!previous) {
        throw new Error(
          'No Company Brain target selected. Run `company-brain target local|cloud`.',
        );
      }

      print.info(`Selected target: ${previous}`);
      return;
    }

    const target = await promptAndSaveTarget();
    const prefix = previous === target ? 'Current target remains' : 'Selected target';
    print.success(`${prefix}: ${target}`);
  },
});
