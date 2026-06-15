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

export type SyncSpec = {
  integrationId: string;
  syncName: string;
  label: string;
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
export const AGENT_CONVERSATIONS_INTEGRATION_ID = 'agent-conversations';
export const HIDDEN_MANAGED_INTEGRATION_IDS = [AGENT_CONVERSATIONS_INTEGRATION_ID];

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
  (sync) =>
    !MANUAL_INTEGRATION_IDS.includes(sync.integrationId) &&
    !HIDDEN_MANAGED_INTEGRATION_IDS.includes(sync.integrationId),
);
export const DEFAULT_REQUIRED_CONNECTIONS: ConnectionSpec[] = REQUIRED_CONNECTIONS.filter(
  (connection) =>
    !MANUAL_INTEGRATION_IDS.includes(connection.integrationId) &&
    !HIDDEN_MANAGED_INTEGRATION_IDS.includes(connection.integrationId),
);
export const DEFAULT_INTEGRATIONS: IntegrationSpec[] = INTEGRATIONS.filter(
  (integration) =>
    !MANUAL_INTEGRATION_IDS.includes(integration.id) &&
    !HIDDEN_MANAGED_INTEGRATION_IDS.includes(integration.id),
);
export const BOOTSTRAPPED_CONNECTIONS: BootstrappedConnectionSpec[] =
  REQUIRED_CONNECTIONS.filter(isBootstrappedConnection);

export const INTEGRATION_IDS = INTEGRATIONS.map((integration) => integration.id);
export const SYNC_INTEGRATION_IDS = SYNC_SPECS.map((sync) => sync.integrationId);
export const CONNECTION_INTEGRATION_IDS = REQUIRED_CONNECTIONS.map(
  (connection) => connection.integrationId,
);

export function resolveSelectedSyncs(selected: string[] | undefined): SyncSpec[] {
  if (!selected) {
    return DEFAULT_SYNC_SPECS;
  }

  const selectedSet = new Set(selected);
  const knownIds = new Set(SYNC_INTEGRATION_IDS);
  const unknown = [...selectedSet].filter((id) => !knownIds.has(id));
  if (unknown.length > 0) {
    throw new Error(`Unknown integration selection: ${unknown.join(', ')}`);
  }

  return SYNC_SPECS.filter((sync) => selectedSet.has(sync.integrationId));
}

export function resolveSelectedIntegrations(selected: string[] | undefined): IntegrationSpec[] {
  if (!selected) {
    return DEFAULT_INTEGRATIONS;
  }

  const selectedSet = new Set(selected);
  const knownIds = new Set(INTEGRATION_IDS);
  const unknown = [...selectedSet].filter((id) => !knownIds.has(id));
  if (unknown.length > 0) {
    throw new Error(`Unknown integration selection: ${unknown.join(', ')}`);
  }

  return INTEGRATIONS.filter((integration) => selectedSet.has(integration.id));
}

export function oauthConnectionHints(integrationIds: string[]): string[] {
  const selected = new Set(integrationIds);
  const oauthIds = new Set(
    INTEGRATIONS.filter((integration) => integration.oauth).map((integration) => integration.id),
  );

  return REQUIRED_CONNECTIONS.filter(
    (connection) =>
      selected.has(connection.integrationId) && oauthIds.has(connection.integrationId),
  ).map((connection) => `${connection.integrationId}/${connection.defaultConnectionId}`);
}

function isBootstrappedConnection(
  connection: ConnectionSpec,
): connection is BootstrappedConnectionSpec {
  return Boolean(connection.bootstrap);
}
