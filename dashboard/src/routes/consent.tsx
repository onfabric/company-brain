import { createFileRoute, redirect } from '@tanstack/react-router';
import { AuthCard } from '#/features/auth/auth-card.tsx';
import { approveConsent } from '#/features/auth/oauth.ts';
import { SIGNED_QUERY } from '#/features/auth/signed-query.ts';

// Access is already gated by workspace-restricted Google sign-in, so the consent
// step carries no extra decision: approve it as the route loads and redirect back
// to the client. better-auth answers with an absolute client `url`, which
// `redirect({ href })` follows as a full-document navigation.
export const Route = createFileRoute('/consent')({
  beforeLoad: async () => {
    const url = await approveConsent(SIGNED_QUERY);
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
