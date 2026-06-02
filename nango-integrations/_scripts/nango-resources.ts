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
    id: 'circleback-mcp',
    provider: 'circleback-mcp',
    displayName: 'Circleback',
    forwardWebhooks: false,
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
    integrationId: 'circleback-mcp',
    connectionIdEnv: 'CIRCLEBACK_MCP_CONNECTION_ID',
    defaultConnectionId: 'circleback-mcp',
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

export const BOOTSTRAPPED_CONNECTIONS: BootstrappedConnectionSpec[] =
  REQUIRED_CONNECTIONS.filter(isBootstrappedConnection);
export const NOT_FOUND_STATUS = 404;

function isBootstrappedConnection(
  connection: ConnectionSpec,
): connection is BootstrappedConnectionSpec {
  return Boolean(connection.bootstrap);
}
