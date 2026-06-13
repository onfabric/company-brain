import { useEffect, useState } from 'react';
import { Button } from '#/components/ui/button.tsx';
import { AuthCard } from '#/features/auth/auth-card.tsx';
import {
  fetchClientName,
  parseClientId,
  parseScopes,
  submitConsent,
} from '#/features/auth/oauth.ts';

export function ConsentView() {
  const [search] = useState(() => window.location.search);
  const [scopes] = useState(() => parseScopes(search));
  const [clientName, setClientName] = useState(() => parseClientId(search));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchClientName(parseClientId(search)).then((name) => {
      if (active) {
        setClientName(name);
      }
    });
    return () => {
      active = false;
    };
  }, [search]);

  async function decide(accept: boolean) {
    setPending(true);
    setError(null);
    try {
      const url = await submitConsent(accept, search);
      if (url) {
        window.location.href = url;
        return;
      }
      setError('Could not record your choice. Please try again.');
    } catch {
      setError('Could not record your choice. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthCard title={`${clientName} wants access`}>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground text-sm">
        {scopes.map((scope) => (
          <li key={scope}>{scope}</li>
        ))}
      </ul>
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={pending}
          onClick={() => void decide(false)}
        >
          Deny
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={pending}
          onClick={() => void decide(true)}
        >
          Allow
        </Button>
      </div>
      {error ? <p className="text-center text-destructive text-sm">{error}</p> : null}
    </AuthCard>
  );
}
