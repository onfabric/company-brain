# syntax=docker/dockerfile:1-labs

# Build context must be the monorepo root. Build from the monorepo root with:
#   docker build -f backend/Dockerfile -t company-brain/brain .

FROM oven/bun:1.3.14-slim AS base
WORKDIR /monorepo

# Cache deps in a temp directory. Copy only the workspace manifests + lockfile
# so this layer is reused whenever source changes but dependencies don't.
FROM base AS install
WORKDIR /temp/deps
COPY package.json bun.lock ./
COPY --parents agent-sync/package.json backend/package.json dashboard/package.json nango-integrations/package.json ./
RUN bun install --frozen-lockfile

FROM base AS build
COPY --from=install /temp/deps ./
COPY backend backend
COPY dashboard dashboard
WORKDIR /monorepo/backend
ENV NODE_ENV=production
RUN bun run build

# Distroless `:debug` for the bundled busybox (wget) used by HEALTHCHECK.
FROM gcr.io/distroless/base-debian12:debug AS release
WORKDIR /app
COPY --from=build /monorepo/backend/dist/ ./
ENV NODE_ENV=production
EXPOSE 3010/tcp
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["/busybox/wget", "-q", "--spider", "http://localhost:3010/health"]
ENTRYPOINT ["/app/server"]
