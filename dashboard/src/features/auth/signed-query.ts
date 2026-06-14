// better-auth signs the OAuth authorize/consent query with repeated `ba_param`
// keys, but the router's search parser collapses repeated keys into a single
// JSON-array value (and re-encodes), which breaks the signature. Capture the
// verbatim query string at module load — before the router mounts and can
// normalize the URL — so the auth pages can replay it untouched. Both auth routes
// are entered via better-auth's full-document redirects, so this evaluates once
// with the original query.
export const SIGNED_QUERY = typeof window === 'undefined' ? '' : window.location.search;
