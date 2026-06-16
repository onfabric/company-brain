import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, KeyRound, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '#/components/ui/button.tsx';
import { Card, CardContent } from '#/components/ui/card.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx';
import { Input } from '#/components/ui/input.tsx';
import { Label } from '#/components/ui/label.tsx';
import { Skeleton } from '#/components/ui/skeleton.tsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '#/components/ui/tooltip.tsx';
import {
  type ApiKey,
  createApiKey,
  deleteApiKey,
  listApiKeys,
  updateApiKey,
} from '#/lib/brain-functions.ts';
import { DATE_TIME_FORMAT_OPTIONS, EMPTY_COUNT } from '#/lib/constants.ts';

const API_KEYS_QUERY_KEY = ['api-keys'];
const SKELETON_ROW_KEYS = Array.from({ length: 3 }, (_, i) => `api-key-skeleton-${i}`);

export function ApiKeysManager({ currentUserId }: { currentUserId?: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: API_KEYS_QUERY_KEY,
    queryFn: listApiKeys,
  });

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<ApiKey>();
  const [deleteTarget, setDeleteTarget] = useState<ApiKey>();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: API_KEYS_QUERY_KEY });
  const apiKeys = data?.api_keys ?? [];

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h3 className="font-medium">API keys</h3>
          <p className="text-muted-foreground text-sm">
            Keys authenticate programmatic access to the brain API.
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus />
          Create API key
        </Button>
      </div>

      <CardContent className="p-0">
        {error ? (
          <p className="p-6 text-destructive text-sm">{error.message}</p>
        ) : isLoading ? (
          <div className="grid gap-3 p-4">
            {SKELETON_ROW_KEYS.map((key) => (
              <Skeleton key={key} className="h-10 w-full" />
            ))}
          </div>
        ) : apiKeys.length === EMPTY_COUNT ? (
          <EmptyState />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead className="w-[12rem]">Created</TableHead>
                <TableHead className="w-[10rem] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys.map((apiKey) => (
                <ApiKeyRow
                  key={apiKey.id}
                  apiKey={apiKey}
                  isOwner={apiKey.created_by === currentUserId}
                  onRename={() => setRenameTarget(apiKey)}
                  onDelete={() => setDeleteTarget(apiKey)}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <CreateApiKeyDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={() => void invalidate()}
      />
      <RenameApiKeyDialog
        apiKey={renameTarget}
        onClose={() => setRenameTarget(undefined)}
        onRenamed={() => void invalidate()}
      />
      <DeleteApiKeyDialog
        apiKey={deleteTarget}
        onClose={() => setDeleteTarget(undefined)}
        onDeleted={() => void invalidate()}
      />
    </Card>
  );
}

