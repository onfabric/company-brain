import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router';
import { BookOpen, FileText, LogOut, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '#/components/ui/button.tsx';
import { signInUrl } from '#/lib/auth.ts';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context }) => {
    const session = await context.auth.ensureSession();
    if (!session) {
      throw redirect({ href: signInUrl() });
    }
  },
  component: AppShell,
});

function AppShell() {
  const { auth } = Route.useRouteContext();

  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      <header className="shrink-0 border-b bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-semibold text-lg">Company Brain</h1>
          <nav className="flex rounded-md border bg-background p-1">
            <NavTab to="/records" icon={<FileText />} label="Records" />
            <NavTab to="/people" icon={<Users />} label="People" />
            <NavTab to="/knowledge" icon={<BookOpen />} label="Knowledge" />
          </nav>
          <Button type="button" variant="outline" onClick={() => void auth.signOut()}>
            <LogOut />
            Log out
          </Button>
        </div>
      </header>

      <Outlet />
    </main>
  );
}

type NavPath = '/records' | '/people' | '/knowledge';

function NavTab({ to, icon, label }: { to: NavPath; icon: ReactNode; label: string }) {
  return (
    <Button
      asChild
      type="button"
      size="sm"
      variant="ghost"
      className="data-[status=active]:bg-secondary"
    >
      <Link to={to}>
        {icon}
        {label}
      </Link>
    </Button>
  );
}
