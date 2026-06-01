import { BuiltInErrorCode, createCli, type OnError } from '@parshjs/core';
import { InitMissingConfigError } from './cli-errors.js';
import { commandTree } from './command-tree.gen.js';

const cliErrors = { InitMissingConfigError } as const;

export const onCliError: OnError<typeof cliErrors, Record<string, never>> = ({
  code,
  error,
  exit,
  print,
}) => {
  if (code === 'InitMissingConfigError') {
    return exit(1);
  }

  if (code === BuiltInErrorCode.Unknown) {
    print.error(error.message);
    return exit(1);
  }

  return undefined;
};

export function createAgentSyncCli() {
  return createCli({
    programName: 'company-brain-agent-sync',
    programDescription: 'Sync local agent conversations into Company Brain.',
    tree: commandTree,
    errors: cliErrors,
    onError: onCliError,
  });
}
