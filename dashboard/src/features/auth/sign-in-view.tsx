import { useState } from 'react';
import { Button } from '#/components/ui/button.tsx';
import { AuthCard } from '#/features/auth/auth-card.tsx';
import { resolveSignInTarget, startGoogleSignIn } from '#/features/auth/oauth.ts';

export function SignInView() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);
    try {
      const url = await startGoogleSignIn(resolveSignInTarget(window.location.search));
      if (url) {
        window.location.href = url;
        return;
      }
      setError('Could not start Google sign-in. Please try again.');
    } catch {
      setError('Could not start Google sign-in. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthCard title="Company Brain">
      <Button type="button" disabled={pending} onClick={() => void signIn()}>
        Continue with Google
      </Button>
      {error ? <p className="text-center text-destructive text-sm">{error}</p> : null}
    </AuthCard>
  );
}