function ApiKeyRow({
  apiKey,
  isOwner,
  onRename,
  onDelete,
}: {
  apiKey: ApiKey;
  isOwner: boolean;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">{apiKey.name}</TableCell>
      <TableCell>
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          {apiKey.key_prefix}…
        </code>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {formatDate(apiKey.created_at)}
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-2">
          {isOwner ? (
            <Button type="button" size="sm" variant="outline" onClick={onRename}>
              <Pencil />
              Edit
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-disabled
                  className="cursor-not-allowed opacity-50 hover:bg-background hover:text-foreground"
                  onClick={(event) => event.preventDefault()}
                >
                  <Pencil />
                  Edit
                </Button>
              </TooltipTrigger>
              <TooltipContent>This key is owned by someone else.</TooltipContent>
            </Tooltip>
          )}
          <Button type="button" size="icon" variant="outline" title="Delete" onClick={onDelete}>
            <Trash2 />
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function CreateApiKeyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [createdKey, setCreatedKey] = useState<string>();

  const mutation = useMutation({
    mutationFn: () => createApiKey(name.trim()),
    onSuccess: (created) => {
      setCreatedKey(created.key);
      onCreated();
    },
  });

  const reset = () => {
    setName('');
    setCreatedKey(undefined);
    mutation.reset();
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      reset();
    }
    onOpenChange(next);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) {
      mutation.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {createdKey ? (
          <>
            <DialogHeader>
              <DialogTitle>API key created</DialogTitle>
              <DialogDescription>
                Copy this key now. For security, it cannot be shown again.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
              <code className="flex-1 break-all font-mono text-sm">{createdKey}</code>
              <CopyButton value={createdKey} />
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Create API key</DialogTitle>
              <DialogDescription>Give the key a name to recognise it later.</DialogDescription>
            </DialogHeader>
            <div className="my-4 grid gap-2">
              <Label htmlFor="api-key-name">Name</Label>
              <Input
                id="api-key-name"
                value={name}
                placeholder="e.g. CI pipeline"
                autoFocus
                onChange={(event) => setName(event.target.value)}
              />
              {mutation.error ? (
                <p className="text-destructive text-sm">{mutation.error.message}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || mutation.isPending}>
                {mutation.isPending ? <Loader2 className="animate-spin" /> : <KeyRound />}
                Create
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RenameApiKeyDialog({
  apiKey,
  onClose,
  onRenamed,
}: {
  apiKey?: ApiKey;
  onClose: () => void;
  onRenamed: () => void;
}) {
  return (
    <Dialog open={apiKey !== undefined} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        {apiKey ? (
          <RenameApiKeyForm
            key={apiKey.id}
            apiKey={apiKey}
            onCancel={onClose}
            onRenamed={() => {
              onRenamed();
              onClose();
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RenameApiKeyForm({
  apiKey,
  onCancel,
  onRenamed,
}: {
  apiKey: ApiKey;
  onCancel: () => void;
  onRenamed: () => void;
}) {
  const [name, setName] = useState(apiKey.name);

  const mutation = useMutation({
    mutationFn: (next: string) => updateApiKey(apiKey.id, next),
    onSuccess: onRenamed,
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed && trimmed !== apiKey.name) {
      mutation.mutate(trimmed);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Rename API key</DialogTitle>
        <DialogDescription>The key itself stays the same.</DialogDescription>
      </DialogHeader>
      <div className="my-4 grid gap-2">
        <Label htmlFor="rename-api-key">Name</Label>
        <Input
          id="rename-api-key"
          value={name}
          autoFocus
          onChange={(event) => setName(event.target.value)}
        />
        {mutation.error ? (
          <p className="text-destructive text-sm">{mutation.error.message}</p>
        ) : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!name.trim() || name.trim() === apiKey.name || mutation.isPending}
        >
          {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

function DeleteApiKeyDialog({
  apiKey,
  onClose,
  onDeleted,
}: {
  apiKey?: ApiKey;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const mutation = useMutation({
    mutationFn: () => deleteApiKey(apiKey?.id ?? ''),
    onSuccess: () => {
      onDeleted();
      onClose();
    },
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      mutation.reset();
      onClose();
    }
  };

  return (
    <Dialog open={apiKey !== undefined} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete API key</DialogTitle>
          <DialogDescription>
            Revoke <span className="font-medium text-foreground">{apiKey?.name}</span>? Requests
            using it will stop working immediately. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {mutation.error ? (
          <p className="text-destructive text-sm">{mutation.error.message}</p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      title="Copy"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), COPIED_RESET_MS);
        });
      }}
    >
      {copied ? <Check /> : <Copy />}
      <span className="sr-only">Copy API key</span>
    </Button>
  );
}

function EmptyState() {
  return (
    <div className="grid place-items-center gap-1 p-10 text-center">
      <KeyRound className="size-6 text-muted-foreground" />
      <p className="font-medium">No API keys yet</p>
      <p className="text-muted-foreground text-sm">Create one to access the brain API.</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, DATE_TIME_FORMAT_OPTIONS);
}

const COPIED_RESET_MS = 1500;
