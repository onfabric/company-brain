import { useEffect, useRef, useState } from 'react';
import { AuthCard } from '#/features/auth/auth-card.tsx';
import { submitConsent } from '#/features/auth/oauth.ts';

// Access is already gated by workspace-restricted Google sign-in, so the consent
// step carries no extra decision for the user: approve it on render and follow the
// redirect back to the client. An error only surfaces if the grant itself fails.
export function ConsentView() {
  const [error, setError] = useState<string | null>(null);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current) {
      return;
    }
    submitted.current = true;
    void submitConsent(true, window.location.search)
      .then((url) => {
        if (url) {
          window.location.href = url;
          return;
        }
        setError('Could not complete authorization. Please try again.');
      })
      .catch(() => setError('Could not complete authorization. Please try again.'));
  }, []);

  return (
    <AuthCard title="Company Brain">
      <p className="text-center text-muted-foreground text-sm">{error ?? 'Authorizing…'}</p>
    </AuthCard>
  );
}
