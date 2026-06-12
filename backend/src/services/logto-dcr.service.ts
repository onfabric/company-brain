import { env } from '#lib/env.ts';
import { logtoManagementApi } from '#lib/logto-management.ts';
import { MCP_SCOPE } from '#lib/mcp-oauth.ts';
import { Service } from '#services/service.ts';

// Bridges RFC 7591 Dynamic Client Registration (which Logto lacks) onto its
// Management API: each registration becomes a third-party application granted
// consent for the MCP scope.

type LogtoResource = { id: string; indicator: string };
type LogtoScope = { id: string; name: string };
type LogtoApplication = { id: string };

type UpstreamOpenidConfiguration = { issuer: string } & Record<string, unknown>;
type OpenidConfiguration = UpstreamOpenidConfiguration & { registration_endpoint: string };

export class LogtoDcrService extends Service {
  async registerClient(input: { clientName: string; redirectUris: string[] }): Promise<string> {
    this.logger.info(`registering MCP client "${input.clientName}"`);
    const application = await logtoManagementApi<LogtoApplication>('POST', 'applications', {
      name: input.clientName,
      type: 'Native',
      isThirdParty: true,
      oidcClientMetadata: {
        redirectUris: input.redirectUris,
        postLogoutRedirectUris: [],
      },
    });

    // Third-party apps may only request scopes granted to them; without this
    // the consent screen rejects the mcp scope.
    const scope = await this.mcpScope();
    await logtoManagementApi('POST', `applications/${application.id}/user-consent-scopes`, {
      resourceScopes: [scope.id],
      userScopes: ['profile'],
    });

    return application.id;
  }

  // Logto's discovery document, with the registration endpoint this service
  // provides added in.
  async openidConfiguration(): Promise<OpenidConfiguration> {
    const res = await fetch(new URL('oidc/.well-known/openid-configuration', env.logtoUpstreamUrl));
    if (!res.ok) {
      throw new Error(`upstream openid-configuration failed (${res.status})`);
    }
    const metadata = (await res.json()) as UpstreamOpenidConfiguration;
    return { ...metadata, registration_endpoint: `${metadata.issuer}/register` };
  }

  private async mcpScope(): Promise<LogtoScope> {
    const resources = await logtoManagementApi<LogtoResource[]>('GET', 'resources');
    const resource = resources.find((r) => r.indicator === env.mcpResource.href);
    if (!resource) {
      throw new Error(`MCP api resource not provisioned in Logto: ${env.mcpResource}`);
    }
    const scopes = await logtoManagementApi<LogtoScope[]>('GET', `resources/${resource.id}/scopes`);
    const scope = scopes.find((s) => s.name === MCP_SCOPE);
    if (!scope) {
      throw new Error(`MCP scope not provisioned in Logto: ${MCP_SCOPE}`);
    }
    return scope;
  }
}
