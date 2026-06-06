import sanitizeHtml from 'sanitize-html';

const KNOWLEDGE_LINK_PATTERN =
  /^knowledge:(?<id>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

type SanitizeOptions = NonNullable<Parameters<typeof sanitizeHtml>[1]>;

type KnowledgeHtmlItem = {
  id: string;
  title: string;
  body: string;
  updated_at: string;
};

export const KNOWLEDGE_HTML_CSP = [
  "default-src 'none'",
  "script-src 'none'",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  'img-src https: data:',
  "style-src 'unsafe-inline'",
].join('; ');

export const KNOWLEDGE_HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'content-security-policy': KNOWLEDGE_HTML_CSP,
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cache-control': 'private, max-age=60',
};

export function knowledgePagePath(id: string): string {
  return `/knowledge/pages/${id}`;
}

export function sanitizeKnowledgeHtml(html: string): string {
  return sanitizeHtml(html, sanitizeOptions(false));
}

export function renderKnowledgeHtmlPage(item: KnowledgeHtmlItem): string {
  const body = sanitizeHtml(item.body, sanitizeOptions(true));
  const title = escapeHtml(item.title);
  const path = knowledgePagePath(item.id);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="knowledge-id" content="${escapeHtml(item.id)}">
    <meta name="updated-at" content="${escapeHtml(item.updated_at)}">
    <link rel="canonical" href="${escapeHtml(path)}">
    <title>${title}</title>
    <style>
      :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; background: Canvas; color: CanvasText; }
      main { max-width: 76ch; margin: 0 auto; padding: 48px 20px 64px; }
      h1 { margin: 0 0 24px; font-size: 2rem; line-height: 1.15; }
      article { font-size: 1rem; line-height: 1.65; }
      a { color: LinkText; text-underline-offset: 0.18em; }
      img { max-width: 100%; height: auto; }
      pre, code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      pre { overflow-x: auto; padding: 12px; background: color-mix(in srgb, CanvasText 8%, Canvas); }
      blockquote { margin-left: 0; padding-left: 16px; border-left: 3px solid color-mix(in srgb, CanvasText 28%, Canvas); }
    </style>
  </head>
  <body>
    <main>
      <article>
        <h1>${title}</h1>
        ${body}
      </article>
    </main>
  </body>
</html>`;
}

function sanitizeOptions(rewriteKnowledgeLinks: boolean): SanitizeOptions {
  return {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      'article',
      'aside',
      'details',
      'figcaption',
      'figure',
      'footer',
      'header',
      'img',
      'main',
      'mark',
      'section',
      'summary',
      'time',
    ],
    allowedAttributes: {
      '*': ['aria-describedby', 'aria-label', 'aria-labelledby', 'class', 'id', 'role', 'title'],
      a: ['href', 'name', 'rel', 'target', 'title'],
      img: ['alt', 'height', 'loading', 'src', 'srcset', 'title', 'width'],
      time: ['datetime'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: {
      a: ['http', 'https', 'mailto', 'tel', 'knowledge'],
      img: ['http', 'https', 'data'],
    },
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: rewriteKnowledgeLinks
      ? {
          a: (tagName, attribs) => {
            const href = attribs.href?.trim();
            const match = href?.match(KNOWLEDGE_LINK_PATTERN);
            const rewritten = match?.groups?.id ? knowledgePagePath(match.groups.id) : href;
            return {
              tagName,
              attribs: {
                ...attribs,
                ...(rewritten ? { href: rewritten } : {}),
              },
            };
          },
        }
      : undefined,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
