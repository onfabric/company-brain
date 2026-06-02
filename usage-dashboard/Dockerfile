# syntax=docker/dockerfile:1-labs

# Build context must be the monorepo root. Build from the monorepo root with:
#   docker build -f usage-dashboard/Dockerfile -t company-brain/usage-dashboard .

FROM oven/bun:1.3.14-slim AS base
WORKDIR /monorepo

FROM base AS install
WORKDIR /temp/deps
COPY package.json bun.lock ./
COPY --parents agent-sync/package.json backend/package.json nango-integrations/package.json usage-dashboard/package.json ./
RUN bun install --frozen-lockfile

FROM base AS build
COPY --from=install /temp/deps ./
COPY usage-dashboard usage-dashboard
WORKDIR /monorepo/usage-dashboard
ENV NODE_ENV=production
RUN bun run build

FROM gcr.io/distroless/base-debian12:debug AS release
WORKDIR /app
COPY --from=build /monorepo/usage-dashboard/dist/ ./
ENV NODE_ENV=production
EXPOSE 3011/tcp
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["/busybox/wget", "-q", "--spider", "http://localhost:3011/health"]
ENTRYPOINT ["/app/server"]
