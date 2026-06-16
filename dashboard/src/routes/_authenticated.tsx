import { createFileRoute, Link, type LinkProps, Outlet, redirect } from '@tanstack/react-router';
import { BookOpen, ChevronDown, FileText, LogOut, Settings, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '#/components/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu.tsx';
import { type AuthContext, signInUrl } from '#/lib/auth.ts';

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
          <UserMenu auth={auth} />
        </div>
      </header>

      <Outlet />
    </main>
  );
}

function UserMenu({ auth }: { auth: AuthContext }) {
  const user = auth.session?.user;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline">
          <span className="max-w-[12rem] truncate">{user?.name || user?.email || 'Account'}</span>
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {user?.email ? (
          <>
            <DropdownMenuLabel className="truncate text-muted-foreground">
              {user.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <Settings />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void auth.signOut()}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavTab({ to, icon, label }: { to: LinkProps['to']; icon: ReactNode; label: string }) {
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
