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
endpoint exposing the knowledge pages to agents, gated by the same `api-key`
header as the REST API. Tools: `get_index_page` (the entry point — links every
page) and `get_page` (follows a `/knowledge/pages/{id}` link). Example client
configuration:

```json
{
  "mcpServers": {
    "company-brain": {
      "type": "http",
      "url": "https://brain-dev.onfabric.io/mcp",
      "headers": {
        "api-key": "<BRAIN_API_KEY>"
      }
    }
  }
}
```

## Build

`bun run build` compiles a standalone binary to `dist/server` and copies the
SQL migrations next to it. The `backend/Dockerfile` (built from the monorepo
root) ships that binary on a distroless image.

See [`AGENTS.md`](AGENTS.md) for the code layout and conventions.
