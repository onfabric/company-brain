import { SQL } from 'bun';
import { MANAGEMENT_API_RESOURCE, requiredEnv } from './env.ts';

// Logto's Management API is only reachable with M2M credentials, and the only
// supported way to create those is the admin console — a manual step that
// would break clone-and-deploy reproducibility. This seeds the M2M app with
// credentials from the environment directly into Logto's database instead
// (idempotent; runs after Logto has seeded its schema).

const TENANT = 'default';
const ROLE_ID = 'brain_m2m_role';
const ROLE_SCOPE_ID = 'brain_m2m_role_scope';
const APP_ROLE_ID = 'brain_m2m_app_role';

export async function ensureM2mApplication(): Promise<void> {
  const sql = new SQL(requiredEnv('LOGTO_DB_URL'));
  const clientId = requiredEnv('LOGTO_M2M_CLIENT_ID');
  const clientSecret = requiredEnv('LOGTO_M2M_CLIENT_SECRET');

  try {
    await sql`
      INSERT INTO applications (tenant_id, id, name, secret, description, type, oidc_client_metadata, custom_client_metadata, is_third_party)
      SELECT ${TENANT}, ${clientId}, 'Brain setup (M2M)', ${clientSecret}, 'Seeded by logto-setup', 'MachineToMachine', '{"redirectUris":[],"postLogoutRedirectUris":[]}', '{}', false
      WHERE NOT EXISTS (
        SELECT 1 FROM applications WHERE tenant_id = ${TENANT} AND id = ${clientId}
      )`;

    await sql`
      INSERT INTO application_secrets (tenant_id, application_id, name, value)
      SELECT ${TENANT}, ${clientId}, 'seeded', ${clientSecret}
      WHERE NOT EXISTS (
        SELECT 1 FROM application_secrets WHERE tenant_id = ${TENANT} AND application_id = ${clientId}
      )`;

    await sql`
      INSERT INTO roles (tenant_id, id, name, description, type)
      SELECT ${TENANT}, ${ROLE_ID}, 'brain-setup-management', 'Management API access for the setup containers', 'MachineToMachine'
      WHERE NOT EXISTS (
        SELECT 1 FROM roles WHERE tenant_id = ${TENANT} AND id = ${ROLE_ID}
      )`;

    await sql`
      INSERT INTO roles_scopes (tenant_id, id, role_id, scope_id)
      SELECT ${TENANT}, ${ROLE_SCOPE_ID}, ${ROLE_ID}, s.id
      FROM scopes s
      JOIN resources r ON s.resource_id = r.id AND r.tenant_id = s.tenant_id
      WHERE r.tenant_id = ${TENANT}
        AND r.indicator = ${MANAGEMENT_API_RESOURCE}
        AND s.name = 'all'
        AND NOT EXISTS (
          SELECT 1 FROM roles_scopes WHERE tenant_id = ${TENANT} AND id = ${ROLE_SCOPE_ID}
        )`;

    await sql`
      INSERT INTO applications_roles (tenant_id, id, application_id, role_id)
      SELECT ${TENANT}, ${APP_ROLE_ID}, ${clientId}, ${ROLE_ID}
      WHERE NOT EXISTS (
        SELECT 1 FROM applications_roles WHERE tenant_id = ${TENANT} AND id = ${APP_ROLE_ID}
      )`;
  } finally {
    await sql.end();
  }
}
