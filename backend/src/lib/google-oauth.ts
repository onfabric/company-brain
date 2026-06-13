// Google's fixed OAuth 2.0 / OIDC endpoints. The brain proxies its own
// /token and /oidc/register in front of these while letting clients hit
// Google's authorize endpoint directly for login + consent.
export const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const GOOGLE_TOKENINFO_ENDPOINT = 'https://oauth2.googleapis.com/tokeninfo';
export const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';
export const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';

export const GOOGLE_SCOPES_SUPPORTED = ['openid', 'email', 'profile'] as const;
