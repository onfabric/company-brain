// Row types for the `brain` schema tables — one exported type per table.
// Add a type here whenever a migration adds a table; see AGENTS.md.

export type DataSources = {
  id: string;
  nango_integration_id: string;
  created_at: Date;
  updated_at: Date;
};

export type Records = {
  id: string;
  created_at: Date;
  updated_at: Date;
  data_source_id: DataSources['id'];
  nango_connection_id: number;
  nango_model: string;
  nango_id: string;
  body: string;
};

export type People = {
  id: string;
  name: string | null;
  email: string | null;
  is_external: boolean;
  created_at: Date;
  updated_at: Date;
};

export type PeopleDataSources = {
  id: string;
  person_id: People['id'];
  data_source_id: DataSources['id'];
  data_source_user_id: string;
  created_at: Date;
  updated_at: Date;
};

export type RecordsPeople = {
  record_id: Records['id'];
  person_id: People['id'];
  created_at: Date;
  updated_at: Date;
};

export type KnowledgeTypes = {
  id: string;
  name: string;
};

export type Knowledge = {
  id: string;
  created_at: Date;
  updated_at: Date;
  knowledge_type_id: KnowledgeTypes['id'];
  title: string;
  body: string;
};

export type KnowledgePeople = {
  knowledge_id: Knowledge['id'];
  person_id: People['id'];
  created_at: Date;
  updated_at: Date;
};

export type KnowledgeRecords = {
  knowledge_id: Knowledge['id'];
  record_id: Records['id'];
  created_at: Date;
  updated_at: Date;
};

// better-auth owns the tables below (migration 0011); the columns are
// camelCase to match better-auth's default schema, which the brain does not
// query directly via Bun.sql.

export type BaUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BaSession = {
  id: string;
  expiresAt: Date;
  token: string;
  createdAt: Date;
  updatedAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  userId: BaUser['id'];
};

export type BaAccount = {
  id: string;
  accountId: string;
  providerId: string;
  userId: BaUser['id'];
  accessToken: string | null;
  refreshToken: string | null;
  idToken: string | null;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  scope: string | null;
  password: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BaVerification = {
  id: string;
  identifier: string;
  value: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type BaJwks = {
  id: string;
  publicKey: string;
  privateKey: string;
  createdAt: Date;
  expiresAt: Date | null;
};

export type BaOauthApplication = {
  id: string;
  name: string;
  icon: string | null;
  metadata: string | null;
  clientId: string;
  clientSecret: string | null;
  redirectUrls: string;
  type: string;
  disabled: boolean | null;
  userId: BaUser['id'] | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BaOauthAccessToken = {
  id: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  clientId: BaOauthApplication['clientId'];
  userId: BaUser['id'] | null;
  scopes: string;
  createdAt: Date;
  updatedAt: Date;
};

export type BaOauthConsent = {
  id: string;
  clientId: BaOauthApplication['clientId'];
  userId: BaUser['id'];
  scopes: string;
  consentGiven: boolean;
  createdAt: Date;
  updatedAt: Date;
};
