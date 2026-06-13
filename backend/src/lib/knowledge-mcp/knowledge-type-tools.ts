import type { MCPServer } from 'mcp-use/server';
import { z } from 'zod';
import { readJson } from '#lib/knowledge-mcp/respond.ts';
import type { KnowledgeTypesReader } from '#lib/knowledge-mcp/types.ts';

export function registerKnowledgeTypeTools(
  server: MCPServer<true>,
  knowledgeTypes: KnowledgeTypesReader,
) {
  server.tool(
    {
      name: 'get_knowledge_types',
      description:
        'List knowledge types as JSON. Use these ids when creating or updating knowledge items.',
      annotations: { readOnlyHint: true },
    },
    () => readJson(async () => ({ knowledge_types: await knowledgeTypes.list() })),
  );

  server.tool(
    {
      name: 'create_knowledge_type',
      description: 'Create a knowledge type. The name must be unique.',
      schema: z.object({
        name: z.string().min(1).describe('Unique name of the knowledge type.'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    ({ name }) => readJson(() => knowledgeTypes.create(name)),
  );

  server.tool(
    {
      name: 'update_knowledge_type',
      description: 'Rename a knowledge type. The new name must be unique.',
      schema: z.object({
        id: z.uuid().describe('Knowledge type id.'),
        name: z.string().min(1).describe('New name for the knowledge type.'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    ({ id, name }) => readJson(() => knowledgeTypes.update(id, name)),
  );
}
