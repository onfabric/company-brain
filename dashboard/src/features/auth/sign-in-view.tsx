import { useMutation } from '@tanstack/react-query';
import { Button } from '#/components/ui/button.tsx';
import { AuthCard } from '#/features/auth/auth-card.tsx';
import { resolveSignInTarget, startGoogleSignIn } from '#/features/auth/oauth.ts';

export function SignInView() {
  const signIn = useMutation({
    mutationFn: async () => {
      const url = await startGoogleSignIn(resolveSignInTarget(window.location.search));
      if (!url) {
        throw new Error('No sign-in URL returned.');
      }
      return url;
    },
    onSuccess: (url) => {
      window.location.href = url;
    },
  });

  return (
    <AuthCard title="Company Brain">
      <Button type="button" disabled={signIn.isPending} onClick={() => signIn.mutate()}>
        Continue with Google
      </Button>
      {signIn.isError ? (
        <p className="text-center text-destructive text-sm">
          Could not start Google sign-in. Please try again.
        </p>
      ) : null}
    </AuthCard>
  );
}
