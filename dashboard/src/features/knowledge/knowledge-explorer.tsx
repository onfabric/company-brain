import { useQuery } from '@tanstack/react-query';
import { Home, KeyRound, Loader2, RefreshCw } from 'lucide-react';
import type { ReactNode, SyntheticEvent } from 'react';
import { Button } from '#/components/ui/button.tsx';
import { Card } from '#/components/ui/card.tsx';
import {
  BrainApiError,
  createKnowledgeBrowserSession,
  type KnowledgePreview,
  listKnowledge,
  listKnowledgeTypes,
} from '#/lib/brain-functions.ts';
import { HTTP_UNAUTHORIZED } from '#/lib/constants.ts';
import type { RecordsRouteSearch } from '#/lib/records-search.ts';

type KnowledgeExplorerProps = {
  apiKey: string;
  apiKeyVersion: number;
  search: RecordsRouteSearch;
  onChange: (next: Partial<RecordsRouteSearch>) => void;
  onChangeApiKey: () => void;
};

const KNOWLEDGE_PAGE_PATH_PATTERN =
  /^\/knowledge\/pages\/(?<id>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const KNOWLEDGE_INDEX_PAGE_PATH = '/knowledge/pages/index';
const KNOWLEDGE_INDEX_TYPE = 'index';
const KNOWLEDGE_INDEX_LIMIT = 2;

export function KnowledgeExplorer({
  apiKey,
  apiKeyVersion,
  search,
  onChange,
  onChangeApiKey,
}: KnowledgeExplorerProps) {
  const sessionQuery = useQuery({
    queryKey: ['knowledge-browser-session', apiKeyVersion],
    queryFn: () => createKnowledgeBrowserSession(apiKey),
    retry: false,
  });
  const indexQuery = useQuery({
    queryKey: ['knowledge-index-page', apiKeyVersion],
    queryFn: () => getKnowledgeIndex(apiKey),
    retry: false,
  });
  const selectedKnowledgeId = search.selectedKnowledgeId;
  const indexKnowledgeId = indexQuery.data?.id;
  const frameKnowledgeId = selectedKnowledgeId ?? indexKnowledgeId;
  const error = sessionQuery.error ?? indexQuery.error;

  const openIndex = () => {
    onChange({ tab: 'knowledge', selectedKnowledgeId: undefined });
  };

  const handleFrameLoad = (event: SyntheticEvent<HTMLIFrameElement>) => {
    const path = knowledgePathFromFrame(event.currentTarget);
    if (path === KNOWLEDGE_INDEX_PAGE_PATH) {
      openIndex();
      return;
    }

    const id = knowledgeIdFromPath(path);
    if (id === indexKnowledgeId && selectedKnowledgeId) {
      openIndex();
      return;
    }
    if (id && id !== selectedKnowledgeId) {
      onChange({ tab: 'knowledge', selectedKnowledgeId: id });
    }
  };

  return (
    <section className="flex min-h-0 flex-1 overflow-hidden p-4">
      <Card className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-end gap-2 border-b px-3 py-3">
          <Button
            type="button"
            size="icon"
            variant="outline"
            title="Open knowledge index"
            onClick={openIndex}
          >
            <Home />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            title="Refresh session"
            onClick={() => void sessionQuery.refetch()}
          >
            <RefreshCw />
          </Button>
        </div>

        <div className="min-h-0 flex-1">
          {sessionQuery.isLoading || indexQuery.isLoading ? (
            <FrameState
              icon={<Loader2 className="size-5 animate-spin" />}
              text="Opening session..."
            />
          ) : error ? (
            <PanelError
              title={sessionQuery.isError ? 'Could not open session' : 'Could not load index'}
              error={error}
              onChangeApiKey={onChangeApiKey}
            />
          ) : (
            <iframe
              key={frameKnowledgeId}
              title="Knowledge page"
              src={knowledgePageSrc(frameKnowledgeId)}
              className="h-full min-h-0 w-full border-0 bg-background"
              referrerPolicy="no-referrer"
              onLoad={handleFrameLoad}
            />
          )}
        </div>
      </Card>
    </section>
  );
}

async function getKnowledgeIndex(apiKey: string): Promise<KnowledgePreview> {
  const types = await listKnowledgeTypes(apiKey);
  const indexType = types.knowledge_types.find(
    (type) => type.name.toLowerCase() === KNOWLEDGE_INDEX_TYPE,
  );
  if (!indexType) {
    throw new Error('Knowledge index type not found.');
  }

  const indexPage = await listKnowledge(apiKey, {
    knowledgeTypeId: indexType.id,
    limit: KNOWLEDGE_INDEX_LIMIT,
  });
  const [index] = indexPage.results;
  if (!index) {
    throw new Error('Knowledge index not found.');
  }
  if (indexPage.results.length > 1) {
    throw new Error('More than one knowledge index page found.');
  }
  return index;
}

function knowledgePageSrc(id: string | undefined) {
  return id ? `/knowledge/pages/${id}` : KNOWLEDGE_INDEX_PAGE_PATH;
}

function knowledgePathFromFrame(frame: HTMLIFrameElement) {
  try {
    return frame.contentWindow?.location.pathname;
  } catch {
    return undefined;
  }
}

function knowledgeIdFromPath(path: string | undefined) {
  return path?.match(KNOWLEDGE_PAGE_PATH_PATTERN)?.groups?.id;
}

function FrameState({ icon, text }: { icon?: ReactNode; text: string }) {
  return (
    <div className="grid h-full min-h-0 flex-1 place-items-center p-8 text-muted-foreground text-sm">
      <div className="flex items-center gap-2">
        {icon}
        <span>{text}</span>
      </div>
    </div>
  );
}

function PanelError({
  title,
  error,
  onChangeApiKey,
}: {
  title: string;
  error: Error;
  onChangeApiKey: () => void;
}) {
  const isAuthError = error instanceof BrainApiError && error.status === HTTP_UNAUTHORIZED;

  return (
    <div className="grid h-full min-h-0 flex-1 place-items-center p-8 text-center">
      <div className="max-w-xl">
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-2 text-muted-foreground text-sm">{error.message}</p>
        {isAuthError ? (
          <Button type="button" className="mt-4" onClick={onChangeApiKey}>
            <KeyRound />
            Enter API key
          </Button>
        ) : null}
      </div>
    </div>
  );
}
