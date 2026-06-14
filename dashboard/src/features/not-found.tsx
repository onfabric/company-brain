import { Link } from '@tanstack/react-router';
import { Button } from '#/components/ui/button.tsx';

export function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <Button asChild>
          <Link to="/">Back to dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
