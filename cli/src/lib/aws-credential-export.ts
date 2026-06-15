import {
  type AwsCredentialConfig,
  type AwsCredentials,
  awsCredentialResolutionEnv,
  normalizeAwsProfile,
  parseAwsCredentialProcessOutput,
} from './aws-credentials.ts';
import { runVisible, type VisibleCommandContext } from './visible-command.ts';

export async function exportAwsCredentials(
  config: AwsCredentialConfig,
  context: VisibleCommandContext,
): Promise<AwsCredentials> {
  const awsProfile = normalizeAwsProfile(config.awsProfile);
  const cmd = ['aws', 'configure', 'export-credentials', '--format', 'process'];
  if (awsProfile) {
    cmd.push('--profile', awsProfile);
  }

  try {
    const output = await runVisible(cmd, context, {
      capture: true,
      env: awsCredentialResolutionEnv({ awsProfile }),
    });
    return parseAwsCredentialProcessOutput(output);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      [
        'AWS CLI could not export credentials for Terraform.',
        'Run `aws login` again, then rerun the Company Brain cloud command.',
        detail,
      ].join('\n'),
    );
  }
}
