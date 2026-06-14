import { createFileRoute, redirect } from '@tanstack/react-router';
import { AuthCard } from '#/features/auth/auth-card.tsx';
import { approveConsent } from '#/features/auth/oauth.ts';

// Access is already gated by workspace-restricted Google sign-in, so the consent
// step carries no extra decision: approve it as the route loads and redirect back
// to the client. better-auth answers with an absolute client `url`, which
// `redirect({ href })` follows as a full-document navigation.
//
// Read the OAuth query from `window.location.search`, not the router's parsed
// search: better-auth signs it with repeated `ba_param` keys, which the router's
// search parser collapses into a single JSON-array value and breaks the signature.
// better-auth only ever reaches this page via a full-document redirect, so
// `window.location.search` is the verbatim signed query.
//
// The grant is single-use, but `beforeLoad` can run more than once per page load
// (router load/validation lifecycle). Memoise the request so it fires exactly
// once: a duplicate call would fail — the grant is already spent — and flash a
// spurious error over the (successful) redirect.
let grant: Promise<string | null> | undefined;

export const Route = createFileRoute('/consent')({
  beforeLoad: async () => {
    grant ??= approveConsent(window.location.search);
    const url = await grant;
    if (!url) {
      throw new Error('Could not complete authorization. Please try again.');
    }
    throw redirect({ href: url });
  },
  pendingMs: 0,
  pendingComponent: () => <ConsentStatus>Authorizing…</ConsentStatus>,
  errorComponent: ({ error }) => <ConsentStatus>{error.message}</ConsentStatus>,
});

function ConsentStatus({ children }: { children: string }) {
  return (
    <AuthCard title="Company Brain">
      <p className="text-center text-muted-foreground text-sm">{children}</p>
    </AuthCard>
  );
}
