import type { AwsConfig } from './aws-config.ts';
import { awsCommandEnv } from './aws-credentials.ts';
import type { ImageUris } from './aws-images.ts';
import { buildSsmDeploymentEnv } from './deployment-contract.ts';
import { buildDozzleUsersYaml } from './dozzle.ts';
import { deployPath } from './paths.ts';
import { runVisible, type VisibleCommandContext } from './visible-command.ts';

export async function putDozzleUsers(
  config: AwsConfig,
  context: VisibleCommandContext,
): Promise<void> {
  const password = config.secrets.dozzlePassword;
  if (!password) {
    throw new Error('Missing Dozzle password in .company-brain.aws.json.');
  }

  const users = await buildDozzleUsersYaml({
    username: config.dozzleUsername,
    password,
    email: config.dozzleEmail,
    name: config.dozzleName,
  });
  const env = awsCommandEnv(config);

  await runVisible(
    [
      'aws',
      'ssm',
      'put-parameter',
      '--name',
      `${config.ssmSecretPrefix}/dozzle_users`,
      '--type',
      'SecureString',
      '--value',
      users,
      '--overwrite',
    ],
    context,
    {
      approve: true,
      env,
      redactions: [users],
      purpose: 'Store Dozzle users.yml in SSM.',
    },
  );
}

export async function deployOverSsm({
  config,
  images,
  bundleUrl,
  context,
}: {
  config: AwsConfig;
  images: ImageUris;
  bundleUrl: string;
  context: VisibleCommandContext;
}): Promise<void> {
  const outputs = requiredOutputs(config);

  await runVisible(['bash', 'ssm_deploy.sh'], context, {
    cwd: deployPath,
    approve: true,
    purpose: 'Deploy the current bundle and images on the EC2 host via SSM.',
    env: {
      ...awsCommandEnv(config),
      ...buildSsmDeploymentEnv({
        bundleUrl,
        deployGroup: outputs.deployGroupTag,
        dataVolumeId: outputs.dataVolumeId,
        artifactsBucket: outputs.artifactsBucket,
        imageUris: images,
        ssmSecretPrefix: config.ssmSecretPrefix,
        nangoHostname: config.nangoHostname,
        nangoConnectHostname: config.nangoConnectHostname,
        brainHostname: config.brainHostname,
        dozzleHostname: config.dozzleHostname,
        acmeEmail: config.acmeEmail,
        awsRegion: config.region,
      }),
      GITHUB_SHA: config.lastDeployId,
    },
  });
}

export async function runRemoteHealthCommand(
  config: AwsConfig,
  context: VisibleCommandContext,
): Promise<string> {
  const outputs = requiredOutputs(config);
  const env = awsCommandEnv(config);
  const script = [
    'cd /opt/company-brain',
    'docker compose -f docker-compose.yml -f docker-compose.prod.yml ps -a --format "{{.Name}}|{{.State}}|{{.Health}}|{{.ExitCode}}|{{.Status}}"',
  ].join(' && ');
  const parameters = JSON.stringify({ commands: [script] });
  const commandId = await runVisible(
    [
      'aws',
      'ssm',
      'send-command',
      '--document-name',
      'AWS-RunShellScript',
      '--instance-ids',
      outputs.instanceId,
      '--parameters',
      parameters,
      '--query',
      'Command.CommandId',
      '--output',
      'text',
    ],
    context,
    {
      capture: true,
      approve: true,
      env,
      purpose: 'Ask the EC2 host for Docker service status.',
    },
  );

  await runVisible(
    [
      'aws',
      'ssm',
      'wait',
      'command-executed',
      '--command-id',
      commandId.trim(),
      '--instance-id',
      outputs.instanceId,
    ],
    context,
    { env },
  );

  return await runVisible(
    [
      'aws',
      'ssm',
      'get-command-invocation',
      '--command-id',
      commandId.trim(),
      '--instance-id',
      outputs.instanceId,
      '--query',
      'StandardOutputContent',
      '--output',
      'text',
    ],
    context,
    { capture: true, env },
  );
}

function requiredOutputs(config: AwsConfig): NonNullable<AwsConfig['outputs']> {
  if (!config.outputs) {
    throw new Error('Missing Terraform outputs. Run `company-brain setup --target cloud` first.');
  }

  return config.outputs;
}
