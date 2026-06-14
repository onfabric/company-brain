import { existsSync } from 'node:fs';
import { nangoSubmodulePath } from './paths.ts';
import { commandSucceeds } from './shell.ts';
import { runVisible, type VisibleCommandContext } from './visible-command.ts';

export type AwsPrerequisites = {
  terraformCommand: string;
  accountId: string;
  arn: string;
};

export async function verifyAwsPrerequisites(
  context: VisibleCommandContext,
): Promise<AwsPrerequisites> {
  const missing = await missingCommands(['aws', 'bash', 'docker', 'jq', 'tar']);
  const terraformCommand = await resolveTerraformCommand();
  if (!terraformCommand) {
    missing.push('terraform or tofu');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required local tools: ${missing.join(', ')}`);
  }

  if (!existsSync(nangoSubmodulePath)) {
    throw new Error(
      'The nango submodule is missing. Run `git submodule update --init --recursive`.',
    );
  }

  await runVisible(['aws', '--version'], context, { capture: true });
  const identity = await runVisible(
    ['aws', 'sts', 'get-caller-identity', '--output', 'json'],
    context,
    { capture: true },
  );
  await runVisible(['docker', 'info'], context, { capture: true });
  await runVisible(['docker', 'buildx', 'version'], context, { capture: true });
  await runVisible([terraformCommand ?? 'terraform', 'version'], context, { capture: true });

  const parsed = JSON.parse(identity) as { Account?: string; Arn?: string };
  if (!parsed.Account || !parsed.Arn) {
    throw new Error('AWS CLI is logged in, but `aws sts get-caller-identity` returned no account.');
  }

  return {
    terraformCommand: terraformCommand ?? 'terraform',
    accountId: parsed.Account,
    arn: parsed.Arn,
  };
}

async function missingCommands(commands: string[]): Promise<string[]> {
  const missing: string[] = [];
  for (const command of commands) {
    if (!(await commandSucceeds(['which', command]))) {
      missing.push(command);
    }
  }

  return missing;
}

async function resolveTerraformCommand(): Promise<string | undefined> {
  if (await commandSucceeds(['which', 'terraform'])) {
    return 'terraform';
  }
  if (await commandSucceeds(['which', 'tofu'])) {
    return 'tofu';
  }

  return undefined;
}
