// Google's fixed OAuth 2.0 endpoints. mcp-use's OAuth proxy advertises the
// authorization endpoint to clients and exchanges codes against the token
// endpoint; the brain validates the resulting opaque access tokens via the
// tokeninfo endpoint.
export const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const GOOGLE_TOKENINFO_ENDPOINT = 'https://oauth2.googleapis.com/tokeninfo';

export const GOOGLE_SCOPES_SUPPORTED = ['openid', 'email', 'profile'] as const;
