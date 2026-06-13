-- Generated with `bunx @better-auth/cli generate` and adapted to the `auth`
-- schema: better-auth owns and manages these tables, so they live in their own
-- schema rather than alongside the app-owned `brain.*` tables.
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE auth."user" (
  "id" text NOT NULL PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL,
  "image" text,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE auth."session" (
  "id" text NOT NULL PRIMARY KEY,
  "expiresAt" timestamptz NOT NULL,
  "token" text NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES auth."user" ("id") ON DELETE CASCADE
);

CREATE TABLE auth."account" (
  "id" text NOT NULL PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES auth."user" ("id") ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "password" text,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz NOT NULL
);

CREATE TABLE auth."verification" (
  "id" text NOT NULL PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE auth."jwks" (
  "id" text NOT NULL PRIMARY KEY,
  "publicKey" text NOT NULL,
  "privateKey" text NOT NULL,
  "createdAt" timestamptz NOT NULL,
  "expiresAt" timestamptz
);

CREATE TABLE auth."oauthApplication" (
  "id" text NOT NULL PRIMARY KEY,
  "name" text NOT NULL,
  "icon" text,
  "metadata" text,
  "clientId" text NOT NULL UNIQUE,
  "clientSecret" text,
  "redirectUrls" text NOT NULL,
  "type" text NOT NULL,
  "disabled" boolean,
  "userId" text REFERENCES auth."user" ("id") ON DELETE CASCADE,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE TABLE auth."oauthAccessToken" (
  "id" text NOT NULL PRIMARY KEY,
  "accessToken" text NOT NULL UNIQUE,
  "refreshToken" text NOT NULL UNIQUE,
  "accessTokenExpiresAt" timestamptz NOT NULL,
  "refreshTokenExpiresAt" timestamptz NOT NULL,
  "clientId" text NOT NULL REFERENCES auth."oauthApplication" ("clientId") ON DELETE CASCADE,
  "userId" text REFERENCES auth."user" ("id") ON DELETE CASCADE,
  "scopes" text NOT NULL,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE TABLE auth."oauthConsent" (
  "id" text NOT NULL PRIMARY KEY,
  "clientId" text NOT NULL REFERENCES auth."oauthApplication" ("clientId") ON DELETE CASCADE,
  "userId" text NOT NULL REFERENCES auth."user" ("id") ON DELETE CASCADE,
  "scopes" text NOT NULL,
  "consentGiven" boolean NOT NULL,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE INDEX "session_userId_idx" ON auth."session" ("userId");
CREATE INDEX "account_userId_idx" ON auth."account" ("userId");
CREATE INDEX "verification_identifier_idx" ON auth."verification" ("identifier");
CREATE INDEX "oauthApplication_userId_idx" ON auth."oauthApplication" ("userId");
CREATE INDEX "oauthAccessToken_clientId_idx" ON auth."oauthAccessToken" ("clientId");
CREATE INDEX "oauthAccessToken_userId_idx" ON auth."oauthAccessToken" ("userId");
CREATE INDEX "oauthConsent_clientId_idx" ON auth."oauthConsent" ("clientId");
CREATE INDEX "oauthConsent_userId_idx" ON auth."oauthConsent" ("userId");
