import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const KNOWLEDGE_WORKFLOW_NAMES = [
  'build-knowledge-base',
  'research-knowledge-entity',
  'build-weekly-timeline',
] as const;

export type KnowledgeWorkflowName = (typeof KNOWLEDGE_WORKFLOW_NAMES)[number];

export type KnowledgeWorkflowSummary = {
  name: KnowledgeWorkflowName;
  title: string;
  description: string;
};

type Frontmatter = Partial<Record<'name' | 'description', string>>;

const FRONTMATTER_START = '---\n';
const FRONTMATTER_END = '\n---';
const FRONTMATTER_CONTENT_START = FRONTMATTER_START.length;
const DEFAULT_WORKFLOW_DOCS_ROOT = join(dirname(process.execPath), 'knowledge-workflows');

export async function listKnowledgeWorkflows(
  docsRoot = DEFAULT_WORKFLOW_DOCS_ROOT,
): Promise<{ workflows: KnowledgeWorkflowSummary[] }> {
  return {
    workflows: await Promise.all(
      KNOWLEDGE_WORKFLOW_NAMES.map(async (name) => summarizeWorkflow(docsRoot, name)),
    ),
  };
}

export function readKnowledgeWorkflow(
  name: KnowledgeWorkflowName,
  docsRoot = DEFAULT_WORKFLOW_DOCS_ROOT,
): Promise<string> {
  return readFile(workflowPath(docsRoot, name), 'utf8');
}

function summarizeWorkflow(
  docsRoot: string,
  name: KnowledgeWorkflowName,
): Promise<KnowledgeWorkflowSummary> {
  return readKnowledgeWorkflow(name, docsRoot).then((markdown) => {
    const frontmatter = parseFrontmatter(markdown);
    return {
      name,
      title: readH1(markdown) ?? frontmatter.name ?? name,
      description: frontmatter.description ?? '',
    };
  });
}

function workflowPath(docsRoot: string, name: KnowledgeWorkflowName): string {
  return join(docsRoot, name, 'SKILL.md');
}

function parseFrontmatter(markdown: string): Frontmatter {
  if (!markdown.startsWith(FRONTMATTER_START)) {
    return {};
  }
  const end = markdown.indexOf(FRONTMATTER_END, FRONTMATTER_CONTENT_START);
  if (end === -1) {
    return {};
  }
  return Object.fromEntries(
    markdown
      .slice(FRONTMATTER_CONTENT_START, end)
      .split('\n')
      .flatMap((line) => {
        const match = line.match(/^([^:]+):\s*(.*)$/);
        const key = match?.[1]?.trim();
        const value = match?.[2]?.trim() ?? '';
        return key ? [[key, value]] : [];
      }),
  );
}

function readH1(markdown: string): string | undefined {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
}
