import { useQuery } from '@tanstack/react-query';
import { Home, Loader2, RefreshCw } from 'lucide-react';
import type { ReactNode, SyntheticEvent } from 'react';
import { Button } from '#/components/ui/button.tsx';
import { Card } from '#/components/ui/card.tsx';
import { type KnowledgePreview, listKnowledge, listKnowledgeTypes } from '#/lib/brain-functions.ts';
import type { RecordsRouteSearch } from '#/lib/records-search.ts';

type KnowledgeExplorerProps = {
  search: RecordsRouteSearch;
  onChange: (next: Partial<RecordsRouteSearch>) => void;
};

const KNOWLEDGE_PAGE_PATH_PATTERN =
  /^\/knowledge\/pages\/(?<id>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const KNOWLEDGE_INDEX_PAGE_PATH = '/knowledge/pages/index';
const KNOWLEDGE_INDEX_TYPE = 'index';
const KNOWLEDGE_INDEX_LIMIT = 2;

export function KnowledgeExplorer({ search, onChange }: KnowledgeExplorerProps) {
  const indexQuery = useQuery({
    queryKey: ['knowledge-index-page'],
    queryFn: () => getKnowledgeIndex(),
    retry: false,
  });
  const selectedKnowledgeId = search.selectedKnowledgeId;
  const indexKnowledgeId = indexQuery.data?.id;
  const frameKnowledgeId = selectedKnowledgeId ?? indexKnowledgeId;

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
            title="Reload page"
            onClick={() => void indexQuery.refetch()}
          >
            <RefreshCw />
          </Button>
        </div>

        <div className="min-h-0 flex-1">
          {indexQuery.isLoading ? (
            <FrameState
              icon={<Loader2 className="size-5 animate-spin" />}
              text="Loading index..."
            />
          ) : indexQuery.isError ? (
            <PanelError title="Could not load index" error={indexQuery.error} />
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

async function getKnowledgeIndex(): Promise<KnowledgePreview> {
  const types = await listKnowledgeTypes();
  const indexType = types.knowledge_types.find(
    (type) => type.name.toLowerCase() === KNOWLEDGE_INDEX_TYPE,
  );
  if (!indexType) {
    throw new Error('Knowledge index type not found.');
  }

  const indexPage = await listKnowledge({
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

function PanelError({ title, error }: { title: string; error: Error }) {
  return (
    <div className="grid h-full min-h-0 flex-1 place-items-center p-8 text-center">
      <div className="max-w-xl">
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-2 text-muted-foreground text-sm">{error.message}</p>
      </div>
    </div>
  );
}
