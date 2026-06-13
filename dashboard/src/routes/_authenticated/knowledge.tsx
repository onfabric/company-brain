import { createFileRoute } from '@tanstack/react-router';
import { KnowledgeExplorer } from '#/features/knowledge/knowledge-explorer.tsx';

type KnowledgeSearch = {
  selectedKnowledgeId?: string;
};

export const Route = createFileRoute('/_authenticated/knowledge')({
  validateSearch: (search: Record<string, unknown>): KnowledgeSearch => ({
    selectedKnowledgeId:
      typeof search.selectedKnowledgeId === 'string' && search.selectedKnowledgeId.length > 0
        ? search.selectedKnowledgeId
        : undefined,
  }),
  component: KnowledgeRoute,
});

function KnowledgeRoute() {
  const { selectedKnowledgeId } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <KnowledgeExplorer
      selectedKnowledgeId={selectedKnowledgeId}
      onSelect={(knowledgeId) => void navigate({ search: { selectedKnowledgeId: knowledgeId } })}
    />
  );
}
