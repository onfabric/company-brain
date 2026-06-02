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
