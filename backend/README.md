# backend — Data Transformation Service ("brain")

Bun + Elysia service that owns the `brain` Postgres schema in the same database
Nango uses. It runs ordered SQL migrations on startup (before accepting
traffic), then serves the HTTP API. Follows the service/repository pattern.

## Develop

```sh
cp .env.example .env   # point DATABASE_URL at a running Postgres
bun run start
bun test
bun run check:types
```

## MCP

`POST /mcp` is a stateless [Streamable HTTP MCP](https://modelcontextprotocol.io)
endpoint exposing knowledge pages, structured knowledge CRUD, knowledge type
management, and source-record discovery to agents. It is OAuth-gated; the REST
`api-key` header is not accepted on `/mcp`.

Discovery tools:

- `get_index_page`, `get_page` — read navigable HTML knowledge pages.
- `get_knowledge_types` — find exact type names for knowledge tools.
- `get_people` — find exact person names or emails for knowledge tools and
  readable people filters for records.
- `get_data_sources`, `get_records` — discover source records.

Knowledge tools:

- `search_knowledge`, `get_knowledge`
- `create_knowledge`, `update_knowledge`, `delete_knowledge`
- `create_knowledge_type`, `update_knowledge_type`

Knowledge tools use exact `knowledge_type` names, exact `people` names or
emails, and `record_ids`; discover those values before writing. Paginated MCP
tools cap `limit` at 50.

Example client configuration:

```json
{
  "mcpServers": {
    "company-brain": {
      "type": "http",
      "url": "https://brain-dev.onfabric.io/mcp"
    }
  }
}
```

## Auth

The REST API accepts either the `Api-Key` header or a better-auth session cookie
(Google sign-in, restricted to the workspace domain). API keys are managed via
`/api/api-keys` (create returns the full key once; only its SHA-256 hash is
stored) and verified by hashing the incoming header and looking it up in
`brain.api_keys`. The dashboard SPA relies on
the session cookie: when a request is unauthenticated it redirects the browser to
the dashboard's `/sign-in` page, which signs in with Google and returns to the
`callbackURL`. The OAuth login and consent prompts are dashboard routes too
(`/sign-in`, `/consent`); better-auth redirects into the SPA, which reads the
appended authorize query client-side. `/mcp` stays OAuth-only and never accepts
the `Api-Key` header.

## Build

`bun run build` compiles a standalone binary to `dist/server` and copies the
SQL migrations next to it. The `backend/Dockerfile` (built from the monorepo
root) ships that binary on a distroless image.

See [`AGENTS.md`](AGENTS.md) for the code layout and conventions.
