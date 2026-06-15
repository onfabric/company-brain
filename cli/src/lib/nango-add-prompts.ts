import { isCancel, multiselect, password, text } from '@clack/prompts';
import { oauthConnectionHints } from '../../../nango-integrations/_scripts/lib/catalog.ts';
import { parseSelection } from '../../../nango-integrations/_scripts/lib/selection.ts';
import {
  bootstrappedConnectionIntegrationIds,
  nangoDefaultIntegrationSpecs,
  nangoIntegrationSpecs,
} from './nango.ts';

export type IntegrationSpec = (typeof nangoIntegrationSpecs)[number];

export async function collectNangoEnv(
  existing: Record<string, string>,
  nangoHostport: string,
  selected: IntegrationSpec[],
  force: boolean,
  nonInteractive: boolean,
): Promise<Record<string, string>> {
  const values: Record<string, string> = {
    ...existing,
    NANGO_HOSTPORT: nangoHostport,
    NANGO_SECRET_KEY_DEV: await promptValue(
      'Hosted Nango dev API key',
      existing.NANGO_SECRET_KEY_DEV,
      force,
      true,
      nonInteractive,
    ),
  };

  for (const integration of selected) {
    if (!integration.oauth) {
      continue;
    }

    values[integration.oauth.clientIdEnv] = await promptValue(
      `${integration.displayName} client ID`,
      existing[integration.oauth.clientIdEnv],
      force,
      false,
      nonInteractive,
    );
    values[integration.oauth.clientSecretEnv] = await promptValue(
      `${integration.displayName} client secret`,
      existing[integration.oauth.clientSecretEnv],
      force,
      true,
      nonInteractive,
    );

    if (integration.oauth.scopesEnv && integration.oauth.scopes) {
      values[integration.oauth.scopesEnv] =
        existing[integration.oauth.scopesEnv] || integration.oauth.scopes;
    }
  }

  return values;
}

export async function resolveIntegrationSelection(
  only: string | undefined,
  all: boolean,
  nonInteractive: boolean,
  defaultIds: string[],
): Promise<IntegrationSpec[]> {
  if (all) {
    return nangoDefaultIntegrationSpecs;
  }

  if (only) {
    const ids = parseSelection(
      only,
      nangoIntegrationSpecs.map((integration) => integration.id),
    );
    return nangoIntegrationSpecs.filter((integration) => ids.includes(integration.id));
  }

  if (defaultIds.length > 0) {
    const selected = new Set(defaultIds);
    return nangoIntegrationSpecs.filter((integration) => selected.has(integration.id));
  }

  if (nonInteractive) {
    throw new Error('Pass --only notion,slack or --all when running without a TTY.');
  }

  const promptIntegrations = nangoDefaultIntegrationSpecs;
  const answer = await multiselect({
    message: 'Which integrations should Company Brain add?',
    options: promptIntegrations.map((integration) => ({
      value: integration.id,
      label: integration.displayName,
      hint: integration.provider,
    })),
    required: true,
  });

  if (isCancel(answer)) {
    throw new Error('Integration setup cancelled.');
  }

  return promptIntegrations.filter((integration) => answer.includes(integration.id));
}

export function selectedConnectionHints(integrationIds: string[]): string[] {
  const hints = oauthConnectionHints(integrationIds);
  const bootstrappedIds = bootstrappedConnectionIntegrationIds(integrationIds);
  if (bootstrappedIds.length > 0) {
    hints.push(...bootstrappedIds.map((integrationId) => `${integrationId} is created by the CLI`));
  }

  return hints.length > 0 ? hints : ['No OAuth connections are needed for this selection.'];
}

async function promptValue(
  label: string,
  existing: string | undefined,
  force: boolean,
  secret: boolean,
  nonInteractive: boolean,
): Promise<string> {
  if (existing && !force) {
    return existing;
  }

  if (nonInteractive) {
    throw new Error(`Missing required Nango setting: ${label}`);
  }

  const answer = secret
    ? await password({
        message: formatPromptLabel(label, existing),
        validate: (value) => validateCredential(value, existing),
      })
    : await text({
        message: label,
        defaultValue: existing,
        validate: (value) => validateCredential(value, existing),
      });

  if (isCancel(answer)) {
    throw new Error('Setup cancelled.');
  }

  const value = answer || existing;

  if (!value) {
    throw new Error(`Missing required Nango setting: ${label}`);
  }

  return value;
}

function formatPromptLabel(label: string, existing: string | undefined): string {
  return existing ? `${label} (press Enter to keep existing value)` : label;
}

function validateCredential(
  value: string | undefined,
  existing: string | undefined,
): string | undefined {
  if (!existing && (!value || value.trim().length === 0)) {
    return 'Required';
  }

  return undefined;
}
