export type IntegrationSpec = {
  id: string;
  provider: string;
  displayName: string;
  forwardWebhooks: boolean;
  oauth?: {
    clientIdEnv: string;
    clientSecretEnv: string;
    scopesEnv?: string;
    scopes?: string;
  };
};

export type ConnectionSpec = {
  integrationId: string;
  connectionIdEnv: string;
  defaultConnectionId: string;
  bootstrap?: {
    type: 'NONE';
    webhookSecretEnv: string;
  };
};

export type BootstrappedConnectionSpec = ConnectionSpec & {
  bootstrap: NonNullable<ConnectionSpec['bootstrap']>;
};

export type ConnectionData = {
  connection_id: string;
  provider_config_key: string;
};

export type SyncSpec = {
  integrationId: string;
  syncName: string;
  label: string;
};

export type ConnectionsData = {
  connections: ConnectionData[];
};

export const SLACK_SCOPES = [
  'channels:read',
  'channels:history',
  'channels:join',
  'groups:read',
  'groups:history',
  'im:read',
  'im:history',
  'mpim:read',
  'mpim:history',
  'users:read',
  'users:read.email',
].join(',');

export const GITHUB_SCOPES = [
  'public_repo',
  'read:org',
  'read:user',
  'repo',
  'user:email',
  'user',
].join(',');

export const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'].join(',');

export const MANUAL_INTEGRATION_IDS = ['circleback-mcp'];

export const INTEGRATIONS: IntegrationSpec[] = [
  {
    id: 'notion',
    provider: 'notion',
    displayName: 'Notion',
    forwardWebhooks: false,
    oauth: {
      clientIdEnv: 'NOTION_CLIENT_ID',
      clientSecretEnv: 'NOTION_CLIENT_SECRET',
    },
  },
  {
    id: 'slack',
    provider: 'slack',
    displayName: 'Slack',
    forwardWebhooks: false,
    oauth: {
      clientIdEnv: 'SLACK_CLIENT_ID',
      clientSecretEnv: 'SLACK_CLIENT_SECRET',
      scopesEnv: 'SLACK_SCOPES',
      scopes: SLACK_SCOPES,
    },
  },
  {
    id: 'github',
    provider: 'github',
    displayName: 'GitHub',
    forwardWebhooks: false,
    oauth: {
      clientIdEnv: 'GH_OAUTH_CLIENT_ID',
      clientSecretEnv: 'GH_OAUTH_CLIENT_SECRET',
      scopesEnv: 'GH_OAUTH_SCOPES',
      scopes: GITHUB_SCOPES,
    },
  },
  {
    id: 'google-mail',
    provider: 'google-mail',
    displayName: 'Gmail',
    forwardWebhooks: false,
    oauth: {
      clientIdEnv: 'GMAIL_CLIENT_ID',
      clientSecretEnv: 'GMAIL_CLIENT_SECRET',
      scopesEnv: 'GMAIL_SCOPES',
      scopes: GMAIL_SCOPES,
    },
  },
  {
    id: 'agent-conversations',
    provider: 'unauthenticated',
    displayName: 'Agent Conversations',
    forwardWebhooks: false,
  },
];

export const REQUIRED_CONNECTIONS: ConnectionSpec[] = [
  {
    integrationId: 'notion',
    connectionIdEnv: 'NOTION_CONNECTION_ID',
    defaultConnectionId: 'notion',
  },
  {
    integrationId: 'slack',
    connectionIdEnv: 'SLACK_CONNECTION_ID',
    defaultConnectionId: 'slack',
  },
  {
    integrationId: 'github',
    connectionIdEnv: 'GH_CONNECTION_ID',
    defaultConnectionId: 'github',
  },
  {
    integrationId: 'google-mail',
    connectionIdEnv: 'GMAIL_CONNECTION_ID',
    defaultConnectionId: 'gmail',
  },
  {
    integrationId: 'circleback-mcp',
    connectionIdEnv: 'CIRCLEBACK_CONNECTION_ID',
    defaultConnectionId: 'circleback',
  },
  {
    integrationId: 'agent-conversations',
    connectionIdEnv: 'AGENT_CONVERSATIONS_CONNECTION_ID',
    defaultConnectionId: 'local-agent-sync',
    bootstrap: {
      type: 'NONE',
      webhookSecretEnv: 'AGENT_SYNC_WEBHOOK_SECRET',
    },
  },
];

