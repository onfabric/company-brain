import { KeyRound } from 'lucide-react';
import { ApiKeysManager } from '#/features/settings/api-keys-manager.tsx';

export function SettingsView({ currentUserId }: { currentUserId?: string }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-auto p-4">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-6">
          <h2 className="font-semibold text-2xl">Settings</h2>
        </header>

        <nav className="mb-6 flex gap-2 border-b">
          <span className="-mb-px flex items-center gap-2 border-primary border-b-2 px-1 pb-3 font-medium text-sm">
            <KeyRound className="size-4" />
            API keys
          </span>
        </nav>

        <ApiKeysManager currentUserId={currentUserId} />
      </div>
    </section>
  );
}
