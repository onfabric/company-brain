import type { MCPServer } from 'mcp-use/server';
import { z } from 'zod';
import { readJson, readText } from '#lib/knowledge-mcp/respond.ts';
import {
  KNOWLEDGE_WORKFLOW_NAMES,
  listKnowledgeWorkflows,
  readKnowledgeWorkflow,
} from '#lib/knowledge-mcp/workflows.ts';

export type KnowledgeWorkflowToolOptions = {
  docsRoot?: string;
};

export function registerKnowledgeWorkflowTools(
  server: MCPServer<true>,
  options: KnowledgeWorkflowToolOptions = {},
) {
  server.tool(
    {
      name: 'list_knowledge_workflows',
      description:
        'List the knowledge-authoring workflows available to agents before creating or updating knowledge pages.',
      annotations: { readOnlyHint: true },
    },
    () => readJson(() => listKnowledgeWorkflows(options.docsRoot)),
  );

  server.tool(
    {
      name: 'get_knowledge_workflow',
      description:
        'Read the full Markdown instructions for a knowledge-authoring workflow. Call this before creating or updating knowledge pages.',
      schema: z.object({
        name: z
          .enum(KNOWLEDGE_WORKFLOW_NAMES)
          .describe('Workflow name from list_knowledge_workflows.'),
      }),
      annotations: { readOnlyHint: true },
    },
    ({ name }) =>
      readText(() => readKnowledgeWorkflow(name, options.docsRoot), 'knowledge workflow'),
  );
}