export const SYNC_SPECS: SyncSpec[] = [
  {
    integrationId: 'notion',
    syncName: 'pages',
    label: 'Notion pages',
  },
  {
    integrationId: 'slack',
    syncName: 'threads',
    label: 'Slack threads',
  },
  {
    integrationId: 'github',
    syncName: 'pull-requests',
    label: 'GitHub pull requests',
  },
  {
    integrationId: 'google-mail',
    syncName: 'threads',
    label: 'Gmail threads',
  },
  {
    integrationId: 'circleback-mcp',
    syncName: 'meetings',
    label: 'Circleback meetings',
  },
  {
    integrationId: 'agent-conversations',
    syncName: 'conversations',
    label: 'Agent conversations',
  },
];

export const DEFAULT_SYNC_SPECS: SyncSpec[] = SYNC_SPECS.filter(
  (sync) => !MANUAL_INTEGRATION_IDS.includes(sync.integrationId),
);
export const DEFAULT_REQUIRED_CONNECTIONS: ConnectionSpec[] = REQUIRED_CONNECTIONS.filter(
  (connection) => !MANUAL_INTEGRATION_IDS.includes(connection.integrationId),
);
export const BOOTSTRAPPED_CONNECTIONS: BootstrappedConnectionSpec[] =
  REQUIRED_CONNECTIONS.filter(isBootstrappedConnection);
export const NOT_FOUND_STATUS = 404;

export function parseIntegrationSelection(value: string | undefined): string[] | undefined {
  if (!value) {
    return undefined;
  }

  const selected = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return selected.length > 0 ? selected : undefined;
}

export function resolveSelectedSyncs(selected: string[] | undefined): SyncSpec[] {
  if (!selected) {
    return DEFAULT_SYNC_SPECS;
  }

  const selectedSet = new Set(selected);
  const knownIds = new Set(SYNC_SPECS.map((sync) => sync.integrationId));
  const unknown = [...selectedSet].filter((id) => !knownIds.has(id));
  if (unknown.length > 0) {
    throw new Error(`Unknown integration selection: ${unknown.join(', ')}`);
  }

  return SYNC_SPECS.filter((sync) => selectedSet.has(sync.integrationId));
}

export function resolveSelectedIntegrations(selected: string[] | undefined): IntegrationSpec[] {
  if (!selected) {
    return INTEGRATIONS;
  }

  const selectedSet = new Set(selected);
  const knownIds = new Set(INTEGRATIONS.map((integration) => integration.id));
  const unknown = [...selectedSet].filter((id) => !knownIds.has(id));
  if (unknown.length > 0) {
    throw new Error(`Unknown integration selection: ${unknown.join(', ')}`);
  }

  return INTEGRATIONS.filter((integration) => selectedSet.has(integration.id));
}

export async function parseConnectionResponse(
  response: Response,
  integrationId: string,
  connectionId: string,
): Promise<ConnectionData> {
  const body = (await response.json()) as unknown;
  if (isConnectionData(body)) {
    return body;
  }

  if (isRecord(body) && isConnectionData(body.data)) {
    return body.data;
  }

  throw new Error(`Nango returned no connection data for ${integrationId}/${connectionId}`);
}

export async function parseConnectionsResponse(
  response: Response,
  integrationId: string,
): Promise<ConnectionsData> {
  const body = (await response.json()) as unknown;
  if (!isRecord(body) || !Array.isArray(body.connections)) {
    throw new Error(`Nango returned no connection list for ${integrationId}`);
  }

  return {
    connections: body.connections.filter(isConnectionData),
  };
}

function isBootstrappedConnection(
  connection: ConnectionSpec,
): connection is BootstrappedConnectionSpec {
  return Boolean(connection.bootstrap);
}

function isConnectionData(value: unknown): value is ConnectionData {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.connection_id === 'string' && typeof value.provider_config_key === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
