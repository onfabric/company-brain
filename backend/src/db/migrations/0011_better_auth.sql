CREATE TABLE brain."user" (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  image text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE brain.session (
  id text PRIMARY KEY,
  "expiresAt" timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES brain."user" (id) ON DELETE CASCADE
);

CREATE INDEX session_user_id_idx ON brain.session ("userId");

CREATE TABLE brain.account (
  id text PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES brain."user" (id) ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX account_user_id_idx ON brain.account ("userId");

CREATE TABLE brain.verification (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX verification_identifier_idx ON brain.verification (identifier);

CREATE TABLE brain.jwks (
  id text PRIMARY KEY,
  "publicKey" text NOT NULL,
  "privateKey" text NOT NULL,
  "createdAt" timestamptz NOT NULL,
  "expiresAt" timestamptz
);

CREATE TABLE brain."oauthApplication" (
  id text PRIMARY KEY,
  name text NOT NULL,
  icon text,
  metadata text,
  "clientId" text NOT NULL UNIQUE,
  "clientSecret" text,
  "redirectUrls" text NOT NULL,
  type text NOT NULL,
  disabled boolean DEFAULT false,
  "userId" text REFERENCES brain."user" (id) ON DELETE CASCADE,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE INDEX oauth_application_user_id_idx ON brain."oauthApplication" ("userId");

CREATE TABLE brain."oauthAccessToken" (
  id text PRIMARY KEY,
  "accessToken" text NOT NULL UNIQUE,
  "refreshToken" text NOT NULL UNIQUE,
  "accessTokenExpiresAt" timestamptz NOT NULL,
  "refreshTokenExpiresAt" timestamptz NOT NULL,
  "clientId" text NOT NULL REFERENCES brain."oauthApplication" ("clientId") ON DELETE CASCADE,
  "userId" text REFERENCES brain."user" (id) ON DELETE CASCADE,
  scopes text NOT NULL,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE INDEX oauth_access_token_client_id_idx ON brain."oauthAccessToken" ("clientId");
CREATE INDEX oauth_access_token_user_id_idx ON brain."oauthAccessToken" ("userId");

CREATE TABLE brain."oauthConsent" (
  id text PRIMARY KEY,
  "clientId" text NOT NULL REFERENCES brain."oauthApplication" ("clientId") ON DELETE CASCADE,
  "userId" text NOT NULL REFERENCES brain."user" (id) ON DELETE CASCADE,
  scopes text NOT NULL,
  "consentGiven" boolean NOT NULL,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE INDEX oauth_consent_client_id_idx ON brain."oauthConsent" ("clientId");
CREATE INDEX oauth_consent_user_id_idx ON brain."oauthConsent" ("userId");
