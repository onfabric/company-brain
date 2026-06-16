import { existsSync } from 'node:fs';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { readAwsConfig } from './aws-config.ts';
import { awsProvider } from './aws-provider.ts';
import type { nangoIntegrationSpecs } from './nango.ts';
import { cloudTargetPath } from './paths.ts';

export const CLOUD_TARGET_VERSION = 1;
export const CLOUD_PROVIDER_IDS = ['aws'] as const;
const CLOUD_TARGET_FILE_MODE = 0o600;

const CloudProviderIdSchema = z.enum(CLOUD_PROVIDER_IDS);
const CloudTargetSchema = z.object({
  version: z.literal(CLOUD_TARGET_VERSION).default(CLOUD_TARGET_VERSION),
  provider: CloudProviderIdSchema,
});

export type CloudProviderId = z.infer<typeof CloudProviderIdSchema>;
export type CloudTarget = z.infer<typeof CloudTargetSchema>;
export type CloudTargetSource = 'saved' | 'legacy-aws' | 'default';
export type IntegrationSpec = (typeof nangoIntegrationSpecs)[number];

export type CloudPrinter = {
  success: (message: string) => void;
  warn: (message: string) => void;
};

export type CloudCommandContext = {
  rootOptions: {
    verbose?: boolean;
    'non-interactive'?: boolean;
  };
  print: CloudPrinter;
};

export type CloudHostedNangoContext<T = unknown> = {
  providerId: CloudProviderId;
  env: Record<string, string>;
  state?: T;
};

export type CloudSyncSelectionConfig = {
  installedIntegrationIds: string[];
  selectedIntegrationIds: string[];
};

export type CloudNangoEnvOverrides = {
  nangoSecretKey?: string;
  nangoUrl?: string;
};

export type CloudAgentSyncTarget = {
  nangoUrl: string;
  nangoSecretKey: string;
  webhookSecret: string;
};

export type CloudProvider = {
  id: CloudProviderId;
  label: string;
  setup: (
    options: { force?: boolean; yes?: boolean },
    context: CloudCommandContext,
  ) => Promise<void>;
  resume: (options: { yes?: boolean }, context: CloudCommandContext) => Promise<void>;
  update: (
    options: { yes?: boolean; version?: string },
    context: CloudCommandContext,
  ) => Promise<void>;
  doctor: (options: { yes?: boolean }, context: CloudCommandContext) => Promise<void>;
  destroy: (context: CloudCommandContext) => Promise<void>;
  loadHostedNangoContext: (overrides: CloudNangoEnvOverrides) => Promise<CloudHostedNangoContext>;
  persistAddedIntegrations: (
    context: CloudHostedNangoContext,
    env: Record<string, string>,
    selected: IntegrationSpec[],
    integrationIds: string[],
  ) => Promise<void>;
  persistAddedSyncs: (context: CloudHostedNangoContext, integrationIds: string[]) => Promise<void>;
  defaultIntegrationIds: (context: CloudHostedNangoContext) => string[];
  syncSelectionConfig: (context: CloudHostedNangoContext) => CloudSyncSelectionConfig;
  resolveAgentSyncTarget: (
    nonInteractive: boolean,
    print: CloudPrinter,
  ) => Promise<CloudAgentSyncTarget>;
};

export const cloudProviders = [awsProvider] as const satisfies readonly CloudProvider[];

export async function readCloudTarget(): Promise<
  { provider: CloudProvider; source: CloudTargetSource } | undefined
> {
  const saved = await readSavedCloudTarget();
  if (saved) {
    return { provider: cloudProviderById(saved.provider), source: 'saved' };
  }

  if (await readAwsConfig()) {
    return { provider: awsProvider, source: 'legacy-aws' };
  }

  if (cloudProviders.length === 1) {
    return { provider: cloudProviders[0], source: 'default' };
  }

  return undefined;
}

export async function requireCloudProvider(): Promise<CloudProvider> {
  const target = await readCloudTarget();
  if (!target) {
    throw new Error('Missing cloud deployment target. Run `company-brain deployment target`.');
  }

  return target.provider;
}

export async function selectCloudProviderForSetup(): Promise<CloudProvider> {
  const target = await readCloudTarget();
  if (!target) {
    throw new Error('Missing cloud deployment target. Run `company-brain deployment target`.');
  }

  await writeCloudTarget(target.provider.id);
  return target.provider;
}

export async function writeCloudTarget(providerId: CloudProviderId): Promise<void> {
  const target = CloudTargetSchema.parse({ provider: providerId });
  await mkdir(dirname(cloudTargetPath), { recursive: true });
  await writeFile(cloudTargetPath, `${JSON.stringify(target, null, 2)}\n`, {
    mode: CLOUD_TARGET_FILE_MODE,
  });
  await chmod(cloudTargetPath, CLOUD_TARGET_FILE_MODE);
}

export function parseCloudProviderId(providerId: string): CloudProviderId {
  return CloudProviderIdSchema.parse(providerId);
}

export function formatCloudProvider(provider: CloudProvider): string {
  return `${provider.label} (${provider.id})`;
}

export function cloudProviderById(providerId: CloudProviderId): CloudProvider {
  const provider = cloudProviders.find((candidate) => candidate.id === providerId);
  if (!provider) {
    throw new Error(`Unsupported cloud provider: ${providerId}`);
  }

  return provider;
}

async function readSavedCloudTarget(): Promise<CloudTarget | undefined> {
  if (!existsSync(cloudTargetPath)) {
    return undefined;
  }

  return CloudTargetSchema.parse(JSON.parse(await readFile(cloudTargetPath, 'utf8')) as unknown);
}
