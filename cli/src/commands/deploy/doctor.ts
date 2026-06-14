import { intro, outro } from '@clack/prompts';
import { defineCommand } from '@parshjs/core';
import { z } from 'zod';
import { requireAwsConfig, writeAwsConfig } from '../../lib/aws-config.ts';
import { withAwsCredentials } from '../../lib/aws-credentials.ts';
import { dnsIssues, httpsIssues } from '../../lib/aws-dns.ts';
import { verifyHostedNangoApi } from '../../lib/aws-nango.ts';
import { runRemoteHealthCommand } from '../../lib/aws-ssm.ts';
import { verifyAwsPrerequisites } from '../../lib/aws-tools.ts';
import { type DoctorCheck, formatError, renderDoctorChecks } from '../../lib/doctor.ts';
import { isNonInteractive } from '../../lib/interaction.ts';

export const command = defineCommand('deploy doctor', {
  description: 'Check hosted deployment health.',
  options: {
    yes: {
      schema: z.boolean().optional(),
      description: 'Run visible mutating check commands without per-command approval.',
    },
  },
  handler: async ({ options, rootOptions, print }) => {
    intro('Company Brain deployment check');

    const context = {
      yes: Boolean(options.yes),
      nonInteractive: isNonInteractive(rootOptions['non-interactive']),
    };
    const prerequisites = await verifyAwsPrerequisites(context);
    const config = {
      ...(await requireAwsConfig()),
      awsProfile: prerequisites.awsProfile,
      terraformCommand: prerequisites.terraformCommand,
    };
    await writeAwsConfig(config);
    const runtimeConfig = withAwsCredentials(config, prerequisites);

    const checks: DoctorCheck[] = [
      { label: 'AWS login', ok: true, detail: `${prerequisites.accountId} (${prerequisites.arn})` },
      {
        label: 'Terraform outputs',
        ok: Boolean(config.outputs),
        detail: config.outputs
          ? config.outputs.instanceId
          : 'Run `bun run company-brain deploy setup`.',
      },
    ];

    if (runtimeConfig.outputs) {
      const dns = await dnsIssues(runtimeConfig);
      checks.push({ label: 'DNS records', ok: dns.length === 0, detail: dns.join('\n') });

      const https = await httpsIssues(runtimeConfig);
      checks.push({ label: 'HTTPS endpoints', ok: https.length === 0, detail: https.join('\n') });

      checks.push(await remoteComposeCheck(runtimeConfig, context));
    }

    checks.push(await nangoApiCheck(runtimeConfig));
    renderDoctorChecks(checks);

    const failed = checks.filter((check) => !check.ok);
    if (failed.length > 0) {
      print.warn(`${failed.length} deployment check(s) need attention.`);
    } else {
      print.success('Hosted deployment looks healthy.');
    }

    outro('Deployment doctor finished.');
  },
});

async function remoteComposeCheck(
  config: Awaited<ReturnType<typeof requireAwsConfig>>,
  context: { yes?: boolean; nonInteractive?: boolean },
): Promise<DoctorCheck> {
  try {
    const output = await runRemoteHealthCommand(config, context);
    const unhealthy = output
      .trim()
      .split('\n')
      .filter(Boolean)
      .filter((line) => !composeLineHealthy(line));

    return {
      label: 'Remote Docker services',
      ok: unhealthy.length === 0,
      detail: unhealthy.length > 0 ? unhealthy.join('\n') : output.trim(),
    };
  } catch (error) {
    return { label: 'Remote Docker services', ok: false, detail: formatError(error) };
  }
}

async function nangoApiCheck(
  config: Awaited<ReturnType<typeof requireAwsConfig>>,
): Promise<DoctorCheck> {
  if (!config.secrets.nangoSecretKey) {
    return {
      label: 'Hosted Nango API key',
      ok: false,
      detail:
        'Open the hosted Nango dashboard, copy the dev API key, then run `bun run company-brain deploy add integrations`.',
    };
  }

  try {
    await verifyHostedNangoApi(config);
    return { label: 'Hosted Nango API key', ok: true };
  } catch (error) {
    return { label: 'Hosted Nango API key', ok: false, detail: formatError(error) };
  }
}

function composeLineHealthy(line: string): boolean {
  const [, state = '', health = '', exitCode = ''] = line.split('|');
  if (health) {
    return health === 'healthy';
  }
  if (state === 'exited') {
    return exitCode === '0';
  }

  return state === 'running';
}
