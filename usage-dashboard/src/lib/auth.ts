import { env } from '#lib/env.ts';

const BASIC_PREFIX = 'Basic ';
const PUBLIC_PATHS = new Set(['/health']);

export function basicAuthHandler({ request }: { request: Request }): Response | undefined {
  if (!env.usageDashboardUsername || !env.usageDashboardPassword) {
    return undefined;
  }

  const path = new URL(request.url).pathname;
  if (PUBLIC_PATHS.has(path)) {
    return undefined;
  }

  const credentials = parseBasicCredentials(request.headers.get('authorization'));
  if (
    credentials?.username === env.usageDashboardUsername &&
    credentials.password === env.usageDashboardPassword
  ) {
    return undefined;
  }

  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'www-authenticate': 'Basic realm="AI Usage"',
    },
  });
}

function parseBasicCredentials(
  authorization: string | null,
): { username: string; password: string } | undefined {
  if (!authorization?.startsWith(BASIC_PREFIX)) {
    return undefined;
  }

  const decoded = Buffer.from(authorization.slice(BASIC_PREFIX.length), 'base64').toString('utf8');
  const separator = decoded.indexOf(':');
  if (separator === -1) {
    return undefined;
  }

  return {
    username: decoded.slice(0, separator),
    password: decoded.slice(separator + 1),
  };
}
