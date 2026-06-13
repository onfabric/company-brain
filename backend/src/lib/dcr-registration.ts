// RFC 7591 redirect URI rule for public MCP clients: https anywhere, plain
// http only on loopback hosts.
export function isAllowedRedirectUri(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.protocol === 'https:') {
    return true;
  }
  return url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
}
