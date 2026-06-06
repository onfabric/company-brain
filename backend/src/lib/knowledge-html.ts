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
  "frame-ancestors 'self'",
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
  const updatedLabel = escapeHtml(formatUpdatedAt(item.updated_at));

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
      :root {
        color-scheme: light;
        --bg: #fafafa;
        --surface: #ffffff;
        --text: #171717;
        --muted: #737373;
        --border: #e5e5e5;
        --accent: #94e3a4;
        --accent-ink: #15803d;
        --code-bg: #f5f5f5;
        --sans: "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        --mono: ui-monospace, "Geist Mono", SFMono-Regular, Menlo, Consolas, monospace;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font-family: var(--sans);
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
      }
      main { max-width: 72ch; margin: 0 auto; padding: 72px 24px 96px; }
      header.brand { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 2.25rem; }
      header.brand .dot {
        width: 0.55rem; height: 0.55rem; border-radius: 50%;
        background: var(--accent);
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 22%, transparent);
      }
      header.brand .label {
        font-size: 0.72rem; font-weight: 600; letter-spacing: 0.14em;
        text-transform: uppercase; color: var(--muted);
      }
      h1 {
        margin: 0 0 1.6rem;
        font-size: clamp(2rem, 1.4rem + 2.2vw, 2.7rem);
        font-weight: 700; line-height: 1.08; letter-spacing: -0.022em;
      }
      h1::after {
        content: ""; display: block; width: 2.5rem; height: 4px;
        margin-top: 1rem; border-radius: 999px; background: var(--accent);
      }
      article { font-size: 1.0625rem; line-height: 1.72; }
      article > :first-child { margin-top: 0; }
      article p { margin: 1rem 0; }
      article h2 {
        margin: 2.75rem 0 1rem; padding-bottom: 0.4rem;
        font-size: 1.32rem; font-weight: 650; letter-spacing: -0.012em;
        border-bottom: 1px solid var(--border);
      }
      article h3 { margin: 2rem 0 0.75rem; font-size: 1.1rem; font-weight: 620; }
      article section { margin: 0 0 2rem; }
      article ul, article ol { padding-left: 1.3rem; }
      article li { margin: 0.35rem 0; }
      article li::marker { color: var(--muted); }
      a {
        color: var(--accent-ink); font-weight: 500;
        text-decoration: underline; text-decoration-color: var(--accent);
        text-decoration-thickness: 2px; text-underline-offset: 0.18em;
        border-radius: 3px; transition: background-color 0.12s ease;
      }
      a:hover { background: color-mix(in srgb, var(--accent) 28%, transparent); }
      mark { background: color-mix(in srgb, var(--accent) 45%, transparent); color: inherit; padding: 0 0.15em; border-radius: 3px; }
      img { max-width: 100%; height: auto; border-radius: 8px; }
      figure { margin: 1.5rem 0; }
      figcaption { margin-top: 0.5rem; font-size: 0.85rem; color: var(--muted); }
      time { color: var(--muted); }
      code { font-family: var(--mono); font-size: 0.9em; background: var(--code-bg); padding: 0.12em 0.35em; border-radius: 4px; }
      pre { overflow-x: auto; padding: 16px; border-radius: 10px; background: var(--code-bg); border: 1px solid var(--border); }
      pre code { background: none; padding: 0; }
      blockquote {
        margin: 1.5rem 0; padding: 0.25rem 0 0.25rem 1.1rem;
        border-left: 3px solid var(--accent); color: var(--muted);
      }
      table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: 0.95rem; }
      th, td { text-align: left; padding: 0.55rem 0.75rem; border-bottom: 1px solid var(--border); }
      th { font-weight: 600; color: var(--muted); font-size: 0.82rem; letter-spacing: 0.02em; text-transform: uppercase; }
      details { margin: 1rem 0; padding: 0.5rem 0.9rem; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
      summary { cursor: pointer; font-weight: 550; }
      footer.meta {
        margin-top: 4rem; padding-top: 1.25rem; border-top: 1px solid var(--border);
        font-family: var(--mono); font-size: 0.78rem; color: var(--muted);
      }

      /* Component kit — opt-in via class, used by richer knowledge entries. */
      article hr.rule { border: none; border-top: 1px solid var(--border); margin: 2rem 0; }
      article .lede { font-size: 1.2rem; line-height: 1.6; color: var(--text); margin: 0 0 0.6rem; }
      article .meta-line { font-family: var(--mono); font-size: 0.8rem; color: var(--muted); margin: 0.2rem 0 0; }
      article .muted { color: var(--muted); }

      .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.85rem; margin: 1.75rem 0; }
      .stat { border: 1px solid var(--border); border-radius: 14px; padding: 1rem 1.1rem; background: var(--surface); min-width: 0; }
      .stat .k { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
      .stat .v { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; line-height: 1.15; margin: 0.4rem 0 0.2rem; overflow-wrap: anywhere; word-break: break-word; hyphens: auto; }
      .stat .v code { font-size: 0.82em; background: none; padding: 0; }
      .stat .d { font-size: 0.84rem; color: var(--muted); line-height: 1.45; overflow-wrap: anywhere; }
      .stat.accent .v { color: var(--accent-ink); }
      .stat.warn .v { color: #b91c1c; }

      ol.timeline, ul.timeline { list-style: none; padding: 0; margin: 1.5rem 0 0; }
      .timeline > li { position: relative; padding: 0 0 1.7rem 1.6rem; border-left: 2px solid var(--border); margin-left: 5px; }
      .timeline > li:last-child { padding-bottom: 0.2rem; }
      .timeline > li::before { content: ""; position: absolute; left: -7px; top: 0.3rem; width: 12px; height: 12px; border-radius: 50%; background: var(--surface); border: 2px solid var(--accent); }
      .timeline > li.is-start::before { border-color: #2563eb; }
      .timeline > li.is-end::before { border-color: #dc2626; }
      .timeline .t-title { font-weight: 650; font-size: 1.05rem; margin: 0.35rem 0; }
      .timeline .t-body { margin: 0.2rem 0; }

      .tag { display: inline-block; font-size: 0.66rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 0.18em 0.55em; border-radius: 999px; background: color-mix(in srgb, var(--accent) 24%, transparent); color: var(--accent-ink); vertical-align: middle; white-space: nowrap; }
      .tag.blue { background: #dbeafe; color: #1d4ed8; }
      .tag.red { background: #fee2e2; color: #b91c1c; }
      .tag.gray { background: #f0f0f0; color: var(--muted); }

      .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 1rem; margin: 1.5rem 0; }
      .card { border: 1px solid var(--border); border-radius: 14px; padding: 1.1rem 1.2rem; background: var(--surface); min-width: 0; }
      .card h3 { margin: 0.1rem 0 0.5rem; font-size: 1.05rem; border: none; padding: 0; overflow-wrap: anywhere; }
      .card p { margin: 0.3rem 0; font-size: 0.95rem; overflow-wrap: anywhere; }
      .card .sub { font-size: 0.84rem; color: var(--muted); }
      .meta-line { overflow-wrap: anywhere; }
      .meta-line code, article p code, li code { overflow-wrap: anywhere; word-break: break-word; }
    </style>
  </head>
  <body>
    <main>
      <header class="brand"><span class="dot" aria-hidden="true"></span><span class="label">Company Brain</span></header>
      <article>
        <h1>${title}</h1>
        ${body}
      </article>
      <footer class="meta">Updated <time datetime="${escapeHtml(item.updated_at)}">${updatedLabel}</time></footer>
    </main>
  </body>
</html>`;
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
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
                ...(match?.groups?.id ? { target: '_self' } : {}),
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
