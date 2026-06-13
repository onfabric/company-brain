function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const PAGE_STYLE = `
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; display: grid; place-items: center;
    min-height: 100dvh; margin: 0; background: Canvas; color: CanvasText; }
  main { width: min(22rem, 90vw); padding: 2rem;
    border: 1px solid color-mix(in srgb, CanvasText 15%, transparent);
    border-radius: 12px; text-align: center; }
  h1 { font-size: 1.25rem; margin: 0 0 1.5rem; }
  button { width: 100%; padding: 0.75rem 1rem; font-size: 1rem; border-radius: 8px;
    border: 1px solid color-mix(in srgb, CanvasText 25%, transparent); cursor: pointer; }
  button.primary { background: #1a73e8; color: #fff; border-color: #1a73e8; }
  .row { display: flex; gap: 0.75rem; margin-top: 1rem; }
  ul { text-align: left; padding-left: 1.25rem; }
`;

function shell(title: string, inner: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><style>${PAGE_STYLE}</style></head>
<body><main>${inner}</main></body></html>`;
}

// better-auth's social sign-in endpoint returns the Google redirect URL as JSON
// rather than a 302, so the button posts via fetch and follows it. `callbackURL`
// resumes the OAuth authorize request once the user is authenticated.
export function signInHTML(callbackURL: string): string {
  return shell(
    'Sign in to Company Brain',
    `<h1>Company Brain</h1>
    <button class="primary" id="google">Continue with Google</button>
    <script>
      document.getElementById('google').addEventListener('click', async () => {
        const res = await fetch('/api/auth/sign-in/social', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ provider: 'google', callbackURL: ${JSON.stringify(callbackURL)} }),
        });
        const data = await res.json();
        if (data.url) { window.location.href = data.url; }
      });
    </script>`,
  );
}

// The consent endpoint verifies the signed authorize request the page was
// redirected with, so accept/deny replay this page's full query string as
// `oauth_query` and follow the returned `url` back to the client. better-auth
// answers a browser fetch with `{ redirect, url }` (200) rather than a 302.
export function consentHTML(clientName: string, scopes: string[]): string {
  const scopeItems = scopes.map((scope) => `<li>${escapeHtml(scope)}</li>`).join('');
  return shell(
    'Authorize access',
    `<h1>${escapeHtml(clientName)} wants access</h1>
    <ul>${scopeItems}</ul>
    <div class="row">
      <button id="deny">Deny</button>
      <button id="allow" class="primary">Allow</button>
    </div>
    <script>
      async function consent(accept) {
        const res = await fetch('/api/auth/oauth2/consent', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ accept, oauth_query: window.location.search.replace(/^\\?/, '') }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.url) { window.location.href = data.url; }
      }
      document.getElementById('allow').addEventListener('click', () => consent(true));
      document.getElementById('deny').addEventListener('click', () => consent(false));
    </script>`,
  );
}
