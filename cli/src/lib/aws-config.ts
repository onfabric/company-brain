import { existsSync } from 'node:fs';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { normalizeAwsEnvironment, validateAwsEnvironment } from './aws-environment.ts';
import { awsConfigPath } from './paths.ts';

export const AWS_CONFIG_VERSION = 1;
const AWS_CONFIG_FILE_MODE = 0o600;

const AwsOutputsSchema = z.object({
  publicIp: z.string(),
  publicIpv6: z.string().optional(),
  nangoEcrRepositoryUrl: z.string(),
  brainEcrRepositoryUrl: z.string(),
  pgBackupEcrRepositoryUrl: z.string(),
  artifactsBucket: z.string(),
  instanceId: z.string(),
  dataVolumeId: z.string(),
  deployGroupTag: z.string(),
});

const AwsDnsSchema = z.object({
  mode: z.enum(['manual', 'route53']).default('manual'),
  hostedZoneId: z.string().optional(),
  verifiedAt: z.string().optional(),
});

const AwsEnvironmentSchema = z
  .string()
  .transform(normalizeAwsEnvironment)
  .refine((value) => validateAwsEnvironment(value) === undefined, {
    message: 'Environment must use 18 or fewer lowercase letters, numbers, and hyphens.',
  });

const AwsSecretsSchema = z.object({
  googleClientSecret: z.string().optional(),
  dozzlePassword: z.string().optional(),
  nangoSecretKey: z.string().optional(),
  oauth: z.record(z.string(), z.string()).default({}),
});

const AwsConfigSchema = z.object({
  version: z.literal(AWS_CONFIG_VERSION).default(AWS_CONFIG_VERSION),
  terraformCommand: z.string().optional(),
  region: z.string(),
  environment: AwsEnvironmentSchema,
  baseDomain: z.string().optional(),
  instanceType: z.string(),
  rootVolumeSize: z.number(),
  dataVolumeSize: z.number(),
  ssmSecretPrefix: z.string(),
  nangoHostname: z.string(),
  nangoConnectHostname: z.string(),
  brainHostname: z.string(),
  dozzleHostname: z.string(),
  acmeEmail: z.string(),
  workspaceDomain: z.string(),
  googleClientId: z.string(),
  dozzleUsername: z.string(),
  dozzleEmail: z.string(),
  dozzleName: z.string(),
  agentSyncWebhookSecret: z.string(),
  selectedIntegrationIds: z.array(z.string()).default([]),
  scopes: z.record(z.string(), z.string()).default({}),
  dns: AwsDnsSchema.default({ mode: 'manual' }),
  outputs: AwsOutputsSchema.optional(),
  lastDeployId: z.string().optional(),
  appDeployedAt: z.string().optional(),
  nangoBootstrappedAt: z.string().optional(),
  syncsDeployedAt: z.string().optional(),
  secrets: AwsSecretsSchema.default({ oauth: {} }),
});

export type AwsOutputs = z.infer<typeof AwsOutputsSchema>;
export type AwsConfig = z.infer<typeof AwsConfigSchema>;

export type PublicDnsRecord = {
  type: 'A' | 'AAAA';
  name: string;
  value: string;
};

export async function readAwsConfig(): Promise<AwsConfig | undefined> {
  if (!existsSync(awsConfigPath)) {
    return undefined;
  }

  return AwsConfigSchema.parse(JSON.parse(await readFile(awsConfigPath, 'utf8')) as unknown);
}

export async function requireAwsConfig(): Promise<AwsConfig> {
  const config = await readAwsConfig();
  if (!config) {
    throw new Error(
      'Missing .company-brain.aws.json. Run `bun run company-brain aws setup` first.',
    );
  }

  return config;
}

export async function writeAwsConfig(config: AwsConfig): Promise<void> {
  await writeFile(awsConfigPath, `${JSON.stringify(AwsConfigSchema.parse(config), null, 2)}\n`, {
    mode: AWS_CONFIG_FILE_MODE,
  });
  await chmod(awsConfigPath, AWS_CONFIG_FILE_MODE);
}

export function awsHosts(config: AwsConfig): string[] {
  return [
    config.nangoHostname,
    config.nangoConnectHostname,
    config.brainHostname,
    config.dozzleHostname,
  ];
}

export function publicDnsRecords(config: AwsConfig): PublicDnsRecord[] {
  if (!config.outputs) {
    return [];
  }

  const aRecords = awsHosts(config).map((name) => ({
    type: 'A' as const,
    name,
    value: config.outputs?.publicIp ?? '',
  }));
  const aaaaRecords = config.outputs.publicIpv6
    ? awsHosts(config).map((name) => ({
        type: 'AAAA' as const,
        name,
        value: config.outputs?.publicIpv6 ?? '',
      }))
    : [];

  return [...aRecords, ...aaaaRecords].filter((record) => record.value.length > 0);
}

export function hostedNangoEnv(config: AwsConfig): Record<string, string> {
  return {
    NANGO_HOSTPORT: `https://${config.nangoHostname}`,
    NANGO_SECRET_KEY_DEV: requiredSecret(config.secrets.nangoSecretKey, 'Nango dev API key'),
    AGENT_SYNC_WEBHOOK_SECRET: config.agentSyncWebhookSecret,
    ...config.secrets.oauth,
    ...config.scopes,
  };
}

function requiredSecret(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`Missing ${label}. Run \`bun run company-brain aws resume\`.`);
  }

  return value;
}
