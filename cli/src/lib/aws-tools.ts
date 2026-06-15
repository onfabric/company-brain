import { exportAwsCredentials } from './aws-credential-export.ts';
import {
  type AwsCredentials,
  awsCredentialResolutionEnv,
  awsSdkEnv,
  detectAwsProfile,
} from './aws-credentials.ts';
import { commandSucceeds } from './shell.ts';
import { runVisible, type VisibleCommandContext } from './visible-command.ts';

export type AwsPrerequisites = {
  terraformCommand: string;
  accountId: string;
  arn: string;
  awsProfile?: string;
  awsCredentials: AwsCredentials;
};

export async function verifyAwsPrerequisites(
  context: VisibleCommandContext,
): Promise<AwsPrerequisites> {
  const prerequisites = await verifyAwsDestroyPrerequisites(context);
  const missing = await missingCommands(['bash', 'jq', 'tar']);

  if (missing.length > 0) {
    throw new Error(`Missing required local tools: ${missing.join(', ')}`);
  }

  return prerequisites;
}

export async function verifyAwsDestroyPrerequisites(
  context: VisibleCommandContext,
): Promise<AwsPrerequisites> {
  const missing = await missingCommands(['aws']);
  const terraformCommand = await resolveTerraformCommand();
  if (!terraformCommand) {
    missing.push('terraform or tofu');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required local tools: ${missing.join(', ')}`);
  }
  if (!terraformCommand) {
    throw new Error('Missing required local tools: terraform or tofu');
  }

  await runVisible(['aws', '--version'], context, { capture: true });
  const awsProfile = detectAwsProfile();
  const resolutionEnv = awsCredentialResolutionEnv({ awsProfile });
  await runVisible(['aws', 'sts', 'get-caller-identity', '--output', 'json'], context, {
    capture: true,
    env: resolutionEnv,
  });
  const awsCredentials = await exportAwsCredentials({ awsProfile }, context);
  const identity = await runVisible(
    ['aws', 'sts', 'get-caller-identity', '--output', 'json'],
    context,
    { capture: true, env: awsSdkEnv({ awsCredentials }) },
  );
  await runVisible([terraformCommand, 'version'], context, { capture: true });

  const parsed = JSON.parse(identity) as { Account?: string; Arn?: string };
  if (!parsed.Account || !parsed.Arn) {
    throw new Error('AWS CLI is logged in, but `aws sts get-caller-identity` returned no account.');
  }

  return {
    terraformCommand,
    accountId: parsed.Account,
    arn: parsed.Arn,
    awsProfile,
    awsCredentials,
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
