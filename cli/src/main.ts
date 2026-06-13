#!/usr/bin/env bun

import { createCli } from '@parshjs/core';
import { commandTree } from './command-tree.gen.ts';

const cli = createCli({
  programName: 'company-brain',
  programDescription: 'Set up and operate a local Company Brain.',
  tree: commandTree,
});

declare module '@parshjs/core' {
  interface Register {
    cli: typeof cli;
  }
}

await cli.main();
