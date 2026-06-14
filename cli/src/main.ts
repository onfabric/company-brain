#!/usr/bin/env bun

import { createCli } from '@parshjs/core';
import { commandTree } from './command-tree.gen.ts';

const cli = createCli({
  programName: 'company-brain',
  programDescription: 'Set up and operate Company Brain locally or in a hosted deployment.',
  tree: commandTree,
});

declare module '@parshjs/core' {
  interface Register {
    cli: typeof cli;
  }
}

await cli.main();
