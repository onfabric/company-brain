import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card.tsx';

export function AuthCard({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">{children}</CardContent>
      </Card>
    </main>
  );
}
