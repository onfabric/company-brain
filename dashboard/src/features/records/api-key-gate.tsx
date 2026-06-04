import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { Button } from '#/components/ui/button.tsx';
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card.tsx';
import { Input } from '#/components/ui/input.tsx';
import { Label } from '#/components/ui/label.tsx';

type ApiKeyGateProps = {
  onSubmit: (apiKey: string) => void;
};

export function ApiKeyGate({ onSubmit }: ApiKeyGateProps) {
  const [draft, setDraft] = useState('');
  const trimmed = draft.trim();

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Company Brain Records</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (trimmed) {
                onSubmit(trimmed);
              }
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="brain-api-key">Brain API key</Label>
              <Input
                id="brain-api-key"
                type="password"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Paste API key"
                autoComplete="off"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={!trimmed}>
              <KeyRound />
              View records
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
